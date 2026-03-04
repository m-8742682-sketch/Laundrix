import { chatDataSource } from "@/datasources/remote/firebase/chatDataSource";
import { uploadMedia, MediaType } from "@/services/mediaUpload.service";
import { Timestamp } from "firebase/firestore";

/**
 * Clean replyTo data by removing undefined values for Firebase
 */
function cleanReplyTo(replyTo?: ReplyToData) {
  if (!replyTo) return undefined;
  
  const cleaned: any = {
    id: replyTo.id,
    type: replyTo.type,
    side: replyTo.side,
  };
  
  if (replyTo.text !== undefined) cleaned.text = replyTo.text;
  if (replyTo.senderId !== undefined) cleaned.senderId = replyTo.senderId;
  if (replyTo.callType !== undefined) cleaned.callType = replyTo.callType;
  if (replyTo.mediaUrl !== undefined) cleaned.mediaUrl = replyTo.mediaUrl;
  
  return cleaned;
}

export type ReplyToData = {
  id: string;
  type: "text" | "audio" | "call" | "image" | "video" | "file";
  text?: string;
  side: "left" | "right";
  senderId?: string;
  callType?: "voice" | "video";
  mediaUrl?: string;
};

export type ChatMessage = {
  id: string;
  type: "text" | "audio" | "call" | "image" | "video" | "file";
  text?: string;
  audioUrl?: string;
  mediaUrl?: string; // For image/video/file
  senderId: string;
  receiverId: string;
  side: "left" | "right";
  createdAt: Timestamp;
  read?: boolean;
  forwardedFrom?: string;
  forwardedFromAvatar?: string;
  forwardedFromUserId?: string;
  replyTo?: ReplyToData;
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
  messageType: "text" | "audio" | "image" | "video" | "file" = "text"
): Promise<void> {
  if (!BACKEND_URL) {
    console.warn("[ChatRepository] No backend URL configured, skipping notification");
    return;
  }

  try {
    // FIX: was calling /api/notify-chat (deleted endpoint).
    // Now calls /api/notify with type="chat" — the unified notification endpoint.
    const preview = messageType !== "text"
      ? `[${messageType.charAt(0).toUpperCase() + messageType.slice(1)}]`
      : message.length > 80 ? message.substring(0, 80) + "..." : message;

    const response = await fetch(`${BACKEND_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "chat",
        senderId,
        senderName,
        recipientIds: [receiverId],
        message: preview,
        machineId: "",
      }),
    });

    const result = await response.json();
    console.log("[ChatRepository] Notification result:", result);
  } catch (error) {
    console.error("[ChatRepository] Failed to send notification:", error);
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
          mediaUrl: m.mediaUrl,
          senderId: m.senderId,
          receiverId: m.receiverId, 
          side: m.senderId === myUserId ? "right" : "left",
          createdAt: m.createdAt,
          read: m.read ?? false,
          forwardedFrom: m.forwardedFrom,
          forwardedFromAvatar: m.forwardedFromAvatar?.trim(),
          forwardedFromUserId: m.forwardedFromUserId,
          replyTo: m.replyTo,
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
    forwardedFromUserId?: string,
    replyTo?: ReplyToData
  ) {
    const result = await chatDataSource.sendText(channel, {
      type: "text",
      text,
      senderId,
      receiverId,
      forwardedFrom,
      forwardedFromAvatar: forwardedFromAvatar?.trim(),
      forwardedFromUserId,
      replyTo: cleanReplyTo(replyTo),
    });

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
    forwardedFromUserId?: string,
    replyTo?: ReplyToData
  ) {
    let url = uri;
    
    // Only upload if not forwarded (forwarded already has URL)
    if (!forwardedFrom) {
      const result = await uploadAudio(uri, `voices/${channel}`);
      url = result.secure_url;
    }

    const result = await chatDataSource.sendText(channel, {
      type: "audio",
      audioUrl: url,
      senderId,
      receiverId,
      forwardedFrom,
      forwardedFromAvatar: forwardedFromAvatar?.trim(),
      forwardedFromUserId,
      replyTo: cleanReplyTo(replyTo),
    });

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
   * Send image message
   */
  async sendImage(
    channel: string,
    senderId: string,
    receiverId: string,
    uri: string,
    senderName?: string,
    replyTo?: ReplyToData
  ) {
    const uploadResult = await uploadMedia(uri, 'image', `chat_images/${channel}`);
    
    const result = await chatDataSource.sendText(channel, {
      type: "image",
      text: "Image",
      mediaUrl: uploadResult.secure_url,
      senderId,
      receiverId,
      replyTo: cleanReplyTo(replyTo),
    });

    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      "📷 Image",
      "image"
    );

    return result;
  }

  /**
   * Send video message
   */
  async sendVideo(
    channel: string,
    senderId: string,
    receiverId: string,
    uri: string,
    senderName?: string,
    replyTo?: ReplyToData
  ) {
    const uploadResult = await uploadMedia(uri, 'video', `chat_videos/${channel}`);
    
    const result = await chatDataSource.sendText(channel, {
      type: "video",
      text: "Video",
      mediaUrl: uploadResult.secure_url,
      senderId,
      receiverId,
      replyTo: cleanReplyTo(replyTo),
    });

    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      "🎥 Video",
      "video"
    );

    return result;
  }

  /**
   * Send file message
   */
  async sendFile(
    channel: string,
    senderId: string,
    receiverId: string,
    uri: string,
    fileName: string,
    senderName?: string,
    replyTo?: ReplyToData
  ) {
    const uploadResult = await uploadMedia(uri, 'file', `chat_files/${channel}`);
    
    const result = await chatDataSource.sendText(channel, {
      type: "file",
      text: fileName,
      mediaUrl: uploadResult.secure_url,
      senderId,
      receiverId,
      replyTo: cleanReplyTo(replyTo),
    });

    await notifyRecipient(
      senderId,
      senderName || "Someone",
      receiverId,
      `📎 ${fileName}`,
      "file"
    );

    return result;
  }

  /**
   * Send multiple media items (images/videos/files)
   */
  async sendMultipleMedia(
    channel: string,
    senderId: string,
    receiverId: string,
    items: Array<{ uri: string; type: MediaType; name?: string }>,
    senderName?: string,
    replyTo?: ReplyToData
  ) {
    const results = [];
    let currentReplyTo = replyTo;
    
    for (const item of items) {
      let result;
      
      switch (item.type) {
        case 'image':
          result = await this.sendImage(channel, senderId, receiverId, item.uri, senderName, currentReplyTo);
          break;
        case 'video':
          result = await this.sendVideo(channel, senderId, receiverId, item.uri, senderName, currentReplyTo);
          break;
        case 'file':
          result = await this.sendFile(channel, senderId, receiverId, item.uri, item.name || 'File', senderName, currentReplyTo);
          break;
        case 'audio':
          result = await this.sendAudio(channel, senderId, receiverId, item.uri, senderName, undefined, undefined, undefined, currentReplyTo);
          break;
      }
      
      results.push(result);
      
      // Clear replyTo after first message so only first one has reply badge
      currentReplyTo = undefined;
    }
    
    return results;
  }

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
    return chatDataSource.updateMessage(channel, id, { text });
  }

  deleteMessage(channel: string, id: string) {
    return chatDataSource.deleteMessage(channel, id);
  }

  markMessagesAsRead(channel: string, userId: string) {
    return chatDataSource.markMessagesAsRead(channel, userId);
  }

  markSingleMessageAsRead(channel: string, messageId: string) {
    return chatDataSource.markSingleMessageAsRead(channel, messageId);
  }
}