import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
  Unsubscribe,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/services/firebase";

// Backend notification types (from backend lib/fcm.ts)
type BackendNotificationType = 
  | 'your_turn'
  | 'grace_warning'
  | 'removed_from_queue'
  | 'unauthorized_alert'
  | 'unauthorized_warning'
  | 'buzzer_triggered'
  | 'clothes_ready'
  | 'session_started'
  | 'session_ended'
  | 'queue_joined'
  | 'queue_left'
  | 'chat_message'
  | 'voice_call'
  | 'video_call'
  | 'missed_call'
  | 'missed_video';

// Frontend notification types for icons
export type NotificationIconType =
  | "queue"
  | "unauthorized"
  | "laundry"
  | "system"
  | "chat"
  | "call"
  | "missedCall"
  | "missedVideo";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationIconType;
  originalType: string; // Keep original type for debugging
  read: boolean;
  createdAt: Date;
  data?: Record<string, any>;
}

/**
 * Map backend notification types to frontend icon types
 */
function mapNotificationType(backendType: string): NotificationIconType {
  const typeMap: Record<string, NotificationIconType> = {
    // Queue related
    'your_turn': 'queue',
    'grace_warning': 'queue',
    'removed_from_queue': 'queue',
    'queue_joined': 'queue',
    'queue_left': 'queue',
    
    // Unauthorized
    'unauthorized_alert': 'unauthorized',
    'unauthorized_warning': 'unauthorized',
    'buzzer_triggered': 'unauthorized',
    
    // Laundry
    'clothes_ready': 'laundry',
    'session_started': 'laundry',
    'session_ended': 'laundry',
    
    // Chat
    'chat_message': 'chat',
    
    // Calls
    'voice_call': 'call',
    'video_call': 'call',
    'missed_call': 'missedCall',
    'missed_video': 'missedVideo',
    
    // Legacy frontend types (for backwards compatibility)
    'queue': 'queue',
    'unauthorized': 'unauthorized',
    'laundry': 'laundry',
    'system': 'system',
    'chat': 'chat',
    'auth': 'system',
    'verification': 'system',
    'missedCall': 'missedCall',
    'missedVideo': 'missedVideo',
  };

  return typeMap[backendType] || 'system';
}

/**
 * Parse createdAt field which can be:
 * - Firestore Timestamp
 * - ISO string
 * - Date object
 * - { seconds, nanoseconds } object
 */
function parseCreatedAt(createdAt: any): Date {
  if (!createdAt) {
    return new Date();
  }

  // Firestore Timestamp
  if (createdAt instanceof Timestamp) {
    return createdAt.toDate();
  }

  // Object with toDate method (Timestamp-like)
  if (typeof createdAt?.toDate === 'function') {
    return createdAt.toDate();
  }

  // Object with seconds (Firestore Timestamp serialized)
  if (typeof createdAt?.seconds === 'number') {
    return new Date(createdAt.seconds * 1000);
  }

  // ISO string or other string format
  if (typeof createdAt === 'string') {
    const parsed = new Date(createdAt);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  // Already a Date
  if (createdAt instanceof Date) {
    return createdAt;
  }

  // Number (timestamp in ms)
  if (typeof createdAt === 'number') {
    return new Date(createdAt);
  }

  return new Date();
}

/**
 * Transform Firestore document to Notification object
 */
function transformNotification(doc: any): Notification {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId || '',
    title: data.title || 'Notification',
    body: data.body || '',
    type: mapNotificationType(data.type || 'system'),
    originalType: data.type || 'system',
    read: data.read ?? false,
    createdAt: parseCreatedAt(data.createdAt),
    data: data.data,
  };
}

export const notificationsDataSource = {
  /**
   * Fetch all notifications for a user (one-time)
   */
  async fetchAll(userId: string): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map(transformNotification);
    } catch (error) {
      console.error("[NotificationsDS] fetchAll error:", error);
      return [];
    }
  },

  /**
   * Subscribe to real-time notifications updates
   */
  subscribe(userId: string, callback: (notifications: Notification[]) => void): Unsubscribe {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const notifications = snapshot.docs.map(transformNotification);
        callback(notifications);
      },
      (error) => {
        // Handle permission errors gracefully (e.g., after logout)
        if (error.code === 'permission-denied') {
          console.warn("[NotificationsDS] Permission denied - user may have logged out");
          return;
        }
        console.error("[NotificationsDS] subscribe error:", error);
      }
    );
  },

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const ref = doc(db, "notifications", notificationId);
      await updateDoc(ref, { read: true });
    } catch (error) {
      console.error("[NotificationsDS] markAsRead error:", error);
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("read", "==", false)
      );

      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map((docSnap) =>
        updateDoc(doc(db, "notifications", docSnap.id), { read: true })
      );

      await Promise.all(updates);
    } catch (error) {
      console.error("[NotificationsDS] markAllAsRead error:", error);
    }
  },

  /**
   * Delete a single notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const ref = doc(db, "notifications", notificationId);
      await deleteDoc(ref);
    } catch (error) {
      console.error("[NotificationsDS] deleteNotification error:", error);
      throw error;
    }
  },

  /**
   * Delete all read notifications for a user
   */
  async deleteAllRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("read", "==", true)
      );

      const snapshot = await getDocs(q);
      
      // Use batched writes for efficiency
      const batch = writeBatch(db);
      snapshot.docs.forEach((docSnap) => {
        batch.delete(doc(db, "notifications", docSnap.id));
      });

      await batch.commit();
      console.log(`[NotificationsDS] Deleted ${snapshot.docs.length} read notifications`);
    } catch (error) {
      console.error("[NotificationsDS] deleteAllRead error:", error);
      throw error;
    }
  },
};
