import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FlatList, ViewToken } from "react-native";
import { ChatRepository, ChatMessage, ReplyToData} from "@/repositories/tabs/ChatRepository";
import { MediaType } from "@/services/mediaUpload.service";

const chatRepo = new ChatRepository();

export function useChatViewModel(
  channel: string,
  myUserId: string,
  targetUserId: string,
  myName?: string
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const optimisticIdCounter = useRef(0);
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // Reset messages when channel changes
  useEffect(() => {
    setMessages([]);
    markedAsReadRef.current = new Set();
  }, [channel]);

  // Real-time subscription
  useEffect(() => {
    if (!channel || !myUserId) return;

    const unsubscribe = chatRepo.subscribe(channel, myUserId, (msgs) => {
      setMessages((prev) => {
        const optimisticIds = new Set(
          prev.filter((m) => m.id?.startsWith("optimistic_")).map((m) => m.id)
        );

        const realMessages = msgs;
        
        const remainingOptimistic = prev.filter((m) => {
          if (!m.id?.startsWith("optimistic_")) return false;
          
          const hasMatch = realMessages.some((rm) => {
            const senderMatch = rm.senderId === m.senderId;
            const typeMatch = rm.type === m.type;
            const mCreatedTime = m.createdAt?.toDate?.()?.getTime() || Date.now();
            const rmCreatedTime = rm.createdAt?.toDate?.()?.getTime() || 0;
            const timeDiff = Math.abs(rmCreatedTime - mCreatedTime);
            const timeMatch = timeDiff < 20000;
            const forwardedMatch = !m.forwardedFrom || rm.forwardedFrom === m.forwardedFrom;

            if (m.type === "audio") {
              return senderMatch && typeMatch && timeMatch && forwardedMatch;
            }
            const contentMatch = rm.text === m.text;
            return senderMatch && typeMatch && contentMatch && timeMatch && forwardedMatch;
          });

          return !hasMatch;
        });

        return [...realMessages, ...remainingOptimistic];
      });
    });

    return () => unsubscribe();
  }, [channel, myUserId]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  }), []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!channel || !myUserId) return;

      viewableItems.forEach((viewableItem) => {
        const message = viewableItem.item as ChatMessage;
        if (!message?.id) return;

        if (
          message.senderId === myUserId ||
          message.read === true ||
          message.id.startsWith("optimistic_") ||
          markedAsReadRef.current.has(message.id)
        ) {
          return;
        }

        markedAsReadRef.current.add(message.id);

        chatRepo.markSingleMessageAsRead(channel, message.id)
          .catch((err: any) => {
            console.warn(`[ChatViewModel] Failed to mark message ${message.id} as read:`, err);
            markedAsReadRef.current.delete(message.id);
          });
      });
    },
    [channel, myUserId]
  );

  // Send text message
  const sendText = useCallback(async (
    messageText?: string, 
    forwardedFrom?: string, 
    forwardedFromAvatar?: string, 
    forwardedFromUserId?: string,
    replyTo?: ReplyToData
  ) => {
    const textToSend = messageText?.trim() || text.trim();
    if (!textToSend || sending) return;

    const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      type: "text",
      text: textToSend,
      senderId: myUserId,
      receiverId: targetUserId,
      side: "right",
      createdAt: { toDate: () => new Date() } as any,
      read: false,
      forwardedFrom: forwardedFrom || undefined,
      forwardedFromAvatar: forwardedFromAvatar || undefined,
      forwardedFromUserId: forwardedFromUserId || undefined,
      replyTo: replyTo || undefined, 
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    if (!messageText) {
      setText("");
    }

    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);

    try {
      setSending(true);
      await chatRepo.sendText(channel, myUserId, targetUserId, textToSend, myName, forwardedFrom, forwardedFromAvatar, forwardedFromUserId, replyTo);
    } catch (error) {
      console.error("[ChatViewModel] sendText error:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }, [text, channel, myUserId, targetUserId, myName, sending]);

  // Send audio message
  const sendAudio = useCallback(
    async (uri: string, forwardedFrom?: string, forwardedFromAvatar?: string, forwardedFromUserId?: string, replyTo?: ReplyToData) => {
      const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        type: "audio",
        text: "",
        audioUrl: uri,
        senderId: myUserId,
        receiverId: targetUserId,
        side: "right",
        createdAt: { toDate: () => new Date() } as any,
        read: false,
        forwardedFrom: forwardedFrom || undefined,
        forwardedFromAvatar: forwardedFromAvatar || undefined,
        forwardedFromUserId: forwardedFromUserId || undefined,
        replyTo: replyTo || undefined,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);

      try {
        setSending(true);
        await chatRepo.sendAudio(channel, myUserId, targetUserId, uri, myName, forwardedFrom, forwardedFromAvatar, forwardedFromUserId, replyTo);
      } catch (error) {
        console.error("[ChatViewModel] sendAudio error:", error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [channel, myUserId, targetUserId, myName]
  );

  // Send image message
  const sendImage = useCallback(
    async (uri: string, replyTo?: ReplyToData) => {
      const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        type: "image",
        text: "Image",
        mediaUrl: uri,
        senderId: myUserId,
        receiverId: targetUserId,
        side: "right",
        createdAt: { toDate: () => new Date() } as any,
        read: false,
        replyTo: replyTo || undefined,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);

      try {
        setSending(true);
        await chatRepo.sendImage(channel, myUserId, targetUserId, uri, myName, replyTo);
      } catch (error) {
        console.error("[ChatViewModel] sendImage error:", error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [channel, myUserId, targetUserId, myName]
  );

  // Send video message
  const sendVideo = useCallback(
    async (uri: string, replyTo?: ReplyToData) => {
      const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        type: "video",
        text: "Video",
        mediaUrl: uri,
        senderId: myUserId,
        receiverId: targetUserId,
        side: "right",
        createdAt: { toDate: () => new Date() } as any,
        read: false,
        replyTo: replyTo || undefined,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);

      try {
        setSending(true);
        await chatRepo.sendVideo(channel, myUserId, targetUserId, uri, myName, replyTo);
      } catch (error) {
        console.error("[ChatViewModel] sendVideo error:", error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [channel, myUserId, targetUserId, myName]
  );

  // Send file message
  const sendFile = useCallback(
    async (uri: string, fileName: string, replyTo?: ReplyToData) => {
      const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        type: "file",
        text: fileName,
        mediaUrl: uri,
        senderId: myUserId,
        receiverId: targetUserId,
        side: "right",
        createdAt: { toDate: () => new Date() } as any,
        read: false,
        replyTo: replyTo || undefined,
      };

      setMessages((prev) => [...prev, optimisticMsg]);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);

      try {
        setSending(true);
        await chatRepo.sendFile(channel, myUserId, targetUserId, uri, fileName, myName, replyTo);
      } catch (error) {
        console.error("[ChatViewModel] sendFile error:", error);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [channel, myUserId, targetUserId, myName]
  );

  // Send multiple media
  const sendMultipleMedia = useCallback(
    async (items: Array<{ uri: string; type: MediaType; name?: string }>, replyTo?: ReplyToData) => {
      try {
        setSending(true);
        await chatRepo.sendMultipleMedia(channel, myUserId, targetUserId, items, myName, replyTo);
      } catch (error) {
        console.error("[ChatViewModel] sendMultipleMedia error:", error);
      } finally {
        setSending(false);
      }
    },
    [channel, myUserId, targetUserId, myName]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      try {
        await chatRepo.deleteMessage(channel, messageId);
      } catch (error) {
        console.error("[ChatViewModel] deleteMessage error:", error);
      }
    },
    [channel]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, text: newText } : m))
      );

      try {
        await chatRepo.editMessage(channel, messageId, newText);
      } catch (error) {
        console.error("[ChatViewModel] editMessage error:", error);
      }
    },
    [channel]
  );

  return {
    messages,
    text,
    setText,
    sendText,
    sendAudio,
    sendImage,
    sendVideo,
    sendFile,
    sendMultipleMedia,
    listRef,
    deleteMessage,
    editMessage,
    sending,
    viewabilityConfig,
    onViewableItemsChanged,
  };
}