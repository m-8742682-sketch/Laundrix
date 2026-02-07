import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Notification } from "@/repositories/tabs/NotificationsRepository";
import { useUser } from "@/components/UserContext";
import { useNotificationsViewModel } from "@/viewmodels/tabs/NotificationsViewModel";
import { NotificationType } from "@/services/notification.service";

/* ---------------------------------- */
/* Helpers */
/* ---------------------------------- */
const isToday = (date: Date) => {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
};

const iconMap: Record<
  NotificationType,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  missedCall:     { icon: "call-outline", color: "#ef4444" },
  missedVideo:    { icon: "videocam-outline", color: "#ef4444" },
  chat:           { icon: "chatbubble-ellipses", color: "#3b82f6" },
  auth:           { icon: "lock-closed", color: "#10b981" },
  verification:   { icon: "shield-checkmark", color: "#22c55e" },
  laundry:        { icon: "checkmark-circle", color: "#0ea5e9" },
  // New types for queue system
  queue:          { icon: "people", color: "#8b5cf6" },
  unauthorized:   { icon: "warning", color: "#f59e0b" },
  system:         { icon: "settings", color: "#64748b" },
};

/* ---------------------------------- */
/* Swipeable Card */
/* ---------------------------------- */
function SwipeableNotification({
  item,
  onRead,
  onDelete,
}: {
  item: Notification;
  onRead: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const readAnim = useRef(new Animated.Value(item.read ? 1 : 0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -120) {
          Animated.timing(translateX, {
            toValue: -400,
            duration: 200,
            useNativeDriver: true,
          }).start(onDelete);
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const handleRead = () => {
    if (!item.read) {
      Animated.timing(readAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
      onRead();
    }
  };

  const bgColor = readAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#eff6ff", "#ffffff"],
  });

  const meta =
  iconMap[item.type] ?? {
    icon: "notifications-outline",
    color: "#94a3b8",
  };


  return (
    <View style={styles.swipeContainer}>
      {/* Delete background */}
      <View style={styles.deleteBg}>
        <Ionicons name="trash-outline" size={22} color="#fff" />
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.card,
          { transform: [{ translateX }], backgroundColor: bgColor },
        ]}
      >
        <Pressable onPress={handleRead} style={styles.row}>
          <Ionicons
            name={meta.icon as any}
            size={22}
            color={meta.color}
          />

          <View style={styles.cardContent}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>
              {item.createdAt.toLocaleString()}
            </Text>
          </View>

          {!item.read && <View style={styles.dot} />}
        </Pressable>
      </Animated.View>
    </View>
  );
}

/* ---------------------------------- */
/* Screen */
/* ---------------------------------- */
export default function NotificationsScreen() {
  const { user, loading: userLoading } = useUser();

  const {
    notifications,
    loading,
    markAsRead,
    deleteOne,
    clearAll,
  } = useNotificationsViewModel(user?.uid);

  const grouped = useMemo(() => {
    const today: any[] = [];
    const earlier: any[] = [];

    notifications.forEach(n => {
      if (isToday(n.createdAt)) today.push(n);
      else earlier.push(n);
    });

    return { today, earlier };
  }, [notifications]);

  if (loading || userLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Decorative background (same as Dashboard) */}
      <View style={styles.backgroundDecor} pointerEvents="none">
        <Animated.View style={styles.decorCircle1} />
        <Animated.View style={styles.decorCircle2} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerSide}>
            <Ionicons name="chevron-back" size={26} color="#0EA5E9" />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>
              {notifications.length} total
            </Text>
          </View>

          {notifications.length > 0 ? (
            <Pressable onPress={clearAll} style={styles.headerSide}>
              <Text style={styles.clearAll}>Clear</Text>
            </Pressable>
          ) : (
            <View style={styles.headerSide} />
          )}
        </View>

        {/* Empty state */}
        {notifications.length === 0 && (
          <View style={styles.empty}>
            <Ionicons
              name="notifications-outline"
              size={40}
              color="#94a3b8"
            />
            <Text style={styles.emptyText}>
              You're all caught up 🎉
            </Text>
          </View>
        )}

        {/* Today */}
        {grouped.today.length > 0 && (
          <>
            <Text style={styles.section}>Today</Text>
            {grouped.today.map(item => (
              <SwipeableNotification
                key={item.id}
                item={item}
                onRead={() => markAsRead(item.id)}
                onDelete={() => deleteOne(item.id)}
              />
            ))}
          </>
        )}

        {/* Earlier */}
        {grouped.earlier.length > 0 && (
          <>
            <Text style={styles.section}>Earlier</Text>
            {grouped.earlier.map(item => (
              <SwipeableNotification
                key={item.id}
                item={item}
                onRead={() => markAsRead(item.id)}
                onDelete={() => deleteOne(item.id)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------------------------- */
/* Styles */
/* ---------------------------------- */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  section: {
    marginTop: 20,
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },

  swipeContainer: {
    marginBottom: 12,
  },
  deleteBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ef4444",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingRight: 24,
  },

  card: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  body: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
    marginTop: 4,
  },

  empty: {
    marginTop: 80,
    alignItems: "center",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748b",
  },
  backgroundDecor: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: -1,
  },

  decorCircle1: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#E0F2FE",
    opacity: 0.6,
    top: -80,
    right: -80,
  },

  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#BAE6FD",
    opacity: 0.4,
    bottom: 120,
    left: -60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    marginBottom: 20,
  },

  headerSide: {
    width: 60,
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.4,
  },

  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  clearAll: {
    textAlign: "right",
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 14,
  },
});
