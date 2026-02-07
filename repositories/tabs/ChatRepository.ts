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

  sendText(
    channel: string,
    senderId: string,
    receiverId: string,
    text: string
  ) {
    return chatDataSource.sendText(channel, {
      type: "text",
      text,
      senderId,
      receiverId,
    });
  }

  async sendAudio(
    channel: string,
    senderId: string,
    receiverId: string,
    uri: string
  ) {
    const url = await uploadAudio(uri, channel);

    return chatDataSource.sendText(channel, {
      type: "audio",
      audioUrl: url,
      senderId,
      receiverId,
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
}