import { useEffect, useRef, useState } from "react";
import { container } from "@/di/container";
import type { ChatMessage } from "@/repositories/tabs/ChatRepository";

export function useChatViewModel(
  channel: string,
  myUserId: string,
  targetUserId: string,
  myName?: string
) {
  const { chatRepository } = container;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<any>(null);

  useEffect(() => {
    const unsub = chatRepository.subscribe(
      channel,
      myUserId,
      msgs => {
        setMessages(msgs);
      }
    );

    return unsub;
  }, [channel, myUserId, chatRepository]);

  const sendText = async () => {
    if (!text.trim()) return;
    await chatRepository.sendText(
      channel,
      myUserId,
      targetUserId,
      text.trim(),
      myName
    );
    setText("");
  };

  const sendAudio = async (uri: string) => {
    await chatRepository.sendAudio(
      channel,
      myUserId,
      targetUserId,
      uri,
      myName
    );
  };

  const deleteMessage = async (id: string) => {
    await chatRepository.deleteMessage(channel, id);
  };

  const editMessage = async (id: string, text: string) => {
    await chatRepository.editMessage(channel, id, text);
  };

  return {
    messages,
    text,
    setText,
    sendText,
    sendAudio,
    listRef,
    deleteMessage,
    editMessage,
  };
}
