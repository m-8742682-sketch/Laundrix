import { Timestamp } from "firebase/firestore";
import { notificationsDataSource } from "@/datasources/remote/firebase/notificationsDataSource";
import { NotificationType } from "@/services/notification.service";

export type Notification = {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: Date;
};

export class NotificationsRepository {
  async getNotifications(userId: string): Promise<Notification[]> {
    const snapshot =
      await notificationsDataSource.fetchByUser(userId);

    return snapshot.docs.map(d => {
      const n = d.data();
      return {
        id: d.id,
        title: n.title,
        body: n.body,
        type: (n.type ?? "chat") as NotificationType,
        read: n.read,
        createdAt: (n.createdAt as Timestamp).toDate(),
      };
    });
  }

  markAsRead(id: string) {
    return notificationsDataSource.markAsRead(id);
  }
  delete(id: string) {
    return notificationsDataSource.delete(id);
  }
  async clearAll(userId: string) {
      const snap =
        await notificationsDataSource.fetchByUser(userId);

      await Promise.all(
        snap.docs.map(d =>
        notificationsDataSource.delete(d.id)
      )
    );
  }
}