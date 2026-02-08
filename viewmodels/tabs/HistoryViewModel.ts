import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import type { UsageRecord } from "@/repositories/tabs/HistoryRepository";

export function useHistoryViewModel(userId?: string) {
  const { historyRepository } = container;

  const [history, setHistory] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load history
  const loadHistory = useCallback(async () => {
    if (!userId) return;
    
    try {
      const data = await historyRepository.getHistory(userId);
      setHistory(data);
    } catch (error) {
      console.error("[HistoryVM] Failed to load history:", error);
    }
  }, [userId, historyRepository]);

  // Initial load
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        await loadHistory();
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, loadHistory]);

  // Refresh function
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadHistory();
    } finally {
      setRefreshing(false);
    }
  }, [loadHistory]);

  return {
    history,
    loading,
    refreshing,
    refresh,
  };
}
