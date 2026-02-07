import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://laundrix-backend.vercel.app";

/* =====================================================
   ENSURE CHAT DOCUMENT EXISTS (ADMIN / SYSTEM USE)
   - Optional but recommended
===================================================== */
export const ensureChatExists = async (machineId: string) => {
  const chatRef = doc(db, "chats", machineId);

  await setDoc(
    chatRef,
    {
      machineId,
      active: true,
    },
    { merge: true }
  );
};

/* =====================================================
   GET CHAT PARTICIPANTS (for notification purposes)
===================================================== */
export const getChatParticipants = async (machineId: string): Promise<string[]> => {
  try {
    // Get unique senders from recent messages
    const messagesRef = collection(db, "chats", machineId, "messages");
    const recentQuery = query(messagesRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(recentQuery);
    
    const senderIds = new Set<string>();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.senderId) {
        senderIds.add(data.senderId);
      }
    });
    
    return Array.from(senderIds);
  } catch (error) {
    console.error("Failed to get chat participants:", error);
    return [];
  }
};

/* =====================================================
   SEND MESSAGE
   - Rule compliant
   - Append-only
   - Sends notifications to other participants
===================================================== */
export const sendMessage = async (
  machineId: string,
  senderId: string,
  message: string,
  senderName?: string
) => {
  const messagesRef = collection(
    db,
    "chats",
    machineId,
    "messages"
  );

  // Add message to Firestore
  await addDoc(messagesRef, {
    senderId,
    senderName: senderName ?? null,
    message,
    timestamp: serverTimestamp(),
  });

  // Get other participants and notify them
  try {
    const participants = await getChatParticipants(machineId);
    const recipientIds = participants.filter(id => id !== senderId);
    
    if (recipientIds.length > 0) {
      // Call backend to send push notifications
      await fetch(`${BACKEND_URL}/api/notify-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          machineId,
          senderId,
          senderName: senderName || "Someone",
          message,
          recipientIds,
        }),
      });
    }
  } catch (error) {
    // Don't fail message send if notification fails
    console.error("Failed to send chat notification:", error);
  }
};

export const subscribeMessages = (
  machineId: string,
  callback: (messages: any[]) => void
) => {
  const messagesRef = collection(
    db,
    "chats",
    machineId,
    "messages"
  );

  const q = query(messagesRef, orderBy("timestamp", "asc"));

  const unsubscribe = onSnapshot(q, snapshot => {
    const messages = snapshot.docs.map(doc => ({
      messageId: doc.id,
      ...doc.data(),
    }));

    callback(messages);
  });

  return unsubscribe;
};
