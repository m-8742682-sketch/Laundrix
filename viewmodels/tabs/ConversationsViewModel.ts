import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import { Conversation } from "@/repositories/tabs/ConversationsRepository";

// Re-export types
export type { Conversation };

export function useConversationsViewModel(userId: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribe to conversations
  useEffect(() => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribe = container.conversationsRepository.subscribeToConversations(
      userId,
      (data: Conversation[]) => {
        setConversations(data);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Manual refresh
  const refresh = useCallback(async () => {
    if (!userId) return;
    
    setRefreshing(true);
    try {
      const data = await container.conversationsRepository.getConversations(userId);
      setConversations(data);
    } catch (error) {
      console.error("[ConversationsVM] Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  // Computed values
  const hasConversations = conversations.length > 0;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    conversations,
    loading,
    refreshing,
    refresh,
    hasConversations,
    totalUnread,
  };
}
