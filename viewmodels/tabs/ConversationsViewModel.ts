import { useEffect, useState, useCallback, useRef } from "react";
import { container } from "@/di/container";
import type { Conversation } from "@/repositories/tabs/ConversationsRepository";

export function useConversationsViewModel(userId: string | undefined) {
  const { conversationsRepository } = container;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track if we've done initial load
  const hasInitialLoad = useRef(false);

  // Real-time subscription using onSnapshot
  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to real-time updates
    const unsubscribe = conversationsRepository.subscribeToConversations(
      userId,
      (updatedConversations) => {
        setConversations(updatedConversations);
        setLoading(false);
        hasInitialLoad.current = true;
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId, conversationsRepository]);

  // Manual refresh function (pull-to-refresh)
  const refresh = useCallback(async () => {
    if (!userId) return;
    
    setRefreshing(true);
    setError(null);
    
    try {
      const data = await conversationsRepository.getConversations(userId);
      setConversations(data);
    } catch (err: any) {
      console.error("[ConversationsVM] refresh error:", err);
      setError(err.message || "Failed to refresh conversations");
    } finally {
      setRefreshing(false);
    }
  }, [userId, conversationsRepository]);

  // Calculate total unread count
  const totalUnreadCount = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  );

  return {
    conversations,
    loading,
    refreshing,
    error,
    refresh,
    totalUnreadCount,
  };
}

export type { Conversation };
