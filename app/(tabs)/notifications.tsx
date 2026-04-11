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
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { useUser } from "@/components/UserContext";
import { 
  useNotificationsViewModel, 
  Notification, 
  NotificationIconType 
} from "@/viewmodels/tabs/NotificationsViewModel";
import { useI18n } from "@/i18n/i18n";
import EnhancedBubble from "@/components/ui/EnhancedBubble";
import { haptic } from "@/utils/haptics";
import { LP } from "@/constants/LaundrixColors";

// ── Monochromatic TechBlue icon system ──────────────────────────────────────
// All types share TechBlue; opacity conveys urgency, not hue.
const NOTIFICATION_ICONS: Record<NotificationIconType, {
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  bgGradient: [string, string];
}> = {
  queue:        { icon: "time",               gradient: [LP.TechBlue.solid,  LP.TechBlue.deep],   bgGradient: [LP.TechBlue[200], LP.TechBlue[100]] },
  unauthorized: { icon: "warning",            gradient: [LP.TechBlue.deeper, LP.TechBlue.deep],   bgGradient: [LP.TechBlue[300], LP.TechBlue[200]] },
  laundry:      { icon: "shirt",              gradient: [LP.TechBlue[600],   LP.TechBlue.solid],  bgGradient: [LP.TechBlue[200], LP.TechBlue[100]] },
  system:       { icon: "information-circle", gradient: [LP.TechBlue[500],   LP.TechBlue[600]],   bgGradient: [LP.TechBlue[100], LP.TechBlue[50]]  },
  chat:         { icon: "chatbubble",         gradient: [LP.TechBlue[500],   LP.TechBlue.solid],  bgGradient: [LP.TechBlue[200], LP.TechBlue[100]] },
  call:         { icon: "call",               gradient: [LP.TechBlue.solid,  LP.TechBlue.deep],   bgGradient: [LP.TechBlue[300], LP.TechBlue[200]] },
  missedCall:   { icon: "call-outline",       gradient: [LP.TechBlue[400],   LP.TechBlue[500]],   bgGradient: [LP.TechBlue[200], LP.TechBlue[100]] },
  missedVideo:  { icon: "videocam-off",       gradient: [LP.TechBlue[400],   LP.TechBlue[500]],   bgGradient: [LP.TechBlue[200], LP.TechBlue[100]] },
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

const NotificationItem = memo(({ item, onPress, onDelete, swipeableRef }: { 
  item: Notification; onPress: () => void; onDelete: () => void;
  swipeableRef: (ref: Swipeable | null) => void;
}) => {
  const config = getIconConfig(item.type);
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const glowAnim  = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
    if (!item.read) {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,   duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.5, duration: 1500, useNativeDriver: true }),
      ])).start();
    }
  }, []);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const trans = dragX.interpolate({ inputRange: [-150, 0], outputRange: [0, 80], extrapolate: "clamp" });
    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX: trans }] }]}>
        <Pressable style={styles.deleteButton} onPress={() => { haptic.medium(); onDelete(); }}>
          <LinearGradient colors={["#F87171","#EF4444","#DC2626"]} style={styles.deleteGradient}>
            <Ionicons name="trash" size={22} color="#fff" />
            <Text style={styles.deleteText}>Delete</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false} friction={2}>
      <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Pressable style={styles.cardInner} onPress={onPress}>
          {!item.read && <Animated.View style={[styles.unreadGlow, { opacity: glowAnim }]} />}
          {/* Mid-layer glass border — depth simulation */}
          <View style={styles.cardMidBorder} pointerEvents="none" />
          <LinearGradient colors={config.bgGradient as [string, string]} style={styles.iconCircle}>
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
          {!item.read ? (
            <View style={styles.unreadBadge}><Text style={styles.unreadBadgeText}>NEW</Text></View>
          ) : (
            <Ionicons name="checkmark-done-circle" size={20} color="#cbd5e1" />
          )}
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
});

export default function NotificationsScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const { 
    notifications, loading, refreshing, refresh, markAsRead, markAllAsRead,
    deleteNotification, deleteAllRead, hasUnread, hasRead,
  } = useNotificationsViewModel(user?.uid);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
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
    const todayItems: Notification[] = [], yesterdayItems: Notification[] = [], olderItems: Notification[] = [];
    notifications.forEach((n) => {
      const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
      if (d.getTime() === today.getTime()) todayItems.push(n);
      else if (d.getTime() === yesterday.getTime()) yesterdayItems.push(n);
      else olderItems.push(n);
    });
    const groups: { title: string; data: Notification[] }[] = [];
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
          <View style={styles.sectionLine} />
          <Text style={styles.sectionTitle}>{item.title}</Text>
          <View style={styles.sectionLine} />
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
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>{t.loadingNotifications}</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Background — identical to queue/conversations */}
        <View style={styles.backgroundContainer}>
          <LinearGradient colors={["#fafaff","#f0f4ff","#e0e7ff","#dbeafe"]} locations={[0,0.3,0.7,1]} style={styles.gradientBackground} />
          <EnhancedBubble delay={0}    size={260} color="rgba(14, 165, 233, 0.07)" position={{ top: -80,    right: -60 }} driftX={14} floatY={26} />
          <EnhancedBubble delay={800}  size={180} color="rgba(14, 165, 233, 0.05)" position={{ top: 80,     left:  -40 }} driftX={9}  floatY={20} />
          <EnhancedBubble delay={1600} size={140} color="rgba(2,  132, 199, 0.06)" position={{ top: 350,    right: -30 }} driftX={11} floatY={16} />
          <EnhancedBubble delay={2400} size={100} color="rgba(16, 185, 129, 0.04)" position={{ bottom: 200, left:  20  }} driftX={7}  floatY={14} />
        </View>

        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View>
              <Text style={styles.overline}>{t.notifications}</Text>
            </View>
            <View style={styles.headerActions}>
              {hasUnread && (
                <Pressable style={styles.markAllReadButton} onPress={() => { haptic.light(); markAllAsRead(); }}>
                  <Text style={styles.markAllReadText}>{t.markAllAsRead}</Text>
                </Pressable>
              )}
              {hasRead && !hasUnread && (
                <Pressable style={styles.trashButton} onPress={handleDeleteAllRead}>
                  <Ionicons name="trash" size={18} color="#EF4444" />
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
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0EA5E9" colors={["#0EA5E9"]} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <LinearGradient colors={["#E0E7FF","#C7D2FE"]} style={styles.emptyIconCircle}>
                    <Ionicons name="notifications-off" size={42} color="#0369A1" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>{t.noNotificationsYet}</Text>
                  <Text style={styles.emptySubtitle}>{t.notificationsArriveHint}</Text>
                </View>
              }
            />
          </Animated.View>
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1 },
  container: { flex: 1, backgroundColor: LP.Surface.base },
  center:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: LP.Surface.base },
  loadingText: { marginTop: 16, color: LP.Text.accent, fontSize: 16, fontWeight: "600" },

  backgroundContainer: { position: "absolute", width: "100%", height: "100%", overflow: "hidden" },
  gradientBackground:  { position: "absolute", width: "100%", height: "100%" },
  bubble:              { position: "absolute", opacity: 0.4 },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  overline: { fontSize: 25, fontWeight: "800", color: LP.Text.heading, textTransform: "uppercase", letterSpacing: -0.5, lineHeight: 30 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  markAllReadButton: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: LP.TechBlue[100], borderWidth: 1, borderColor: LP.Border.glow,
  },
  markAllReadText: { color: LP.Text.accent, fontSize: 13, fontWeight: "700", letterSpacing: 0.2 },
  trashButton: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.08)", borderWidth: 1, borderColor: "rgba(239,68,68,0.16)",
    alignItems: "center", justifyContent: "center",
  },

  // List
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  // Section header — dashed-line style matching history
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 8, marginLeft: 2 },
  sectionLine:   { flex: 1, height: 1, backgroundColor: LP.TechBlue[200], opacity: 0.6 },
  sectionTitle:  { fontSize: 11, fontWeight: "800", color: LP.TechBlue.deep, textTransform: "uppercase", letterSpacing: 1.6, opacity: 0.8 },

  // Cards — layered glass
  cardWrapper: { marginBottom: 12 },
  cardInner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: LP.Surface.glass,
    padding: 16, borderRadius: 22,
    shadowColor: LP.Glow.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 3,
    // Layer 1 — outer rim
    borderWidth: 1, borderColor: LP.LayeredGlass.outer,
    overflow: "hidden",
  },
  // Layer 2 — mid sheen (positioned absolutely, no layout impact)
  cardMidBorder: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 21, borderWidth: 1, borderColor: LP.LayeredGlass.mid,
  },
  // Unread left-edge — TechBlue mono
  unreadGlow: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
    backgroundColor: LP.TechBlue.solid,
    borderTopLeftRadius: 22, borderBottomLeftRadius: 22,
  },

  // Icon area
  iconCircle: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 14, borderWidth: 1, borderColor: LP.Border.glassInner },
  iconInner:  { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  // Content
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: LP.Text.primary, marginBottom: 3, letterSpacing: -0.2, lineHeight: 21 },
  cardBody:  { fontSize: 13, color: LP.Text.muted, lineHeight: 20, marginBottom: 6 },
  timeRow:   { flexDirection: "row", alignItems: "center", gap: 4 },
  cardTime:  { fontSize: 12, color: LP.Text.soft, fontWeight: "500" },

  // State badges — TechBlue mono
  unreadBadge:     { backgroundColor: LP.TechBlue[100], paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: LP.Border.glow },
  unreadBadgeText: { color: LP.TechBlue.solid, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },

  // Delete swipe action
  deleteAction:   { justifyContent: "center", alignItems: "flex-end", width: 100 },
  deleteButton:   { height: "100%", width: 90, borderRadius: 22, overflow: "hidden" },
  deleteGradient: { flex: 1, justifyContent: "center", alignItems: "center" },
  deleteText:     { color: LP.Text.onDark, fontSize: 11, fontWeight: "700", marginTop: 4 },

  // Empty state
  emptyState:      { alignItems: "center", paddingVertical: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 24, backgroundColor: LP.TechBlue[100], borderWidth: 1, borderColor: LP.Border.glass },
  emptyTitle:      { fontSize: 22, fontWeight: "800", color: LP.Text.primary, marginBottom: 8, letterSpacing: -0.5 },
  emptySubtitle:   { fontSize: 15, color: LP.Text.soft, textAlign: "center", lineHeight: 22, paddingHorizontal: 40 },
});