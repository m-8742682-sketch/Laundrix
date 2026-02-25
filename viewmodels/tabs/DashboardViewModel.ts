/**
 * Dashboard ViewModel
 *
 * CRITICAL FIX — Active Session Detection:
 * The backend writes currentUserId to Firestore `machines` collection.
 * Previous version only subscribed to RTDB (iot/ path) which only the IoT
 * hardware device writes to — not the backend API.
 *
 * Fix: Subscribe to Firestore machines collection to detect active session.
 * Keep RTDB subscription for machine IoT state (availability, status).
 */

import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import { Machine } from "@/domain/machine/Machine";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { auth, db } from "@/services/firebase";
import { subscribeMachinesRTDB } from "@/services/machine.service";
import { collection, query, onSnapshot } from "firebase/firestore";

export type UserSession = {
  machineId: string;
  machineLocation?: string;
  startTime: Date;
  estimatedEndTime?: Date;
  progress: number;
  timeRemaining: string;
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

  // Use auth.currentUser directly — always reflects live auth state
  const currentUserId = auth.currentUser?.uid ?? null;

  // ── 1. FIRESTORE subscription: active session detection ──────────────────
  // Backend writes currentUserId to Firestore machines/{machineId}
  // This is the correct source of truth for "in progress" state
  useEffect(() => {
    if (!currentUserId) return;

    const q = query(collection(db, "machines"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const userMachineDoc = snap.docs.find(
          (d) => d.data().currentUserId === currentUserId
        );

        if (userMachineDoc) {
          const data = userMachineDoc.data();
          const machineId = userMachineDoc.id;
          const startTime: Date = data.lastUpdated?.toDate() ?? new Date();
          const estimatedEnd: Date | undefined = data.estimatedEndTime?.toDate() ?? undefined;

          let progress = 0;
          let timeRemaining = "In progress...";

          if (estimatedEnd) {
            const totalDuration = estimatedEnd.getTime() - startTime.getTime();
            const elapsed = Date.now() - startTime.getTime();
            progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
            const remainingMs = estimatedEnd.getTime() - Date.now();
            if (remainingMs > 0) {
              const mins = Math.ceil(remainingMs / 60000);
              timeRemaining = `${mins} min remaining`;
            } else {
              timeRemaining = "Finishing up...";
              progress = 100;
            }
          }

          setActiveSession({
            machineId,
            machineLocation: data.location ?? undefined,
            startTime,
            estimatedEndTime: estimatedEnd,
            progress: Math.round(progress),
            timeRemaining,
          });
        } else {
          setActiveSession(null);
        }
      },
      (err) => {
        console.warn("[DashboardVM] Firestore machines error:", err);
      }
    );

    return () => unsub();
  }, [currentUserId]);

  // ── 2. RTDB subscription: machine IoT state ───────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeMachinesRTDB((updatedMachines) => {
      setMachines(updatedMachines);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  // ── 3. Initial machine load ───────────────────────────────────────────────
  const loadMachines = useCallback(async () => {
    try {
      setError(null);
      const data = await dashboardRepository.getAll();
      setMachines((prev) => (prev.length === 0 ? data : prev));
      return data;
    } catch (err: any) {
      console.error("[DashboardVM] Failed to load machines:", err);
      setError(err.message || "Failed to load machines");
      return [];
    }
  }, [dashboardRepository]);

  useEffect(() => {
    (async () => {
      try {
        await loadMachines();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMachines]);

  // ── 4. Queue subscriptions ────────────────────────────────────────────────
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
              const idx = users.findIndex((u: any) => u.userId === currentUserId);
              if (idx >= 0) {
                userPosition = idx + 1;
                userMachine = mId;
              }
            });

            setQueueCount(total);
            setUserQueuePosition(userPosition);
            setUserQueueMachineId(userMachine);
            return allQueues;
          });
        } catch (err) {
          console.error(`[DashboardVM] Queue error for ${machine.machineId}:`, err);
        }
      });

      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach((u) => u());
  }, [machines, queueRepository, currentUserId]);

  // ── Refresh ───────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMachines();
    } finally {
      setRefreshing(false);
    }
  }, [loadMachines]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const stats = dashboardRepository.getStats(machines);
  const hasActiveSession = !!activeSession;

  // "Your turn" = user is #1 in queue AND they are NOT yet using the machine
  const isUserTurn = userQueuePosition === 1 && !hasActiveSession;

  // Active machine ID for navigation / grace period watching
  const activeMachineId = activeSession?.machineId ?? userQueueMachineId ?? null;

  // ── Navigation ────────────────────────────────────────────────────────────
  const onScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeMachineId) {
      router.push({ pathname: "/iot/qrscan", params: { machineId: activeMachineId } });
    } else {
      router.push("/iot/qrscan");
    }
  };

  const onJoinQueue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (userQueueMachineId) {
      router.push({ pathname: "/(tabs)/queue", params: { machineId: userQueueMachineId } });
    } else {
      const available = machines.find((m) => m.status === "Available" && !m.currentUserId);
      router.push(
        available
          ? { pathname: "/(tabs)/queue", params: { machineId: available.machineId } }
          : "/(tabs)/queue"
      );
    }
  };

  const onViewAll = () => router.push("/iot/machines");
  const onViewMachine = (machineId: string) => router.push(`/iot/${machineId}`);
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

  const onStatusActionPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (hasActiveSession && activeSession) {
      router.push({ pathname: "/iot/[machineId]", params: { machineId: activeSession.machineId } });
    } else if (isUserTurn && userQueueMachineId) {
      router.push({ pathname: "/iot/qrscan", params: { machineId: userQueueMachineId } });
    } else if (userQueuePosition && userQueueMachineId) {
      router.push({ pathname: "/(tabs)/queue", params: { machineId: userQueueMachineId } });
    } else {
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
    activeMachineId,
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
