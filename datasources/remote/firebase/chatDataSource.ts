import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../../../services/firebase";

export type RawMessage = {
  id: string;
  type?: "text" | "audio" | "call";
  text?: string;
  audioUrl?: string;
  audioDuration?: number;
  senderId: string;
  receiverId: string;
  createdAt: Timestamp;
  read?: boolean;
  forwardedFrom?: string; // NEW
  forwardedFromAvatar?: string; 
  forwardedFromUserId?: string;
  callType?: "voice" | "video";
  callStatus?: "ended" | "missed";
  callDuration?: number;
};

/**
 * Subscribe to chat messages in real-time (fast, no polling!)
 */
function subscribe(
  channel: string,
  callback: (messages: RawMessage[]) => void
): () => void {
  const messagesRef = collection(db, "chats", channel, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  const unsubscribe = onSnapshot(
    q,
    { includeMetadataChanges: false },
    (snapshot) => {
      const messages: RawMessage[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as RawMessage));
      callback(messages);
    },
    (error) => {
      console.error("[chatDataSource] subscribe error:", error);
      // Return empty array on error instead of crashing
      callback([]);
    }
  );

  return unsubscribe;
}

/**
 * Send a text/audio/call message - returns immediately with optimistic response
 */
async function sendText(
  channel: string,
  msg: {
    type?: "text" | "audio" | "call";
    text?: string;
    audioUrl?: string;
    audioDuration?: number;
    senderId: string;
    receiverId: string;
    forwardedFrom?: string; // NEW
    forwardedFromAvatar?: string;
    forwardedFromUserId?: string;
    callType?: "voice" | "video";
    callStatus?: "ended" | "missed";
    callDuration?: number;
  }
): Promise<{ id: string }> {
  const messagesRef = collection(db, "chats", channel, "messages");

  const messageData: any = {
    type: msg.type ?? "text",
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    createdAt: Timestamp.now(),
    read: false,
  };

  // Add optional fields
  if (msg.text !== undefined) messageData.text = msg.text;
  if (msg.audioUrl !== undefined) messageData.audioUrl = msg.audioUrl;
  if (msg.audioDuration !== undefined) messageData.audioDuration = msg.audioDuration;
  if (msg.forwardedFrom !== undefined) messageData.forwardedFrom = msg.forwardedFrom;
  if (msg.forwardedFromAvatar !== undefined) messageData.forwardedFromAvatar = msg.forwardedFromAvatar;
  if (msg.forwardedFromUserId !== undefined) messageData.forwardedFromUserId = msg.forwardedFromUserId;
  if (msg.callType !== undefined) messageData.callType = msg.callType;
  if (msg.callStatus !== undefined) messageData.callStatus = msg.callStatus;
  if (msg.callDuration !== undefined) messageData.callDuration = msg.callDuration;

  const docRef = await addDoc(messagesRef, messageData);
  return { id: docRef.id };
}

/**
 * Update a message
 */
async function updateMessage(
  channel: string,
  messageId: string,
  updates: Partial<{ text: string; read: boolean }>
): Promise<void> {
  const messageRef = doc(db, "chats", channel, "messages", messageId);
  await updateDoc(messageRef, updates);
}

/**
 * Delete a message
 */
async function deleteMessage(channel: string, messageId: string): Promise<void> {
  const messageRef = doc(db, "chats", channel, "messages", messageId);
  await deleteDoc(messageRef);
}

/**
 * Mark all messages from the other user as read
 */
async function markMessagesAsRead(channel: string, currentUserId: string): Promise<void> {
  try {
    const messagesRef = collection(db, "chats", channel, "messages");
    // Get unread messages where the current user is the receiver
    const q = query(
      messagesRef,
      where("receiverId", "==", currentUserId),
      where("read", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    // Use batch for efficient updates
    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    console.log(`[chatDataSource] Marked ${snapshot.docs.length} messages as read`);
  } catch (error) {
    console.warn("[chatDataSource] markMessagesAsRead error:", error);
    // Don't throw - this is not critical
  }
}

/**
 * Mark a single message as read (for viewport-based reading)
 */
async function markSingleMessageAsRead(channel: string, messageId: string): Promise<void> {
  try {
    const messageRef = doc(db, "chats", channel, "messages", messageId);
    await updateDoc(messageRef, { read: true });
    console.log(`[chatDataSource] Marked message ${messageId} as read`);
  } catch (error) {
    console.warn("[chatDataSource] markSingleMessageAsRead error:", error);
    // Don't throw - this is not critical
  }
}

/**
 * Subscribe to call document for real-time call status updates
 */
function subscribeToCall(
  callId: string,
  onCallUpdate: (callData: any) => void,
  onError?: (error: Error) => void
): () => void {
  const callRef = doc(db, "calls", callId);

  const unsubscribe = onSnapshot(
    callRef,
    (docSnap) => {
      if (docSnap.exists()) {
        onCallUpdate({ id: docSnap.id, ...docSnap.data() });
      } else {
        onCallUpdate(null);
      }
    },
    (error) => {
      console.error("[chatDataSource] subscribeToCall error:", error);
      onError?.(error);
    }
  );

  return unsubscribe;
}

export const chatDataSource = {
  subscribe,
  sendText,
  updateMessage,
  deleteMessage,
  markMessagesAsRead,
  markSingleMessageAsRead,
  subscribeToCall,
};