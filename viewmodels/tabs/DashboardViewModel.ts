/**
 * Dashboard ViewModel
 *
 * KEY FIXES:
 * - Properly detects active session by checking if user is currentUserId on any machine
 * - Tracks which machine the user is currently using
 * - Calculates real-time progress for active washing session
 */

import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import { Machine } from "@/domain/machine/Machine";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { auth } from "@/services/firebase";
import { subscribeMachinesRTDB, subscribeMachines } from "@/services/machine.service";

export type UserSession = {
  machineId: string;
  machineLocation?: string;
  startTime: Date;
  estimatedEndTime?: Date;
  progress: number; // 0-100
  timeRemaining: string; // "45 min remaining"
};

export function useDashboardViewModel() {
  const { dashboardRepository, queueRepository } = container;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queueData, setQueueData] = useState<Record<string, any>>({});
  const [queueCount, setQueueCount] = useState(0);
  const [userQueuePosition, setUserQueuePosition] = useState<number | null>(null);
  const [userQueueMachineId, setUserQueueMachineId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<UserSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueJoinedAt, setQueueJoinedAt] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<string | null>(null);

  const getCurrentUser = useCallback(() => auth.currentUser, []);
  const currentUserId = getCurrentUser()?.uid;

  // ── Subscribe to machines for real-time updates ─────────────────────────────
  // Dual subscription: RTDB for IoT live data, Firestore for currentUserId
  // (RTDB iot/ node may not exist for all machines; Firestore is always authoritative
  //  for session ownership written by scan.ts)
  useEffect(() => {
    if (!currentUserId) return;

    const detectSession = (machineList: Machine[]) => {
      const userMachine = machineList.find(m => m.currentUserId === currentUserId);
      if (userMachine) {
        const now = new Date();
        const startTime = userMachine.lastUpdated || now;
        const estimatedEnd = userMachine.estimatedEndTime;
        let progress = 0;
        let timeRemaining = "In progress...";
        if (estimatedEnd) {
          const totalDuration = estimatedEnd.getTime() - startTime.getTime();
          const elapsed = now.getTime() - startTime.getTime();
          progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
          const remainingMs = estimatedEnd.getTime() - now.getTime();
          if (remainingMs > 0) {
            const remainingMins = Math.ceil(remainingMs / 60000);
            timeRemaining = `${remainingMins} min remaining`;
          } else {
            timeRemaining = "Finishing up...";
            progress = 100;
          }
        }
        // Subscribe to Firestore machine doc for accurate startTime
        subscribeToSessionStart(userMachine.machineId);
        setActiveSession({
          machineId: userMachine.machineId,
          machineLocation: userMachine.location ?? undefined,
          startTime,
          estimatedEndTime: estimatedEnd ?? undefined,
          progress: Math.round(progress),
          timeRemaining,
        });
      } else {
        subscribeToSessionStart(null);
        setActiveSession(null);
      }
    };

    // Firestore subscription — authoritative for currentUserId (written by scan.ts)
    const unsubFirestore = subscribeMachines((firestoreMachines) => {
      setMachines(firestoreMachines);
      detectSession(firestoreMachines);
    });

    // Subscribe to session startTime from Firestore machines/{machineId}.lastUpdated
    // This is the authoritative session start time written by the backend on scan.
    // We watch the machine doc directly for the currentUserId's machine.
    const { getFirestore, doc: fsDoc, onSnapshot: fsSnapshot } = require("firebase/firestore");
    const { getDatabase, ref: rtdbRef, onValue } = require("firebase/database");
    let unsubSessionFs = () => {};
    let currentWatchedMachineId: string | null = null;

    const subscribeToSessionStart = (machineId: string | null) => {
      if (machineId === currentWatchedMachineId) return; // already watching
      unsubSessionFs(); // unsub previous
      currentWatchedMachineId = machineId;
      if (!machineId) { setSessionStartTime(null); return; }

      // Primary: Firestore machines/{machineId}.lastUpdated (= scan timestamp)
      const db = getFirestore();
      unsubSessionFs = fsSnapshot(fsDoc(db, "machines", machineId), (snap: any) => {
        if (!snap.exists()) { setSessionStartTime(null); return; }
        const data = snap.data();
        // lastUpdated is set by backend scan.ts to Timestamp.now() at claim time
        const lu = data.lastUpdated;
        if (lu?.toDate) {
          setSessionStartTime(lu.toDate().toISOString());
        } else if (typeof lu === "string") {
          setSessionStartTime(lu);
        } else {
          setSessionStartTime(null);
        }
      });
    };

    // RTDB subscription — merges live IoT data (load, vibration, lock state, etc.)
    // but RTDB iot/ may not contain all machines, so we use it to enrich Firestore data
    const unsubRTDB = subscribeMachinesRTDB((rtdbMachines) => {
      setMachines((prev) => {
        if (prev.length === 0) return rtdbMachines;
        // Merge: Firestore is source-of-truth for ownership, RTDB for IoT live state
        return prev.map(fsMachine => {
          const rtdbMachine = rtdbMachines.find(r => r.machineId === fsMachine.machineId);
          if (!rtdbMachine) return fsMachine;
          return {
            ...fsMachine,
            // RTDB wins for live sensor/IoT fields
            currentLoad: rtdbMachine.currentLoad ?? fsMachine.currentLoad,
            vibrationLevel: rtdbMachine.vibrationLevel ?? fsMachine.vibrationLevel,
            buzzerActive: rtdbMachine.buzzerActive ?? fsMachine.buzzerActive,
            isLive: rtdbMachine.isLive,
            locked: rtdbMachine.locked ?? fsMachine.locked,
            lastPing: rtdbMachine.lastPing ?? fsMachine.lastPing,
            // Firestore wins for ownership — but if RTDB has a more recent currentUserId, use it
            currentUserId: rtdbMachine.currentUserId || fsMachine.currentUserId,
          };
        });
      });
    });

    return () => {
      unsubFirestore();
      unsubRTDB();
      unsubSessionFs();
    };
  }, [currentUserId]);

  // ── Load all machines initially ────────────────────────────────────────────
  const loadMachines = useCallback(async () => {
    try {
      setError(null);
      const data = await dashboardRepository.getAll();
      setMachines(data);
      return data;
    } catch (err: any) {
      console.error("[DashboardVM] Failed to load machines:", err);
      setError(err.message || "Failed to load machines");
      setMachines([]);
      return [];
    }
  }, [dashboardRepository]);

  useEffect(() => {
    const load = async () => {
      try {
        await loadMachines();
      } catch (err) {
        console.error("[DashboardVM] Initial load error:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [loadMachines]);

  // ── Subscribe to ALL machine queues ────────────────────────────────────────
  useEffect(() => {
    if (machines.length === 0 || !currentUserId) return;

    const unsubscribers: (() => void)[] = [];

    machines.forEach((machine) => {
      const unsub = queueRepository.subscribe(machine.machineId, (data) => {
        try {
          setQueueData((prev) => {
            const allQueues = { ...prev, [machine.machineId]: data };

            let total = 0;
            let userPosition: number | null = null;
            let userMachine: string | null = null;

            Object.entries(allQueues).forEach(([mId, qData]) => {
              const users = queueRepository.mapUsers(qData?.users ?? []);
              total += users.length;

              const idx = users.findIndex(
                (u: any) => u.userId === currentUserId
              );
              if (idx >= 0) {
                userPosition = idx + 1;
                userMachine = mId;
                const joinedAt = users[idx]?.joinedAt;
                if (joinedAt) setQueueJoinedAt(joinedAt instanceof Date ? joinedAt.toISOString() : String(joinedAt));
              }
            });

            setQueueCount(total);
            setUserQueuePosition(userPosition);
            setUserQueueMachineId(userMachine);

            return allQueues;
          });
        } catch (err) {
          console.error(
            `[DashboardVM] Queue subscription error for ${machine.machineId}:`,
            err
          );
        }
      });

      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [machines, queueRepository, currentUserId]);

  // ── Refresh ────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMachines();
    } finally {
      setRefreshing(false);
    }
  }, [loadMachines]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const stats = dashboardRepository.getStats(machines);
  
  // User's turn if they're position #1 in queue AND not currently using a machine
  // AND the machine they're waiting for is actually free (no one currently using it)
  const queueMachineFree = userQueueMachineId
    ? !machines.find(m => m.machineId === userQueueMachineId)?.currentUserId
    : false;
  const isUserTurn = userQueuePosition === 1 && !activeSession && queueMachineFree;
  
  // Has active session if currently using a machine
  const hasActiveSession = !!activeSession;

  // ── Queue wait cascade estimate ────────────────────────────────────────────
  // pos1 is the anchor. Each slot adds 60 min hi and 60 min lo on top of pos1.
  // This way: when pos1 finishes early, everyone shifts down correctly.
  // When a new person joins at posN, they see pos1_remaining×N + (N-1)×60 — accurate.
  const estimatedWaitRange: { lo: number; hi: number } | null = (() => {
    if (!userQueuePosition || !userQueueMachineId) return null;
    const qData = queueData[userQueueMachineId];
    const users: any[] = qData?.users ?? [];
    const now = Date.now();

    // Find user currently at position 1 (the anchor)
    const pos1 = users.find((u: any) => u.position === 1);
    if (!pos1?.joinedAt) {
      // Fallback: simple position-based estimate
      const hi = Math.max(1, userQueuePosition * 60);
      return { lo: Math.max(1, Math.ceil(hi / 2)), hi };
    }

    const elapsed1 = (now - new Date(pos1.joinedAt).getTime()) / 60000;
    const pos1Hi   = Math.max(1, Math.round(60 - elapsed1));
    const pos1Lo   = Math.max(1, Math.ceil(pos1Hi / 2));

    if (userQueuePosition === 1) {
      return { lo: pos1Lo, hi: pos1Hi };
    }

    // posN: add (N-1) × 60 to both lo and hi of pos1
    const offset = (userQueuePosition - 1) * 60;
    return {
      lo: Math.max(1, pos1Lo + offset),
      hi: Math.max(2, pos1Hi + offset),
    };
  })();

  // Derived active machine ID — prefer current session, else queue machine
  const activeMachineId = activeSession?.machineId ?? userQueueMachineId ?? null;

  // ── Navigation Actions ─────────────────────────────────────────────────────
  const onScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // FIX #2: always pass the active machineId so qrscan can navigate correctly
    if (activeMachineId && activeMachineId !== "M001") {
      router.push({ pathname: "/iot/qrscan", params: { machineId: activeMachineId } });
    } else {
      router.push("/iot/qrscan");
    }
  };

  const onJoinQueue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // If user is already in a queue, go directly to that machine's queue
    if (userQueueMachineId) {
      router.push({ pathname: "/(tabs)/queue", params: { machineId: userQueueMachineId } });
    } else {
      // Go to first available machine's queue
      const availableMachine = machines.find(m => m.status === "Available" && !m.currentUserId);
      if (availableMachine) {
        router.push({ pathname: "/(tabs)/queue", params: { machineId: availableMachine.machineId } });
      } else {
        router.push("/(tabs)/queue");
      }
    }
  };

  const onViewMachine = (machineId: string) => {
    router.push(`/iot/${machineId}`);
  };

  const onViewQueue = () => {
    if (userQueueMachineId) {
      router.push({ pathname: "/(tabs)/queue", params: { machineId: userQueueMachineId } });
    } else {
      router.push("/(tabs)/queue");
    }
  };

  const onViewChats = () => router.push("/(tabs)/conversations");
  const onViewNotifications = () => router.push("/(tabs)/notifications");
  const onViewSettings = () => router.push("/(tabs)/settings");
  const onViewHelp = () => router.push("/(settings)/help_center");
  const onViewAI = () => router.push("/(settings)/ai_assistant");
  const onViewPolicies = () => router.push("/(settings)/policies");
  const onViewAll = () => router.push("/iot/machines");

  // ── Status Card Action Handler ─────────────────────────────────────────────
  const onStatusActionPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (hasActiveSession && activeSession) {
      // View current session details
      router.push({ 
        pathname: "/iot/[machineId]", 
        params: { machineId: activeSession.machineId } 
      });
    } else if (isUserTurn && userQueueMachineId) {
      // It's user's turn - prompt to scan
      router.push({ 
        pathname: "/iot/qrscan", 
        params: { machineId: userQueueMachineId } 
      });
    } else if (userQueuePosition && userQueueMachineId) {
      // User is in queue - view queue
      router.push({ 
        pathname: "/(tabs)/queue", 
        params: { machineId: userQueueMachineId } 
      });
    } else {
      // No status - find a machine
      onViewAll();
    }
  };

  return {
    machines,
    stats,
    queueCount,
    userQueuePosition,
    userQueueMachineId,
    isUserTurn,
    hasActiveSession,
    activeSession,
    queueJoinedAt,
    estimatedWaitRange,
    sessionStartTime,
    loading,
    refreshing,
    refresh,
    error,
    onScanPress,
    onJoinQueue,
    onViewMachine,
    onViewQueue,
    onViewNotifications,
    onViewSettings,
    onViewHelp,
    onViewAI,
    onViewPolicies,
    onViewChats,
    onViewAll,
    onStatusActionPress,
  };
}