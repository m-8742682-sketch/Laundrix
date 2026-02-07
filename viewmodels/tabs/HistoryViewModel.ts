import { useEffect, useState } from "react";
import { container } from "@/di/container";
import type { UsageRecord } from "@/repositories/tabs/HistoryRepository";

export function useHistoryViewModel(userId?: string) {
  const { historyRepository } = container;

  const [history, setHistory] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const data =
          await historyRepository.getHistory(userId);
        setHistory(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  return {
    history,
    loading,
  };
}