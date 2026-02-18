import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
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
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");

// Luxury Icon Configuration
const NOTIFICATION_ICONS: Record<NotificationIconType, { 
  icon: keyof typeof Ionicons.glyphMap; 
  gradient: [string, string];
  bgGradient: [string, string];
}> = {
  queue: { 
    icon: "time", 
    gradient: ["#A78BFA", "#8B5CF6"],
    bgGradient: ["#F5F3FF", "#EDE9FE"],
  },
  unauthorized: { 
    icon: "warning", 
    gradient: ["#818CF8", "#6366F1"],
    bgGradient: ["#EEF2FF", "#E0E7FF"],
  },
  laundry: { 
    icon: "shirt", 
    gradient: ["#67E8F9", "#22D3EE"],
    bgGradient: ["#ECFEFF", "#CFFAFE"],
  },
  system: { 
    icon: "information-circle", 
    gradient: ["#38BDF8", "#0EA5E9"],
    bgGradient: ["#F0F9FF", "#E0F2FE"],
  },
  chat: { 
    icon: "chatbubble", 
    gradient: ["#38BDF8", "#0EA5E9"],
    bgGradient: ["#F0F9FF", "#E0F2FE"],
  },
  call: { 
    icon: "call", 
    gradient: ["#67E8F9", "#22D3EE"],
    bgGradient: ["#ECFEFF", "#CFFAFE"],
  },
  missedCall: { 
    icon: "call", 
    gradient: ["#818CF8", "#6366F1"],
    bgGradient: ["#EEF2FF", "#E0E7FF"],
  },
  missedVideo: { 
    icon: "videocam", 
    gradient: ["#818CF8", "#6366F1"],
    bgGradient: ["#EEF2FF", "#E0E7FF"],
  },
};

function getIconConfig(type: NotificationIconType) {
  return NOTIFICATION_ICONS[type] || NOTIFICATION_ICONS.system;
}

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
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const NotificationItem = memo(({ 
  item, onPress, onDelete, swipeableRef,
}: { 
  item: Notification;
  onPress: () => void;
  onDelete: () => void;
  swipeableRef: (ref: Swipeable | null) => void;
}) => {
  const config = getIconConfig(item.type);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    if (!item.read) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({
      inputRange: [-150, 0],
      outputRange: [0, 80],
      extrapolate: "clamp",
    });

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX: trans }] }]}>
        <Pressable style={styles.deleteButton} onPress={onDelete}>
           {/* COMMON SENSE: Red for Delete */}
          <LinearGradient colors={["#F87171", "#EF4444", "#DC2626"]} style={styles.deleteGradient}>
            <Ionicons name="trash" size={26} color="#fff" />
            <Text style={styles.deleteText}>Delete</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable style={styles.cardInner} onPress={onPress}>
          {/* Unread Glow Effect */}
          {!item.read && (
            <Animated.View style={[styles.unreadGlow, { opacity: glowAnim }]} />
          )}
          
          <LinearGradient
            colors={config.bgGradient as [string, string]}
            style={styles.iconCircle}
          >
            <LinearGradient colors={config.gradient as [string, string]} style={styles.iconInner}>
              <Ionicons name={config.icon} size={20} color="#fff" />
            </LinearGradient>
          </LinearGradient>

          <View style={styles.cardContent}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={12} color="#94a3b8" />
              <Text style={styles.cardTime}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
          </View>

          {/* Status Indicator */}
          {!item.read ? (
             <View style={styles.unreadBadge}>
               <Text style={styles.unreadBadgeText}>NEW</Text>
             </View>
          ) : (
             <Ionicons name="checkmark-done-circle" size={20} color="#cbd5e1" />
          )}
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
});

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { t } = useI18n();
  const { 
    notifications, loading, refreshing, refresh, markAsRead, markAllAsRead,
    deleteNotification, deleteAllRead, hasUnread, hasRead,
  } = useNotificationsViewModel(user?.uid);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  React.useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handleDeleteAllRead = useCallback(() => {
    Alert.alert(t.deleteReadNotifications, t.confirmDeleteReadNotifications, [
      { text: t.cancel, style: "cancel" },
      { text: t.delete, style: "destructive", onPress: () => deleteAllRead() },
    ]);
  }, [deleteAllRead, t]);

  const handleItemDelete = useCallback((id: string) => {
    swipeableRefs.current.get(id)?.close();
    deleteNotification(id);
  }, [deleteNotification]);

  const groupedNotifications = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups: { title: string; data: Notification[] }[] = [];
    const todayItems: Notification[] = [];
    const yesterdayItems: Notification[] = [];
    const olderItems: Notification[] = [];

    notifications.forEach((n) => {
      const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) todayItems.push(n);
      else if (d.getTime() === yesterday.getTime()) yesterdayItems.push(n);
      else olderItems.push(n);
    });

    if (todayItems.length > 0) groups.push({ title: t.today, data: todayItems });
    if (yesterdayItems.length > 0) groups.push({ title: t.yesterday, data: yesterdayItems });
    if (olderItems.length > 0) groups.push({ title: t.earlier, data: olderItems });
    return groups;
  }, [notifications, t]);

  const flatData = useMemo(() => {
    const result: (Notification | { type: "header"; title: string })[] = [];
    groupedNotifications.forEach((g) => { result.push({ type: "header", title: g.title }); result.push(...g.data); });
    return result;
  }, [groupedNotifications]);

  const renderFlatItem = useCallback(({ item }: { item: any }) => {
    if ("type" in item && item.type === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
      );
    }
    return (
      <NotificationItem
        item={item}
        onPress={() => markAsRead(item.id)}
        onDelete={() => handleItemDelete(item.id)}
        swipeableRef={(ref) => ref ? swipeableRefs.current.set(item.id, ref) : swipeableRefs.current.delete(item.id)}
      />
    );
  }, [markAsRead, handleItemDelete]);

  if (loading && notifications.length === 0) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>{t.loadingNotifications}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />

        {/* Exaggerated Background */}
        <View style={styles.backgroundDecor}>
          <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.decorTriangle} />
        </View>

        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>{t.notifications}</Text>
          <View style={styles.headerActions}>
            {hasUnread && (
              <Pressable style={styles.markAllReadButton} onPress={markAllAsRead}>
                <Text style={styles.markAllReadText}>{t.markAllAsRead}</Text>
              </Pressable>
            )}
            {hasRead && (
              <Pressable style={styles.headerButton} onPress={handleDeleteAllRead}>
                <Ionicons name="trash" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
        </Animated.View>

        <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
          <FlatList
            data={flatData}
            keyExtractor={(item, i) => (item.type === "header" ? `header-${item.title}` : item.id)}
            renderItem={renderFlatItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#6366F1" colors={["#6366F1"]} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.emptyIconCircle}>
                  <Ionicons name="notifications-off" size={42} color="#4F46E5" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>{t.noNotificationsYet}</Text>
                <Text style={styles.emptySubtitle}>{t.notificationsArriveHint}</Text>
              </View>
            }
          />
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },
  loadingText: { marginTop: 16, color: "#6366F1", fontSize: 16, fontWeight: "600" },

  // Background
  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#E0E7FF", opacity: 0.5, top: -80, right: -60 },
  decorCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 150, left: -40 },
  decorTriangle: { position: "absolute", width: 200, height: 200, backgroundColor: "#ECFEFF", opacity: 0.3, top: "30%", right: -50, transform: [{ rotate: "45deg" }] },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 20 },
  title: { fontSize: 32, fontWeight: "800", color: "#0f172a", letterSpacing: -1 },
  headerActions: { flexDirection: "row", gap: 10 },
  headerButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", shadowColor: "#EF4444", shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  markAllReadButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "#6366F1", shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  markAllReadText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // List
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  // Sections
  sectionHeader: { paddingVertical: 12, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },

  // Cards
  cardWrapper: { marginBottom: 12 },
  cardInner: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", 
    padding: 16, borderRadius: 24, 
    shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.8)",
    overflow: 'hidden'
  },
  unreadGlow: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: "#6366F1", shadowColor: "#6366F1", shadowOpacity: 1, shadowRadius: 8 },

  // Icon
  iconCircle: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 14 },
  iconInner: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  // Content
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  cardBody: { fontSize: 14, color: "#64748b", lineHeight: 20, marginBottom: 6 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardTime: { fontSize: 12, color: "#94a3b8", fontWeight: "500" },

  // Status
  unreadBadge: { backgroundColor: "#ECFEFF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "#A5F3FC" },
  unreadBadgeText: { color: "#0891B2", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },

  // Swipe
  deleteAction: { justifyContent: "center", alignItems: "flex-end", width: 100 },
  deleteButton: { height: "100%", width: 90, borderRadius: 20, overflow: "hidden" },
  deleteGradient: { flex: 1, justifyContent: "center", alignItems: "center" },
  deleteText: { color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#64748b", textAlign: "center", lineHeight: 22, paddingHorizontal: 40 },
});