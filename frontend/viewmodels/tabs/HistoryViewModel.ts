/**
 * History ViewModel — FIXED #7
 *
 * isAdmin=true → loads ALL records via getAllHistory()
 * isAdmin=false (default) → loads only this user's records
 */

import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import type { UsageRecord } from "@/repositories/tabs/HistoryRepository";

export function useHistoryViewModel(userId?: string, isAdmin = false) {
  const { historyRepository } = container;

  const [history, setHistory] = useState<UsageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    try {
      const data = isAdmin
        ? await historyRepository.getAllHistory()
        : await historyRepository.getHistory(userId);
      setHistory(data);
    } catch (error) {
      console.error("[HistoryVM] Failed to load history:", error);
    }
  }, [userId, isAdmin, historyRepository]);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      try { await loadHistory(); } finally { setLoading(false); }
    })();
  }, [userId, loadHistory]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadHistory(); } finally { setRefreshing(false); }
  }, [loadHistory]);

  return { history, loading, refreshing, refresh };
}
