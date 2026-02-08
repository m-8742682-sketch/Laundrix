/**
 * Conversations Screen (WhatsApp/Telegram-style)
 * 
 * Shows all chat conversations with other users.
 * Tap a conversation to open the chat.
 * Includes search functionality.
 */

import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Animated,
  StatusBar,
  TextInput,
  Dimensions,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { useConversationsViewModel, Conversation } from "@/viewmodels/tabs/ConversationsViewModel";

const { width } = Dimensions.get("window");

// Format relative time for last message
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  
  return date.toLocaleDateString(undefined, { 
    month: "short", 
    day: "numeric" 
  });
}

export default function ConversationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { 
    conversations, 
    loading, 
    refreshing, 
    refresh,
    hasConversations,
  } = useConversationsViewModel(user?.uid);

  // Search state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Toggle search animation
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: searchVisible ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();

    if (searchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery("");
      Keyboard.dismiss();
    }
  }, [searchVisible]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(
      (conv) =>
        conv.participantName.toLowerCase().includes(query) ||
        conv.lastMessage.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const openChat = (conversation: Conversation) => {
    router.push({
      pathname: "/(tabs)/contact",
      params: {
        targetUserId: conversation.participantId,
        targetName: conversation.participantName,
        targetAvatar: conversation.participantAvatar || undefined,
      },
    });
  };

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    const animDelay = index * 50;
    
    return (
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        }}
      >
        <Pressable 
          style={({ pressed }) => [
            styles.conversationItem,
            pressed && styles.conversationItemPressed,
          ]}
          onPress={() => openChat(item)}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            <Avatar 
              name={item.participantName} 
              avatarUrl={item.participantAvatar} 
              size={56} 
            />
            {item.isOnline && (
              <View style={styles.onlineDotContainer}>
                <View style={styles.onlineDot} />
              </View>
            )}
          </View>

          {/* Content */}
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.participantName} numberOfLines={1}>
                {item.participantName}
              </Text>
              <Text style={[
                styles.timeText,
                item.unreadCount > 0 && styles.timeTextUnread
              ]}>
                {formatRelativeTime(item.lastMessageTime)}
              </Text>
            </View>
            
            <View style={styles.messagePreview}>
              <Text 
                style={[
                  styles.lastMessage,
                  item.unreadCount > 0 && styles.lastMessageUnread,
                ]} 
                numberOfLines={1}
              >
                {item.lastMessageType === "audio" ? "🎵 Voice message" : item.lastMessage}
              </Text>
              
              {item.unreadCount > 0 && (
                <LinearGradient
                  colors={["#0EA5E9", "#0284C7"]}
                  style={styles.unreadBadge}
                >
                  <Text style={styles.unreadText}>
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  if (loading && !hasConversations) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  const searchHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>Chats</Text>
        <View style={styles.headerActions}>
          <Pressable 
            style={[
              styles.headerButton,
              searchVisible && styles.headerButtonActive,
            ]} 
            onPress={() => setSearchVisible(!searchVisible)}
          >
            <Ionicons 
              name={searchVisible ? "close" : "search"} 
              size={22} 
              color={searchVisible ? "#fff" : "#64748b"} 
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* Search Bar */}
      <Animated.View style={[styles.searchContainer, { height: searchHeight, opacity: searchAnim }]}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color="#94a3b8" />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Conversations List */}
      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          contentContainerStyle={[
            styles.listContent,
            !hasConversations && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#0EA5E9"
              colors={["#0EA5E9"]}
            />
          }
          ListEmptyComponent={
            searchQuery ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="search-outline" size={48} color="#cbd5e1" />
                </View>
                <Text style={styles.emptyTitle}>No results found</Text>
                <Text style={styles.emptySubtitle}>
                  Try a different search term
                </Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={["#f0f9ff", "#e0f2fe"]}
                  style={styles.emptyIconCircle}
                >
                  <Ionicons name="chatbubbles-outline" size={56} color="#0EA5E9" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No conversations yet</Text>
                <Text style={styles.emptySubtitle}>
                  Start chatting with someone from the queue!
                </Text>
                <Pressable 
                  style={({ pressed }) => [
                    styles.startChatButton,
                    pressed && styles.startChatButtonPressed,
                  ]}
                  onPress={() => router.push("/(tabs)/queue")}
                >
                  <LinearGradient
                    colors={["#0EA5E9", "#0284C7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.startChatGradient}
                  >
                    <Text style={styles.startChatText}>View Queue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </View>
            )
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -60,
    right: -60,
  },
  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 150,
    left: -40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerButtonActive: {
    backgroundColor: "#0EA5E9",
    borderColor: "#0EA5E9",
  },
  searchContainer: {
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "500",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
  },
  conversationItemPressed: {
    backgroundColor: "#f8fafc",
  },
  avatarContainer: {
    position: "relative",
  },
  onlineDotContainer: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 2,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22c55e",
  },
  conversationContent: {
    flex: 1,
    marginLeft: 14,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  timeText: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  timeTextUnread: {
    color: "#0EA5E9",
    fontWeight: "600",
  },
  messagePreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: {
    fontSize: 14,
    color: "#64748b",
    flex: 1,
    marginRight: 8,
  },
  lastMessageUnread: {
    fontWeight: "600",
    color: "#0f172a",
  },
  unreadBadge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  separator: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginLeft: 90,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  startChatButton: {
    borderRadius: 14,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  startChatButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  startChatGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  startChatText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
