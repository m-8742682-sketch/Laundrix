/**
 * Conversations List Screen
 * 
 * High-end messaging app UI with real-time sync.
 * Now uses Firestore onSnapshot for instant message updates.
 * Optimized for smooth performance with memoization.
 */

import React, { useRef, useEffect, useMemo, useCallback, memo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Animated,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import Avatar, { resolveAvatar } from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { useConversationsViewModel, Conversation } from "@/viewmodels/tabs/ConversationsViewModel";

const { width } = Dimensions.get("window");

// Format relative time for messages
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
  
  return date.toLocaleDateString(undefined, { 
    month: "short", 
    day: "numeric" 
  });
}

// Memoized conversation item for performance
const ConversationItem = memo(({ 
  item, 
  onPress 
}: { 
  item: Conversation; 
  onPress: () => void;
}) => {
  const hasUnread = item.unreadCount > 0;
  
  // Get message icon based on type
  const getMessageTypeIcon = () => {
    switch (item.lastMessageType) {
      case "audio":
        return <Ionicons name="mic" size={14} color="#64748b" style={{ marginRight: 4 }} />;
      case "image":
        return <Ionicons name="image" size={14} color="#64748b" style={{ marginRight: 4 }} />;
      case "call":
        return <Ionicons name="call" size={14} color="#64748b" style={{ marginRight: 4 }} />;
      default:
        return null;
    }
  };

  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [
        styles.conversationItem,
        hasUnread && styles.conversationItemUnread,
        pressed && styles.conversationItemPressed,
      ]}
    >
      {/* Avatar with online indicator */}
      <View style={styles.avatarContainer}>
        <Avatar 
          {...resolveAvatar({ 
            name: item.participantName, 
            avatarUrl: item.participantAvatar 
          })} 
          size={56} 
        />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      {/* Content */}
      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={[styles.participantName, hasUnread && styles.participantNameUnread]} numberOfLines={1}>
            {item.participantName}
          </Text>
          <Text style={[styles.timestamp, hasUnread && styles.timestampUnread]}>
            {formatRelativeTime(item.lastMessageTime)}
          </Text>
        </View>
        <View style={styles.messageRow}>
          {getMessageTypeIcon()}
          <Text 
            style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]} 
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {hasUnread && (
            <LinearGradient
              colors={["#0EA5E9", "#0284C7"]}
              style={styles.unreadBadge}
            >
              <Text style={styles.unreadCount}>
                {item.unreadCount > 99 ? "99+" : item.unreadCount}
              </Text>
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
  const { 
    conversations, 
    loading, 
    refreshing, 
    refresh,
    totalUnreadCount,
  } = useConversationsViewModel(user?.uid);

  const [searchQuery, setSearchQuery] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Subtle pulse animation for background
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.participantName.toLowerCase().includes(query) ||
      conv.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const handleConversationPress = useCallback((item: Conversation) => {
    router.push({
      pathname: "/(tabs)/contact",
      params: {
        targetUserId: item.participantId,
        targetName: item.participantName,
        targetAvatar: item.participantAvatar || "",
      },
    });
  }, []);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem 
      item={item} 
      onPress={() => handleConversationPress(item)} 
    />
  ), [handleConversationPress]);

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 80, // Approximate item height
    offset: 80 * index,
    index,
  }), []);

  if (loading && conversations.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor} pointerEvents="none">
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Messages</Text>
          {totalUnreadCount > 0 && (
            <LinearGradient
              colors={["#0EA5E9", "#0284C7"]}
              style={styles.totalUnreadBadge}
            >
              <Text style={styles.totalUnreadText}>
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </Text>
            </LinearGradient>
          )}
        </View>
        <Pressable 
          style={styles.newChatButton}
          onPress={() => router.push("/(settings)/select_user")}
        >
          <LinearGradient
            colors={["#0EA5E9", "#0284C7"]}
            style={styles.newChatGradient}
          >
            <Ionicons name="create-outline" size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Conversations List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          filteredConversations.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={15}
        getItemLayout={getItemLayout}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#0EA5E9"
            colors={["#0EA5E9"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <LinearGradient
              colors={["#f0f9ff", "#e0f2fe"]}
              style={styles.emptyIconContainer}
            >
              <Ionicons name="chatbubbles-outline" size={56} color="#0EA5E9" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>
              {searchQuery ? "No results found" : "No conversations yet"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? "Try a different search term" 
                : "Start a new conversation by tapping the button above ✨"}
            </Text>
            {!searchQuery && (
              <Pressable 
                style={styles.startChatButton}
                onPress={() => router.push("/(settings)/select_user")}
              >
                <LinearGradient
                  colors={["#0EA5E9", "#0284C7"]}
                  style={styles.startChatGradient}
                >
                  <Text style={styles.startChatText}>Start a Chat</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </LinearGradient>
              </Pressable>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  backgroundDecor: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  decorCircle1: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#E0F2FE",
    opacity: 0.5,
    top: -100,
    right: -80,
  },
  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#BAE6FD",
    opacity: 0.35,
    bottom: 100,
    left: -60,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  totalUnreadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  totalUnreadText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  newChatButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  newChatGradient: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  conversationItemUnread: {
    backgroundColor: "#f8fafc",
  },
  conversationItemPressed: {
    backgroundColor: "#f1f5f9",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 14,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#fff",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  participantNameUnread: {
    fontWeight: "800",
  },
  timestamp: {
    fontSize: 12,
    color: "#94a3b8",
  },
  timestampUnread: {
    color: "#0EA5E9",
    fontWeight: "600",
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
  },
  lastMessageUnread: {
    color: "#334155",
    fontWeight: "500",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadCount: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },
  startChatButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: "hidden",
  },
  startChatGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    gap: 8,
  },
  startChatText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
