import { chatDataSource } from "@/datasources/remote/firebase/chatDataSource";
import { uploadAudio } from "@/services/mediaUpload.service";
import { Timestamp } from "firebase/firestore";

export type ChatMessage = {
  id: string;
  type: "text" | "audio";
  text: string;
  audioUrl?: string;
  senderId: string;
  receiverId: string;
  side: "left" | "right";
  createdAt: Timestamp;
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "";

/**
 * Send notification to receiver about new chat message
 */
async function notifyRecipient(
  senderId: string,
  senderName: string,
  receiverId: string,
  message: string,
  messageType: "text" | "audio" | "image" = "text"
): Promise<void> {
  if (!BACKEND_URL) {
    console.warn("[ChatRepository] No backend URL configured, skipping notification");
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/notify-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        senderId,
        senderName,
        receiverId,
        message,
        messageType,
      }),
    });

    const result = await response.json();
    console.log("[ChatRepository] Notification result:", result);
  } catch (error) {
    console.error("[ChatRepository] Failed to send notification:", error);
    // Don't throw - notification failure shouldn't block message sending
  }
}

export class ChatRepository {
  subscribe(
    channel: string,
    myUserId: string,
    cb: (msgs: ChatMessage[]) => void
  ) {
    return chatDataSource.subscribe(channel, raw => {
      cb(
        raw.map(m => ({
          id: m.id,
          type: m.type ?? "text",
          text: m.text,
          audioUrl: m.audioUrl,
          senderId: m.senderId,
          receiverId: m.receiverId, 
          side:
            m.senderId === myUserId ? "right" : "left",
          createdAt: m.createdAt,
        }))
      );
    });
  }

  async sendText(
    channel: string,
    senderId: string,
    receiverId: string,
    text: string,
    senderName?: string
  ) {
    // Send message to Firestore
    const result = await chatDataSource.sendText(channel, {
      type: "text",
      text,
      senderId,
      receiverId,
    });

    // Send notification to receiver
    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      text,
      "text"
    );

    return result;
  }

  async sendAudio(
    channel: string,
    senderId: string,
    receiverId: string,
    uri: string,
    senderName?: string
  ) {
    const url = await uploadAudio(uri, channel);

    // Send message to Firestore
    const result = await chatDataSource.sendText(channel, {
      type: "audio",
      audioUrl: url,
      senderId,
      receiverId,
    });

    // Send notification to receiver
    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      "Voice message",
      "audio"
    );

    return result;
  }

  editMessage(channel: string, id: string, text: string) {
    return chatDataSource.updateMessage(channel, id, {
      text,
    });
  }

  deleteMessage(channel: string, id: string) {
    return chatDataSource.deleteMessage(channel, id);
  }
}
