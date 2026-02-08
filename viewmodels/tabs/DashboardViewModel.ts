import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import { Machine } from "@/domain/machine/Machine";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

const M001_MACHINE_ID = "M001";

export function useDashboardViewModel() {
  const { dashboardRepository, queueRepository } = container;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [m001Queue, setM001Queue] = useState<any>(null);
  const [queueCount, setQueueCount] = useState(0);

  // Load machines
  const loadMachines = useCallback(async () => {
    try {
      const data = await dashboardRepository.getAll();
      setMachines(data);
    } catch (error) {
      console.error("[DashboardVM] Failed to load machines:", error);
    }
  }, [dashboardRepository]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        await loadMachines();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [loadMachines]);

  // Subscribe to M001 queue for live status
  useEffect(() => {
    const unsub = queueRepository.subscribe(M001_MACHINE_ID, (queueData) => {
      setM001Queue(queueData);
      const users = queueRepository.mapUsers(queueData.users ?? []);
      setQueueCount(users.length);
    });

    return unsub;
  }, [queueRepository]);

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

  const primaryMachine = machines[0] ?? null;

  // Determine M001 status based on queue data
  const m001Status = m001Queue?.currentUserId ? "In Use" : "Available";

  const onScanPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.push({
      pathname: "/iot/qrscan",
      params: { machineId: M001_MACHINE_ID },
    });
  };

  const onJoinM001Queue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    router.push({
      pathname: "/(tabs)/queue",
      params: { machineId: M001_MACHINE_ID },
    });
  };

  return {
    machines,
    stats,
    primaryMachine,
    m001Status,
    queueCount,
    loading,
    refreshing,
    refresh,
    onScanPress,
    onJoinM001Queue,
  };
}
