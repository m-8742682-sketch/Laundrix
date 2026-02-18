// conversations.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar, { resolveAvatar } from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { useI18n } from "@/i18n/i18n";
import { Conversation, useConversationsViewModel } from "@/viewmodels/tabs/ConversationsViewModel";

const { width } = Dimensions.get("window");

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const ConversationItem = memo(({ item, onPress, isForwardMode, isSelected, isMe }: { 
  item: Conversation; 
  onPress: () => void;
  isForwardMode?: boolean;
  isSelected?: boolean;
  isMe?: boolean;
}) => {
  const hasUnread = item.unreadCount > 0 && !isForwardMode;

  const getMessageTypeIcon = () => {
    switch (item.lastMessageType) {
      case "audio": return <Ionicons name="mic" size={14} color={hasUnread ? "#6366F1" : "#94a3b8"} style={{ marginRight: 4 }} />;
      case "image": return <Ionicons name="image" size={14} color={hasUnread ? "#6366F1" : "#94a3b8"} style={{ marginRight: 4 }} />;
      case "call": return <Ionicons name="call" size={14} color={hasUnread ? "#6366F1" : "#94a3b8"} style={{ marginRight: 4 }} />;
      default: return null;
    }
  };

  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.conversationItem, 
        pressed && styles.itemPressed, 
        isSelected && styles.itemSelected,
        isMe && styles.meItem // Special style for "Me"
      ]}
    >
      {hasUnread && <View style={styles.unreadGlow} />}

      <View style={styles.avatarWrapper}>
        <Avatar {...resolveAvatar({ name: item.participantName, avatarUrl: item.participantAvatar })} size={56} />
        {isMe && (
          <View style={styles.meBadge}>
            <Ionicons name="person" size={12} color="#fff" />
          </View>
        )}
        {item.isOnline && !isForwardMode && (
          <View style={styles.onlinePulse}>
            <View style={styles.onlineDot} />
          </View>
        )}
        {isForwardMode && isSelected && (
          <View style={styles.selectedCheck}>
            <Ionicons name="checkmark-circle" size={24} color="#6366F1" />
          </View>
        )}
      </View>

      <View style={styles.contentWrapper}>
        <View style={styles.headerRow}>
          <Text style={[styles.nameText, hasUnread && styles.nameTextUnread, isMe && styles.meNameText]} numberOfLines={1}>
            {item.participantName}
          </Text>
          <Text style={[styles.timeText, hasUnread && styles.timeTextUnread]}>
            {formatRelativeTime(item.lastMessageTime)}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.messagePreview}>
            {getMessageTypeIcon()}
            <Text style={[styles.messageText, hasUnread && styles.messageTextUnread]} numberOfLines={1}>
              {isForwardMode ? "Tap to forward message" : item.lastMessage}
            </Text>
          </View>

          {hasUnread && (
            <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.badgeGradient}>
              <Text style={styles.badgeText}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text>
            </LinearGradient>
          )}
        </View>
      </View>
    </Pressable>
  );
});

export default function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { t } = useI18n();
  const { conversations, loading, refreshing, refresh, totalUnreadCount } = useConversationsViewModel(user?.uid);

  const meConversation: Conversation | null = user ? {
    id: "me_self_conversation", // Special ID
    participantId: user.uid,
    participantName: `${user.name || "Me"} (You)`, // Show "You" indicator
    participantAvatar: user.avatarUrl || "",
    lastMessage: "Message yourself",
    lastMessageTime: new Date(), // Always recent
    lastMessageType: "text",
    unreadCount: 0,
    isOnline: true, // Always online
  } : null;

  const allConversations = useMemo(() => {
  if (!meConversation) return conversations;
  return [meConversation, ...conversations.filter(c => c.participantId !== user?.uid)];
}, [conversations, meConversation, user?.uid]);


  const params = useLocalSearchParams<{
    forwardMessageId?: string;
    forwardType?: string;
    forwardContent?: string;
    forwardAudioUrl?: string;
    forwardCallType?: string;
    forwardCallStatus?: string;
    forwardCallDuration?: string;
    sourceTargetName?: string;
    sourceTargetAvatar?: string;
    sourceUserId?: string;
  }>();

  const { 
    forwardMessageId, 
    forwardType, 
    forwardContent,
    forwardAudioUrl,
    forwardCallType,
    forwardCallStatus,
    forwardCallDuration,
    sourceTargetName,
    sourceTargetAvatar,
    sourceUserId,
  } = params;

  // FIXED: Use state to track forward mode instead of just deriving from params
  // This allows us to reset the state properly
  const [isForwardMode, setIsForwardMode] = useState(!!forwardMessageId);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // FIXED: Sync forward mode state with params
  useEffect(() => {
    setIsForwardMode(!!forwardMessageId);
  }, [forwardMessageId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Clear forward params when component mounts if no forwardMessageId
  useEffect(() => {
    if (!forwardMessageId) {
      setSelectedConversations(new Set());
      setIsForwardMode(false);
    }
  }, [forwardMessageId]);

  // Use allConversations instead of conversations in filteredConversations
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return allConversations;
    const query = searchQuery.toLowerCase();
    return allConversations.filter(
      (conv) =>
        conv.participantName.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
    );
  }, [allConversations, searchQuery]);

  // FIXED: Helper function to clear forward state
  const clearForwardState = useCallback(() => {
    // Clear local state first
    setIsForwardMode(false);
    setSelectedConversations(new Set());

    // Then clear URL params
    router.setParams({
      forwardMessageId: undefined,
      forwardType: undefined,
      forwardContent: undefined,
      forwardAudioUrl: undefined,
      forwardCallType: undefined,
      forwardCallStatus: undefined,
      forwardCallDuration: undefined,
      sourceTargetName: undefined,
    });
  }, []);

  // FIXED: Handle conversation press with proper state reset
  const handleConversationPress = useCallback(async (item: Conversation) => {
    Keyboard.dismiss();

    if (isForwardMode) {
      console.log("[Conversations] Forwarding to:", {
        targetName: item.participantName,
        sourceTargetName,
        sourceTargetAvatar,
        sourceUserId,
      });

      // Navigate to contact with forward params
      router.push({
        pathname: "/(tabs)/contact",
        params: {
          targetUserId: item.participantId,
          targetName: item.participantName,
          targetAvatar: item.participantAvatar || "",
          forwardedFrom: sourceTargetName || "User",
          forwardedType: forwardType || "text",
          forwardedMessage: forwardContent || "",
          forwardedAudioUrl: forwardAudioUrl || "",
          sourceTargetAvatar: (sourceTargetAvatar || "").trim(), // Ensure this is passed
          forwardedFromUserId: sourceUserId || "", // Ensure this is passed
          isForwarded: "true",
        },
      });

      // FIXED: Immediately clear forward state after navigation
      clearForwardState();

      return;
    }

    // Normal navigation - check if it's "Me"
    if (item.id === "me_self_conversation") {
      router.push({
        pathname: "/(tabs)/contact",
        params: { 
          targetUserId: user?.uid,
          targetName: user?.name || "Me",
          targetAvatar: user?.avatarUrl || "",
          isSelfChat: "true",
        },
      });
      return;
    }

    // Normal navigation
    router.push({
      pathname: "/(tabs)/contact",
      params: { 
        targetUserId: item.participantId, 
        targetName: item.participantName, 
        targetAvatar: item.participantAvatar || "" 
      },
    });
  }, [isForwardMode, user, forwardType, forwardContent, forwardAudioUrl, sourceTargetName, sourceTargetAvatar, sourceUserId, clearForwardState]);

  // FIXED: Handle cancel with proper state reset
  const handleForwardCancel = useCallback(() => {
    clearForwardState();
  }, [clearForwardState]);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem 
      item={item} 
      onPress={() => handleConversationPress(item)} 
      isForwardMode={isForwardMode}
      isSelected={selectedConversations.has(item.id)}
      isMe={item.id === "me_self_conversation"}
    />
  ), [handleConversationPress, isForwardMode, selectedConversations]);

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.loaderIcon}>
          <Ionicons name="chatbubbles" size={36} color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>{t.loadingConversations}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorTriangle} />
      </View>

      <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>
            {isForwardMode 
              ? `Forward to...` 
              : t.messages}
          </Text>
          {!isForwardMode && totalUnreadCount > 0 && (
            <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{totalUnreadCount > 99 ? "99+" : totalUnreadCount}</Text>
            </LinearGradient>
          )}
        </View>
        {isForwardMode ? (
          <Pressable onPress={handleForwardCancel} style={styles.cancelForwardBtn}>
            <Text style={styles.cancelForwardText}>Cancel</Text>
          </Pressable>
        ): (
          <Pressable onPress={() => { Keyboard.dismiss(); router.push("/(settings)/select_user"); }} style={({ pressed }) => [styles.newChatBtn, pressed && { transform: [{ scale: 0.95 }] }]}>
            <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.newChatGradient}>
              <Ionicons name="pencil" size={20} color="#fff" />
            </LinearGradient>
          </Pressable>
        )}
      </Animated.View>

      {/* FORWARD PREVIEW - Shows actual message being forwarded */}
      {isForwardMode && (
        <View style={styles.forwardPreviewContainer}>
          <Text style={styles.forwardPreviewLabel}>Forwarding:</Text>
          <View style={styles.forwardPreviewBubble}>
            <View style={styles.forwardPreviewHeader}>
              <Ionicons name="arrow-forward" size={12} color="#64748B" />
              <Text style={styles.forwardPreviewFrom}>Forwarded from {sourceTargetName}</Text>
            </View>

            {forwardType === "audio" ? (
              <View style={styles.forwardPreviewContent}>
                <Ionicons name="mic" size={20} color="#6366F1" />
                <Text style={styles.forwardPreviewText}>Voice message</Text>
              </View>
            ) : forwardType === "call" ? (
              <View style={styles.forwardPreviewContent}>
                <Ionicons name={forwardCallType === "video" ? "videocam" : "call"} size={20} color="#6366F1" />
                <Text style={styles.forwardPreviewText}>
                  {forwardCallStatus === "missed" ? "Missed " : ""}
                  {forwardCallType === "video" ? "Video" : "Voice"} call
                </Text>
              </View>
            ) : (
              <Text style={styles.forwardPreviewMessage} numberOfLines={2}>
                {forwardContent}
              </Text>
            )}
          </View>
        </View>
      )}

      {!isForwardMode && (
        <Animated.View style={[styles.searchWrapper, { opacity: fadeAnim }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchMessages}
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={20} color="#cbd5e1" />
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, filteredConversations.length === 0 && styles.emptyListContent]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#6366F1" colors={["#6366F1"]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={48} color="#4F46E5" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>{searchQuery ? t.noResultsFound : t.noConversationsYet}</Text>
              <Text style={styles.emptySubtitle}>{searchQuery ? t.tryDifferentSearchTerm : t.startConversationHint}</Text>

              {!searchQuery && !isForwardMode && (
                <Pressable onPress={() => router.push("/(settings)/select_user")} style={styles.startBtn}>
                  <LinearGradient colors={["#6366F1", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startBtnGradient}>
                    <Text style={styles.startBtnText}>{t.startAChat}</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          }
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },

  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 350, height: 350, borderRadius: 175, backgroundColor: "#E0E7FF", opacity: 0.5, top: -100, right: -80 },
  decorCircle2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 100, left: -80 },
  decorTriangle: { position: "absolute", width: 180, height: 180, backgroundColor: "#ECFEFF", opacity: 0.3, top: "20%", right: -40, transform: [{ rotate: "45deg" }] },

  loaderIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20, shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  loadingText: { fontSize: 16, color: "#6366F1", fontWeight: "700" },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#0f172a", letterSpacing: -1 },
  totalBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  totalBadgeText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  newChatBtn: { borderRadius: 18, overflow: "hidden", shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  newChatGradient: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },

  cancelForwardBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  cancelForwardText: { color: "#6366F1", fontSize: 16, fontWeight: "700" },

  forwardPreviewContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  forwardPreviewLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
  },
  forwardPreviewBubble: {
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  forwardPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  forwardPreviewFrom: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  forwardPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forwardPreviewText: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },
  forwardPreviewMessage: {
    fontSize: 15,
    color: '#0F172A',
    lineHeight: 20,
  },

  searchWrapper: { paddingHorizontal: 20, marginBottom: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, gap: 12, borderWidth: 1, borderColor: "#E2E8F0", shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, fontSize: 16, color: "#0f172a", fontWeight: "600" },

  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyListContent: { flex: 1, justifyContent: "center" },

  conversationItem: {
    flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 10, borderRadius: 24, backgroundColor: "#fff",
    shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: "#f1f5f9", overflow: 'hidden',
  },
  itemPressed: { backgroundColor: "#F8FAFC", transform: [{ scale: 0.98 }] },
  itemSelected: { borderColor: "#6366F1", borderWidth: 2, backgroundColor: "#EEF2FF" },

  unreadGlow: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: "#6366F1", borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },

  avatarWrapper: { marginRight: 14, position: 'relative' },
  onlinePulse: { position: "absolute", bottom: 2, right: 2, width: 18, height: 18, borderRadius: 9, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#10B981", borderWidth: 2, borderColor: "#fff" },
  selectedCheck: { position: "absolute", bottom: -4, right: -4, backgroundColor: "#fff", borderRadius: 12 },

  contentWrapper: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  nameText: { fontSize: 17, fontWeight: "700", color: "#0f172a", flex: 1, marginRight: 8 },
  nameTextUnread: { color: "#4F46E5" },

  timeText: { fontSize: 12, color: "#94a3b8", fontWeight: "600" },
  timeTextUnread: { color: "#6366F1", fontWeight: "800" },

  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  messagePreview: { flexDirection: "row", alignItems: "center", flex: 1 },
  messageText: { fontSize: 14, color: "#64748b", fontWeight: "500" },
  messageTextUnread: { color: "#334155", fontWeight: "700" },

  badgeGradient: { minWidth: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, marginLeft: 10 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 24, shadowColor: "#6366F1", shadowOpacity: 0.2, shadowRadius: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#94a3b8", textAlign: "center", lineHeight: 22, marginBottom: 24 },

  startBtn: { borderRadius: 20, overflow: "hidden", shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  startBtnGradient: { flexDirection: "row", alignItems: "center", paddingHorizontal: 32, paddingVertical: 16 },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  meItem: {
  backgroundColor: "#F0F9FF", // Light blue background
  borderColor: "#0EA5E9",
},
  meBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  meNameText: {
    color: "#0EA5E9", // Blue text for "Me"
  },
});