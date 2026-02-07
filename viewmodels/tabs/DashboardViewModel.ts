import { useEffect, useState } from "react";
import { container } from "@/di/container";
import { Machine } from "@/domain/machine/Machine";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

export function useDashboardViewModel() {
  const { dashboardRepository } = container;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data =
          await dashboardRepository.getAll();
        setMachines(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const stats = dashboardRepository.getStats(machines);

  const primaryMachine = machines[0] ?? null;

  const onScanPress = () => {
    if (!primaryMachine) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.push({
      pathname: "/iot/qrscan",
      params: { machineId: primaryMachine.machineId },
    });
  };

  return {
    machines,
    stats,
    primaryMachine,
    loading,
    onScanPress,
  };
}