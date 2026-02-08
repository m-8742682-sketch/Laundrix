import { useEffect, useState, useCallback } from "react";
import { container } from "@/di/container";
import { Notification, NotificationIconType } from "@/repositories/tabs/NotificationsRepository";

// Re-export types for convenience
export type { Notification, NotificationIconType };

export function useNotificationsViewModel(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to real-time updates
    const unsubscribe = container.notificationsRepository.subscribeToNotifications(
      userId,
      (data: Notification[]) => {
        setNotifications(data);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!userId) return;
    
    setRefreshing(true);
    try {
      const data = await container.notificationsRepository.getNotifications(userId);
      setNotifications(data);
    } catch (error) {
      console.error("[NotificationsVM] Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  // Mark single notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await container.notificationsRepository.markAsRead(notificationId);
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error("[NotificationsVM] markAsRead failed:", error);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    
    try {
      await container.notificationsRepository.markAllAsRead(userId);
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error("[NotificationsVM] markAllAsRead failed:", error);
    }
  }, [userId]);

  // Delete a single notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      await container.notificationsRepository.deleteNotification(notificationId);
    } catch (error) {
      console.error("[NotificationsVM] deleteNotification failed:", error);
      // Revert on error by refreshing
      refresh();
    }
  }, [refresh]);

  // Delete all read notifications
  const deleteAllRead = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Optimistic update
      setNotifications((prev) => prev.filter((n) => !n.read));
      await container.notificationsRepository.deleteAllRead(userId);
    } catch (error) {
      console.error("[NotificationsVM] deleteAllRead failed:", error);
      // Revert on error by refreshing
      refresh();
    }
  }, [userId, refresh]);

  // Computed values
  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;
  const hasUnread = unreadCount > 0;
  const hasRead = readCount > 0;

  return {
    notifications,
    loading,
    refreshing,
    refresh,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    unreadCount,
    readCount,
    hasUnread,
    hasRead,
  };
}
