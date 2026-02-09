/**
 * Conversations Data Source
 * 
 * Fetches chat conversations from Firestore.
 * Messages are stored in chats/{channel}/messages where channel is chat-{userId1}-{userId2}
 * 
 * IMPORTANT: Firestore subcollections don't create parent documents automatically.
 * We use collectionGroup query to find all messages, then group them by channel.
 * 
 * Real-time sync using onSnapshot listeners for immediate updates.
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
  Unsubscribe,
  Timestamp,
  limit,
  collectionGroup,
} from "firebase/firestore";
import { db, auth } from "@/services/firebase";

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  lastMessageType: "text" | "audio" | "image" | "call";
  unreadCount: number;
  isOnline?: boolean;
}

// Cache for user info to reduce Firestore reads
const userInfoCache = new Map<string, { name: string; avatarUrl?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
 * Get user info from Firestore with caching
 */
async function getUserInfo(userId: string): Promise<{ name: string; avatarUrl?: string }> {
  // Check cache first
  const cached = userInfoCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { name: cached.name, avatarUrl: cached.avatarUrl };
  }

  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const info = {
        name: data.name || data.displayName || "Unknown",
        avatarUrl: data.avatarUrl || data.photoURL,
      };
      // Update cache
      userInfoCache.set(userId, { ...info, timestamp: Date.now() });
      return info;
    }
  } catch (error) {
    console.error("[ConversationsDS] Error fetching user info:", error);
  }
  return { name: "Unknown" };
}

/**
 * Process messages into conversations
 */
async function processMessagesToConversations(
  messages: any[],
  userId: string
): Promise<Conversation[]> {
  // Group by channel (extract from document reference path)
  const channelMap = new Map<string, {
    channel: string;
    participantId: string;
    messages: any[];
  }>();

  for (const msg of messages) {
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
    
    // Count unread messages (messages sent to the user that are not read)
    // Treat undefined/null as unread (read !== true)
    const unreadCount = data.messages.filter(
      m => m.receiverId === userId && m.read !== true
    ).length;

    // Get participant info
    const userInfo = await getUserInfo(data.participantId);

    let lastMessageText = latestMsg.text || "";
    let lastMessageType: "text" | "audio" | "image" | "call" = latestMsg.type || "text";
    
    if (latestMsg.type === "audio") {
      lastMessageText = "Voice message";
    } else if (latestMsg.type === "call") {
      lastMessageText = latestMsg.callStatus === "missed" 
        ? `Missed ${latestMsg.callType} call`
        : `${latestMsg.callType === "voice" ? "Voice" : "Video"} call`;
    }

    conversations.push({
      id: channel,
      participantId: data.participantId,
      participantName: userInfo.name,
      participantAvatar: userInfo.avatarUrl,
      lastMessage: lastMessageText,
      lastMessageTime: parseDate(latestMsg.createdAt),
      lastMessageType,
      unreadCount,
      isOnline: false,
    });
  }

  // Sort by last message time
  conversations.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

  return conversations;
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

      const conversations = await processMessagesToConversations(allMessages, userId);

      console.log(`[ConversationsDS] Returning ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.error("[ConversationsDS] fetchConversations error:", error);
      // Return empty array instead of throwing
      return [];
    }
  },

  /**
   * Subscribe to real-time conversation updates using onSnapshot
   * This provides immediate updates when messages are sent/received
   */
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void): Unsubscribe {
    let isCancelled = false;
    let lastProcessedTime = 0;
    const DEBOUNCE_MS = 500; // Debounce updates to prevent too many re-renders
    
    // Query for messages where user is sender
    const sentQuery = query(
      collectionGroup(db, "messages"),
      where("senderId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(200)
    );
    
    // Query for messages where user is receiver
    const receivedQuery = query(
      collectionGroup(db, "messages"),
      where("receiverId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    let sentMessages: any[] = [];
    let receivedMessages: any[] = [];
    let sentLoaded = false;
    let receivedLoaded = false;

    const processMessages = async () => {
      if (isCancelled || !sentLoaded || !receivedLoaded) return;
      
      const now = Date.now();
      if (now - lastProcessedTime < DEBOUNCE_MS) return;
      lastProcessedTime = now;

      try {
        const allMessages = [...sentMessages, ...receivedMessages];
        const conversations = await processMessagesToConversations(allMessages, userId);
        
        if (!isCancelled) {
          callback(conversations);
        }
      } catch (error) {
        console.error("[ConversationsDS] processMessages error:", error);
      }
    };

    // Subscribe to sent messages
    const unsubSent = onSnapshot(
      sentQuery,
      (snapshot) => {
        if (!auth.currentUser || isCancelled) return;
        
        sentMessages = snapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
        sentLoaded = true;
        processMessages();
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.warn("[ConversationsDS] Permission denied (logout)");
          return;
        }
        console.error("[ConversationsDS] sentQuery error:", error);
      }
    );

    // Subscribe to received messages
    const unsubReceived = onSnapshot(
      receivedQuery,
      (snapshot) => {
        if (!auth.currentUser || isCancelled) return;
        
        receivedMessages = snapshot.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
        receivedLoaded = true;
        processMessages();
      },
      (error) => {
        if (error.code === 'permission-denied') {
          console.warn("[ConversationsDS] Permission denied (logout)");
          return;
        }
        console.error("[ConversationsDS] receivedQuery error:", error);
      }
    );

    // Return unsubscribe function
    return () => {
      isCancelled = true;
      unsubSent();
      unsubReceived();
    };
  },
};
