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
        setActiveSession({
          machineId: userMachine.machineId,
          machineLocation: userMachine.location ?? undefined,
          startTime,
          estimatedEndTime: estimatedEnd ?? undefined,
          progress: Math.round(progress),
          timeRemaining,
        });
      } else {
        setActiveSession(null);
      }
    };

    // Firestore subscription — authoritative for currentUserId (written by scan.ts)
    const unsubFirestore = subscribeMachines((firestoreMachines) => {
      setMachines(firestoreMachines);
      detectSession(firestoreMachines);
    });

    // Subscribe to session startTime from RTDB sessions/{machineId}
    const { getDatabase, ref: rtdbRef, onValue } = require("firebase/database");
    let unsubSession = () => {};
    if (currentUserId) {
      const rtdb = getDatabase();
      // We'll update this when we find the active machine
      const checkSessions = (machines: any[]) => {
        const userM = machines.find((m: any) => m.currentUserId === currentUserId);
        if (!userM) { setSessionStartTime(null); return; }
        const sessRef = rtdbRef(rtdb, `sessions/${userM.machineId}`);
        unsubSession();
        unsubSession = onValue(sessRef, (snap: any) => {
          if (snap.exists() && snap.val()?.startTime) {
            setSessionStartTime(snap.val().startTime);
          } else {
            setSessionStartTime(null);
          }
        });
      };
      // Called from detectSession context - we listen on machines
    }

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