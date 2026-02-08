import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  Animated,
  StatusBar,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import Avatar from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { useSettings } from "../../stores/settings.store";
import { useSettingsViewModel } from "@/viewmodels/tabs/SettingsViewModel";
import { useNotificationSettingsViewModel } from "@/viewmodels/settings/NotificationSettingsViewModel";
import { showLocalNotification } from "@/services/notification.service";

export default function SettingsScreen() {
  const { user } = useUser();
  const { ringEnabled, toggleRing } = useSettings();
  const { logout, deleteAccount, shareApp, showLanguageInfo } = useSettingsViewModel(user?.uid);
  
  // Notification settings integration
  const {
    enabled: notificationsEnabled,
    machineReady,
    reminders,
    toggleAll: toggleNotifications,
    toggleMachineReady,
    toggleReminders,
  } = useNotificationSettingsViewModel(user?.uid);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const refreshNotifications = async () => {
    if (!user?.uid) return;
    
    try {
      const { initializeNotifications } = await import("@/services/notification.service");
      await initializeNotifications(user.uid);
      Alert.alert("Success", "Notifications refreshed! FCM token saved.");
    } catch (err) {
      Alert.alert("Error", "Failed to refresh notifications");
    }
  };

  const testNotification = async () => {
    try {
      await showLocalNotification(
        "🧪 Test Notification",
        "If you see this, notifications are working!",
        { test: "true" },
        "default"
      );
      Alert.alert("Sent!", "Check your notification tray.");
    } catch (err: any) {
      Alert.alert("Error", "Notification failed: " + err.message);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            <Text style={styles.headerTitle}>Settings</Text>

            {/* Profile Section */}
            <LinearGradient
              colors={["#ffffff", "#f8fafc"]}
              style={styles.profileCard}
            >
              <View style={styles.profileInfo}>
                <Avatar
                  name={user?.name}
                  avatarUrl={user?.avatarUrl ?? null}
                  size={60}
                />
                <View style={styles.profileTextContainer}>
                  <Text style={styles.profileEmail} numberOfLines={1}>
                    {user?.email ?? "Guest User"}
                  </Text>
                  <View style={[styles.badge, user?.isVerified ? styles.badgeVerified : styles.badgeUnverified]}>
                    <Ionicons 
                      name={user?.isVerified ? "checkmark-circle" : "alert-circle"} 
                      size={12} 
                      color={user?.isVerified ? "#059669" : "#dc2626"} 
                    />
                    <Text style={[styles.badgeText, { color: user?.isVerified ? "#059669" : "#dc2626" }]}>
                      {user?.isVerified ? "Verified" : "Unverified"}
                    </Text>
                  </View>
                </View>
              </View>
            </LinearGradient>

            {/* Account Section */}
            <Text style={styles.sectionLabel}>Account</Text>
            <View style={styles.settingsGroup}>
              <SettingItem
                icon="person"
                label="Personal Information"
                onPress={() => router.push("/(settings)/profile")}
              />
              <SettingItem
                icon="lock-closed"
                label="Security & Password"
                onPress={() => router.push("/(auth)/forgot_password")}
              />
            </View>

            {/* Notifications Section */}
            <Text style={styles.sectionLabel}>Notifications</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#eff6ff' }]}>
                    <Ionicons name="notifications" size={20} color="#3b82f6" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>All Notifications</Text>
                    <Text style={styles.subLabel}>Enable or disable all alerts</Text>
                  </View>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: "#e2e8f0", true: "#0ea5e9" }}
                  thumbColor="#fff"
                />
              </View>
              
              <View style={[styles.item, !notificationsEnabled && styles.itemDisabled]}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#f0fdf4' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>Machine Ready</Text>
                    <Text style={styles.subLabel}>When your laundry is done</Text>
                  </View>
                </View>
                <Switch
                  value={machineReady}
                  onValueChange={toggleMachineReady}
                  disabled={!notificationsEnabled}
                  trackColor={{ false: "#e2e8f0", true: "#10b981" }}
                  thumbColor="#fff"
                />
              </View>

              <View style={[styles.item, !notificationsEnabled && styles.itemDisabled]}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#fef3c7' }]}>
                    <Ionicons name="time" size={20} color="#f59e0b" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>Queue Reminders</Text>
                    <Text style={styles.subLabel}>When it's almost your turn</Text>
                  </View>
                </View>
                <Switch
                  value={reminders}
                  onValueChange={toggleReminders}
                  disabled={!notificationsEnabled}
                  trackColor={{ false: "#e2e8f0", true: "#f59e0b" }}
                  thumbColor="#fff"
                />
              </View>

              <SettingItem
                icon="settings"
                label="Advanced Settings"
                onPress={() => router.push("/(settings)/notifications_settings")}
              />
            </View>

            {/* Debug / Troubleshooting */}
            <Text style={styles.sectionLabel}>Troubleshooting</Text>
            <View style={styles.settingsGroup}>
              <SettingItem
                icon="refresh"
                label="Refresh Notifications"
                iconColor="#0ea5e9"
                iconBg="#f0f9ff"
                onPress={refreshNotifications}
              />
              <SettingItem
                icon="paper-plane"
                label="Test Notification"
                iconColor="#8b5cf6"
                iconBg="#faf5ff"
                onPress={testNotification}
              />
            </View>

            {/* Preferences */}
            <Text style={styles.sectionLabel}>Preferences</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#fdf4ff' }]}>
                    <Ionicons name="volume-high" size={20} color="#a855f7" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>Queue Ring</Text>
                    <Text style={styles.subLabel}>Ring when it's my turn</Text>
                  </View>
                </View>
                <Switch
                  value={ringEnabled}
                  onValueChange={toggleRing}
                  trackColor={{ false: "#e2e8f0", true: "#a855f7" }}
                  thumbColor="#fff"
                />
              </View>
            </View>

            {/* Languages */}
            <Text style={styles.sectionLabel}>Language</Text>
            <View style={styles.settingsGroup}>
              <SettingItem icon="language" label="English" onPress={() => showLanguageInfo("English")} />
              <SettingItem icon="language" label="Bahasa Melayu" onPress={() => showLanguageInfo("Bahasa Melayu")} />
              <SettingItem icon="language" label="中文 (Chinese)" onPress={() => showLanguageInfo("Chinese")} />
            </View>

            {/* Help & Support */}
            <Text style={styles.sectionLabel}>Help & Support</Text>
            <View style={styles.settingsGroup}>
              <SettingItem 
                icon="sparkles" 
                label="AI Assistant" 
                iconColor="#8b5cf6"
                iconBg="#faf5ff"
                onPress={() => router.push("/(settings)/ai_assistant")} 
              />
              <SettingItem 
                icon="help-circle" 
                label="Help Center" 
                onPress={() => router.push("/(settings)/help_center")} 
              />
              <SettingItem 
                icon="shield-checkmark" 
                label="Privacy & Policies" 
                onPress={() => router.push("/(settings)/policies")} 
              />
              <SettingItem icon="share-social" label="Invite a Friend" onPress={shareApp} />
            </View>

            {/* Danger Zone */}
            <Text style={styles.sectionLabel}>Account Actions</Text>
            <View style={[styles.settingsGroup, { marginBottom: 40 }]}>
              <SettingItem
                icon="log-out"
                label="Log Out"
                danger
                onPress={() => logout(() => router.replace("/(auth)/login"))}
              />
              <SettingItem
                icon="trash"
                label="Delete Account"
                danger
                hideChevron
                onPress={() => deleteAccount(user?.email!, () => router.replace("/(auth)/login"))}
              />
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ---------- ITEM COMPONENT ---------- */
function SettingItem({ 
  icon, 
  label, 
  onPress, 
  danger, 
  hideChevron,
  iconColor,
  iconBg 
}: any) {
  return (
    <Pressable 
      onPress={onPress} 
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: '#f1f5f9' }]}
    >
      <View style={styles.itemLeft}>
        <View style={[
          styles.iconBox, 
          danger 
            ? { backgroundColor: '#fef2f2' } 
            : iconBg 
            ? { backgroundColor: iconBg }
            : { backgroundColor: '#f8fafc' }
        ]}>
          <Ionicons
            name={icon}
            size={20}
            color={danger ? "#ef4444" : iconColor || "#475569"}
          />
        </View>
        <Text style={[styles.itemText, danger && { color: "#ef4444" }]}>
          {label}
        </Text>
      </View>
      {!danger && !hideChevron && (
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  
  // Background
  backgroundDecor: { position: "absolute", width: "100%", height: "100%" },
  decorCircle1: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#F0FDFA", top: -100, left: -50 },
  decorCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#F0F9FF", bottom: 50, right: -50 },

  headerTitle: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginTop: 20, marginBottom: 24, letterSpacing: -0.5 },

  // Profile Card
  profileCard: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  profileInfo: { flexDirection: "row", alignItems: "center", gap: 16 },
  profileTextContainer: { flex: 1 },
  profileEmail: { fontSize: 17, fontWeight: "700", color: "#1e293b" },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 6, gap: 4 },
  badgeVerified: { backgroundColor: '#ecfdf5' },
  badgeUnverified: { backgroundColor: '#fef2f2' },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: 'uppercase' },

  // Settings Items
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  settingsGroup: { backgroundColor: "#fff", borderRadius: 20, marginBottom: 24, overflow: "hidden", borderWidth: 1, borderColor: "#f1f5f9" },
  
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  itemDisabled: {
    opacity: 0.5,
  },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 15, color: "#334155", fontWeight: "600" },
  subLabel: { fontSize: 12, color: "#94a3b8", marginTop: 1 },
});
