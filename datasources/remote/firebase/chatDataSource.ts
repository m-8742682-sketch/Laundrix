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
  type?: "text" | "audio" | "call" | "image" | "video" | "file";
  text?: string;
  audioUrl?: string;
  mediaUrl?: string;
  senderId: string;
  receiverId: string;
  createdAt: Timestamp;
  read?: boolean;
  forwardedFrom?: string;
  forwardedFromAvatar?: string;
  forwardedFromUserId?: string;
  callType?: "voice" | "video";
  callStatus?: "ended" | "missed";
  callDuration?: number;
  replyTo?: any;
};

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
      callback([]);
    }
  );

  return unsubscribe;
}

async function sendText(
  channel: string,
  msg: {
    type?: "text" | "audio" | "call" | "image" | "video" | "file";
    text?: string;
    audioUrl?: string;
    mediaUrl?: string;
    senderId: string;
    receiverId: string;
    forwardedFrom?: string;
    forwardedFromAvatar?: string;
    forwardedFromUserId?: string;
    callType?: "voice" | "video";
    callStatus?: "calling" | "ended" | "missed";
    callDuration?: number;
    replyTo?: {
      id: string;
      type: "text" | "audio" | "call" | "image" | "video" | "file";
      text?: string;
      side: "left" | "right";
      senderId?: string;
      callType?: "voice" | "video";
      mediaUrl?: string;
    };
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

  if (msg.text !== undefined) messageData.text = msg.text;
  if (msg.audioUrl !== undefined) messageData.audioUrl = msg.audioUrl;
  if (msg.mediaUrl !== undefined) messageData.mediaUrl = msg.mediaUrl;
  if (msg.forwardedFrom !== undefined) messageData.forwardedFrom = msg.forwardedFrom;
  if (msg.forwardedFromAvatar !== undefined) messageData.forwardedFromAvatar = msg.forwardedFromAvatar;
  if (msg.forwardedFromUserId !== undefined) messageData.forwardedFromUserId = msg.forwardedFromUserId;
  if (msg.callType !== undefined) messageData.callType = msg.callType;
  if (msg.callStatus !== undefined) messageData.callStatus = msg.callStatus;
  if (msg.callDuration !== undefined) messageData.callDuration = msg.callDuration;
  if (msg.replyTo !== undefined) messageData.replyTo = msg.replyTo;

  const docRef = await addDoc(messagesRef, messageData);
  return { id: docRef.id };
}

async function updateMessage(
  channel: string,
  messageId: string,
  updates: Partial<{ text: string; read: boolean }>
): Promise<void> {
  const messageRef = doc(db, "chats", channel, "messages", messageId);
  await updateDoc(messageRef, updates);
}

async function updateCallMessage(
  channel: string,
  messageId: string,
  callStatus: "calling" | "ended" | "missed",
  callDuration?: number
): Promise<void> {
  const messageRef = doc(db, "chats", channel, "messages", messageId);
  const updates: any = { callStatus };
  if (callDuration !== undefined) updates.callDuration = callDuration;
  await updateDoc(messageRef, updates);
}

async function deleteMessage(channel: string, messageId: string): Promise<void> {
  const messageRef = doc(db, "chats", channel, "messages", messageId);
  await deleteDoc(messageRef);
}

async function markMessagesAsRead(channel: string, currentUserId: string): Promise<void> {
  try {
    const messagesRef = collection(db, "chats", channel, "messages");
    const q = query(
      messagesRef,
      where("receiverId", "==", currentUserId),
      where("read", "==", false)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { read: true });
    });

    await batch.commit();
    console.log(`[chatDataSource] Marked ${snapshot.docs.length} messages as read`);
  } catch (error) {
    console.warn("[chatDataSource] markMessagesAsRead error:", error);
  }
}

async function markSingleMessageAsRead(channel: string, messageId: string): Promise<void> {
  try {
    const messageRef = doc(db, "chats", channel, "messages", messageId);
    await updateDoc(messageRef, { read: true });
    console.log(`[chatDataSource] Marked message ${messageId} as read`);
  } catch (error) {
    console.warn("[chatDataSource] markSingleMessageAsRead error:", error);
  }
}

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
  updateCallMessage,
  deleteMessage,
  markMessagesAsRead,
  markSingleMessageAsRead,
  subscribeToCall,
};