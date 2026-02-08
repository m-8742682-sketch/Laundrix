/**
 * Conversations Data Source
 * 
 * Fetches chat conversations from Firestore.
 * Messages are stored in chats/{channel}/messages where channel is chat-{userId1}-{userId2}
 * 
 * IMPORTANT: Firestore subcollections don't create parent documents automatically.
 * We use collectionGroup query to find all messages, then group them by channel.
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Unsubscribe,
  Timestamp,
  limit,
  collectionGroup,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageType: "text" | "audio" | "image";
  unreadCount: number;
  isOnline?: boolean;
}

/**
 * Parse createdAt field which can be:
 * - Firestore Timestamp
 * - ISO string
 * - Date object
 * - { seconds, nanoseconds } object
 */
function parseDate(dateField: any): Date {
  if (!dateField) return new Date();

  if (dateField instanceof Timestamp) {
    return dateField.toDate();
  }

  if (typeof dateField?.toDate === 'function') {
    return dateField.toDate();
  }

  if (typeof dateField?.seconds === 'number') {
    return new Date(dateField.seconds * 1000);
  }

  if (typeof dateField === 'string') {
    const parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  if (dateField instanceof Date) {
    return dateField;
  }

  if (typeof dateField === 'number') {
    return new Date(dateField);
  }

  return new Date();
}

/**
 * Get user info from Firestore
 */
async function getUserInfo(userId: string): Promise<{ name: string; avatarUrl?: string }> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        name: data.name || data.displayName || "Unknown",
        avatarUrl: data.avatarUrl || data.photoURL,
      };
    }
  } catch (error) {
    console.error("[ConversationsDS] Error fetching user info:", error);
  }
  return { name: "Unknown" };
}

export const conversationsDataSource = {
  /**
   * Fetch all conversations for a user
   * Uses collectionGroup to query all messages subcollections
   */
  async fetchConversations(userId: string): Promise<Conversation[]> {
    try {
      console.log(`[ConversationsDS] Fetching conversations for ${userId}`);
      
      // Query all messages where the user is the sender
      const sentQuery = query(
        collectionGroup(db, "messages"),
        where("senderId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(200)
      );
      
      // Query all messages where the user is the receiver  
      const receivedQuery = query(
        collectionGroup(db, "messages"),
        where("receiverId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(200)
      );

      const [sentSnapshot, receivedSnapshot] = await Promise.all([
        getDocs(sentQuery),
        getDocs(receivedQuery),
      ]);

      console.log(`[ConversationsDS] Found ${sentSnapshot.docs.length} sent, ${receivedSnapshot.docs.length} received messages`);

      // Combine all messages
      const allMessages = [
        ...sentSnapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() })),
        ...receivedSnapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() })),
      ];

      // Group by channel (extract from document reference path)
      const channelMap = new Map<string, {
        channel: string;
        participantId: string;
        messages: any[];
      }>();

      for (const msg of allMessages) {
        // Reference path: chats/{channel}/messages/{messageId}
        const pathParts = msg.ref.path.split("/");
        const channel = pathParts[1]; // Second part is channel
        
        if (!channel || !channel.startsWith("chat-")) continue;

        const participantId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        if (!participantId) continue;

        if (!channelMap.has(channel)) {
          channelMap.set(channel, {
            channel,
            participantId,
            messages: [],
          });
        }
        
        channelMap.get(channel)!.messages.push(msg);
      }

      // Convert to conversations
      const conversations: Conversation[] = [];
      
      for (const [channel, data] of channelMap.entries()) {
        // Sort messages by time
        data.messages.sort((a, b) => {
          const timeA = parseDate(a.createdAt).getTime();
          const timeB = parseDate(b.createdAt).getTime();
          return timeB - timeA;
        });

        const latestMsg = data.messages[0];
        const unreadCount = data.messages.filter(
          m => m.senderId !== userId && !m.read
        ).length;

        // Get participant info
        const userInfo = await getUserInfo(data.participantId);

        conversations.push({
          id: channel,
          participantId: data.participantId,
          participantName: userInfo.name,
          participantAvatar: userInfo.avatarUrl,
          lastMessage: latestMsg.text || (latestMsg.type === "audio" ? "Voice message" : "Media"),
          lastMessageTime: parseDate(latestMsg.createdAt),
          lastMessageType: latestMsg.type || "text",
          unreadCount,
          isOnline: false,
        });
      }

      // Sort by last message time
      conversations.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

      console.log(`[ConversationsDS] Returning ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.error("[ConversationsDS] fetchConversations error:", error);
      // Return empty array instead of throwing
      return [];
    }
  },

  /**
   * Subscribe to real-time conversation updates
   */
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): Unsubscribe {
    let lastFetch = 0;
    let isCancelled = false;
    
    const doFetch = async () => {
      if (isCancelled) return;
      
      const now = Date.now();
      if (now - lastFetch < 2000) return; // Debounce 2 seconds
      lastFetch = now;
      
      try {
        const conversations = await conversationsDataSource.fetchConversations(userId);
        if (!isCancelled) {
          callback(conversations);
        }
      } catch (error) {
        console.error("[ConversationsDS] Subscribe fetch error:", error);
      }
    };

    // Initial fetch
    doFetch();

    // Set up a polling interval (every 5 seconds for more responsive updates)
    const intervalId = setInterval(doFetch, 5000);

    // Return unsubscribe function
    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  },
};
