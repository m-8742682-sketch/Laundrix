import { 
  notificationsDataSource, 
  Notification, 
  NotificationIconType 
} from "@/datasources/remote/firebase/notificationsDataSource";
import { Unsubscribe } from "firebase/firestore";

// Re-export types
export type { Notification, NotificationIconType };

export class NotificationsRepository {
  /**
   * Get all notifications for a user (one-time fetch)
   */
  async getNotifications(userId: string): Promise<Notification[]> {
    return notificationsDataSource.fetchAll(userId);
  }

  /**
   * Subscribe to real-time notification updates
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void
  ): Unsubscribe {
    return notificationsDataSource.subscribe(userId, callback);
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    return notificationsDataSource.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    return notificationsDataSource.markAllAsRead(userId);
  }

  /**
   * Delete a single notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    return notificationsDataSource.deleteNotification(notificationId);
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId: string): Promise<void> {
    return notificationsDataSource.deleteAllRead(userId);
  }
}
