import React, { useRef, useState, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import EmojiPicker from "@/components/contact/EmojiPicker";
import Avatar, { resolveAvatar } from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import VoiceRecorder from "@/components/contact/VoiceRecorder";
import AudioBubble from "@/components/AudioBubble";
import { useChatViewModel } from "@/viewmodels/tabs/ChatViewModel";
import { ChatMessage } from "@/repositories/tabs/ChatRepository";

const { width } = Dimensions.get("window");

export default function ContactScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const { targetUserId, targetName, targetAvatar } = useLocalSearchParams<{
    targetUserId: string;
    targetName?: string;
    targetAvatar?: string;
  }>();

  if (!user || !targetUserId) return null;

  const myUserId = user.uid;
  const channel = `chat-${[myUserId, targetUserId].sort().join("-")}`;

  const {
    messages,
    text,
    setText,
    sendText,
    sendAudio,
    listRef,
    deleteMessage,
    editMessage,
  } = useChatViewModel(channel, myUserId, targetUserId, user.name || user.displayName);

  // UI States
  const [showEmoji, setShowEmoji] = useState(false);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Long Press Logic
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Background Animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      listRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const onCall = () => {
    router.push({
      pathname: "/call/voice-call",
      params: { 
        targetUserId, 
        targetName: targetName ?? "User", 
        targetAvatar: targetAvatar ?? "" 
      },
    });
  };

  const onVideoCall = () => {
    router.push({
      pathname: "/call/video-call",
      params: {
        targetUserId,
        targetName: targetName ?? "User",
        targetAvatar: targetAvatar ?? "",
      },
    });
  };


  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isMe = item.side === "right";
    const prev = messages[index - 1];
    const showAvatar = !prev || prev.side !== item.side;

    return (
      <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
        {!isMe && (
          <View style={styles.avatarSlot}>
            {showAvatar && (
              <Avatar {...resolveAvatar({ name: targetName, avatarUrl: targetAvatar })} size={30} />
            )}
          </View>
        )}
        
        <TouchableOpacity
          activeOpacity={0.9}
          onPressIn={() => {
            if (isMe) longPressTimer.current = setTimeout(() => setActionMsg(item), 500);
          }}
          onPressOut={() => {
            if (longPressTimer.current) clearTimeout(longPressTimer.current);
          }}
          style={{ maxWidth: "78%" }}
        >
          {isMe ? (
            <LinearGradient
              colors={["#0EA5E9", "#0284C7"]}
              style={[styles.bubble, styles.myBubble, !showAvatar && { borderBottomRightRadius: 18 }]}
            >
              {editingId === item.id ? (
                <View>
                  <TextInput
                    value={editText}
                    onChangeText={setEditText}
                    autoFocus
                    multiline
                    style={[styles.text, { color: "#fff", minWidth: 120 }]}
                  />
                  <View style={styles.editActions}>
                    <TouchableOpacity onPress={() => setEditingId(null)}>
                      <Text style={styles.editCancel}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => {
                      if (!editText.trim()) return;
                      await editMessage(item.id, editText.trim());
                      setEditingId(null);
                    }}>
                      <Text style={styles.editSave}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  {item.type === "text" ? (
                    <>
                      <Text style={[styles.text, styles.myText]}>{item.text}</Text>
                      <View style={styles.msgFooter}>
                        <Text style={styles.myTime}>{formatMsgTime(item.createdAt)}</Text>
                        <Ionicons name="checkmark-done" size={14} color="#BAE6FD" />
                      </View>
                    </>
                  ) : (
                    <View>
                      <AudioBubble url={item.audioUrl!} isMe />
                      <View style={styles.msgFooter}>
                        <Text style={styles.myTime}>{formatMsgTime(item.createdAt)}</Text>
                        <Ionicons name="checkmark-done" size={14} color="#BAE6FD" />
                      </View>
                    </View>
                  )}
                </>
              )}
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.otherBubble, !showAvatar && { borderBottomLeftRadius: 18 }]}>
              {item.type === "text" ? (
                <Text style={[styles.text, styles.otherText]}>{item.text}</Text>
              ) : (
                <AudioBubble url={item.audioUrl!} isMe={false} />
              )}
              <Text style={styles.otherTime}>
                {formatMsgTime(item.createdAt)}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" />

      {/* Decorative Animated Background */}
      <View style={styles.backgroundDecor} pointerEvents="none">
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      {/* Glassmorphism Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0EA5E9" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View>
            <Avatar {...resolveAvatar({ name: targetName, avatarUrl: targetAvatar })} size={38} />
            <View style={styles.onlineBadge} />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.name}>{targetName ?? "User"}</Text>
            <Text style={styles.status}>Active now</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onCall} style={styles.headerIconCircle}>
            <Ionicons name="call" size={18} color="#0EA5E9" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onVideoCall} style={styles.headerIconCircle}>
            <Ionicons name="videocam" size={20} color="#0EA5E9" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: true });
          }}
        />

        {/* Improved Floating Input Bar */}
        <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.inputRowContainer}>
            {isRecordingUI ? (
              <View style={styles.recordingBar}>
                <Animated.View style={[styles.recordDot, { opacity: pulseAnim }]} />
                <Text style={styles.timerText}>{formatTime(elapsedMs)}</Text>
                <Text style={styles.slideText} numberOfLines={1}>
                  {!isLocked ? "Swipe left to cancel" : "Recording locked"}
                </Text>
              </View>
            ) : (
              <View style={styles.mainInputSubContainer}>
                <TouchableOpacity onPress={() => {
                  Keyboard.dismiss();
                  setShowEmoji(true);
                  }}
                  style={styles.iconPadding}>
                  <Ionicons name="happy-outline" size={24} color="#94a3b8" />
                </TouchableOpacity>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Message..."
                  placeholderTextColor="#94a3b8"
                  value={text}
                  onChangeText={setText}
                  multiline
                />
              </View>
            )}

            <View style={styles.sendButtonArea}>
              {!text.trim() ? (
                <VoiceRecorder
                  onSend={sendAudio}
                  onRecordingStateChange={setIsRecordingUI}
                  onTick={setElapsedMs}
                  onLockChange={setIsLocked}
                />
              ) : (
                <TouchableOpacity onPress={sendText}>
                  <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.sendCircle}>
                    <Ionicons name="send" size={18} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* OVERLAY: Message Actions */}
      {actionMsg && (
        <View style={styles.overlay}>
          <TouchableOpacity style={{flex:1}} onPress={() => setActionMsg(null)} />
          <View style={[styles.actionSheet, { paddingBottom: insets.bottom + 20 }]}>
            <TouchableOpacity style={styles.actionItem} onPress={() => {
              setEditingId(actionMsg.id);
              setEditText(actionMsg.text);
              setActionMsg(null);
            }}>
              <Ionicons name="pencil-outline" size={20} color="#1e293b" />
              <Text style={styles.actionText}>Edit Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={async () => {
              await deleteMessage(actionMsg.id);
              setActionMsg(null);
            }}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.actionText, { color: "#ef4444" }]}>Delete for everyone</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionItem, { borderBottomWidth: 0 }]} onPress={() => setActionMsg(null)}>
              <Text style={styles.cancelActionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* OVERLAY: Emoji Picker */}
      {showEmoji && (
        <View style={[styles.emojiContainer, { paddingBottom: insets.bottom }]}>
          <View style={styles.emojiHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowEmoji(false);
                setTimeout(() => {
                  inputRef.current?.focus(); // 👈 REOPEN keyboard
                }, 100);
              }}
            >
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <EmojiPicker onSelect={(emoji) => {
            setText(t => t + emoji);
          }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    position: "relative",
  },
  backgroundDecor: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "rgba(255,255,255,0.85)", borderBottomWidth: 1, borderColor: "#F1F5F9",
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", flex: 1 },
  onlineBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 12, height: 12,
    borderRadius: 6, backgroundColor: '#22c55e', borderWidth: 2, borderColor: '#fff'
  },
  name: { fontSize: 16, fontWeight: "800", color: "#0f172a", letterSpacing: -0.4 },
  status: { fontSize: 12, color: "#64748b" },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F9FF",
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E0F2FE'
  },
  list: { paddingHorizontal: 16, paddingVertical: 20 },
  row: { flexDirection: "row", marginBottom: 10, alignItems: 'flex-end' },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatarSlot: { width: 34 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  myBubble: { borderBottomRightRadius: 4, shadowColor: "#0EA5E9", shadowOpacity: 0.15, shadowRadius: 5, elevation: 3 },
  otherBubble: { backgroundColor: "#fff", borderBottomLeftRadius: 4, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2 },
  text: { fontSize: 15, lineHeight: 22 },
  myText: { color: "#fff" },
  otherText: { color: "#1e293b" },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  myTime: { fontSize: 10, color: "rgba(255,255,255,0.6)", marginRight: 4 },
  otherTime: { fontSize: 10, color: "#94a3b8", marginTop: 4, textAlign: 'right' },
  inputWrapper: { paddingHorizontal: 12, paddingTop: 8 },
  inputRowContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 28, padding: 6, elevation: 8,
    shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10,
  },
  mainInputSubContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconPadding: { paddingHorizontal: 8 },
  input: { flex: 1, fontSize: 16, color: '#0f172a', maxHeight: 100, paddingVertical: 8 },
  sendButtonArea: { width: 48, alignItems: 'center', justifyContent: 'center' },
  sendCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  timerText: { marginLeft: 8, fontSize: 15, fontWeight: '700', color: '#1e293b' },
  slideText: { marginLeft: 12, fontSize: 13, color: '#94a3b8', flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 1000 },
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 0.5, borderColor: '#f1f5f9' },
  actionText: { fontSize: 16, marginLeft: 12, fontWeight: '500' },
  cancelActionText: { textAlign: 'center', width: '100%', color: '#94a3b8', fontWeight: '600' },
  emojiContainer: { backgroundColor: '#fff', height: 350, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  emojiHeader: { padding: 12, alignItems: 'flex-end', borderBottomWidth: 0.5, borderColor: '#f1f5f9' },
  doneText: { color: '#0EA5E9', fontWeight: '700', fontSize: 16 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  editCancel: { color: 'rgba(255,255,255,0.7)', marginRight: 16, fontWeight: '600' },
  editSave: { color: '#fff', fontWeight: '800' },
  backBtn: { 
    paddingRight: 8, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  decorCircle1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#E0F2FE",
    opacity: 0.6,
    top: -60,
    left: -100,
  },

  decorCircle2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#BAE6FD",
    opacity: 0.45,
    bottom: 100,
    right: -60,
  },
});

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function formatMsgTime(ts?: any) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}