import { chatDataSource } from "@/datasources/remote/firebase/chatDataSource";
import { uploadAudio } from "@/services/mediaUpload.service";
import { Timestamp } from "firebase/firestore";

export type ChatMessage = {
  id: string;
  type: "text" | "audio" | "call";
  text?: string; // FIXED: Made optional since audio messages don't have text
  audioUrl?: string;
  senderId: string;
  receiverId: string;
  side: "left" | "right";
  createdAt: Timestamp;
  read?: boolean;
  forwardedFrom?: string; // For forwarded messages
  forwardedFromAvatar?: string; // ADD THIS
  forwardedFromUserId?: string;
  // Call-specific fields
  callType?: "voice" | "video";
  callStatus?: "ended" | "missed";
  callDuration?: number;
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
      console.log("[ChatRepository] Raw messages:", raw.map(m => ({
        id: m.id,
        forwardedFrom: m.forwardedFrom,
        forwardedFromAvatar: m.forwardedFromAvatar ? "has" : "none",
      })));

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
          read: m.read ?? false,
          forwardedFrom: m.forwardedFrom,
          forwardedFromAvatar: m.forwardedFromAvatar?.trim(),
          forwardedFromUserId: m.forwardedFromUserId,
          // Call-specific fields
          callType: m.callType,
          callStatus: m.callStatus,
          callDuration: m.callDuration,
        }))      
      );
      
    });
    
  }

  async sendText(
    channel: string,
    senderId: string,
    receiverId: string,
    text: string,
    senderName?: string,
    forwardedFrom?: string,
    forwardedFromAvatar?: string,
    forwardedFromUserId?: string
  ) {
    // Send message to Firestore
    const result = await chatDataSource.sendText(channel, {
      type: "text",
      text,
      senderId,
      receiverId,
      forwardedFrom,
      forwardedFromAvatar,
      forwardedFromUserId
    });

    // Send notification to receiver
    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      forwardedFrom ? `Forwarded: ${text}` : text,
      "text"
    );

    return result;
  }

  async sendAudio(
    channel: string,
    senderId: string,
    receiverId: string,
    uri: string,
    senderName?: string,
    forwardedFrom?: string,
    forwardedFromAvatar?: string,
    forwardedFromUserId?: string
  ) {
    // If it's a forwarded audio, uri is already a remote URL
    // If it's new audio, we need to upload it
    let url = uri;
    if (!forwardedFrom) {
      url = await uploadAudio(uri, channel);
    }

    // Send message to Firestore
    const result = await chatDataSource.sendText(channel, {
      type: "audio",
      audioUrl: url,
      senderId,
      receiverId,
      forwardedFrom,
      forwardedFromAvatar,
      forwardedFromUserId
    });

    // Send notification to receiver
    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      forwardedFrom ? "Forwarded voice message" : "Voice message",
      "audio"
    );

    return result;
  }

  /**
   * Add a call record to the chat
   */
  async addCallRecord(
    channel: string,
    senderId: string,
    receiverId: string,
    callType: "voice" | "video",
    callStatus: "ended" | "missed",
    callDuration?: number
  ) {
    const text = callStatus === "missed" 
      ? `Missed ${callType} call` 
      : `${callType === "voice" ? "Voice" : "Video"} call ended`;

    return chatDataSource.sendText(channel, {
      type: "call",
      senderId,
      receiverId,
      callType,
      callStatus,
      callDuration: callDuration || 0,
    });
  }

  editMessage(channel: string, id: string, text: string) {
    return chatDataSource.updateMessage(channel, id, {
      text,
    });
  }

  deleteMessage(channel: string, id: string) {
    return chatDataSource.deleteMessage(channel, id);
  }

  /**
   * Mark all messages in a channel as read for a user
   */
  markMessagesAsRead(channel: string, userId: string) {
    return chatDataSource.markMessagesAsRead(channel, userId);
  }

  /**
   * Mark a single message as read (for viewport-based reading)
   */
  markSingleMessageAsRead(channel: string, messageId: string) {
    return chatDataSource.markSingleMessageAsRead(channel, messageId);
  }
}