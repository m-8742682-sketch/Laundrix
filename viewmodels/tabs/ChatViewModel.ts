import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { FlatList, ViewToken } from "react-native";
import { ChatRepository, ChatMessage } from "@/repositories/tabs/ChatRepository";

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
  
  // Track which messages have already been marked as read to avoid duplicate calls
  const markedAsReadRef = useRef<Set<string>>(new Set());

  // Real-time subscription
  useEffect(() => {
    if (!channel || !myUserId) return;

    const unsubscribe = chatRepo.subscribe(channel, myUserId, (msgs) => {
      setMessages((prev) => {
        // Filter out optimistic messages that now exist in Firebase
        const optimisticIds = new Set(
          prev.filter((m) => m.id && m.id && m.id.startsWith("optimistic_")).map((m) => m.id)
        );
        
        // Remove optimistic messages that match real ones
        const realMessages = msgs;
        
        // Keep only optimistic messages that don't have a real counterpart yet
        const remainingOptimistic = prev.filter((m) => {
          if (!m.id || !m.id && m.id.startsWith("optimistic_")) return false;
          // Check if there's a matching real message
          const hasMatch = realMessages.some(
            (rm) =>
              rm.senderId === m.senderId &&
              rm.text === m.text &&
              rm.type === m.type &&
              Math.abs(
                (rm.createdAt?.toDate?.()?.getTime() || 0) -
                  (m.createdAt?.toDate?.()?.getTime() || Date.now())
              ) < 10000
          );
          return !hasMatch;
        });

        return [...realMessages, ...remainingOptimistic];
      });
    });

    return () => unsubscribe();
  }, [channel, myUserId]);

  // Viewability configuration for detecting when messages scroll into view
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50, // Message is 50% visible
    minimumViewTime: 300, // Must be visible for 300ms
  }), []);

  // Handle when messages become visible - mark them as read
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!channel || !myUserId) return;

      viewableItems.forEach((viewableItem) => {
        const message = viewableItem.item as ChatMessage;
        
        // Safety check - skip if message or id is undefined
        if (!message || !message.id) {
          return;
        }
        
        // Only mark messages from the OTHER user as read
        // Skip if:
        // - Message is from me (senderId === myUserId)
        // - Message is already read
        // - Message is optimistic (starts with "optimistic_")
        // - Message has already been marked (in our Set)
        if (
          message.senderId === myUserId ||
          message.read === true ||
          (message.id && message.id.startsWith("optimistic_")) ||
          markedAsReadRef.current.has(message.id)
        ) {
          return;
        }

        // Add to marked set immediately to prevent duplicate calls
        markedAsReadRef.current.add(message.id);

        // Mark as read in Firebase
        chatRepo.markSingleMessageAsRead(channel, message.id)
          .then(() => {
            console.log(`[ChatViewModel] Marked message ${message.id} as read`);
          })
          .catch((err) => {
            console.warn(`[ChatViewModel] Failed to mark message ${message.id} as read:`, err);
            // Remove from set so it can be retried
            markedAsReadRef.current.delete(message.id);
          });
      });
    },
    [channel, myUserId]
  );

  // Optimistic send text - appears instantly
  const sendText = useCallback(async () => {
    if (!text.trim() || sending) return;

    const messageText = text.trim();
    const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

    // Create optimistic message
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      type: "text",
      text: messageText,
      senderId: myUserId,
      receiverId: targetUserId,
      side: "right",
      createdAt: { toDate: () => new Date() } as any,
      read: false,
    };

    // Add optimistic message immediately
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");

    // Scroll to bottom
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);

    // Send to Firebase in background
    try {
      setSending(true);
      await chatRepo.sendText(channel, myUserId, targetUserId, messageText, myName);
    } catch (error) {
      console.error("[ChatViewModel] sendText error:", error);
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }, [text, channel, myUserId, targetUserId, myName, sending]);

  // Optimistic send audio
  const sendAudio = useCallback(
    async (uri: string, duration?: number) => {
      const optimisticId = `optimistic_${Date.now()}_${optimisticIdCounter.current++}`;

      // Create optimistic message
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        type: "audio",
        text: "",
        audioUrl: uri, // Use local URI temporarily
        senderId: myUserId,
        receiverId: targetUserId,
        side: "right",
        createdAt: { toDate: () => new Date() } as any,
        read: false,
      };

      // Add optimistic message immediately
      setMessages((prev) => [...prev, optimisticMsg]);

      // Scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);

      // Upload and send to Firebase
      try {
        setSending(true);
        await chatRepo.sendAudio(channel, myUserId, targetUserId, uri, myName);
      } catch (error) {
        console.error("[ChatViewModel] sendAudio error:", error);
        // Remove failed optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      } finally {
        setSending(false);
      }
    },
    [channel, myUserId, targetUserId, myName]
  );

  // Delete message with optimistic removal
  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Optimistic delete - remove immediately
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        await chatRepo.deleteMessage(channel, messageId);
      } catch (error) {
        console.error("[ChatViewModel] deleteMessage error:", error);
        // Message will be restored by real-time listener if delete failed
      }
    },
    [channel]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId: string, newText: string) => {
      // Optimistic update
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
    listRef,
    deleteMessage,
    editMessage,
    sending,
    // Viewability for read status
    viewabilityConfig,
    onViewableItemsChanged,
  };
}
