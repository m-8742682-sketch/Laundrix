import { useEffect, useState } from "react";
import { container } from "@/di/container";
import type { Notification } from "@/repositories/tabs/NotificationsRepository";

export function useNotificationsViewModel(userId?: string) {
  const { notificationsRepository } = container;

  const [notifications, setNotifications] = useState<
    Notification[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const data =
          await notificationsRepository.getNotifications(
            userId
          );
        setNotifications(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId]);

  const markAsRead = async (id: string) => {
    await notificationsRepository.markAsRead(id);

    setNotifications(prev =>
      prev.map(n =>
        n.id === id ? { ...n, read: true } : n
      )
    );
  };

  const deleteOne = async (id: string) => {
    await notificationsRepository.delete(id);

    setNotifications(prev =>
      prev.filter(n => n.id !== id)
    );
  };

  const clearAll = async () => {
    if (!userId) return;

    await notificationsRepository.clearAll(userId);
    setNotifications([]);
  };

  return {
    notifications,
    loading,
    markAsRead,
    deleteOne,
    clearAll,
  };
}