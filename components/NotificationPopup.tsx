/**
 * NotificationPopup Component
 * 
 * Handles in-app notification display with:
 * - Sound playback (assets/sounds/notify.mp3)
 * - Vibration (0.5 seconds)
 * - Popup window with Laundrix logo and notification content
 * 
 * Rules:
 * - If "enable all alerts" is ON: sound + vibration + popup
 * - If "enable all alerts" is OFF: vibration only (NO sound, NO popup)
 * - Voice/video calls are EXCLUDED (they have their own overlays)
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Vibration,
  Image,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
// Sound is handled by GlobalSoundController — import the helper only
import { playNotifyBeep, activeSound$ } from "@/services/soundState";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

// Notification types that should NOT trigger popup (calls have their own overlays)
// Only active call types excluded — missed calls SHOULD show in popup
const EXCLUDED_TYPES = ["voice_call", "video_call", "incoming_call", "outgoing_call"];

type NotificationData = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: any;
  senderId?: string;
  senderName?: string;
  callerId?: string;
  callerName?: string;
};

export default function NotificationPopup() {
  const { user } = useUser();
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [visible, setVisible] = useState(false);
  const [enableAllAlerts, setEnableAllAlerts] = useState(true);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const lastNotificationId = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load settings from AsyncStorage
  const loadSettings = useCallback(async () => {
    try {
      const enabled = await AsyncStorage.getItem("notifications_enabled");
      setEnableAllAlerts(enabled !== "false"); // Default to true
    } catch (error) {
      console.warn("[NotificationPopup] Failed to load settings:", error);
    }
  }, []);

  // Play notification sound — delegated to GlobalSoundController
  const playSound = useCallback(() => {
    // Don't interrupt higher-priority sounds (calling=1, alarm=2) with notify(4)
    const current = activeSound$.value;
    if (current === "calling" || current === "alarm" || current === "urgent") return;
    playNotifyBeep();
  }, []);

  // Vibrate for 0.5 seconds
  const vibrate = useCallback(() => {
    Vibration.vibrate(500); // 500ms = 0.5 seconds
  }, []);

  // Show notification popup
  const showPopup = useCallback((notif: NotificationData) => {
    setNotification(notif);
    setVisible(true);
    
    // Slide in animation
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 80,
      friction: 10,
      useNativeDriver: true,
    }).start();

    // Auto dismiss after 5 seconds
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
    }
    dismissTimer.current = setTimeout(() => {
      hidePopup();
    }, 5000);
  }, [slideAnim]);

  // Hide notification popup
  const hidePopup = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setNotification(null);
    });

    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, [slideAnim]);

  // Handle notification tap
  const handleTap = useCallback(() => {
    if (!notification) return;

    hidePopup();

    // Mark as read
    try {
      updateDoc(doc(db, "notifications", notification.id), { read: true });
    } catch (error) {
      console.warn("[NotificationPopup] Failed to mark as read:", error);
    }

    // Navigate based on notification type
    if (notification.type === "chat_message" && notification.senderId) {
      router.push({
        pathname: "/(tabs)/contact",
        params: {
          id: notification.senderId,
          name: notification.senderName || "User",
        },
      });
    } else if (notification.type === "missed_call" || notification.type === "missed_video") {
      // Go to conversations so user can call back
      router.push("/(tabs)/conversations");
    } else {
      router.push("/(tabs)/notifications");
    }
  }, [notification, hidePopup]);

  // Listen for new notifications
  useEffect(() => {
    if (!user?.uid) return;

    loadSettings();

    // Query for unread notifications (no orderBy to avoid index requirement)
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Sort changes by createdAt to get the latest first (client-side sort)
      const addedChanges = snapshot.docChanges()
        .filter(change => change.type === "added")
        .sort((a, b) => {
          const aTime = a.doc.data().createdAt?.toMillis?.() || 0;
          const bTime = b.doc.data().createdAt?.toMillis?.() || 0;
          return bTime - aTime; // Newest first
        });

      // Process only the latest one
      const change = addedChanges[0];
      if (change) {
          const data = change.doc.data();
          const notif: NotificationData = {
            id: change.doc.id,
            type: data.type || "general",
            title: data.title || "Notification",
            body: data.body || "",
            read: data.read || false,
            createdAt: data.createdAt,
            senderId: data.senderId,
            senderName: data.senderName,
            callerId: data.callerId,
            callerName: data.callerName,
          };

          // Skip if we already processed this notification
          if (lastNotificationId.current === notif.id) return;
          lastNotificationId.current = notif.id;

          // Skip excluded types (calls have their own UI)
          if (EXCLUDED_TYPES.includes(notif.type)) {
            console.log("[NotificationPopup] Skipping call notification:", notif.type);
            return;
          }

          // Always vibrate
          vibrate();

          // If enable all alerts is ON: play sound and show popup
          if (enableAllAlerts) {
            playSound();
            showPopup(notif);
          }
          // If OFF: only vibrate (already done above), no popup, no sound
      }
    }, (error) => {
      console.warn("[NotificationPopup] Listener error:", error);
    });

    return () => {
      unsubscribe();
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
      }

    };
  }, [user?.uid, enableAllAlerts, vibrate, playSound, showPopup, loadSettings]);

  // Reload settings periodically
  useEffect(() => {
    const interval = setInterval(loadSettings, 5000);
    return () => clearInterval(interval);
  }, [loadSettings]);

  if (!visible || !notification) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <TouchableOpacity 
        style={styles.content}
        onPress={handleTap}
        activeOpacity={0.9}
      >
        {/* Laundrix Logo */}
        <View style={styles.iconContainer}>
          <Image 
            source={require("@/assets/images/laundrix-icon.png")} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Notification Content */}
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>

        {/* Dismiss Button */}
        <TouchableOpacity 
          style={styles.dismissButton}
          onPress={hidePopup}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color="#64748b" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: (Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 44) + 8,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logo: {
    width: 28,
    height: 28,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 18,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
});