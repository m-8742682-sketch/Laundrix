// contact.tsx
import React, { useRef, useState, useEffect, useCallback, memo, useMemo } from "react";
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  FlatList,
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
  Linking,
  SafeAreaView,
} from "react-native";
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { GestureHandlerRootView, PanGestureHandler, State } from "react-native-gesture-handler";
import * as FileSystem from 'expo-file-system';

import EmojiPicker from "@/components/contact/EmojiPicker";
import Avatar from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import VoiceRecorder from "@/components/contact/VoiceRecorder";
import AudioBubble from "@/components/AudioBubble";
import { useChatViewModel } from "@/viewmodels/tabs/ChatViewModel";
import { ChatMessage } from "@/repositories/tabs/ChatRepository";
import MediaPicker, { MediaAsset } from "@/components/contact/MediaPicker";
import { MediaType } from "@/services/mediaUpload.service";

const { width, height } = Dimensions.get("window");

const SWIPE_THRESHOLD = 60;
const SWIPE_REPLY_THRESHOLD = 60;
const DEFAULT_EMOJI_HEIGHT = 300;

const DateSeparator = memo(({ label }: { label: string }) => (
  <View style={styles.dateSeparatorContainer}>
    <View style={styles.dateSeparatorLine} />
    <View style={styles.dateSeparatorBadge}>
      <Text style={styles.dateSeparatorText}>{label}</Text>
    </View>
    <View style={styles.dateSeparatorLine} />
  </View>
));

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
  messageType?: "text" | "audio" | "call" | "image" | "video" | "file";
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
      <View style={[styles.replyPreviewLine, { backgroundColor: isMe ? '#0EA5E9' : '#0EA5E9' }]} />
      <View style={styles.replyPreviewTextContainer}>
        <Text style={[styles.replyPreviewName, { color: isMe ? '#0EA5E9' : '#0EA5E9' }]}>
          {message.side === "right" ? "You" : targetName}
        </Text>
        <Text style={styles.replyPreviewText} numberOfLines={1}>
          {message.type === "audio" ? "Voice message" : 
           message.type === "call" ? `${message.callType} call` : 
           message.type === "file" ? "📎 File" :
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
          colors={["#0284C7", "#0EA5E9"]}
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

const FileMessage = memo(({ 
  item, 
  isMe, 
  showAvatar, 
  targetName, 
  targetAvatar, 
  myUserId,
  onShowActions,
  handleForwardedPress,
  formatMsgTime
}: any) => {
  const isPending = item.id && item.id.startsWith("optimistic_");
  
  // Extract filename from URL or text
  const getFileName = () => {
    if (item.text && item.text.length > 0 && !item.text.startsWith('http')) {
      return item.text;
    }
    if (item.mediaUrl) {
      const urlParts = item.mediaUrl.split('/');
      return decodeURIComponent(urlParts[urlParts.length - 1]) || 'Unknown file';
    }
    return 'Unknown file';
  };

  // Get file extension
  const getFileExtension = () => {
    const filename = getFileName();
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  };

  // Get file icon based on extension
  const getFileIcon = () => {
    const ext = getFileExtension();
    const iconMap: { [key: string]: string } = {
      'pdf': 'file-pdf-box',
      'doc': 'file-word-box',
      'docx': 'file-word-box',
      'xls': 'file-excel-box',
      'xlsx': 'file-excel-box',
      'ppt': 'file-powerpoint-box',
      'pptx': 'file-powerpoint-box',
      'txt': 'file-document-outline',
      'zip': 'zip-box',
      'rar': 'zip-box',
      'mp3': 'music-box',
      'mp4': 'video-box',
      'jpg': 'image',
      'jpeg': 'image',
      'png': 'image',
    };
    return iconMap[ext] || 'file-document-outline';
  };

  // Get file color based on extension
  const getFileColor = () => {
    const ext = getFileExtension();
    const colorMap: { [key: string]: string } = {
      'pdf': '#EF4444',
      'doc': '#3B82F6',
      'docx': '#3B82F6',
      'xls': '#10B981',
      'xlsx': '#10B981',
      'ppt': '#F59E0B',
      'pptx': '#F59E0B',
    };
    return colorMap[ext] || '#0EA5E9';
  };

  const handleFilePress = async () => {
    try {
      const url = item.mediaUrl;
      if (!url) return;
      
      // Try to open the URL
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        console.log('Cannot open URL:', url);
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const fileName = getFileName();
  const fileExt = getFileExtension().toUpperCase();
  const fileColor = getFileColor();

  return (
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
        onPress={handleFilePress}
        style={{ maxWidth: "75%" }}
      >
        <View>
          {item.replyTo && (
            <View style={[
              styles.repliedMessageContainer, 
              isMe ? styles.repliedMessageContainerMe : styles.repliedMessageContainerOther,
              { marginBottom: 4, borderRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }
            ]}>
              <View style={[styles.repliedMessageLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : '#0EA5E9' }]} />
              <View style={styles.repliedMessageContent}>
                <View style={styles.repliedToLabel}>
                  <Ionicons name="arrow-undo" size={10} color={isMe ? "rgba(255,255,255,0.7)" : "#0EA5E9"} />
                  <Text style={[styles.repliedToText, { color: isMe ? 'rgba(255,255,255,0.8)' : '#0EA5E9', fontSize: 11 }]}>
                    Replied to {item.replyTo!.side === "right" ? (isMe ? "Yourself" : targetName) : (isMe ? targetName : "Yourself")}
                  </Text>
                </View>
                <Text style={[styles.repliedMessageText, { color: isMe ? 'rgba(255,255,255,0.9)' : '#475569', fontSize: 12 }]} numberOfLines={1}>
                  {item.replyTo!.type === "audio" ? "🎤 Voice message" : 
                   item.replyTo!.type === "call" ? `📞 ${item.replyTo!.callType} call` : 
                   item.replyTo!.type === "image" ? "📷 Image" :
                   item.replyTo!.type === "video" ? "🎥 Video" :
                   item.replyTo!.type === "file" ? "📎 File" :
                   item.replyTo!.text || ""}
                </Text>
              </View>
            </View>
          )}
          
          {item.forwardedFrom && (
            <ForwardedBadge 
              fromName={item.forwardedFrom} 
              fromAvatar={item.forwardedFromAvatar}
              fromUserId={item.forwardedFromUserId}
              myUserId={myUserId}
              isMyMessage={isMe} 
              onPress={item.forwardedFromUserId ? () => handleForwardedPress(item.forwardedFromUserId, item.forwardedFrom, item.forwardedFromAvatar) : undefined}
            />
          )}
          
          <View style={[
            styles.fileBubble,
            isMe ? styles.fileBubbleMe : styles.fileBubbleOther
          ]}>
            <View style={styles.fileContent}>
              <View style={[styles.fileIconContainer, { backgroundColor: fileColor + '20' }]}>
                <MaterialCommunityIcons name={getFileIcon() as any} size={32} color={fileColor} />
                {fileExt && (
                  <View style={[styles.fileExtBadge, { backgroundColor: fileColor }]}>
                    <Text style={styles.fileExtText}>{fileExt}</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.fileInfo}>
                <Text 
                  style={[styles.fileName, isMe ? styles.fileNameMe : styles.fileNameOther]} 
                  numberOfLines={2}
                >
                  {fileName}
                </Text>
                <Text style={[styles.fileMeta, isMe ? styles.fileMetaMe : styles.fileMetaOther]}>
                  {fileExt || 'FILE'} • Tap to open
                </Text>
              </View>
              
              <Ionicons 
                name="download-outline" 
                size={20} 
                color={isMe ? "rgba(255,255,255,0.6)" : "#94A3B8"} 
              />
            </View>
            
            <View style={styles.fileFooter}>
              <Text style={isMe ? styles.myTime : styles.otherTime}>
                {formatMsgTime(item.createdAt)}
              </Text>
              {isMe && (
                isPending ? (
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                ) : (
                  <Ionicons 
                    name={item.read ? "checkmark-done" : "checkmark"} 
                    size={12} 
                    color={item.read ? "#67E8F9" : "rgba(255,255,255,0.7)"} 
                  />
                )
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const VideoMessage = memo(({ 
  item, 
  isMe, 
  showAvatar, 
  targetName, 
  targetAvatar, 
  myUserId,
  onShowActions,
  handleForwardedPress,
  formatMsgTime,
  onMaximize,
}: any) => {
  const videoRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Use a ref to avoid stale closure causing setState loops
  const isPlayingRef = useRef(false);
  const videoPlayer = useVideoPlayer({ uri: item.mediaUrl }, player => {
    player.loop = true;
  });

  useEffect(() => {
    const sub = videoPlayer.addListener('playingChange', (payload) => {
      // payload is PlayingChangeEventPayload: { isPlaying: boolean }
      const playing = payload.isPlaying;
      // Guard against unnecessary re-renders causing update depth exceeded
      if (isPlayingRef.current !== playing) {
        isPlayingRef.current = playing;
        setIsPlaying(playing);
      }
    });
    return () => { try { sub.remove(); } catch {} };
  }, [videoPlayer]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      videoPlayer.pause();
    } else {
      videoPlayer.play();
    }
  }, [videoPlayer]);

  const isPending = item.id && item.id.startsWith("optimistic_");

  return (
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
        style={{ maxWidth: "75%" }}
      >
        <View>
          {item.replyTo && (
            <View style={[
              styles.repliedMessageContainer, 
              isMe ? styles.repliedMessageContainerMe : styles.repliedMessageContainerOther,
              { marginBottom: 4, borderRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }
            ]}>
              <View style={[styles.repliedMessageLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : '#0EA5E9' }]} />
              <View style={styles.repliedMessageContent}>
                <View style={styles.repliedToLabel}>
                  <Ionicons name="arrow-undo" size={10} color={isMe ? "rgba(255,255,255,0.7)" : "#0EA5E9"} />
                  <Text style={[styles.repliedToText, { color: isMe ? 'rgba(255,255,255,0.8)' : '#0EA5E9', fontSize: 11 }]}>
                    Replied to {item.replyTo!.side === "right" ? (isMe ? "Yourself" : targetName) : (isMe ? targetName : "Yourself")}
                  </Text>
                </View>
                <Text style={[styles.repliedMessageText, { color: isMe ? 'rgba(255,255,255,0.9)' : '#475569', fontSize: 12 }]} numberOfLines={1}>
                  {item.replyTo!.type === "audio" ? "🎤 Voice message" : 
                   item.replyTo!.type === "call" ? `📞 ${item.replyTo!.callType} call` : 
                   item.replyTo!.type === "image" ? "📷 Image" :
                   item.replyTo!.type === "video" ? "🎥 Video" :
                   item.replyTo!.type === "file" ? "📎 File" :
                   item.replyTo!.text || ""}
                </Text>
              </View>
            </View>
          )}
          
          {item.forwardedFrom && (
            <ForwardedBadge 
              fromName={item.forwardedFrom} 
              fromAvatar={item.forwardedFromAvatar}
              fromUserId={item.forwardedFromUserId}
              myUserId={myUserId}
              isMyMessage={isMe} 
              onPress={item.forwardedFromUserId ? () => handleForwardedPress(item.forwardedFromUserId, item.forwardedFrom, item.forwardedFromAvatar) : undefined}
            />
          )}
          
          <View style={[
            styles.mediaBubble,
            isMe ? styles.mediaBubbleMe : styles.mediaBubbleOther
          ]}>
            <TouchableOpacity 
              activeOpacity={1}
              onPress={togglePlay}
              onLongPress={(e) => {
                const { pageX, pageY } = e.nativeEvent;
                onShowActions(item, false, { nativeEvent: { pageX, pageY } });
              }}
              delayLongPress={300}
              style={styles.videoWrapper}
            >
              <VideoView
                ref={videoRef}
                player={videoPlayer}
                style={styles.videoPlayer}
                contentFit="cover"
                nativeControls={false}
              />
              {!isPlaying && (
                <View style={styles.playButtonOverlay}>
                  <View style={styles.playButton}>
                    <Ionicons name="play" size={24} color="#fff" />
                  </View>
                  {/* Maximize button overlay */}
                  <TouchableOpacity
                    style={styles.maximizeButton}
                    onPress={() => onMaximize && onMaximize({ type: 'video', url: item.mediaUrl, player: videoPlayer })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="expand" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {isPlaying && (
                <View style={styles.pauseButtonOverlay}>
                  <View style={styles.pauseButton}>
                    <Ionicons name="pause" size={20} color="#fff" />
                  </View>
                  {/* Maximize button while playing */}
                  <TouchableOpacity
                    style={styles.maximizeButton}
                    onPress={() => onMaximize && onMaximize({ type: 'video', url: item.mediaUrl, player: videoPlayer })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="expand" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
            
            <View style={styles.mediaFooter}>
              <Text style={isMe ? styles.myTime : styles.otherTime}>
                {formatMsgTime(item.createdAt)}
              </Text>
              {isMe && (
                isPending ? (
                  <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                ) : (
                  <Ionicons 
                    name={item.read ? "checkmark-done" : "checkmark"} 
                    size={12} 
                    color={item.read ? "#67E8F9" : "rgba(255,255,255,0.7)"} 
                  />
                )
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

function formatDuration(millis: number): string {
  const totalSeconds = Math.floor(millis / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ── Full-screen media viewer (image / video) ─────────────────────────────────
interface MediaViewerItem {
  type: 'image' | 'video';
  url: string;
  player?: any; // VideoPlayer for videos
}

const MediaViewerModal = memo(({ 
  visible, 
  media, 
  onClose 
}: { 
  visible: boolean; 
  media: MediaViewerItem | null; 
  onClose: () => void; 
}) => {
  const fullscreenPlayer = useVideoPlayer(
    media?.type === 'video' && media.url ? { uri: media.url } : null,
    player => { if (player) { player.loop = false; } }
  );

  if (!visible || !media) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.mediaViewerOverlay}>
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.95)" />
        
        {/* Close button */}
        <SafeAreaView style={styles.mediaViewerHeader}>
          <TouchableOpacity onPress={onClose} style={styles.mediaViewerClose} activeOpacity={0.8}>
            <View style={styles.mediaViewerCloseBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </View>
          </TouchableOpacity>
        </SafeAreaView>

        {/* Content */}
        <View style={styles.mediaViewerContent}>
          {media.type === 'image' ? (
            <Image
              source={{ uri: media.url }}
              style={styles.mediaViewerImage}
              resizeMode="contain"
            />
          ) : (
            <VideoView
              player={fullscreenPlayer}
              style={styles.mediaViewerVideo}
              contentFit="contain"
              nativeControls
            />
          )}
        </View>
      </View>
    </Modal>
  );
});

const MessageBubble = memo(({ 
  item, isMe, showAvatar, targetName, targetAvatar, myUserId, myUserName, myUserAvatar, onLongPress, onSwipeReply,
  editingId, editText, setEditText, setEditingId, editMessage, onShowActions, onMaximize,
}: any) => {
  const isPending = item.id && item.id.startsWith("optimistic_");

  const translateX = useRef(new Animated.Value(0)).current;
  const [showReplyIcon, setShowReplyIcon] = useState(false);
  const hasTriggeredHaptic = useRef(false);
  const [localEditText, setLocalEditText] = useState(editText);

  const isMyMessage = isMe;
  const isEditing = editingId === item.id;

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

  const handleEditChange = useCallback((text: string) => {
    setLocalEditText(text);
    setEditText(text);
  }, [setEditText]);

  const handleSaveEdit = useCallback(async () => {
    if (!localEditText.trim()) return;
    await editMessage(item.id, localEditText.trim());
    setEditingId(null);
  }, [localEditText, item.id, editMessage, setEditingId]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, [setEditingId, setEditText]);

  if (item.type === "call") {
    const isCalling = item.callStatus === "calling";
    const isMissed = item.callStatus === "missed";
    const isVoice = item.callType === "voice";
    const isOutgoing = item.side === "right";

    const handleCallPress = () => {
      if (isCalling) return; // don't re-call while already calling
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
              isOutgoing 
                ? { color: '#fff' } 
                : (isMissed ? { color: '#991B1B' } : isCalling ? { color: '#0284C7' } : { color: '#0C4A6E' })
            ]}>
              {isCalling 
                ? `${isVoice ? "Voice" : "Video"} Calling…`
                : isMissed 
                  ? `Missed ${isVoice ? "Voice" : "Video"} Call` 
                  : `${isVoice ? "Voice" : "Video"} Call Ended`}
            </Text>

            <View style={styles.callMeta}>
              <Text style={[
                styles.callTime,
                isOutgoing ? { color: 'rgba(255,255,255,0.8)' } : { color: '#64748B' }
              ]}>
                {formatMsgTime(item.createdAt)}
              </Text>
              {!isMissed && !isCalling && item.callDuration > 0 && (
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
            name={isCalling ? "call" : isMissed ? "alert-circle" : "checkmark-circle"} 
            size={22} 
            color={isOutgoing 
              ? "rgba(255,255,255,0.9)" 
              : (isMissed ? "#EF4444" : isCalling ? "#0EA5E9" : "#0EA5E9")
            } 
          />
        </TouchableOpacity>
      </View>
    );
  }

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
          style={{ maxWidth: "75%" }}
        >
          <View>
            {item.replyTo && (
              <View style={[
                styles.repliedMessageContainer, 
                isMe ? styles.repliedMessageContainerMe : styles.repliedMessageContainerOther,
                { marginBottom: 4, borderRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }
              ]}>
                <View style={[styles.repliedMessageLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : '#0EA5E9' }]} />
                <View style={styles.repliedMessageContent}>
                  <View style={styles.repliedToLabel}>
                    <Ionicons name="arrow-undo" size={10} color={isMe ? "rgba(255,255,255,0.7)" : "#0EA5E9"} />
                    <Text style={[styles.repliedToText, { color: isMe ? 'rgba(255,255,255,0.8)' : '#0EA5E9', fontSize: 11 }]}>
                      Replied to {item.replyTo!.side === "right" ? (isMe ? "Yourself" : targetName) : (isMe ? targetName : "Yourself")}
                    </Text>
                  </View>
                  <Text style={[styles.repliedMessageText, { color: isMe ? 'rgba(255,255,255,0.9)' : '#475569', fontSize: 12 }]} numberOfLines={1}>
                    {item.replyTo!.type === "audio" ? "🎤 Voice message" : 
                     item.replyTo!.type === "call" ? `📞 ${item.replyTo!.callType} call` : 
                     item.replyTo!.type === "image" ? "📷 Image" :
                     item.replyTo!.type === "video" ? "🎥 Video" :
                     item.replyTo!.type === "file" ? "📎 File" :
                     item.replyTo!.text || ""}
                  </Text>
                </View>
              </View>
            )}
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
              hideForwarded={false}
            />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (item.type === "image") {
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
          style={{ maxWidth: "75%" }}
        >
          <View>
            {item.replyTo && (
              <View style={[
                styles.repliedMessageContainer, 
                isMe ? styles.repliedMessageContainerMe : styles.repliedMessageContainerOther,
                { marginBottom: 4, borderRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }
              ]}>
                <View style={[styles.repliedMessageLine, { backgroundColor: isMe ? 'rgba(255,255,255,0.6)' : '#0EA5E9' }]} />
                <View style={styles.repliedMessageContent}>
                  <View style={styles.repliedToLabel}>
                    <Ionicons name="arrow-undo" size={10} color={isMe ? "rgba(255,255,255,0.7)" : "#0EA5E9"} />
                    <Text style={[styles.repliedToText, { color: isMe ? 'rgba(255,255,255,0.8)' : '#0EA5E9', fontSize: 11 }]}>
                      Replied to {item.replyTo!.side === "right" ? (isMe ? "Yourself" : targetName) : (isMe ? targetName : "Yourself")}
                    </Text>
                  </View>
                  <Text style={[styles.repliedMessageText, { color: isMe ? 'rgba(255,255,255,0.9)' : '#475569', fontSize: 12 }]} numberOfLines={1}>
                    {item.replyTo!.type === "audio" ? "🎤 Voice message" : 
                     item.replyTo!.type === "call" ? `📞 ${item.replyTo!.callType} call` : 
                     item.replyTo!.type === "image" ? "📷 Image" :
                     item.replyTo!.type === "video" ? "🎥 Video" :
                     item.replyTo!.type === "file" ? "📎 File" :
                     item.replyTo!.text || ""}
                  </Text>
                </View>
              </View>
            )}
            
            {item.forwardedFrom && (
              <ForwardedBadge 
                fromName={item.forwardedFrom} 
                fromAvatar={item.forwardedFromAvatar}
                fromUserId={item.forwardedFromUserId}
                myUserId={myUserId}
                isMyMessage={isMe} 
                onPress={item.forwardedFromUserId ? () => handleForwardedPress(item.forwardedFromUserId, item.forwardedFrom, item.forwardedFromAvatar) : undefined}
              />
            )}
            
            <View style={[
              styles.mediaBubble,
              isMe ? styles.mediaBubbleMe : styles.mediaBubbleOther
            ]}>
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => onMaximize && onMaximize({ type: 'image', url: item.mediaUrl })}
              >
                <Image 
                  source={{ uri: item.mediaUrl }} 
                  style={styles.imageMessage}
                  resizeMode="cover"
                />
                {/* Expand hint badge */}
                <View style={styles.expandHint}>
                  <Ionicons name="expand" size={14} color="#fff" />
                </View>
              </TouchableOpacity>
              <View style={styles.mediaFooter}>
                <Text style={isMe ? styles.myTime : styles.otherTime}>
                  {formatMsgTime(item.createdAt)}
                </Text>
                {isMe && (
                  isPending ? (
                    <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                  ) : (
                    <Ionicons 
                      name={item.read ? "checkmark-done" : "checkmark"} 
                      size={12} 
                      color={item.read ? "#67E8F9" : "rgba(255,255,255,0.7)"} 
                    />
                  )
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  if (item.type === "video") {
    return renderSwipeableMessage(
      <VideoMessage 
        item={item}
        isMe={isMe}
        showAvatar={showAvatar}
        targetName={targetName}
        targetAvatar={targetAvatar}
        myUserId={myUserId}
        onShowActions={onShowActions}
        handleForwardedPress={handleForwardedPress}
        formatMsgTime={formatMsgTime}
        onMaximize={onMaximize}
      />
    );
  }

  if (item.type === "file") {
    return renderSwipeableMessage(
      <FileMessage 
        item={item}
        isMe={isMe}
        showAvatar={showAvatar}
        targetName={targetName}
        targetAvatar={targetAvatar}
        myUserId={myUserId}
        onShowActions={onShowActions}
        handleForwardedPress={handleForwardedPress}
        formatMsgTime={formatMsgTime}
      />
    );
  }

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
          <View style={[styles.repliedMessageContainer, styles.repliedMessageContainerMe]}>
            <View style={[styles.repliedMessageLine, { backgroundColor: 'rgba(255,255,255,0.6)' }]} />
            <View style={styles.repliedMessageContent}>
              <View style={styles.repliedToLabel}>
                <Ionicons name="arrow-undo" size={10} color="rgba(255,255,255,0.7)" />
                <Text style={[styles.repliedToText, { color: 'rgba(255,255,255,0.8)' }]}>
                  Replied to {item.replyTo.side === "right" ? "Yourself" : targetName}
                </Text>
              </View>
              <Text style={[styles.repliedMessageName, { color: '#fff' }]}>
                {item.replyTo.side === "right" ? "You" : targetName}
              </Text>
              <Text style={[styles.repliedMessageText, { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={2}>
                {item.replyTo.type === "audio" ? "🎤 Voice message" : 
                 item.replyTo.type === "call" ? `📞 ${item.replyTo.callType} call` : 
                 item.replyTo.type === "image" ? "📷 Image" :
                 item.replyTo.type === "video" ? "🎥 Video" :
                 item.replyTo.type === "file" ? "📎 File" :
                 item.replyTo.text || ""}
              </Text>
            </View>
          </View>
        )}
        
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
          <LinearGradient
            colors={isPending ? ["#94A3B8", "#64748B"] : ["#0EA5E9", "#0369A1"]}
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
          <View style={[styles.bubble, styles.otherBubble]}>
            {item.replyTo && (
              <View style={[styles.repliedMessageContainer, styles.repliedMessageContainerOther]}>
                <View style={[styles.repliedMessageLine, { backgroundColor: '#0EA5E9' }]} />
                <View style={styles.repliedMessageContent}>
                  <View style={styles.repliedToLabelOther}>
                    <Ionicons name="arrow-undo" size={10} color="#0EA5E9" />
                    <Text style={[styles.repliedToTextOther, { color: '#0EA5E9', fontWeight: '600' }]}>
                      Replied to {item.replyTo.side === "right" ? targetName : "Yourself"}
                    </Text>
                  </View>
                  <Text style={[styles.repliedMessageName, { color: '#0F172A', fontWeight: '700' }]}>
                    {item.replyTo.side === "right" ? "You" : targetName}
                  </Text>
                  <Text style={[styles.repliedMessageText, { color: '#475569' }]} numberOfLines={2}>
                    {item.replyTo.type === "audio" ? "🎤 Voice message" : 
                     item.replyTo.type === "call" ? `📞 ${item.replyTo.callType} call` : 
                     item.replyTo.type === "image" ? "📷 Image" :
                     item.replyTo.type === "video" ? "🎥 Video" :
                     item.replyTo.type === "file" ? "📎 File" :
                     item.replyTo.text || ""}
                  </Text>
                </View>
              </View>
            )}
            
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
    messages, text, setText, sendText, sendAudio, sendImage, sendVideo, sendFile, sendMultipleMedia,
    listRef, deleteMessage, editMessage, viewabilityConfig, onViewableItemsChanged,
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
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [mediaPickerVisible, setMediaPickerVisible] = useState(false);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerItem, setMediaViewerItem] = useState<{ type: 'image' | 'video'; url: string } | null>(null);

  const handleMaximizeMedia = useCallback((media: { type: 'image' | 'video'; url: string }) => {
    setMediaViewerItem(media);
    setMediaViewerVisible(true);
  }, []);

  // ── Keyboard height tracking ──────────────────────────────────────────────
  // We DON'T use KeyboardAvoidingView. Instead we manually pad the bottom
  // with the keyboard height so the layout is:
  //   header | chat(flex:1) | inputBar | emojiPanel-OR-keyboardSpacer
  //
  // Rules:
  //  - keyboard visible  → show spacer of keyboardHeight, emoji hidden
  //  - emoji visible     → show emojiPanel of keyboardHeight, keyboard dismissed
  //  - neither           → bottom padding = insets.bottom only
  const [keyboardHeight, setKeyboardHeight] = useState(DEFAULT_EMOJI_HEIGHT);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    // Use Will events on iOS so layout moves simultaneously with keyboard animation
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      // Capture exact height once so emoji panel always matches
      setKeyboardHeight(e.endCoordinates.height);
      setIsKeyboardVisible(true);
      // Real keyboard appearing → collapse emoji panel (they are mutually exclusive)
      setShowEmoji(false);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setIsKeyboardVisible(false);
    });

    return () => { showSub.remove(); hideSub.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // no deps — we never want this to re-register

  const toastTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastForwardedParams = useRef<string>("");
  const inputRef = useRef<TextInput>(null);
  const isNearBottom = useRef(true);
  const rafId = useRef<number | null>(null);

  const showToastMessage = useCallback((message: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToastMessage(message);
    setShowToast(true);
    toastTimeout.current = setTimeout(() => setShowToast(false), 2000);
  }, []);

  const toggleEmojiPicker = useCallback(() => {
    if (showEmoji) {
      // Emoji → Keyboard: hide panel, focus input (keyboard will slide up)
      setShowEmoji(false);
      // Small delay so panel collapses before keyboard rises (avoids double-bump)
      setTimeout(() => inputRef.current?.focus(), Platform.OS === 'ios' ? 80 : 50);
    } else {
      // Keyboard → Emoji (or nothing → Emoji):
      // Dismiss keyboard first. keyboardWillHide fires → isKeyboardVisible=false.
      // Then we show emoji panel. The layout stays identical height → no jump.
      if (isKeyboardVisible) {
        // Dismiss without letting the layout collapse: set emoji flag before dismiss
        // so the panel fills the space immediately as keyboard slides out.
        setShowEmoji(true);          // panel appears at same height
        Keyboard.dismiss();          // keyboard slides down behind it
      } else {
        // No keyboard showing — just open emoji panel
        setShowEmoji(true);
      }
    }
  }, [showEmoji, isKeyboardVisible]);

  const handleInputFocus = useCallback(() => {
    // User tapped TextInput while emoji is open → keyboard takes over
    if (showEmoji) setShowEmoji(false);
  }, [showEmoji]);

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
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showEmoji) {
        setShowEmoji(false);
        return true;
      }
      // Go back to previous screen instead of hardcoded conversations
      router.back();
      return true;
    });

    return () => backHandler.remove();
  }, [showEmoji]);

  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    
    if (rafId.current) cancelAnimationFrame(rafId.current);
    
    rafId.current = requestAnimationFrame(() => {
      const THRESHOLD = 150;
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
      const shouldShow = distanceFromBottom > THRESHOLD;
      
      if (shouldShow !== showScrollButton) {
        setShowScrollButton(shouldShow);
      }
      
      isNearBottom.current = !shouldShow;
    });
  }, [showScrollButton]);

  const scrollToBottom = useCallback((animated = true) => {
    listRef.current?.scrollToEnd({ animated });
    setShowScrollButton(false);
    isNearBottom.current = true;
  }, [listRef]);

  useEffect(() => {
    if (messages.length > 0 && isNearBottom.current && !editingId) {
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [messages.length, editingId, scrollToBottom]);

  useEffect(() => {
    if (editingId) {
      isNearBottom.current = false;
    }
  }, [editingId]);

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
    } else if (popupMsg.type === "file") {
      textToCopy = popupMsg.mediaUrl || popupMsg.text || "";
    }
    await Clipboard.setStringAsync(textToCopy);
    handlePopupClose();
    showToastMessage("Copied!");
  };

  const handleForward = () => {
    if (!popupMsg) return;
    handlePopupClose();

    const isMyMessage = popupMsg.side === "right";
    
    let originalSenderName: string;
    let originalSenderAvatar: string;
    let originalSenderId: string;

    if (popupMsg.forwardedFrom && popupMsg.forwardedFromUserId) {
      originalSenderName = popupMsg.forwardedFrom;
      originalSenderAvatar = (popupMsg.forwardedFromAvatar || "").trim();
      originalSenderId = popupMsg.forwardedFromUserId;
    } else if (isMyMessage) {
      originalSenderName = user?.name || "Me";
      originalSenderAvatar = (user?.avatarUrl || "").trim();
      originalSenderId = myUserId;
    } else {
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
        forwardMediaUrl: popupMsg.mediaUrl || "",
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

  const handleMediaSelect = async (assets: MediaAsset[]) => {
    if (assets.length === 0) return;
    
    showToastMessage(`Sending ${assets.length} file(s)...`);
    
    try {
      const items: Array<{ uri: string; type: MediaType; name?: string }> = assets.map(asset => ({
        uri: asset.uri,
        type: asset.type === 'file' ? 'file' : asset.type,
        name: asset.name,
      }));
      
      const replyToData = replyingTo ? {
        id: replyingTo.id,
        type: replyingTo.type,
        text: replyingTo.text,
        side: replyingTo.side,
        senderId: replyingTo.senderId,
        callType: replyingTo.callType,
        mediaUrl: replyingTo.mediaUrl,
      } : undefined;
      
      await sendMultipleMedia(items, replyToData);
      setReplyingTo(null);
      scrollToBottom(true);
    } catch (error) {
      console.error("[Contact] Media send failed:", error);
      showToastMessage("Failed to send media");
    }
  };

  const openMediaPicker = () => {
    Keyboard.dismiss();
    setMediaPickerVisible(true);
  };

  const handleEdit = () => {
    if (!popupMsg || popupMsg.type !== "text") return;
    setEditingId(popupMsg.id);
    setEditText(popupMsg.text || "");
    handlePopupClose();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReplyingTo(message);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSend = useCallback(() => {
    if (!(text || "").trim()) return;
    
    // Reset everything
    setText(""); // Clear input
    setShowEmoji(false); // Hide emoji
    
    const replyToData = replyingTo ? {
      id: replyingTo.id,
      type: replyingTo.type,
      text: replyingTo.text,
      side: replyingTo.side,
      senderId: replyingTo.senderId,
      callType: replyingTo.callType,
      mediaUrl: replyingTo.mediaUrl,
    } : undefined;
    
    sendText((text || "").trim(), undefined, undefined, undefined, replyToData);
    setReplyingTo(null);
    setTimeout(() => scrollToBottom(true), 100);
  }, [text, sendText, scrollToBottom, replyingTo]);

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
        onMaximize={handleMaximizeMedia}
      />
    );
  }, [messagesWithSeparators, targetName, targetAvatar, myUserId, user?.name, user?.avatarUrl, handleShowActions, handleSwipeReply, editingId, editText, editMessage, handleMaximizeMedia]);

  const keyExtractor = useCallback((item: any) => ("label" in item ? item.key : item.id), []);

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


  return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    {/* 
      Layout (no KAV — we manage spacing manually):
        ┌─────────────────────┐
        │       header        │  fixed height
        ├─────────────────────┤
        │    chat (flex:1)    │  shrinks as input/emoji panels grow
        ├─────────────────────┤
        │     input bar       │  always visible, always above panels
        ├─────────────────────┤
        │  emoji panel OR     │  height = keyboardHeight (matches keyboard)
        │  keyboard spacer    │  so layout never jumps
        └─────────────────────┘
    */}
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.background}>
        <Animated.View style={[styles.bgCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.bgCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      <View style={[styles.header, { paddingTop: 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
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
            <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={styles.iconButton}>
              <Ionicons name="call" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onVideoCall}>
            <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={styles.iconButton}>
              <Ionicons name="videocam" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat list — flex:1 so it shrinks when panels appear */}
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
        <ScrollToBottomButton 
          visible={showScrollButton}
          onPress={() => scrollToBottom(true)}
        />
      </View>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <View style={styles.inputContainer}>
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
              <TouchableOpacity onPress={openMediaPicker} style={styles.attachmentButton}>
                <Ionicons name="attach" size={24} color="#94A3B8" />
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleEmojiPicker} style={styles.emojiButton}>
                {showEmoji ? (
                  <MaterialCommunityIcons name="keyboard-outline" size={24} color="#0EA5E9" />
                ) : (
                  <Ionicons name="happy-outline" size={24} color="#94A3B8" />
                )}
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
                onFocus={handleInputFocus}
              />
            </View>
          )}

          <View style={styles.sendContainer}>
            {!(text || "").trim() ? (   // shows VoiceRecorder only when emoji picker is closed
              <VoiceRecorder
                onSend={(uri) => {
                  const replyToData = replyingTo ? {
                    id: replyingTo.id,
                    type: replyingTo.type,
                    text: replyingTo.text,
                    side: replyingTo.side,
                    senderId: replyingTo.senderId,
                    callType: replyingTo.callType,
                    mediaUrl: replyingTo.mediaUrl,
                  } : undefined;
                  sendAudio(uri, undefined, undefined, undefined, replyToData);
                  setReplyingTo(null);
                }}
                onRecordingStateChange={setIsRecordingUI}
                onTick={setElapsedMs}
                onLockChange={setIsLocked}
              />
            ) : (
              <TouchableOpacity onPress={handleSend} activeOpacity={0.8}>
                <LinearGradient colors={["#0284C7", "#0EA5E9"]} style={styles.sendButton}>
                  <Ionicons name="send" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* ── Panel zone — ALWAYS occupies keyboardHeight px ─────────────────
          This is the key to no-jank switching:
          - keyboard visible  → transparent spacer, keyboard sits over it
          - emoji visible     → emoji panel fills it (same height as keyboard)
          - neither           → insets.bottom only (collapses to safe area)
      ─────────────────────────────────────────────────────────────────── */}
      {isKeyboardVisible ? (
        // Keyboard is open: reserve space so input bar stays above it.
        // On iOS the keyboard slides over this spacer; on Android it truly pushes.
        <View style={{ height: keyboardHeight }} />
      ) : showEmoji ? (
        // Emoji panel: same height as keyboard was, so no layout jump.
        <View style={[styles.emojiPanel, { height: keyboardHeight }]}>
          <View style={styles.emojiHeader}>
            <Text style={styles.emojiPickerTitle}>Emoji</Text>
            <TouchableOpacity
              onPress={toggleEmojiPicker}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#0EA5E9' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>
            <EmojiPicker onSelect={(emoji) => setText((text || "") + emoji)} />
          </View>
        </View>
      ) : (
        // Nothing open: just safe-area bottom padding
        <View style={{ height: insets.bottom }} />
      )}

      <MediaPicker
        visible={mediaPickerVisible}
        onClose={() => setMediaPickerVisible(false)}
        onSelect={handleMediaSelect}
        maxSelection={5}
      />

        {/* Modals and overlays */}
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

        {showToast && (
          <Animated.View style={[styles.toast, { bottom: insets.bottom + 80 }]}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.toastGradient}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </LinearGradient>
          </Animated.View>
        )}
    </View>

      {/* Full-screen media viewer — outside main View so it covers tab bar */}
      <MediaViewerModal
        visible={mediaViewerVisible}
        media={mediaViewerItem}
        onClose={() => { setMediaViewerVisible(false); setMediaViewerItem(null); }}
      />
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
    shadowColor: "#0EA5E9",
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
    borderLeftColor: '#0EA5E9',
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
    backgroundColor: '#0EA5E9',
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
    color: '#0EA5E9',
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
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 8,
    paddingLeft: 12,
    minWidth: 165,
    maxWidth: '100%', 
  },
  repliedMessageContainerMe: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderLeftWidth: 0,
  },
  repliedMessageContainerOther: {
    backgroundColor: '#F1F5F9',
    borderLeftWidth: 0,
  },
  repliedMessageLine: {
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginRight: 10,
    borderRadius: 2,
  },
  repliedMessageContent: {
    flex: 1,
    minWidth: 0, 
  },
  repliedToLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  repliedToText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  repliedMessageName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  repliedMessageText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  repliedToLabelOther: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  repliedToTextOther: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
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
    shadowColor: "#0EA5E9",
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
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3
  },
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
    backgroundColor: '#0EA5E9',
    borderBottomRightRadius: 4,
    shadowColor: "#0EA5E9",
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
    backgroundColor: '#F8FAFC',
    // no paddingBottom here — handled by the panel zone below (keyboardSpacer/emojiPanel/insetSpacer)
  },
  
  inputWrapper: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff',
    borderRadius: 24, 
    padding: 6,
    paddingLeft: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
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
  attachmentButton: { 
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
    width: 40, 
    height: 40, 
    borderRadius: 30, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: "#0284C7",
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
  
  mediaBubble: {
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: 250,
  },
  mediaBubbleMe: {
    backgroundColor: '#0EA5E9',
    borderBottomRightRadius: 4,
  },
  mediaBubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  imageMessage: {
    width: 250,
    height: 200,
    borderRadius: 12,
  },
  videoWrapper: {
    width: 250,
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  videoPlayer: {
    width: '100%',
    height: '100%',
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoDurationBadge: {
    position: 'absolute',
    bottom: 40,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDurationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  mediaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 8,
    gap: 4,
  },

  // Media viewer (fullscreen)
  mediaViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  mediaViewerClose: {
    alignSelf: 'flex-end',
    margin: 16,
  },
  mediaViewerCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaViewerContent: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaViewerImage: {
    width: width,
    height: '100%',
  },
  mediaViewerVideo: {
    width: width,
    height: width * (9/16),
  },
  // Expand hint on image bubble
  expandHint: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 10,
    padding: 4,
  },
  // Maximize button overlay on video
  maximizeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    padding: 5,
  },

  // File message styles
  fileBubble: {
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: 250,
    minWidth: 230,
    padding: 12,
  },
  fileBubbleMe: {
    backgroundColor: '#0EA5E9',
    borderBottomRightRadius: 4,
  },
  fileBubbleOther: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E2E8F0',
  },
  fileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  fileExtBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  fileExtText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  fileNameMe: {
    color: '#fff',
  },
  fileNameOther: {
    color: '#0F172A',
  },
  fileMeta: {
    fontSize: 11,
  },
  fileMetaMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  fileMetaOther: {
    color: '#94A3B8',
  },
  fileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 4,
  },

  emojiPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 0,
    borderTopColor: '#E2E8F0',
  },
  emojiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  emojiPickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
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