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
  View,
  Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Avatar, { resolveAvatar } from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { useI18n } from "@/i18n/i18n";
import { Conversation, useConversationsViewModel } from "@/viewmodels/tabs/ConversationsViewModel";

const { width, height } = Dimensions.get("window");

// Animated background bubble - matches dashboard
const Bubble = ({ delay, size, color, position }: { delay: number; size: number; color: string; position: { top?: number; left?: number; right?: number; bottom?: number } }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 4000 + Math.random() * 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 4000 + Math.random() * 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 3000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 3000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...position,
          transform: [{ translateY }, { scale: scaleAnim }],
        },
      ]}
    />
  );
};

function formatRelativeTime(date: Date, now_label: string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return now_label;
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
  const { t } = useI18n();
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
        isMe && styles.meItem
      ]}
    >
      {hasUnread && <View style={styles.unreadGlow} />}

      <View style={styles.avatarWrapper}>
        <View style={[styles.avatarGlow, isMe && styles.avatarGlowMe]}>
          <Avatar {...resolveAvatar({ name: item.participantName, avatarUrl: item.participantAvatar })} size={52} />
        </View>
        {isMe && (
          <View style={styles.meBadge}>
            <Ionicons name="person" size={10} color="#fff" />
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
            {formatRelativeTime(item.lastMessageTime, t.now)}
          </Text>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.messagePreview}>
            {getMessageTypeIcon()}
            <Text style={[styles.messageText, hasUnread && styles.messageTextUnread]} numberOfLines={1}>
              {isForwardMode ? t.tapToForwardMessage : item.lastMessage}
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
    id: "me_self_conversation",
    participantId: user.uid,
    participantName: `${user.name || t.me} (You)`,
    participantAvatar: user.avatarUrl || "",
    lastMessage: t.messageYourself,
    lastMessageTime: new Date(),
    lastMessageType: "text",
    unreadCount: 0,
    isOnline: true,
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

  const [isForwardMode, setIsForwardMode] = useState(!!forwardMessageId);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const headerY = useRef(new Animated.Value(-20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    setIsForwardMode(!!forwardMessageId);
  }, [forwardMessageId]);

  useEffect(() => {
    const entranceAnimation = Animated.stagger(100, [
      Animated.timing(headerY, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 900, 
        useNativeDriver: true 
      }),
      Animated.spring(slideAnim, { 
        toValue: 0, 
        tension: 50, 
        friction: 8,
        useNativeDriver: true 
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true
      })
    ]);

    entranceAnimation.start();
  }, []);

  useEffect(() => {
    if (!forwardMessageId) {
      setSelectedConversations(new Set());
      setIsForwardMode(false);
    }
  }, [forwardMessageId]);

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return allConversations;
    const query = searchQuery.toLowerCase();
    return allConversations.filter(
      (conv) =>
        conv.participantName.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
    );
  }, [allConversations, searchQuery]);

  const clearForwardState = useCallback(() => {
    setIsForwardMode(false);
    setSelectedConversations(new Set());
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

  const handleConversationPress = useCallback(async (item: Conversation) => {
    Keyboard.dismiss();

    if (isForwardMode) {
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
          sourceTargetAvatar: (sourceTargetAvatar || "").trim(),
          forwardedFromUserId: sourceUserId || "",
          isForwarded: "true",
        },
      });
      clearForwardState();
      return;
    }

    if (item.id === "me_self_conversation") {
      router.push({
        pathname: "/(tabs)/contact",
        params: { 
          targetUserId: user?.uid,
          targetName: user?.name || t.me,
          targetAvatar: user?.avatarUrl || "",
          isSelfChat: "true",
        },
      });
      return;
    }

    router.push({
      pathname: "/(tabs)/contact",
      params: { 
        targetUserId: item.participantId, 
        targetName: item.participantName, 
        targetAvatar: item.participantAvatar || "" 
      },
    });
  }, [isForwardMode, user, forwardType, forwardContent, forwardAudioUrl, sourceTargetName, sourceTargetAvatar, sourceUserId, clearForwardState]);

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
        <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.loaderIcon}>
          <Ionicons name="chatbubbles" size={36} color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>{t.loadingConversations}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Animated Background - Matches Dashboard */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#fafaff", "#f0f4ff", "#e0e7ff", "#dbeafe"]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradientBackground}
        />
        
        {/* Floating Glass Bubbles */}
        <Bubble delay={0} size={260} color="rgba(99, 102, 241, 0.08)" position={{ top: -80, right: -60 }} />
        <Bubble delay={1000} size={180} color="rgba(14, 165, 233, 0.06)" position={{ top: 80, left: -40 }} />
        <Bubble delay={2000} size={140} color="rgba(139, 92, 246, 0.07)" position={{ top: 250, right: -30 }} />
        <Bubble delay={1500} size={100} color="rgba(16, 185, 129, 0.05)" position={{ bottom: 150, left: 20 }} />
      </View>

      <View style={[styles.content, { paddingTop: insets.top }]}>
        {/* Header - Dashboard Style */}
        <Animated.View 
          style={[
            styles.header, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }] 
            }
          ]}
        >
          <Animated.View style={{ transform: [{ translateY: headerY }] }}>
            <View style={styles.titleRow}>
              <View>
                <View style={styles.headerLeft}>
                  <Text style={styles.overline}>
                    {isForwardMode ? t.forwardTo : t.messages}
                  </Text>
                  {!isForwardMode && totalUnreadCount > 0 && (
                    <View style={styles.totalBadge}>
                      <Text style={styles.totalBadgeText}>
                        {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              
              {isForwardMode ? (
                <Pressable onPress={handleForwardCancel} style={styles.cancelForwardBtn}>
                  <Text style={styles.cancelForwardText}>Cancel</Text>
                </Pressable>
              ) : (
                <Pressable 
                  onPress={() => { Keyboard.dismiss(); router.push("/(settings)/select_user"); }} 
                  style={({ pressed }) => [
                    styles.newChatBtn, 
                    pressed && styles.newChatBtnPressed
                  ]}
                >
                  <LinearGradient colors={["#6366F1", "#8B5CF6"]} style={styles.newChatGradient}>
                    <Ionicons name="pencil" size={20} color="#fff" />
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </Animated.View>
        </Animated.View>

        {/* FORWARD PREVIEW - Glass Card Style */}
        {isForwardMode && (
          <View style={styles.forwardPreviewContainer}>
            <Text style={styles.sectionLabel}>Forwarding</Text>
            <View style={styles.forwardPreviewCard}>
              <View style={styles.forwardPreviewHeader}>
                <Ionicons name="arrow-redo" size={16} color="#6366F1" />
                <Text style={styles.forwardPreviewFrom}>Forwarded from {sourceTargetName}</Text>
              </View>

              {forwardType === "audio" ? (
                <View style={styles.forwardPreviewContent}>
                  <View style={[styles.previewIconBox, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                    <Ionicons name="mic" size={20} color="#6366F1" />
                  </View>
                  <Text style={styles.forwardPreviewText}>{t.voiceMessageLabel}</Text>
                </View>
              ) : forwardType === "call" ? (
                <View style={styles.forwardPreviewContent}>
                  <View style={[styles.previewIconBox, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                    <Ionicons name={forwardCallType === "video" ? "videocam" : "call"} size={20} color="#6366F1" />
                  </View>
                  <Text style={styles.forwardPreviewText}>
                    {forwardCallStatus === "missed" ? t.missedPrefix : ""}
                    {forwardCallType === "video" ? t.videoCall2 : t.voiceCall2}
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

        {/* Search Bar - Glass Style */}
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

        {/* Conversations List */}
        <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent, 
              filteredConversations.length === 0 && styles.emptyListContent
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={refresh} 
                tintColor="#6366F1"
                colors={["#6366F1", "#8B5CF6", "#0EA5E9"]}
                progressBackgroundColor="#fff"
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#6366F1" />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? t.noResultsFound : t.noConversationsYet}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery ? t.tryDifferentSearchTerm : t.startConversationHint}
                </Text>

                {!searchQuery && !isForwardMode && (
                  <Pressable 
                    onPress={() => router.push("/(settings)/select_user")} 
                    style={({ pressed }) => [
                      styles.startBtn,
                      pressed && styles.startBtnPressed
                    ]}
                  >
                    <LinearGradient 
                      colors={["#6366F1", "#8B5CF6"]} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 0 }} 
                      style={styles.startBtnGradient}
                    >
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafaff" 
  },
  center: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#fafaff" 
  },

  // Background - Matches Dashboard
  backgroundContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  gradientBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  bubble: {
    position: "absolute",
    opacity: 0.4,
  },

  content: {
    flex: 1,
  },

  // Header - Dashboard Style
  header: { 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 16,
  },
  titleRow: { 
    flexDirection: "row", 
    alignItems: "flex-end", 
    justifyContent: "space-between",
  },
  overline: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0b0b0b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  headerLeft: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12 
  },
  totalBadge: { 
    backgroundColor: "#6366F1",
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 10,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  totalBadgeText: { 
    color: "#fff", 
    fontSize: 12, 
    fontWeight: "800" 
  },

  // New Chat Button - Glass Style
  newChatBtn: { 
    borderRadius: 16, 
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6 
  },
  newChatBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9
  },
  newChatGradient: { 
    width: 48, 
    height: 48, 
    alignItems: "center", 
    justifyContent: "center" 
  },

  cancelForwardBtn: { 
    paddingHorizontal: 16, 
    paddingVertical: 8,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)"
  },
  cancelForwardText: { 
    color: "#6366F1", 
    fontSize: 14, 
    fontWeight: "800" 
  },

  // Forward Preview - Glass Card
  forwardPreviewContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionLabel: { 
    fontSize: 13, 
    fontWeight: "800", 
    color: "#0F172A", 
    textTransform: "uppercase", 
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4
  },
  forwardPreviewCard: {
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  forwardPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(226, 232, 240, 0.6)",
  },
  forwardPreviewFrom: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "700",
  },
  forwardPreviewContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  previewIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  forwardPreviewText: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "600",
  },
  forwardPreviewMessage: {
    fontSize: 15,
    color: "#0F172A",
    lineHeight: 22,
    fontWeight: "500",
  },

  // Search - Glass Style
  searchWrapper: { 
    paddingHorizontal: 20, 
    marginBottom: 16 
  },
  searchBar: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "rgba(255, 255, 255, 0.95)", 
    borderRadius: 20, 
    paddingHorizontal: 18, 
    paddingVertical: 14, 
    gap: 12, 
    borderWidth: 1, 
    borderColor: "rgba(255, 255, 255, 0.8)", 
    shadowColor: "#000", 
    shadowOpacity: 0.03, 
    shadowRadius: 8, 
    elevation: 2,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 16, 
    color: "#0f172a", 
    fontWeight: "600" 
  },

  // List
  listContainer: { 
    flex: 1 
  },
  listContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 120 
  },
  emptyListContent: { 
    flex: 1, 
    justifyContent: "center" 
  },

  // Conversation Item - Glass Card
  conversationItem: {
    flexDirection: "row", 
    alignItems: "center", 
    padding: 14, 
    marginBottom: 10, 
    borderRadius: 20, 
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1, 
    borderColor: "rgba(255, 255, 255, 0.6)", 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.03, 
    shadowRadius: 6, 
    elevation: 1,
    overflow: "hidden",
    position: "relative"
  },
  itemPressed: { 
    backgroundColor: "rgba(248, 250, 252, 1)", 
    transform: [{ scale: 0.98 }] 
  },
  itemSelected: { 
    borderColor: "#6366F1", 
    borderWidth: 2, 
    backgroundColor: "rgba(238, 242, 255, 0.9)" 
  },

  unreadGlow: { 
    position: "absolute", 
    left: 0, 
    top: 0, 
    bottom: 0, 
    width: 4, 
    backgroundColor: "#6366F1",
    borderTopLeftRadius: 20, 
    borderBottomLeftRadius: 20 
  },

  avatarWrapper: { 
    marginRight: 14, 
    position: "relative" 
  },
  avatarGlow: { 
    borderWidth: 2, 
    borderColor: "rgba(255,255,255,0.8)", 
    borderRadius: 26,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  avatarGlowMe: {
    borderColor: "#0EA5E9",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.2
  },
  onlinePulse: { 
    position: "absolute", 
    bottom: 2, 
    right: 2, 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: "#fff", 
    alignItems: "center", 
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  },
  onlineDot: { 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: "#10B981"
  },
  selectedCheck: { 
    position: "absolute", 
    bottom: -4, 
    right: -4, 
    backgroundColor: "#fff", 
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  meBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0EA5E9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },

  contentWrapper: { 
    flex: 1 
  },
  headerRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 4 
  },
  nameText: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#0f172a", 
    flex: 1, 
    marginRight: 8 
  },
  nameTextUnread: { 
    color: "#4F46E5" 
  },
  meNameText: {
    color: "#0EA5E9",
  },
  meItem: {
    backgroundColor: "rgba(240, 249, 255, 0.95)",
    borderColor: "rgba(14, 165, 233, 0.3)",
  },

  timeText: { 
    fontSize: 12, 
    color: "#94a3b8", 
    fontWeight: "600" 
  },
  timeTextUnread: { 
    color: "#6366F1", 
    fontWeight: "800" 
  },

  footerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
  },
  messagePreview: { 
    flexDirection: "row", 
    alignItems: "center", 
    flex: 1 
  },
  messageText: { 
    fontSize: 14, 
    color: "#64748b", 
    fontWeight: "500" 
  },
  messageTextUnread: { 
    color: "#334155", 
    fontWeight: "700" 
  },

  badgeGradient: { 
    minWidth: 22, 
    height: 22, 
    borderRadius: 11, 
    alignItems: "center", 
    justifyContent: "center", 
    paddingHorizontal: 7, 
    marginLeft: 10,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  badgeText: { 
    color: "#fff", 
    fontSize: 11, 
    fontWeight: "800" 
  },

  // Empty State - Glass Style
  emptyState: { 
    alignItems: "center", 
    paddingVertical: 60, 
    paddingHorizontal: 40 
  },
  emptyIconCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 32, 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 24,
    backgroundColor: "rgba(238, 242, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5
  },
  emptyTitle: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#0f172a", 
    marginBottom: 8 
  },
  emptySubtitle: { 
    fontSize: 15, 
    color: "#94a3b8", 
    textAlign: "center", 
    lineHeight: 22, 
    marginBottom: 24 
  },

  // Start Button - Glass Style
  startBtn: { 
    borderRadius: 20, 
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6 
  },
  startBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95
  },
  startBtnGradient: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 28, 
    paddingVertical: 16 
  },
  startBtnText: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "800" 
  },

  // Loading
  loaderIcon: { 
    width: 80, 
    height: 80, 
    borderRadius: 24, 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 20,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8 
  },
  loadingText: { 
    fontSize: 16, 
    color: "#6366F1", 
    fontWeight: "700" 
  },
});