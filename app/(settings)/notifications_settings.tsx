/**
 * Notification Settings Screen
 * 
 * Configure notification preferences and test different notification types.
 */

import { useUser } from "@/components/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNotificationSettingsViewModel } from "@/viewmodels/settings/NotificationSettingsViewModel";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";

// All 15 notification types
const NOTIFICATION_TYPES = [
  { type: "your_turn", label: "Your Turn", icon: "person", color: "#22c55e" },
  { type: "grace_warning", label: "Grace Warning", icon: "timer", color: "#f59e0b" },
  { type: "removed_from_queue", label: "Removed from Queue", icon: "close-circle", color: "#ef4444" },
  { type: "unauthorized_alert", label: "Unauthorized Alert", icon: "alert-circle", color: "#ef4444" },
  { type: "unauthorized_warning", label: "Unauthorized Warning", icon: "warning", color: "#f59e0b" },
  { type: "buzzer_triggered", label: "Buzzer Triggered", icon: "notifications", color: "#8b5cf6" },
  { type: "clothes_ready", label: "Clothes Ready", icon: "checkmark-circle", color: "#22c55e" },
  { type: "session_started", label: "Session Started", icon: "play-circle", color: "#0ea5e9" },
  { type: "session_ended", label: "Session Ended", icon: "stop-circle", color: "#64748b" },
  { type: "queue_joined", label: "Queue Joined", icon: "enter", color: "#0ea5e9" },
  { type: "queue_left", label: "Queue Left", icon: "exit", color: "#64748b" },
  { type: "chat_message", label: "Chat Message", icon: "chatbubble", color: "#0ea5e9" },
  { type: "voice_call", label: "Voice Call", icon: "call", color: "#22c55e" },
  { type: "video_call", label: "Video Call", icon: "videocam", color: "#8b5cf6" },
  { type: "missed_call", label: "Missed Call", icon: "call", color: "#ef4444" },
  { type: "missed_video", label: "Missed Video", icon: "videocam", color: "#ef4444" },
];

export default function NotificationSettings() {
  const { user, loading: userLoading } = useUser();
  const [testingType, setTestingType] = useState<string | null>(null);

  const {
    loading,
    enabled,
    machineReady,
    reminders,
    toggleAll,
    toggleMachineReady,
    toggleReminders,
  } = useNotificationSettingsViewModel(user?.uid);

  // Create a test notification
  const testNotification = async (type: string) => {
    if (!user?.uid) {
      Alert.alert("Error", "You must be logged in to test notifications");
      return;
    }

    setTestingType(type);

    try {
      // Create notification in Firestore
      const notificationData: any = {
        userId: user.uid,
        type,
        title: getTestTitle(type),
        body: getTestBody(type),
        read: false,
        createdAt: serverTimestamp(),
      };

      // Add extra data for certain types
      if (type === "chat_message") {
        notificationData.senderId = "test_user";
        notificationData.senderName = "Test User";
      } else if (type.includes("call") || type.includes("video")) {
        notificationData.callerId = "test_user";
        notificationData.callerName = "Test Caller";
        notificationData.callType = type.includes("video") ? "video" : "voice";
      } else if (type.includes("queue") || type === "your_turn" || type === "grace_warning") {
        notificationData.machineId = "test_machine";
        notificationData.machineName = "Washer 1";
      }

      await addDoc(collection(db, "notifications"), notificationData);

      Alert.alert(
        "Test Notification Sent", 
        `A "${type}" notification has been created. Check your notifications tab.`
      );
    } catch (error) {
      console.error("Error creating test notification:", error);
      Alert.alert("Error", "Failed to create test notification");
    } finally {
      setTestingType(null);
    }
  };

  const getTestTitle = (type: string): string => {
    const titles: Record<string, string> = {
      your_turn: "It's Your Turn!",
      grace_warning: "Grace Period Warning",
      removed_from_queue: "Removed from Queue",
      unauthorized_alert: "Unauthorized Access!",
      unauthorized_warning: "Warning: Unauthorized",
      buzzer_triggered: "Buzzer Activated",
      clothes_ready: "Clothes Ready!",
      session_started: "Session Started",
      session_ended: "Session Ended",
      queue_joined: "Joined Queue",
      queue_left: "Left Queue",
      chat_message: "New Message",
      voice_call: "Incoming Call",
      video_call: "Incoming Video Call",
      missed_call: "Missed Call",
      missed_video: "Missed Video Call",
    };
    return titles[type] || "Test Notification";
  };

  const getTestBody = (type: string): string => {
    const bodies: Record<string, string> = {
      your_turn: "The machine is now available for you. Please start within 5 minutes.",
      grace_warning: "You have 2 minutes remaining to claim the machine.",
      removed_from_queue: "You have been removed from the queue due to inactivity.",
      unauthorized_alert: "Someone is using the machine without authorization!",
      unauthorized_warning: "Potential unauthorized access detected.",
      buzzer_triggered: "The buzzer has been activated on your machine.",
      clothes_ready: "Your laundry cycle is complete. Please collect your clothes.",
      session_started: "Your laundry session has started.",
      session_ended: "Your laundry session has ended.",
      queue_joined: "You have successfully joined the queue.",
      queue_left: "You have left the queue.",
      chat_message: "Test User: Hey, are you done with the machine?",
      voice_call: "Test Caller is calling you...",
      video_call: "Test Caller is video calling you...",
      missed_call: "You missed a call from Test Caller",
      missed_video: "You missed a video call from Test Caller",
    };
    return bodies[type] || "This is a test notification";
  };

  if (loading || userLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Main Toggle */}
        <View style={styles.card}>
          <SettingToggle
            icon="notifications-outline"
            label="Enable notifications"
            value={enabled}
            onChange={toggleAll}
          />
        </View>

        {/* Alert Settings */}
        <Text style={styles.sectionTitle}>Alerts</Text>
        <View style={styles.card}>
          <SettingToggle
            icon="checkmark-circle-outline"
            label="Machine ready"
            subLabel="When your laundry is done"
            value={machineReady}
            onChange={toggleMachineReady}
            disabled={!enabled}
          />
          <SettingToggle
            icon="time-outline"
            label="Queue reminders"
            subLabel="When it's almost your turn"
            value={reminders}
            onChange={toggleReminders}
            disabled={!enabled}
            last
          />
        </View>

        {/* Test Notifications Section */}
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        <Text style={styles.sectionDescription}>
          Tap any button below to create a test notification and verify it appears correctly.
        </Text>
        
        <View style={styles.testGrid}>
          {NOTIFICATION_TYPES.map((notif) => (
            <Pressable
              key={notif.type}
              style={({ pressed }) => [
                styles.testButton,
                pressed && styles.testButtonPressed,
              ]}
              onPress={() => testNotification(notif.type)}
              disabled={testingType !== null}
            >
              <View style={[styles.testIconCircle, { backgroundColor: `${notif.color}15` }]}>
                {testingType === notif.type ? (
                  <ActivityIndicator size="small" color={notif.color} />
                ) : (
                  <Ionicons name={notif.icon as any} size={18} color={notif.color} />
                )}
              </View>
              <Text style={styles.testButtonText} numberOfLines={1}>
                {notif.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color="#0ea5e9" />
          <Text style={styles.infoText}>
            Test notifications are created locally in Firestore and will appear in your 
            Notifications tab. They won't trigger push notifications.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- TOGGLE COMPONENT ---------- */
function SettingToggle({
  icon,
  label,
  subLabel,
  value,
  onChange,
  disabled,
  last,
}: {
  icon: string;
  label: string;
  subLabel?: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.item, disabled && { opacity: 0.5 }, last && styles.itemLast]}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIcon}>
          <Ionicons name={icon as any} size={20} color="#0ea5e9" />
        </View>
        <View>
          <Text style={styles.itemText}>{label}</Text>
          {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
        </View>
      </View>

      <Switch 
        value={value} 
        onValueChange={onChange} 
        disabled={disabled}
        trackColor={{ false: "#e2e8f0", true: "#0ea5e9" }}
        thumbColor="#fff"
      />
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  itemText: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
  },
  subLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  testGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  testButton: {
    width: "31%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  testButtonPressed: {
    backgroundColor: "#e2e8f0",
    transform: [{ scale: 0.98 }],
  },
  testIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  testButtonText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    backgroundColor: "#f0f9ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  infoText: {
    fontSize: 12,
    color: "#0369a1",
    flex: 1,
    lineHeight: 18,
  },
});
