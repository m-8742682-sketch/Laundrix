/**
 * Notifications Screen
 * 
 * High-end UI with swipe-to-delete and delete all read functionality
 */

import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  StatusBar,
  Alert,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { useUser } from "@/components/UserContext";
import { 
  useNotificationsViewModel, 
  Notification, 
  NotificationIconType 
} from "@/viewmodels/tabs/NotificationsViewModel";

const { width } = Dimensions.get("window");

// Icon configuration for each notification type
const NOTIFICATION_ICONS: Record<NotificationIconType, { 
  icon: keyof typeof Ionicons.glyphMap; 
  color: string; 
  bgColor: string;
  gradient: [string, string];
}> = {
  queue: { 
    icon: "time", 
    color: "#8b5cf6", 
    bgColor: "#f5f3ff",
    gradient: ["#a78bfa", "#8b5cf6"],
  },
  unauthorized: { 
    icon: "warning", 
    color: "#ef4444", 
    bgColor: "#fef2f2",
    gradient: ["#f87171", "#ef4444"],
  },
  laundry: { 
    icon: "shirt", 
    color: "#22c55e", 
    bgColor: "#f0fdf4",
    gradient: ["#4ade80", "#22c55e"],
  },
  system: { 
    icon: "information-circle", 
    color: "#64748b", 
    bgColor: "#f8fafc",
    gradient: ["#94a3b8", "#64748b"],
  },
  chat: { 
    icon: "chatbubble", 
    color: "#0EA5E9", 
    bgColor: "#f0f9ff",
    gradient: ["#38bdf8", "#0EA5E9"],
  },
  call: { 
    icon: "call", 
    color: "#22c55e", 
    bgColor: "#f0fdf4",
    gradient: ["#4ade80", "#22c55e"],
  },
  missedCall: { 
    icon: "call", 
    color: "#ef4444", 
    bgColor: "#fef2f2",
    gradient: ["#f87171", "#ef4444"],
  },
  missedVideo: { 
    icon: "videocam", 
    color: "#ef4444", 
    bgColor: "#fef2f2",
    gradient: ["#f87171", "#ef4444"],
  },
};

// Get icon config with fallback
function getIconConfig(type: NotificationIconType) {
  return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.system;
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString(undefined, { 
    month: "short", 
    day: "numeric" 
  });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { 
    notifications, 
    loading, 
    refreshing, 
    refresh, 
    markAsRead, 
    markAllAsRead,
    deleteNotification,
    deleteAllRead,
    hasUnread,
    hasRead,
  } = useNotificationsViewModel(user?.uid);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation for decorative elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleDeleteAllRead = () => {
    Alert.alert(
      "Delete Read Notifications",
      "Are you sure you want to delete all read notifications?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => deleteAllRead(),
        },
      ]
    );
  };

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
    notificationId: string
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.8],
      extrapolate: "clamp",
    });

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ scale }] }]}>
        <Pressable
          style={styles.deleteButton}
          onPress={() => {
            swipeableRefs.current.get(notificationId)?.close();
            deleteNotification(notificationId);
          }}
        >
          <LinearGradient
            colors={["#ef4444", "#dc2626"]}
            style={styles.deleteGradient}
          >
            <Ionicons name="trash-outline" size={24} color="#fff" />
            <Text style={styles.deleteText}>Delete</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const config = getIconConfig(item.type);
    
    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
        }}
        renderRightActions={(progress, dragX) => 
          renderRightActions(progress, dragX, item.id)
        }
        overshootRight={false}
        friction={2}
      >
        <Pressable
          style={[styles.card, !item.read && styles.cardUnread]}
          onPress={() => markAsRead(item.id)}
        >
          <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
            <Ionicons name={config.icon} size={22} color={config.color} />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardBody} numberOfLines={2}>
              {item.body}
            </Text>
            <Text style={styles.cardTime}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
          {!item.read && (
            <LinearGradient
              colors={["#0EA5E9", "#0284C7"]}
              style={styles.unreadDot}
            />
          )}
        </Pressable>
      </Swipeable>
    );
  };

  // Group notifications by date
  const groupedNotifications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { title: string; data: Notification[] }[] = [];
    const todayItems: Notification[] = [];
    const yesterdayItems: Notification[] = [];
    const olderItems: Notification[] = [];

    notifications.forEach((notification) => {
      const notifDate = new Date(notification.createdAt);
      notifDate.setHours(0, 0, 0, 0);

      if (notifDate.getTime() === today.getTime()) {
        todayItems.push(notification);
      } else if (notifDate.getTime() === yesterday.getTime()) {
        yesterdayItems.push(notification);
      } else {
        olderItems.push(notification);
      }
    });

    if (todayItems.length > 0) {
      groups.push({ title: "Today", data: todayItems });
    }
    if (yesterdayItems.length > 0) {
      groups.push({ title: "Yesterday", data: yesterdayItems });
    }
    if (olderItems.length > 0) {
      groups.push({ title: "Earlier", data: olderItems });
    }

    return groups;
  }, [notifications]);

  // Flatten for FlatList with section headers
  const flatData = useMemo(() => {
    const result: (Notification | { type: "header"; title: string })[] = [];
    groupedNotifications.forEach((group) => {
      result.push({ type: "header", title: group.title });
      result.push(...group.data);
    });
    return result;
  }, [groupedNotifications]);

  const renderFlatItem = ({ item }: { item: Notification | { type: "header"; title: string } }) => {
    if ("type" in item && item.type === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
      );
    }
    return renderItem({ item: item as Notification });
  };

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />

        {/* Background Decor */}
        <View style={styles.backgroundDecor}>
          <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        </View>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.headerActions}>
            {hasUnread && (
              <Pressable style={styles.headerButton} onPress={markAllAsRead}>
                <Ionicons name="checkmark-done" size={20} color="#0EA5E9" />
              </Pressable>
            )}
            {hasRead && (
              <Pressable style={styles.headerButton} onPress={handleDeleteAllRead}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* Action Hints */}
        {notifications.length > 0 && (
          <Animated.View style={[styles.hintsContainer, { opacity: fadeAnim }]}>
            <View style={styles.hint}>
              <Ionicons name="arrow-back" size={14} color="#94a3b8" />
              <Text style={styles.hintText}>Swipe left to delete</Text>
            </View>
          </Animated.View>
        )}

        {/* Notifications List */}
        <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
          <FlatList
            data={flatData}
            keyExtractor={(item, index) => 
              "type" in item && item.type === "header" 
                ? `header-${item.title}` 
                : (item as Notification).id
            }
            renderItem={renderFlatItem}
            contentContainerStyle={[
              styles.listContent,
              flatData.length === 0 && styles.emptyListContent,
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
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={["#f0f9ff", "#e0f2fe"]}
                  style={styles.emptyIconCircle}
                >
                  <Ionicons name="notifications-off-outline" size={48} color="#0EA5E9" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptySubtitle}>
                  We'll let you know when something arrives ✨
                </Text>
              </View>
            }
          />
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  hintsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hintText: {
    fontSize: 12,
    color: "#94a3b8",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardUnread: {
    backgroundColor: "#f8fafc",
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    borderLeftColor: "#0EA5E9",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  cardBody: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 8,
  },
  cardTime: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
    marginTop: 4,
  },
  deleteAction: {
    justifyContent: "center",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  deleteButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  deleteGradient: {
    width: 90,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  deleteText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
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
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});
