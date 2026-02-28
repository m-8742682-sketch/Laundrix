/**
 * Notification Settings Screen
 * 
 * Configure notification preferences and test different notification types.
 */

import { useUser } from "@/components/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n } from "@/i18n/i18n";
import { useNotificationSettingsViewModel } from "@/viewmodels/settings/NotificationSettingsViewModel";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";

const getNotificationTypes = (t: any) => [
  { type: "your_turn", label: t.notifTypeYourTurn, icon: "person", color: "#22D3EE" },
  { type: "grace_warning", label: t.notifTypeGraceWarning, icon: "timer", color: "#0EA5E9" },
  { type: "removed_from_queue", label: t.notifTypeRemoved, icon: "close-circle", color: "#6366F1" },
  { type: "unauthorized_alert", label: t.notifTypeUnauthorizedAlert, icon: "alert-circle", color: "#6366F1" },
  { type: "unauthorized_warning", label: t.notifTypeUnauthorizedWarning, icon: "warning", color: "#8B5CF6" },
  { type: "buzzer_triggered", label: t.notifTypeBuzzer, icon: "notifications", color: "#8B5CF6" },
  { type: "clothes_ready", label: t.notifTypeReady, icon: "checkmark-circle", color: "#22D3EE" },
  { type: "session_started", label: t.notifTypeStarted, icon: "play-circle", color: "#0EA5E9" },
  { type: "session_ended", label: t.notifTypeEnded, icon: "stop-circle", color: "#64748b" },
  { type: "queue_joined", label: t.notifTypeQueueJoined, icon: "enter", color: "#0EA5E9" },
  { type: "queue_left", label: t.notifTypeQueueLeft, icon: "exit", color: "#64748b" },
  { type: "chat_message", label: t.notifTypeChat, icon: "chatbubble", color: "#0EA5E9" },
  { type: "voice_call", label: t.notifTypeVoice, icon: "call", color: "#22D3EE" },
  { type: "video_call", label: t.notifTypeVideo, icon: "videocam", color: "#8B5CF6" },
  { type: "missed_call", label: t.notifTypeMissedCall, icon: "call", color: "#6366F1" },
  { type: "missed_video", label: t.notifTypeMissedVideo, icon: "videocam", color: "#6366F1" },
];

export default function NotificationSettings() {
  const { user, loading: userLoading } = useUser();
  const { t } = useI18n();
  const [testingType, setTestingType] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const {
    loading,
    enabled,
    machineReady,
    reminders,
    toggleAll,
    toggleMachineReady,
    toggleReminders,
  } = useNotificationSettingsViewModel(user?.uid);

  const NOTIFICATION_TYPES = getNotificationTypes(t);

  const testNotification = async (type: string) => {
    if (!user?.uid) {
      Alert.alert(t.error, t.notifMustLogin);
      return;
    }

    setTestingType(type);

    try {
      const notificationData: any = {
        userId: user.uid,
        type,
        title: getTestTitle(type),
        body: getTestBody(type),
        read: false,
        createdAt: serverTimestamp(),
      };

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

      Alert.alert(t.notifTestSentTitle, `A "${type}" ${t.notifTestSentBody}`);
    } catch (error) {
      console.error("Error creating test notification:", error);
      Alert.alert(t.error, t.notifFailedCreate);
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
        <StatusBar barStyle="dark-content" />
        <View style={styles.backgroundDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <ActivityIndicator size="large" color="#22D3EE" />
        <Text style={styles.loadingText}>{t.loading}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <LinearGradient
              colors={["#ECFEFF", "#CFFAFE"]}
              style={styles.backButtonGradient}
            >
              <Ionicons name="chevron-back" size={24} color="#0891B2" />
            </LinearGradient>
          </Pressable>
          <View>
            <Text style={styles.headerTitle}>{t.notifications}</Text>
            <Text style={styles.headerSubtitle}>{t.notifHeaderSubtitle}</Text>
          </View>
          <View style={{ width: 48 }} />
        </View>
      </Animated.View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Main Toggle */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={["#22D3EE", "#06B6D4"]}
                style={styles.cardIconGradient}
              >
                <Ionicons name="notifications" size={22} color="#fff" />
              </LinearGradient>
              <View style={styles.cardTitleContainer}>
                <Text style={styles.cardTitle}>{t.notifPushTitle}</Text>
                <Text style={styles.cardSubtitle}>{t.notifPushSubtitle}</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={toggleAll}
                trackColor={{ false: "#e2e8f0", true: "#22D3EE" }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Alert Settings */}
          <Text style={styles.sectionTitle}>{t.notifAlertsTitle}</Text>
          <View style={styles.card}>
            <SettingToggle
              icon="checkmark-circle"
              label={t.notifMachineReadyLabel}
              subLabel={t.notifMachineReadySub}
              value={machineReady}
              // FIX: Wrap async function properly
              onToggle={() => toggleMachineReady(!machineReady)}
              disabled={!enabled}
            />
            <SettingToggle
              icon="time"
              label={t.notifQueueRemindersLabel}
              subLabel={t.notifQueueRemindersSub}
              value={reminders}
              // FIX: Wrap async function properly
              onToggle={() => toggleReminders(!reminders)}
              disabled={!enabled}
              last
            />
          </View>

          {/* Test Notifications Section */}
          <Text style={styles.sectionTitle}>{t.notifTestTitle}</Text>
          <Text style={styles.sectionDescription}>
            {t.notifTestDescription}
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
                <View style={[styles.testIconCircle, { backgroundColor: `${notif.color}20` }]}>
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
            <View style={styles.infoIconContainer}>
              <Ionicons name="information-circle" size={22} color="#0891B2" />
            </View>
            <Text style={styles.infoText}>
              {t.notifTestInfoText}
            </Text>
          </View>

          <View style={{ height: 60 }} />
        </Animated.View>
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
  onToggle,
  disabled,
  last,
}: {
  icon: string;
  label: string;
  subLabel?: string;
  value: boolean;
  onToggle: () => void;  // FIX: Changed from onChange to onToggle with simple signature
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.item, disabled && styles.itemDisabled, last && styles.itemLast]}>
      <View style={styles.itemLeft}>
        <View style={[styles.itemIcon, disabled && { backgroundColor: "#f1f5f9" }]}>
          <Ionicons 
            name={icon as any} 
            size={20} 
            color={disabled ? "#94a3b8" : "#22D3EE"} 
          />
        </View>
        <View>
          <Text style={[styles.itemText, disabled && { color: "#94a3b8" }]}>{label}</Text>
          {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
        </View>
      </View>

      <Switch 
        value={value} 
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: "#e2e8f0", true: "#22D3EE" }}
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
    backgroundColor: "#CFFAFE",
    opacity: 0.4,
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#E0E7FF",
    opacity: 0.3,
    bottom: 150,
    left: -40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#0891B2",
    fontSize: 14,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    borderRadius: 14,
    overflow: "hidden",
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 10,
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionDescription: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
  },
  cardIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  cardTitleContainer: {
    flex: 1,
    marginLeft: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#ECFEFF",
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
    fontWeight: "500",
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
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  testButtonPressed: {
    backgroundColor: "#ECFEFF",
    borderColor: "#CFFAFE",
    transform: [{ scale: 0.98 }],
  },
  testIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: 12,
    padding: 16,
    backgroundColor: "#ECFEFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#CFFAFE",
  },
  infoIconContainer: {
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#0891B2",
    lineHeight: 20,
    fontWeight: "500",
  },
});