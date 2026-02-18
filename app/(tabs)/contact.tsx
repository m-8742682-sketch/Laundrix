// contact.tsx
import React, { useRef, useState, useEffect, useCallback, memo, useMemo } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  Dimensions,
  Animated,
  Keyboard,
  Modal,
  Pressable,
  BackHandler,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { GestureHandlerRootView, PanGestureHandler, State } from "react-native-gesture-handler";

import EmojiPicker from "@/components/contact/EmojiPicker";
import Avatar, { resolveAvatar } from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import VoiceRecorder from "@/components/contact/VoiceRecorder";
import AudioBubble from "@/components/AudioBubble";
import { useChatViewModel } from "@/viewmodels/tabs/ChatViewModel";
import { ChatMessage } from "@/repositories/tabs/ChatRepository";

const { width, height } = Dimensions.get("window");

const SWIPE_THRESHOLD = 60;
const SWIPE_REPLY_THRESHOLD = 60;

const DateSeparator = memo(({ label }: { label: string }) => (
  <View style={styles.dateSeparatorContainer}>
    <View style={styles.dateSeparatorLine} />
    <View style={styles.dateSeparatorBadge}>
      <Text style={styles.dateSeparatorText}>{label}</Text>
    </View>
    <View style={styles.dateSeparatorLine} />
  </View>
));

// FIXED: Forwarded Badge Component - now works for both text and audio
const ForwardedBadge = memo(({ 
  fromName, 
  fromAvatar, 
  fromUserId,
  myUserId, 
  onPress,
  isMyMessage = false,
}: { 
  fromName: string; 
  fromAvatar?: string;
  fromUserId?: string;
  myUserId?: string; 
  onPress?: () => void;
  isMyMessage?: boolean;
}) => {
  return(
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
      style={{ marginBottom: 8 }}
    >
      <View style={[
        styles.forwardedContainer,
        isMyMessage && { borderBottomColor: 'rgba(255,255,255,0.2)' }
      ]}>
        <View style={styles.forwardedHeader}>
          <Ionicons 
            name="arrow-forward" 
            size={11} 
            color={isMyMessage ? "rgba(255,255,255,0.7)" : "#64748B"} 
          />
          <Text 
            style={[
              styles.forwardedLabel,
              { color: isMyMessage ? "rgba(255,255,255,0.85)" : "#64748B" }
            ]}
            numberOfLines={1}
            ellipsizeMode="clip"
          >
            Forwarded
          </Text>
        </View>
        
        <View style={styles.forwardedSender}>
          {fromAvatar ? (
            <Image 
              source={{ uri: fromAvatar }} 
              style={{ 
                width: 20, 
                height: 20, 
                borderRadius: 10,
                backgroundColor: '#E5E7EB'
              }}
            />
          ) : (
            <View style={[
              styles.forwardedAvatarPlaceholder,
              { backgroundColor: isMyMessage ? 'rgba(255,255,255,0.2)' : '#F1F5F9' }
            ]}>
              <Ionicons 
                name="person" 
                size={13} 
                color={isMyMessage ? "rgba(255,255,255,0.7)" : "#94A3B8"} 
              />
            </View>
          )}
          
          <Text 
            style={[
              styles.forwardedFromText,
              { color: isMyMessage ? '#fff' : '#1e293b' }
            ]}
          >
            {fromName}
          </Text>
    
          {onPress && (
            <Ionicons 
              name="chevron-forward" 
              size={15} 
              color={isMyMessage ? "rgba(255,255,255,0.7)" : "#64748B"} 
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

function getDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return "Today";
  if (messageDate.getTime() === yesterday.getTime()) return "Yesterday";

  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "long" });
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: messageDate.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

interface MessageActionsPopupProps {
  visible: boolean;
  onClose: () => void;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onDelete: () => void;
  position: { x: number; y: number };
  isMe: boolean;
  isCall?: boolean;
  onEdit: () => void;
  isForwarded?: boolean;
  messageType?: "text" | "audio" | "call";
}

const MessageActionsPopup = memo(({ 
  visible, 
  onClose, 
  onReply, 
  onCopy, 
  onForward, 
  onDelete, 
  position, 
  isMe,
  isCall = false,
  onEdit,
  isForwarded = false,
  messageType = "text"
}: MessageActionsPopupProps) => {
  if (!visible) return null;

  const popupWidth = 200;
  const popupHeight = isCall ? 100 : 180;

  let left = isMe 
    ? position.x - popupWidth - 10
    : position.x + 10;

  let top = position.y - popupHeight / 2;

  if (left < 10) left = 10;
  if (left + popupWidth > width - 10) left = width - popupWidth - 10;
  if (top < 60) top = 60;
  if (top + popupHeight > height - 100) top = height - popupHeight - 100;

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="fade"
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.actionsPopup, { left, top }]}>
          <View style={[
            styles.popupArrow, 
            isMe ? styles.popupArrowRight : styles.popupArrowLeft
          ]} />

          <LinearGradient
            colors={['#1e293b', '#0f172a']}
            style={styles.actionsGradient}
          >
            {!isCall && (
              <Pressable style={styles.actionButton} onPress={onReply}>
                <Ionicons name="arrow-undo-outline" size={20} color="#E0F2FE" />
                <Text style={styles.actionText}>Reply</Text>
              </Pressable>
            )}

            {isMe && messageType === "text" && !isForwarded && (
              <Pressable style={styles.actionButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={20} color="#E0F2FE" />
                <Text style={styles.actionText}>Edit</Text>
              </Pressable>
            )}

            {!isCall && (
              <Pressable style={styles.actionButton} onPress={onCopy}>
                <Ionicons name="copy-outline" size={20} color="#E0F2FE" />
                <Text style={styles.actionText}>Copy</Text>
              </Pressable>
            )}

            {!isCall && (
              <Pressable style={styles.actionButton} onPress={onForward}>
                <Ionicons name="arrow-forward-outline" size={20} color="#E0F2FE" />
                <Text style={styles.actionText}>Forward</Text>
              </Pressable>
            )}

            {isMe && (
              <Pressable style={styles.actionButton} onPress={onDelete}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete for Everyone</Text>
              </Pressable>
            )}
          </LinearGradient>
        </View>
      </Pressable>
    </Modal>
  );
});

const ReplyPreview = memo(({ message, targetName, onClose, isMe }: { 
  message: ChatMessage; 
  targetName: string; 
  onClose: () => void;
  isMe: boolean;
}) => (
  <View style={styles.replyPreviewContainer}>
    <View style={styles.replyPreviewContent}>
      <View style={[styles.replyPreviewLine, { backgroundColor: isMe ? '#6366F1' : '#0EA5E9' }]} />
      <View style={styles.replyPreviewTextContainer}>
        <Text style={[styles.replyPreviewName, { color: isMe ? '#6366F1' : '#0EA5E9' }]}>
          {message.side === "right" ? "You" : targetName}
        </Text>
        <Text style={styles.replyPreviewText} numberOfLines={1}>
          {message.type === "audio" ? "Voice message" : 
           message.type === "call" ? `${message.callType} call` : 
           message.text || ""}
        </Text>
      </View>
    </View>
    <TouchableOpacity 
      onPress={onClose} 
      style={styles.replyPreviewClose}
      hitSlop={{ top: 30, right: 30, bottom: 30, left: 30 }}
      activeOpacity={0.7}
    >
      <View style={styles.closeButtonCircle}>
        <Ionicons name="close" size={24} color="#64748B" />
      </View>
    </TouchableOpacity>
  </View>
));

// NEW: Scroll to bottom button component
const ScrollToBottomButton = memo(({ 
  visible, 
  onPress, 
  unreadCount = 0 
}: { 
  visible: boolean; 
  onPress: () => void;
  unreadCount?: number;
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 100,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.scrollToBottomContainer,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }
      ]}
    >
      <TouchableOpacity 
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.scrollToBottomButton}
      >
        <LinearGradient
          colors={['#6366F1', '#4F46E5']}
          style={styles.scrollToBottomGradient}
        >
          <Ionicons name="arrow-down" size={20} color="#fff" />
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
});

const MessageBubble = memo(({ 
  item, isMe, showAvatar, targetName, targetAvatar, myUserId, myUserName, myUserAvatar, onLongPress, onSwipeReply,
  editingId, editText, setEditText, setEditingId, editMessage, onShowActions, onEditHeightChange,
}: any) => {
  const isPending = item.id && item.id.startsWith("optimistic_");

  const translateX = useRef(new Animated.Value(0)).current;
  const [showReplyIcon, setShowReplyIcon] = useState(false);
  const hasTriggeredHaptic = useRef(false);
  const [localEditText, setLocalEditText] = useState(editText);

  const isMyMessage = isMe;
  const isEditing = editingId === item.id;

  // Sync local text with prop when editing starts
  useEffect(() => {
    if (isEditing) {
      setLocalEditText(editText);
    }
  }, [isEditing, editText]);

  const onGestureEvent = useCallback((event: any) => {
    const x = event.nativeEvent.translationX;

    let clampedX = x;
    if (isMyMessage) {
      clampedX = Math.min(0, x);
    } else {
      clampedX = Math.max(0, x);
    }

    const absX = Math.abs(clampedX);
    if (absX > SWIPE_REPLY_THRESHOLD && !showReplyIcon) {
      setShowReplyIcon(true);
      if (!hasTriggeredHaptic.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        hasTriggeredHaptic.current = true;
      }
    } else if (absX <= SWIPE_REPLY_THRESHOLD && showReplyIcon) {
      setShowReplyIcon(false);
      hasTriggeredHaptic.current = false;
    }

    translateX.setValue(clampedX);
  }, [isMyMessage, showReplyIcon]);

  const onHandlerStateChange = useCallback((event: any) => {
    const { state, translationX } = event.nativeEvent;

    if (state === State.END) {
      const absX = Math.abs(translationX);
      if (absX > SWIPE_THRESHOLD) {
        onSwipeReply(item);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();

      setShowReplyIcon(false);
      hasTriggeredHaptic.current = false;
    }
  }, [item, onSwipeReply, translateX]);

  const renderSwipeableMessage = (content: React.ReactNode) => (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={isMyMessage ? [-20, 1000] : [-1000, 20]}
      failOffsetY={[-100, 100]}
    >
      <Animated.View style={[
        styles.swipeContainer,
        { transform: [{ translateX }] }
      ]}>
        {showReplyIcon && (
          <Animated.View style={[
            styles.replyIconContainer,
            { 
              [isMyMessage ? 'right' : 'left']: 8,
              opacity: translateX.interpolate({
                inputRange: isMyMessage ? [-SWIPE_REPLY_THRESHOLD - 20, -SWIPE_REPLY_THRESHOLD, 0] : [0, SWIPE_REPLY_THRESHOLD, SWIPE_REPLY_THRESHOLD + 20],
                outputRange: [1, 1, 0],
                extrapolate: 'clamp'
              })
            }
          ]}>
            <Ionicons name="arrow-undo" size={20} color="#0EA5E9" style={{
              transform: [{ rotate: isMyMessage ? '180deg' : '0deg' }]
            }} />
          </Animated.View>
        )}

        {content}
      </Animated.View>
    </PanGestureHandler>
  );

  // FIXED: Navigation handler for forwarded badge
  const handleForwardedPress = useCallback((forwardedUserId?: string, forwardedName?: string, forwardedAvatar?: string) => {
    if (!forwardedUserId) return;
    
    if (forwardedUserId === myUserId) {
      router.push({
        pathname: "/(tabs)/contact",
        params: {
          targetUserId: myUserId,
          targetName: myUserName || "Me",
          targetAvatar: myUserAvatar || "",
        }
      });
    } else {
      router.push({
        pathname: "/(tabs)/contact",
        params: {
          targetUserId: forwardedUserId,
          targetName: forwardedName || "User",
          targetAvatar: forwardedAvatar || "",
        }
      });
    }
  }, [myUserId, myUserName, myUserAvatar]);

  // IMPROVED: Edit handlers with position preservation
  const handleEditChange = useCallback((text: string) => {
    setLocalEditText(text);
    setEditText(text);
  }, [setEditText]);

  const handleSaveEdit = useCallback(async () => {
    if (!localEditText.trim()) return;
    await editMessage(item.id, localEditText.trim());
    // Don't clear editingId here - parent handles it
    setEditingId(null);
  }, [localEditText, item.id, editMessage, setEditingId]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, [setEditingId, setEditText]);

  if (item.type === "call") {
    const isMissed = item.callStatus === "missed";
    const isVoice = item.callType === "voice";
    const isOutgoing = item.side === "right";

    const handleCallPress = () => {
      const otherUserId = item.receiverId === myUserId ? item.senderId : item.receiverId;
      if (isVoice) {
        router.push({ 
          pathname: "/call/voice-outgoing", 
          params: { 
            targetUserId: otherUserId, 
            targetName: targetName ?? "User", 
            targetAvatar: targetAvatar ?? "" 
          }
        });
      } else {
        router.push({ 
          pathname: "/call/video-outgoing", 
          params: { 
            targetUserId: otherUserId, 
            targetName: targetName ?? "User", 
            targetAvatar: targetAvatar ?? "" 
          }
        });
      }
    };

    const handleLongPress = (event: any) => {
      const { pageX, pageY } = event.nativeEvent;
      onShowActions(item, true, { nativeEvent: { pageX, pageY } });
    };

    return (
      <View style={[
        styles.row, 
        isOutgoing ? styles.rowRight : styles.rowLeft,
        { marginVertical: 6 }
      ]}>
        {!isOutgoing && (
          <View style={styles.avatarSlot}>
            {showAvatar && (
              <Avatar name={targetName} avatarUrl={targetAvatar} size={32} />
            )}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleCallPress}
          onLongPress={handleLongPress}
          delayLongPress={300}
          style={[
            styles.callBubble,
            isOutgoing ? styles.callBubbleOutgoing : styles.callBubbleIncoming,
            isMissed && (isOutgoing ? styles.callBubbleMissedMe : styles.callBubbleMissed),
          ]}
        >
          <View style={[
            styles.callIconContainer,
            isOutgoing 
              ? { backgroundColor: 'rgba(255,255,255,0.2)' }
              : (isMissed ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#E0F2FE' })
          ]}>
            <Ionicons 
              name={isVoice ? "call" : "videocam"} 
              size={18} 
              color={isOutgoing 
                ? "#fff" 
                : (isMissed ? "#DC2626" : "#0284C7")
              } 
            />
          </View>

          <View style={styles.callContent}>
            <Text style={[
              styles.callTitle,
              isOutgoing ? { color: '#fff' } : (isMissed ? { color: '#991B1B' } : { color: '#0C4A6E' })
            ]}>
              {isMissed ? `Missed ${isVoice ? "Voice" : "Video"} Call` : `${isVoice ? "Voice" : "Video"} Call Ended`}
            </Text>

            <View style={styles.callMeta}>
              <Text style={[
                styles.callTime,
                isOutgoing ? { color: 'rgba(255,255,255,0.8)' } : { color: '#64748B' }
              ]}>
                {formatMsgTime(item.createdAt)}
              </Text>
              {!isMissed && item.callDuration > 0 && (
                <>
                  <Text style={[
                    styles.callDot,
                    isOutgoing ? { color: 'rgba(255,255,255,0.6)' } : { color: '#94A3B8' }
                  ]}>•</Text>
                  <Ionicons 
                    name="time-outline" 
                    size={10} 
                    color={isOutgoing ? "rgba(255,255,255,0.8)" : "#64748B"} 
                  />
                  <Text style={[
                    styles.callDuration,
                    isOutgoing ? { color: '#fff' } : { color: '#0EA5E9' }
                  ]}>
                    {formatCallDuration(item.callDuration)}
                  </Text>
                </>
              )}
            </View>
          </View>

          <Ionicons 
            name={isMissed ? "alert-circle" : "checkmark-circle"} 
            size={22} 
            color={isOutgoing 
              ? "rgba(255,255,255,0.9)" 
              : (isMissed ? "#EF4444" : "#0EA5E9")
            } 
          />
        </TouchableOpacity>
      </View>
    );
  }

  // FIXED: Audio message with forwarded badge
  if (item.type === "audio") {
    return renderSwipeableMessage(
      <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
        {!isMe && (
          <View style={styles.avatarSlot}>
            {showAvatar && (
              <Avatar name={targetName} avatarUrl={targetAvatar} size={32} />
            )}
          </View>
        )}
        
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={(e) => {
            const { pageX, pageY } = e.nativeEvent;
            onShowActions(item, false, { nativeEvent: { pageX, pageY } });
          }}
          delayLongPress={300}
          style={{ maxWidth: "190%" }}
        >
          <AudioBubble 
            uri={item.audioUrl!} 
            isMe={isMe} 
            timestamp={formatMsgTime(item.createdAt)}
            isPending={isPending}
            read={item.read}
            forwardedFrom={item.forwardedFrom}
            fromAvatar={item.forwardedFromAvatar}
            fromUserId={item.forwardedFromUserId}
            myUserId={myUserId}
            onForwardedPress={item.forwardedFromUserId ? () => handleForwardedPress(item.forwardedFromUserId, item.forwardedFrom, item.forwardedFromAvatar) : undefined}
            hideForwarded={false} // Let AudioBubble render it internally
          />
        </TouchableOpacity>
      </View>
    );
  }

  // IMPROVED: Text message with better editing UI
  const renderTextContent = () => {
    if (isEditing) {
      return (
        <View style={styles.editContainer}>
          <TextInput
            value={localEditText}
            onChangeText={handleEditChange}
            autoFocus
            multiline
            style={[styles.editInput, { color: "#fff" }]}
            placeholder="Edit message..."
            placeholderTextColor="rgba(255,255,255,0.5)"
          />
          <View style={styles.editActionsRow}>
            <TouchableOpacity 
              onPress={handleCancelEdit}
              style={styles.editButtonSecondary}
              activeOpacity={0.7}
            >
              <Text style={styles.editButtonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleSaveEdit}
              style={styles.editButtonPrimary}
              activeOpacity={0.7}
            >
              <LinearGradient 
                colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.15)"]} 
                style={styles.editButtonPrimaryGradient}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={styles.editButtonPrimaryText}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <>
        {item.replyTo && (
          <View style={styles.repliedMessageContainer}>
            <View style={styles.repliedMessageLine} />
            <View style={styles.repliedMessageContent}>
              <View style={styles.repliedToLabel}>
                <Ionicons name="arrow-undo" size={10} color="rgba(255,255,255,0.6)" />
                <Text style={styles.repliedToText}>Replied to {item.replyTo.side === "right" ? "Yourself" : targetName}</Text>
              </View>
              <Text style={styles.repliedMessageName}>
                {item.replyTo.side === "right" ? "You" : targetName}
              </Text>
              <Text style={styles.repliedMessageText} numberOfLines={2}>
                {item.replyTo.type === "audio" ? "Voice message" : 
                 item.replyTo.type === "call" ? `${item.replyTo.callType} call` : 
                 item.replyTo.text || ""}
              </Text>
            </View>
          </View>
        )}
        {/* Forwarded badge for MY messages */}
        {item.forwardedFrom && (
            <ForwardedBadge 
              fromName={item.forwardedFrom} 
              fromAvatar={item.forwardedFromAvatar}
              fromUserId={item.forwardedFromUserId}
              myUserId={myUserId}
              isMyMessage={true} 
              onPress={() => handleForwardedPress(item.forwardedFromUserId, item.forwardedFrom, item.forwardedFromAvatar)}
            />
          )}
        <Text style={[styles.text, styles.myText]}>{item.text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.myTime}>{formatMsgTime(item.createdAt)}</Text>
          {isPending ? (
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
          ) : (
            <Ionicons 
              name={item.read ? "checkmark-done" : "checkmark"} 
              size={12} 
              color={item.read ? "#67E8F9" : "rgba(255,255,255,0.7)"} 
            />
          )}
        </View>
      </>
    );
  };

  return renderSwipeableMessage(
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      {!isMe && (
        <View style={styles.avatarSlot}>
          {showAvatar && (
            <Avatar name={targetName} avatarUrl={targetAvatar} size={32} />
          )}
        </View>
      )}

      <TouchableOpacity
        activeOpacity={isEditing ? 1 : 0.9}
        onLongPress={isEditing ? undefined : (e) => {
          const { pageX, pageY } = e.nativeEvent;
          onShowActions(item, false, { nativeEvent: { pageX, pageY } });
        }}
        delayLongPress={300}
        style={{ maxWidth: "90%" }}
      >
        {isMe ? (
        // MY MESSAGE (Blue Gradient)
        <LinearGradient
            colors={isPending ? ["#94A3B8", "#64748B"] : ["#6366F1", "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.bubble, 
              styles.myBubble,
              isEditing && styles.myBubbleEditing
            ]}
        >
            {renderTextContent()}
          </LinearGradient>
        ) : (
          // OTHER PERSON'S MESSAGE (White Bubble)
          <View style={[styles.bubble, styles.otherBubble]}>
            {item.replyTo && (
              <View style={[styles.repliedMessageContainer, { borderLeftColor: '#0EA5E9' }]}>
                <View style={[styles.repliedMessageLine, { backgroundColor: '#0EA5E9' }]} />
                <View style={styles.repliedMessageContent}>
                  <View style={styles.repliedToLabelOther}>
                    <Ionicons name="arrow-undo" size={10} color="#94A3B8" />
                    <Text style={styles.repliedToTextOther}>Replied to {item.replyTo.side === "right" ? targetName : "Yourself"}</Text>
                  </View>
                  <Text style={[styles.repliedMessageName, { color: '#0EA5E9' }]}>
                    {item.replyTo.side === "right" ? "You" : targetName}
                  </Text>
                  <Text style={[styles.repliedMessageText, { color: '#475569' }]} numberOfLines={2}>
                    {item.replyTo.type === "audio" ? "Voice message" : 
                     item.replyTo.type === "call" ? `${item.replyTo.callType} call` : 
                     item.replyTo.text || ""}
                  </Text>
                </View>
              </View>
            )}
            
            {/* Forwarded badge for RECEIVED messages */}
            {item.forwardedFrom && (
                <ForwardedBadge 
                  fromName={item.forwardedFrom} 
                  fromAvatar={item.forwardedFromAvatar}
                  fromUserId={item.forwardedFromUserId}
                  myUserId={myUserId}
                  isMyMessage={false} 
                  onPress={() => handleForwardedPress(item.forwardedFromUserId, item.forwardedFrom, item.forwardedFromAvatar)}
                />
            )}
            <Text style={[styles.text, styles.otherText]}>{item.text}</Text>
            <Text style={styles.otherTime}>{formatMsgTime(item.createdAt)}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
});

export default function ContactScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { 
    targetUserId, 
    targetName, 
    targetAvatar,
    forwardedMessage,
    forwardedType,
    forwardedFrom,
    forwardedAudioUrl,
    sourceTargetAvatar,
    forwardedFromUserId,
  } = useLocalSearchParams<{
    targetUserId: string;
    targetName?: string;
    targetAvatar?: string;
    forwardedMessage?: string;
    forwardedType?: string;
    forwardedFrom?: string;
    forwardedAudioUrl?: string;
    sourceTargetAvatar?: string;
    forwardedFromUserId?: string;
  }>();

  if (!user || !targetUserId) return null;

  const myUserId = user.uid;
  const channel = `chat-${[myUserId, targetUserId].sort().join("-")}`;

  const {
    messages, text, setText, sendText, sendAudio, listRef,
    deleteMessage, editMessage, viewabilityConfig, onViewableItemsChanged,
  } = useChatViewModel(channel, myUserId, targetUserId, user.name);

  const [showEmoji, setShowEmoji] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [popupMsg, setPopupMsg] = useState<ChatMessage | null>(null);
  const [isCallPopup, setIsCallPopup] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const toastTimeout = useRef<NodeJS.Timeout | null>(null);

  // NEW: Scroll to bottom button state
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const isNearBottom = useRef(true);
  const contentHeight = useRef(0);
  const scrollViewHeight = useRef(0);
  const lastScrollY = useRef(0);
  const rafId = useRef<number | null>(null);

  const lastForwardedParams = useRef<string>("");

  const inputRef = useRef<TextInput>(null);

  const showToastMessage = useCallback((message: string) => {
    if (toastTimeout.current) {
      clearTimeout(toastTimeout.current);
    }

    setToastMessage(message);
    setShowToast(true);

    toastTimeout.current = setTimeout(() => {
      setShowToast(false);
    }, 2000);
  }, []);

  // FIXED: Forward handling with proper avatar trimming
  useEffect(() => {
    const currentParams = `${forwardedType}-${forwardedMessage}-${forwardedAudioUrl}-${sourceTargetAvatar}`;

    if (currentParams !== lastForwardedParams.current) {
      lastForwardedParams.current = "";
    }

    if (!lastForwardedParams.current && (forwardedMessage || forwardedAudioUrl)) {
      const hasAudio = forwardedType === "audio" && forwardedAudioUrl;
      const hasText = forwardedType === "text" && forwardedMessage;

      if (hasAudio || hasText) {
        lastForwardedParams.current = currentParams;

        const sendForwardedMessage = async () => {
          try {
            // TRIM AVATAR URL TO REMOVE TRAILING SPACES
            const cleanAvatar = sourceTargetAvatar?.trim();
            
            if (hasAudio) {
              await sendAudio(forwardedAudioUrl, forwardedFrom, cleanAvatar, forwardedFromUserId);
              showToastMessage("Voice message forwarded!");
            } else if (hasText) {
              await sendText(forwardedMessage, forwardedFrom, cleanAvatar, forwardedFromUserId);
              showToastMessage("Message forwarded!");
            }

            router.setParams({ 
              forwardedMessage: undefined, 
              forwardedType: undefined, 
              forwardedFrom: undefined,
              forwardedAudioUrl: undefined,
              sourceTargetAvatar: undefined,
            });

          } catch (error) {
            console.error("[Contact] Forward error:", error);
            showToastMessage("Forward failed");
            lastForwardedParams.current = "";
          }
        };

        sendForwardedMessage();
      }
    }
  }, [forwardedMessage, forwardedType, forwardedFrom, forwardedAudioUrl, sourceTargetAvatar, forwardedFromUserId, sendText, sendAudio, showToastMessage]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      router.push("/(tabs)/conversations");
      return true;
    });

    return () => backHandler.remove();
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  // NEW: Scroll handlers for scroll-to-bottom button - OPTIMIZED
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    // Cancel pending frame
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
    }
    
    rafId.current = requestAnimationFrame(() => {
      const THRESHOLD = 150;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const shouldShow = distanceFromBottom > THRESHOLD;
      
      // Only update if changed (prevents unnecessary re-renders)
      if (shouldShow !== showScrollButton) {
        setShowScrollButton(shouldShow);
      }
      
      isNearBottom.current = !shouldShow;
      lastScrollY.current = contentOffset.y;
    });
  }, [showScrollButton]);

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
    setShowScrollButton(false);
    isNearBottom.current = true;
  }, [listRef]);

  // IMPROVED: Only auto-scroll on new messages if user is near bottom and not editing
  useEffect(() => {
    if (messages.length > 0 && isNearBottom.current && !editingId) {
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [messages.length, editingId, scrollToBottom]);

  // IMPROVED: Don't auto-scroll when editing starts
  useEffect(() => {
    if (editingId) {
      // Disable auto-scroll when editing
      isNearBottom.current = false;
    }
  }, [editingId]);

  const messagesWithSeparators = useMemo(() => {
    if (!messages.length) return [];
    const result: (ChatMessage | { type: "separator"; label: string; key: string })[] = [];
    let lastDateLabel = "";

    messages.forEach((msg, index) => {
      const msgDate = msg.createdAt?.toDate?.() || new Date();
      const dateLabel = getDateLabel(msgDate);
      if (dateLabel !== lastDateLabel) {
        result.push({ type: "separator", label: dateLabel, key: `sep_${dateLabel}_${index}` });
        lastDateLabel = dateLabel;
      }
      result.push(msg);
    });
    return result;
  }, [messages]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      // Only scroll if not editing
      if (!editingId) {
        listRef.current?.scrollToEnd({ animated: true });
      }
    });
    return () => sub.remove();
  }, [editingId, listRef]);

  const onCall = useCallback(() => {
    router.push({ 
      pathname: "/call/voice-outgoing", 
      params: { 
        targetUserId, 
        targetName: targetName ?? "User", 
        targetAvatar: targetAvatar ?? "" 
      }
    });
  }, [targetUserId, targetName, targetAvatar]);

  const onVideoCall = useCallback(() => {
    router.push({ 
      pathname: "/call/video-outgoing", 
      params: { 
        targetUserId, 
        targetName: targetName ?? "User", 
        targetAvatar: targetAvatar ?? "" 
      }
    });
  }, [targetUserId, targetName, targetAvatar]);

  const handleShowActions = useCallback((item: ChatMessage, isCall: boolean, event?: any) => {
    let x = width / 2;
    let y = height / 2;

    if (event?.nativeEvent) {
      x = event.nativeEvent.pageX;
      y = event.nativeEvent.pageY;
    }

    setPopupMsg(item);
    setIsCallPopup(isCall);
    setPopupPosition({ x, y });
    setPopupVisible(true);
  }, []);

  const handlePopupClose = () => {
    setPopupVisible(false);
    setPopupMsg(null);
  };

  const handleReply = () => {
    if (!popupMsg) return;
    setReplyingTo(popupMsg);
    handlePopupClose();
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCopy = async () => {
    if (!popupMsg) return;
    let textToCopy = "";
    if (popupMsg.type === "text") {
      textToCopy = popupMsg.text || "";
    } else if (popupMsg.type === "audio") {
      textToCopy = popupMsg.audioUrl || "";
    } else if (popupMsg.type === "call") {
      textToCopy = `${popupMsg.callType} call - ${popupMsg.callStatus}`;
    }
    await Clipboard.setStringAsync(textToCopy);
    handlePopupClose();
    showToastMessage("Copied!");
  };

  // FIXED: handleForward with proper original sender detection
  const handleForward = () => {
    if (!popupMsg) return;
    handlePopupClose();

    const isMyMessage = popupMsg.side === "right";
    
    let originalSenderName: string;
    let originalSenderAvatar: string;
    let originalSenderId: string;

    if (popupMsg.forwardedFrom && popupMsg.forwardedFromUserId) {
      // Already forwarded - preserve original
      originalSenderName = popupMsg.forwardedFrom;
      originalSenderAvatar = (popupMsg.forwardedFromAvatar || "").trim();
      originalSenderId = popupMsg.forwardedFromUserId;
    } else if (isMyMessage) {
      // My message - I'm the source
      originalSenderName = user?.name || "Me";
      originalSenderAvatar = (user?.avatarUrl || "").trim();
      originalSenderId = myUserId;
    } else {
      // Other's message - they're the source
      originalSenderName = targetName || "User";
      originalSenderAvatar = (targetAvatar || "").trim();
      originalSenderId = targetUserId;
    }

    router.push({
      pathname: "/(tabs)/conversations",
      params: { 
        forwardMessageId: popupMsg.id,
        forwardType: popupMsg.type,
        forwardContent: popupMsg.text || "",
        forwardAudioUrl: popupMsg.audioUrl || "",
        forwardCallType: popupMsg.callType || "",
        forwardCallStatus: popupMsg.callStatus || "",
        forwardCallDuration: String(popupMsg.callDuration || 0),
        sourceTargetName: originalSenderName,
        sourceTargetAvatar: originalSenderAvatar,
        sourceUserId: originalSenderId,
        isForwarded: "true",
      }
    });
  };

  // IMPROVED: Handle edit without scrolling
  const handleEdit = () => {
    if (!popupMsg || popupMsg.type !== "text") return;
    setEditingId(popupMsg.id);
    setEditText(popupMsg.text || "");
    handlePopupClose();
    // Don't auto-focus to prevent scroll
  };

  const handleDelete = async () => {
    if (!popupMsg) return;
    try {
      await deleteMessage(popupMsg.id);
      showToastMessage("Deleted for everyone");
    } catch (error) {
      console.error("[Contact] Delete failed:", error);
      showToastMessage("Delete failed");
    }
    handlePopupClose();
  };

  const handleSwipeReply = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = useCallback(() => {
    if (!text.trim()) return;
    sendText();
    setReplyingTo(null);
    // Scroll to bottom after sending
    setTimeout(() => scrollToBottom(true), 100);
  }, [text, sendText, scrollToBottom]);

  const renderItem = useCallback(({ item, index }: any) => {
    if ("label" in item && item.type === "separator") {
      return <DateSeparator label={item.label} />;
    }
    const msg = item as ChatMessage;
    const isMe = msg.side === "right";
    let prev: ChatMessage | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const prevItem = messagesWithSeparators[i];
      if (!("label" in prevItem)) { 
        prev = prevItem as ChatMessage; 
        break; 
      }
    }
    const showAvatar = !prev || prev.side !== msg.side || prev.type === "call";
    return (
      <MessageBubble 
        item={msg} 
        isMe={isMe} 
        showAvatar={showAvatar} 
        targetName={targetName} 
        targetAvatar={targetAvatar}
        myUserId={myUserId}
        myUserName={user?.name}
        myUserAvatar={user?.avatarUrl}
        onShowActions={handleShowActions}
        onSwipeReply={handleSwipeReply}
        editingId={editingId} 
        editText={editText} 
        setEditText={setEditText}
        setEditingId={setEditingId} 
        editMessage={editMessage} 
      />
    );
  }, [messagesWithSeparators, targetName, targetAvatar, myUserId, user?.name, user?.avatarUrl, handleShowActions, handleSwipeReply, editingId, editText, editMessage]);

  const keyExtractor = useCallback((item: any) => ("label" in item ? item.key : item.id), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        <View style={styles.background}>
          <Animated.View style={[styles.bgCircle1, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.bgCircle2, { transform: [{ scale: pulseAnim }] }]} />
        </View>

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/conversations")} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={28} color="#0EA5E9" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.avatarContainer}>
              <Avatar name={targetName} avatarUrl={targetAvatar} size={40} />
              <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerName}>{targetName ?? "User"}</Text>
              <Text style={styles.headerStatus}>Active now</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={onCall}>
              <LinearGradient 
                      colors={["#3b82f6", "#2563eb"]} 
                      style={styles.iconButton}
                    >
                      <Ionicons name="call" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity onPress={onVideoCall}>
              <LinearGradient 
                colors={["#3b82f6", "#2563eb"]} 
                style={styles.iconButton}
              >
                <Ionicons name="videocam" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
        >
          <View style={styles.chatContainer}>
            <FlatList
              ref={listRef}
              data={messagesWithSeparators}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
            />

            {/* NEW: Scroll to bottom button */}
            <ScrollToBottomButton 
              visible={showScrollButton}
              onPress={() => scrollToBottom(true)}
              unreadCount={unreadCount}
            />
          </View>

          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {replyingTo && (
              <ReplyPreview 
                message={replyingTo} 
                targetName={targetName || "User"} 
                onClose={() => setReplyingTo(null)}
                isMe={replyingTo.side === "right"}
              />
            )}
            <View style={styles.inputWrapper}>
              {isRecordingUI ? (
                <View style={styles.recordingBar}>
                  <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
                  <Text style={styles.recordingTime}>{formatTime(elapsedMs)}</Text>
                  <Text style={styles.recordingHint} numberOfLines={1}>
                    {!isLocked ? "Slide left to cancel" : "Recording..."}
                  </Text>
                </View>
              ) : (
                <View style={styles.inputRow}>
                  <TouchableOpacity 
                    onPress={() => { Keyboard.dismiss(); setShowEmoji(true); }} 
                    style={styles.emojiButton}
                  >
                    <Ionicons name="happy-outline" size={24} color="#94A3B8" />
                  </TouchableOpacity>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    placeholder="Message..."
                    placeholderTextColor="#94A3B8"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={1000}
                  />
                </View>
              )}

              <View style={styles.sendContainer}>
                {!text.trim() ? (
                  <VoiceRecorder
                    onSend={sendAudio}
                    onRecordingStateChange={setIsRecordingUI}
                    onTick={setElapsedMs}
                    onLockChange={setIsLocked}
                  />
                ) : (
                  <TouchableOpacity onPress={handleSend} activeOpacity={0.8}>
                    <LinearGradient 
                      colors={["#3b82f6", "#2563eb"]} 
                      style={styles.sendButton}
                    >
                      <Ionicons name="send" size={24} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>

        <MessageActionsPopup
          visible={popupVisible}
          onClose={handlePopupClose}
          onReply={handleReply}
          onCopy={handleCopy}
          onForward={handleForward}
          onDelete={handleDelete}
          onEdit={handleEdit} 
          position={popupPosition}
          isMe={popupMsg?.side === "right"}
          isCall={isCallPopup}
          isForwarded={!!popupMsg?.forwardedFrom}    
          messageType={popupMsg?.type}   
        />

        {showEmoji && (
          <View style={[styles.emojiPicker, { paddingBottom: insets.bottom }]}>
            <View style={styles.emojiHeader}>
              <TouchableOpacity onPress={() => { 
                setShowEmoji(false); 
                setTimeout(() => inputRef.current?.focus(), 100); 
              }}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>
            <EmojiPicker onSelect={(emoji) => setText(t => t + emoji)} />
          </View>
        )}

        {showToast && (
          <Animated.View 
            style={[
              styles.toast,
              { 
                bottom: insets.bottom + 80,
              }
            ]}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.toastGradient}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </LinearGradient>
          </Animated.View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC" 
  },

  background: { 
    ...StyleSheet.absoluteFillObject, 
    overflow: "hidden" 
  },
  bgCircle1: { 
    position: "absolute", 
    width: 400, 
    height: 400, 
    borderRadius: 200, 
    backgroundColor: "#E0F2FE", 
    opacity: 0.4, 
    top: -150, 
    right: -100 
  },
  bgCircle2: { 
    position: "absolute", 
    width: 300, 
    height: 300, 
    borderRadius: 150, 
    backgroundColor: "#EEF2FF", 
    opacity: 0.5, 
    bottom: 100, 
    left: -100 
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  actionsPopup: {
    position: 'absolute',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  actionsGradient: {
    padding: 8,
    minWidth: 180,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 15,
    color: '#E0F2FE',
    fontWeight: '500',
  },
  popupArrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  popupArrowLeft: {
    left: -8,
    top: '50%',
    marginTop: -8,
    borderRightWidth: 8,
    borderRightColor: '#1e293b',
  },
  popupArrowRight: {
    right: -8,
    top: '50%',
    marginTop: -8,
    borderLeftWidth: 8,
    borderLeftColor: '#1e293b',
  },

  swipeContainer: {
    position: 'relative',
  },
  replyIconContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    backgroundColor: '#E0F2FE',
    padding: 8,
    borderRadius: 20,
    zIndex: -1,
  },

  // NEW: Scroll to bottom button styles
  chatContainer: {
    flex: 1,
    position: 'relative',
  },
  scrollToBottomContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 100,
  },
  scrollToBottomButton: {
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scrollToBottomGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F8FAFC',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  replyPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewLine: {
    width: 4,
    height: '100%',
    minHeight: 36,
    backgroundColor: '#6366F1',
    marginRight: 10,
    borderRadius: 2,
  },
  replyPreviewTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  replyPreviewName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366F1',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 13,
    color: '#64748B',
  },
  replyPreviewClose: {
    padding: 12,
    marginLeft: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repliedMessageContainer: {
    flexDirection: 'row',
    marginBottom: 6,
    opacity: 0.9,
  },
  repliedMessageLine: {
    width: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginRight: 8,
    borderRadius: 2,
  },
  repliedMessageContent: {
    flex: 1,
  },
  repliedMessageName: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 1,
  },
  repliedMessageText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  // NEW: Replied to label styles
  repliedToLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    opacity: 0.8,
  },
  repliedToText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  repliedToLabelOther: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  repliedToTextOther: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  audioForwardedContainer: {
    marginBottom: 4,
  },
  
  forwardedContainerAudio: {
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 0,
  },
  
  forwardedLabelAudio: {
    color: '#6366F1',
  },

  forwardedAvatar: {
    marginLeft: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },

  toast: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 16, 
    paddingBottom: 12, 
    backgroundColor: "rgba(255,255,255,0.95)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    zIndex: 10
  },
  headerButton: { 
    padding: 4,
    marginLeft: -4
  },
  headerCenter: { 
    flexDirection: "row", 
    alignItems: "center", 
    flex: 1,
    marginLeft: 8
  },
  avatarContainer: { 
    position: 'relative',
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  onlineIndicator: { 
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff'
  },
  headerText: { 
    marginLeft: 12 
  },
  headerName: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#0F172A",
    letterSpacing: -0.3
  },
  headerStatus: { 
    fontSize: 12, 
    color: "#10B981",
    fontWeight: "500",
    marginTop: 1
  },
  headerActions: { 
    flexDirection: 'row', 
    gap: 8 
  },
  iconButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: "#F0F9FF", 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0F2FE'
  },

  keyboardView: {
    flex: 1
  },

  listContent: { 
    paddingHorizontal: 16, 
    paddingVertical: 16,
    gap: 2
  },

  row: { 
    flexDirection: "row", 
    marginBottom: 4,
    alignItems: 'flex-end' 
  },
  rowLeft: { 
    justifyContent: "flex-start" 
  },
  rowRight: { 
    justifyContent: "flex-end" 
  },
  avatarSlot: { 
    width: 36, 
    marginRight: 8,
    alignItems: 'center'
  },
  bubble: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20,
    maxWidth: "100%"
  },
  myBubble: { 
    borderBottomRightRadius: 4,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
  // NEW: Editing state styling
  myBubbleEditing: {
    borderBottomRightRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 200,
  },
  otherBubble: { 
    backgroundColor: "#fff", 
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0"
  },
  text: { 
    fontSize: 15, 
    lineHeight: 20,
    letterSpacing: -0.2
  },
  myText: { 
    color: "#fff" 
  },
  otherText: { 
    color: "#1E293B" 
  },
  messageFooter: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-end', 
    marginTop: 4, 
    gap: 4 
  },
  myTime: { 
    fontSize: 11, 
    color: "rgba(255,255,255,0.8)", 
    fontWeight: "500" 
  },
  otherTime: { 
    fontSize: 11, 
    color: "#94A3B8", 
    marginTop: 4,
    fontWeight: "500",
    alignSelf: 'flex-end'
  },

  // NEW: Improved edit UI styles
  editContainer: {
    minWidth: 220,
  },
  editInput: {
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
    marginBottom: 12,
    minHeight: 40,
  },
  editActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButtonSecondary: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  editButtonSecondaryText: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 14,
  },
  editButtonPrimary: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  editButtonPrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 4,
    borderRadius: 8,
  },
  editButtonPrimaryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  callBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    maxWidth: '72%',
    gap: 12,
  },
  callBubbleIncoming: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  callBubbleOutgoing: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  callBubbleMissed: {
    backgroundColor: '#fff',
  },
  callBubbleMissedMe: {
    backgroundColor: '#EF4444',
  },
  callIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callContent: {
    flex: 1,
  },
  callTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  callDot: {
    fontSize: 12,
  },
  callDuration: {
    fontSize: 12,
    fontWeight: '600',
  },

  inputContainer: { 
    paddingHorizontal: 16, 
    paddingTop: 8,
    backgroundColor: '#F8FAFC'
  },
  inputWrapper: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff',
    borderRadius: 24, 
    padding: 6,
    paddingLeft: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0"
  },
  inputRow: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center',
    minHeight: 40
  },
  emojiButton: { 
    padding: 6,
    marginRight: 4
  },
  textInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#0F172A',
    maxHeight: 100,
    paddingVertical: 8,
    lineHeight: 20
  },
  sendContainer: { 
    marginLeft: 6 
  },
  sendButton: { 
    width: 50, 
    height: 50, 
    borderRadius: 30, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  recordingBar: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingLeft: 12,
    height: 40
  },
  recordingDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: '#EF4444',
    marginRight: 8
  },
  recordingTime: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#0F172A',
    width: 50
  },
  recordingHint: { 
    fontSize: 13, 
    color: '#94A3B8',
    flex: 1
  },

  emojiPicker: { 
    backgroundColor: '#fff', 
    height: 320, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  emojiHeader: { 
    padding: 12, 
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0'
  },
  doneButton: { 
    color: '#0EA5E9', 
    fontWeight: '700', 
    fontSize: 16 
  },

  editActions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    marginTop: 8,
    gap: 16
  },
  editCancel: { 
    color: 'rgba(255,255,255,0.8)', 
    fontWeight: '600',
    fontSize: 14
  },
  editSave: { 
    color: '#fff', 
    fontWeight: '700',
    fontSize: 14
  },

  dateSeparatorContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 16 
  },
  dateSeparatorLine: { 
    flex: 1, 
    height: StyleSheet.hairlineWidth, 
    backgroundColor: '#CBD5E1' 
  },
  dateSeparatorBadge: { 
    backgroundColor: '#F1F5F9', 
    paddingHorizontal: 12, 
    paddingVertical: 4, 
    borderRadius: 12, 
    marginHorizontal: 12
  },
  dateSeparatorText: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#64748B'
  },
  forwardedContainer: {
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  forwardedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  forwardedLabel: {
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  forwardedSender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  forwardedFromText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  forwardedAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const secs = s % 60;
  return `${m}:${secs.toString().padStart(2, "0")}`;
}

function formatMsgTime(ts?: any) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}