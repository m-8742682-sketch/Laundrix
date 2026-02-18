import React, { useRef, useEffect, useState, useCallback } from "react";
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
  RefreshControl,
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
import LanguageSelector from "@/components/LanguageSelector";
import { useI18n } from "@/i18n/i18n";

export default function SettingsScreen() {
  const { user } = useUser();
  const { ringEnabled, toggleRing } = useSettings();
  const { logout, deleteAccount, shareApp } = useSettingsViewModel(user?.uid);
  const { language, t } = useI18n();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const currentLanguageName = language === "en" ? "English" : "Bahasa Melayu";
  const currentLanguageFlag = language === "en" ? "🇬🇧" : "🇲🇾";
  
  const {
    enabled: notificationsEnabled,
    machineReady,
    reminders,
    toggleAll: toggleNotifications,
    toggleMachineReady,
    toggleReminders,
  } = useNotificationSettingsViewModel(user?.uid);

  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Exaggerated Background */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorTriangle} />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" colors={["#6366F1"]} />
          }
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            
            <Text style={styles.headerTitle}>{t.settings}</Text>

            {/* Profile Card - Premium Gradient */}
            <View style={styles.profileCardContainer}>
              <LinearGradient
                colors={["#6366F1", "#4F46E5", "#3730A3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileCard}
              >
                <View style={styles.profileInfo}>
                  <View style={styles.avatarGlow}>
                    <Avatar name={user?.name} avatarUrl={user?.avatarUrl ?? null} size={64} />
                  </View>
                  <View style={styles.profileTextContainer}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {user?.name ?? t.guestUser}
                    </Text>
                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {user?.email ?? ""}
                    </Text>
                    <View style={[styles.badge, user?.isVerified ? styles.badgeVerified : styles.badgeUnverified]}>
                      <Ionicons 
                        name={user?.isVerified ? "checkmark-circle" : "alert-circle"} 
                        size={12} 
                        color={user?.isVerified ? "#10B981" : "#F8FAFC"} 
                      />
                      <Text style={[styles.badgeText, { color: user?.isVerified ? "#10B981" : "#fff" }]}>
                        {user?.isVerified ? t.verified : t.unverified}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.cardDecorCircle} />
              </LinearGradient>
            </View>

            {/* Account Section */}
            <Text style={styles.sectionLabel}>{t.account}</Text>
            <View style={styles.settingsGroup}>
              <SettingItem icon="person" label={t.personalInformation} iconColor="#6366F1" onPress={() => router.push("/(settings)/profile")} />
              <SettingItem icon="lock-closed" label={t.securityPassword} iconColor="#8B5CF6" onPress={() => router.push("/(auth)/forgot_password")} />
            </View>

            {/* Notifications Section */}
            <Text style={styles.sectionLabel}>{t.notifications}</Text>
            <View style={styles.settingsGroup}>
              <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#ECFEFF' }]}>
                    <Ionicons name="notifications" size={20} color="#0891B2" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>{t.allNotifications}</Text>
                    <Text style={styles.subLabel}>{t.enableOrDisableAlerts}</Text>
                  </View>
                </View>
                <Switch value={notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ false: "#e2e8f0", true: "#22D3EE" }} thumbColor="#fff" />
              </View>
              
              <View style={[styles.item, !notificationsEnabled && styles.itemDisabled]}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#ECFEFF' }]}>
                    <Ionicons name="checkmark-circle" size={20} color="#22D3EE" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>{t.machineReady}</Text>
                    <Text style={styles.subLabel}>{t.whenLaundryDone}</Text>
                  </View>
                </View>
                <Switch value={machineReady} onValueChange={toggleMachineReady} disabled={!notificationsEnabled} trackColor={{ false: "#e2e8f0", true: "#22D3EE" }} thumbColor="#fff" />
              </View>

              <View style={[styles.item, !notificationsEnabled && styles.itemDisabled]}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                    <Ionicons name="time" size={20} color="#0EA5E9" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>{t.queueReminders}</Text>
                    <Text style={styles.subLabel}>{t.whenAlmostYourTurn}</Text>
                  </View>
                </View>
                <Switch value={reminders} onValueChange={toggleReminders} disabled={!notificationsEnabled} trackColor={{ false: "#e2e8f0", true: "#0EA5E9" }} thumbColor="#fff" />
              </View>
            </View>

            {/* Preferences */}
            <Text style={styles.sectionLabel}>{t.preferences}</Text>
            <View style={styles.settingsGroup}>
               <View style={styles.item}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="volume-high" size={20} color="#8B5CF6" />
                  </View>
                  <View>
                    <Text style={styles.itemText}>{t.queueRing}</Text>
                    <Text style={styles.subLabel}>{t.ringWhenMyTurn}</Text>
                  </View>
                </View>
                <Switch value={ringEnabled} onValueChange={toggleRing} trackColor={{ false: "#e2e8f0", true: "#8B5CF6" }} thumbColor="#fff" />
              </View>

              <Pressable style={({ pressed }) => [styles.item, pressed && { backgroundColor: '#f1f5f9' }]} onPress={() => setShowLanguageModal(true)}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: '#ECFEFF' }]}>
                    <Text style={{ fontSize: 20 }}>{currentLanguageFlag}</Text>
                  </View>
                  <View>
                    <Text style={styles.itemText}>{currentLanguageName}</Text>
                    <Text style={styles.subLabel}>{t.selectLanguage}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </Pressable>
            </View>

            {/* Help & Support */}
            <Text style={styles.sectionLabel}>{t.helpSupport}</Text>
            <View style={styles.settingsGroup}>
              <SettingItem icon="sparkles" label={t.aiAssistant} iconColor="#8B5CF6" iconBg="#F5F3FF" onPress={() => router.push("/(settings)/ai_assistant")} />
              <SettingItem icon="help-circle" label={t.helpCenter} onPress={() => router.push("/(settings)/help_center")} />
              <SettingItem icon="shield-checkmark" label={t.privacyPolicies} onPress={() => router.push("/(settings)/policies")} />
              <SettingItem icon="share-social" label={t.inviteFriend} onPress={shareApp} />
            </View>

            {/* Danger Zone */}
            <Text style={styles.sectionLabel}>{t.accountActions}</Text>
            <View style={[styles.settingsGroup, { marginBottom: 40, borderColor: '#FECACA', backgroundColor: '#FFF' }]}>
              <SettingItem
                icon="log-out"
                label={t.logout}
                danger
                onPress={() => logout(() => router.replace("/(auth)/login"))}
              />
              <SettingItem
                icon="trash"
                label={t.deleteAccount}
                destructive
                hideChevron
                onPress={() => deleteAccount(user?.email!, () => router.replace("/(auth)/login"))}
              />
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <LanguageSelector visible={showLanguageModal} onClose={() => setShowLanguageModal(false)} />
    </View>
  );
}

function SettingItem({ icon, label, onPress, danger, destructive, hideChevron, iconColor, iconBg }: any) {
  // Logic for styling
  const textColor = destructive ? "#EF4444" : danger ? "#D97706" : "#334155";
  const iconBgColor = destructive ? "#FEE2E2" : danger ? "#FEF3C7" : iconBg ? iconBg : "#F8FAFC";
  const iconTintColor = destructive ? "#EF4444" : danger ? "#D97706" : iconColor || "#6366F1";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: '#f8fafc' }]}>
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: iconBgColor }]}>
          <Ionicons name={icon} size={20} color={iconTintColor} />
        </View>
        <Text style={[styles.itemText, { color: textColor }]}>
          {label}
        </Text>
      </View>
      {!hideChevron && (
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  
  // Background
  backgroundDecor: { position: "absolute", width: "100%", height: "100%", overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#E0E7FF", opacity: 0.5, top: -80, right: -60 },
  decorCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 150, left: -40 },
  decorTriangle: { position: "absolute", width: 150, height: 150, backgroundColor: "#ECFEFF", opacity: 0.3, top: "20%", right: -30, transform: [{ rotate: "45deg" }] },

  headerTitle: { fontSize: 32, fontWeight: "800", color: "#0f172a", marginTop: 20, marginBottom: 24, letterSpacing: -1 },

  // Profile Card
  profileCardContainer: { borderRadius: 28, overflow: "hidden", marginBottom: 32, elevation: 12, shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 16 },
  profileCard: { padding: 20, position: 'relative', overflow: 'hidden' },
  profileInfo: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarGlow: { shadowColor: "#fff", shadowOpacity: 0.4, shadowRadius: 10, borderRadius: 32 },
  profileTextContainer: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 2 },
  profileEmail: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginBottom: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  badgeVerified: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  badgeUnverified: { backgroundColor: 'rgba(255,255,255,0.15)' },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: 'uppercase' },
  cardDecorCircle: { position: 'absolute', width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)', top: -50, right: -50 },

  // Sections
  sectionLabel: { fontSize: 13, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginLeft: 8 },
  settingsGroup: { backgroundColor: "#fff", borderRadius: 24, marginBottom: 24, overflow: "hidden", borderWidth: 1, borderColor: "#f1f5f9", elevation: 2, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8 },
  
  item: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9",
  },
  itemDisabled: { opacity: 0.5 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBox: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 16, color: "#334155", fontWeight: "600" },
  subLabel: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
});