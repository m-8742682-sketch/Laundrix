import { queueDataSource } from "@/datasources/remote/firebase/queueDataSource";
import { joinQueue, leaveQueue } from "@/services/queue.service";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export type QueueUser = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt: Date;
  queueToken: string;
  position: number;
};

// Cache for user avatars to avoid repeated fetches
const avatarCache: { [userId: string]: string | null } = {};

/**
 * Fetch avatar URL from Firestore users collection
 */
async function fetchUserAvatar(userId: string): Promise<string | null> {
  // Return from cache if available
  if (avatarCache[userId] !== undefined) {
    return avatarCache[userId];
  }

  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const avatarUrl = data?.avatarUrl || null;
      avatarCache[userId] = avatarUrl;
      return avatarUrl;
    }
  } catch (error) {
    console.warn("[QueueRepo] Failed to fetch avatar for", userId, error);
  }
  
  avatarCache[userId] = null;
  return null;
}

export class QueueRepository {
  /**
   * Subscribe to real-time queue updates
   */
  subscribe(machineId: string, onUpdate: (state: any) => void) {
    return queueDataSource.subscribeQueue(machineId, onUpdate);
  }

  /**
   * Get queue data once (for manual refresh)
   */
  async getQueue(machineId: string): Promise<any | null> {
    return queueDataSource.getQueue(machineId);
  }

  async join(machineId: string, userId: string) {
    return joinQueue(machineId, userId);
  }

  async leave(machineId: string, userId: string) {
    return leaveQueue(machineId, userId);
  }

  /**
   * Map raw queue users and fetch their avatar URLs from users collection
   */
  mapUsers(rawUsers: any[]): QueueUser[] {
    const sortedUsers = (rawUsers ?? [])
      .sort((a, b) => a.position - b.position)
      .map(u => ({
        ...u,
        joinedAt: u.joinedAt?.toDate?.() ?? new Date(),
      }));
    
    return sortedUsers;
  }

  /**
   * Map raw queue users and fetch their avatar URLs asynchronously
   * Returns the users with avatarUrl populated from Firestore users collection
   */
  async mapUsersWithAvatars(rawUsers: any[]): Promise<QueueUser[]> {
    const sortedUsers = (rawUsers ?? [])
      .sort((a, b) => a.position - b.position);
    
    // Fetch avatar URLs for all users in parallel
    const usersWithAvatars = await Promise.all(
      sortedUsers.map(async (u) => {
        // If avatarUrl already exists in queue data, use it
        // Otherwise fetch from users collection
        let avatarUrl = u.avatarUrl;
        if (!avatarUrl && u.userId) {
          avatarUrl = await fetchUserAvatar(u.userId);
        }
        
        return {
          ...u,
          avatarUrl,
          joinedAt: u.joinedAt?.toDate?.() ?? new Date(),
        };
      })
    );
    
    return usersWithAvatars;
  }
}
