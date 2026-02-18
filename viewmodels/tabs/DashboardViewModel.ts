import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import { Machine } from "@/domain/machine/Machine";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { auth } from "@/services/firebase";

const M001_MACHINE_ID = "M001";

export function useDashboardViewModel() {
  const { dashboardRepository, queueRepository } = container;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [m001Queue, setM001Queue] = useState<any>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [userQueuePosition, setUserQueuePosition] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Get current user from Firebase Auth directly
  const getCurrentUser = useCallback(() => {
    return auth.currentUser;
  }, []);

  // Load machines with error handling
  const loadMachines = useCallback(async () => {
    try {
      setError(null);
      const data = await dashboardRepository.getAll();
      setMachines(data);
    } catch (err: any) {
      console.error("[DashboardVM] Failed to load machines:", err);
      setError(err.message || "Failed to load machines");
      // Set empty array to prevent undefined errors
      setMachines([]);
    }
  }, [dashboardRepository]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        await loadMachines();
        // TODO: Load active session for current user
        // TODO: Load user's queue position
      } catch (err) {
        console.error("[DashboardVM] Initial load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadMachines]);

  // Subscribe to M001 queue for live status
  useEffect(() => {
    const unsub = queueRepository.subscribe(M001_MACHINE_ID, (queueData) => {
      try {
        setM001Queue(queueData);
        const users = queueRepository.mapUsers(queueData.users ?? []);
        setQueueCount(users.length);

        // Find user's position in queue
        const currentUser = getCurrentUser();
        const currentUserId = currentUser?.uid;

        if (currentUserId && users) {
          const position = users.findIndex((u: any) => u.userId === currentUserId);
          setUserQueuePosition(position >= 0 ? position + 1 : null);
        }
      } catch (err) {
        console.error("[DashboardVM] Queue subscription error:", err);
      }
    });

    return unsub;
  }, [queueRepository, getCurrentUser]);

  // Refresh function
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMachines();
    } finally {
      setRefreshing(false);
    }
  }, [loadMachines]);

  const stats = dashboardRepository.getStats(machines);

  // Determine M001 status based on queue data
  const m001Status = m001Queue?.currentUserId ? "In Use" : "Available";

  // Check if it's user's turn (position #1)
  const isUserTurn = userQueuePosition === 1;

  // Check if user has active session
  const hasActiveSession = !!activeSession;

  const onScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/iot/qrscan");
  };

  const onJoinQueue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/(tabs)/queue");
  };

  const onViewMachine = (machineId: string) => {
    router.push(`/iot/${machineId}`);
  };

  const onViewQueue = () => {
    router.push("/(tabs)/queue");
  };

  const onViewNotifications = () => {
    router.push("/(tabs)/notifications");
  };

  const onViewSettings = () => {
    router.push("/(tabs)/settings");
  };

  const onViewHelp = () => {
    router.push("/(settings)/help_center");
  };

  const onViewAI = () => {
    router.push("/(settings)/ai_assistant");
  };

  const onViewPolicies = () => {
    router.push("/(settings)/policies");
  };

  const onViewMachines = () => {
    router.push("/iot/machines");
  };

  return {
    machines,
    stats,
    m001Status,
    queueCount,
    userQueuePosition,
    isUserTurn,
    hasActiveSession,
    activeSession,
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
    onViewMachines,
  };
}