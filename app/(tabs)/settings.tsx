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
  RefreshControl,
  Easing,
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
import { useI18n, Language } from "@/i18n/i18n";

// ── Floating bubble — identical to queue.tsx & conversations.tsx ─────────────
const Bubble = ({
  delay, size, color, position,
}: {
  delay: number;
  size: number;
  color: string;
  position: { top?: number; left?: number; right?: number; bottom?: number };
}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 4000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 4000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 3000 + Math.random() * 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1,   duration: 3000 + Math.random() * 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });

  return (
    <Animated.View
      style={[styles.bubble, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, ...position,
        transform: [{ translateY }, { scale: scaleAnim }],
      }]}
    />
  );
};

// Language display config
const languageConfig: Record<Language, { name: string; flag: string; nativeName: string }> = {
  en: { name: "English", flag: "🇬🇧", nativeName: "English" },
  ms: { name: "Bahasa Melayu", flag: "🇲🇾", nativeName: "Bahasa Melayu" },
  zh: { name: "中文", flag: "🇨🇳", nativeName: "中文" },
};

// ────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { user } = useUser();
  const { ringEnabled, toggleRing } = useSettings();
  const { logout, deleteAccount, shareApp } = useSettingsViewModel(user?.uid);
  const { language, t } = useI18n();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  
  const currentLang = languageConfig[language];

  const {
    enabled: notificationsEnabled,
    machineReady,
    reminders,
    toggleAll: toggleNotifications,
    toggleMachineReady,
    toggleReminders,
  } = useNotificationSettingsViewModel(user?.uid);

  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Background — same gradient + bubbles as queue & conversations */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#fafaff", "#f0f4ff", "#e0e7ff", "#dbeafe"]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradientBackground}
        />
        <Bubble delay={0}    size={260} color="rgba(99,102,241,0.08)"  position={{ top: -80,    right: -60 }} />
        <Bubble delay={1000} size={180} color="rgba(14,165,233,0.06)"  position={{ top: 80,     left: -40  }} />
        <Bubble delay={2000} size={140} color="rgba(139,92,246,0.07)"  position={{ top: 380,    right: -30 }} />
        <Bubble delay={1500} size={100} color="rgba(16,185,129,0.05)"  position={{ bottom: 200, left: 20   }} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" colors={["#6366F1"]} />
          }
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Header — overline style matching queue/conversations titleRow */}
            <View style={styles.header}>
              <Text style={styles.overline}>{t.settings}</Text>
            </View>

            {/* Profile Card — keeps indigo gradient, gets queue card proportions */}
            <View style={styles.profileCardContainer}>
              <LinearGradient
                colors={["#6366F1", "#4F46E5", "#3730A3"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.profileCard}
              >
                <View style={styles.cardDecorCircleLarge} />
                <View style={styles.cardDecorCircleSmall} />
                <View style={styles.profileInfo}>
                  <View style={styles.avatarRing}>
                    <Avatar name={user?.name} avatarUrl={user?.avatarUrl ?? null} size={64} />
                  </View>
                  <View style={styles.profileTextContainer}>
                    <Text style={styles.profileName} numberOfLines={1}>{user?.name ?? t.guestUser}</Text>
                    <Text style={styles.profileEmail} numberOfLines={1}>{user?.email ?? ""}</Text>
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
              </LinearGradient>
            </View>

            {/* ── Account ── */}
            <Text style={styles.sectionLabel}>{t.account}</Text>
            <View style={styles.settingsGroup}>
              <SettingItem icon="person"      label={t.personalInformation} iconColor="#6366F1" iconBg="rgba(99,102,241,0.1)"  onPress={() => router.push("/(settings)/profile")} />
              <SettingItem icon="lock-closed" label={t.securityPassword}    iconColor="#8B5CF6" iconBg="rgba(139,92,246,0.1)" onPress={() => router.push("/(auth)/forgot_password")} last />
            </View>

            {/* ── Notifications ── */}
            <Text style={styles.sectionLabel}>{t.notifications}</Text>
            <View style={styles.settingsGroup}>
              <SwitchItem icon="notifications"  iconColor="#0891B2" iconBg="rgba(8,145,178,0.1)"   label={t.allNotifications} sub={t.enableOrDisableAlerts}  value={notificationsEnabled} onValueChange={toggleNotifications}  trackColor="#22D3EE" />
              <SwitchItem icon="checkmark-circle" iconColor="#22D3EE" iconBg="rgba(34,211,238,0.1)" label={t.machineReady}     sub={t.whenLaundryDone}        value={machineReady}         onValueChange={toggleMachineReady}  trackColor="#22D3EE" disabled={!notificationsEnabled} />
              <SwitchItem icon="time"            iconColor="#0EA5E9" iconBg="rgba(14,165,233,0.1)"  label={t.queueReminders}   sub={t.whenAlmostYourTurn}     value={reminders}            onValueChange={toggleReminders}     trackColor="#0EA5E9" disabled={!notificationsEnabled} last />
            </View>

            {/* ── Preferences ── */}
            <Text style={styles.sectionLabel}>{t.preferences}</Text>
            <View style={styles.settingsGroup}>
              <SwitchItem icon="volume-high" iconColor="#8B5CF6" iconBg="rgba(139,92,246,0.1)" label={t.queueRing} sub={t.ringWhenMyTurn} value={ringEnabled} onValueChange={toggleRing} trackColor="#8B5CF6" />
              <Pressable style={({ pressed }) => [styles.item, pressed && styles.itemPressed, styles.itemLast]} onPress={() => setShowLanguageModal(true)}>
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBox, { backgroundColor: "rgba(14,165,233,0.1)" }]}>
                    <Text style={{ fontSize: 20 }}>{currentLang.flag}</Text>
                  </View>
                  <View>
                    <Text style={styles.itemText}>{currentLang.nativeName}</Text>
                    <Text style={styles.subLabel}>{t.selectLanguage}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* ── Help & Support ── */}
            <Text style={styles.sectionLabel}>{t.helpSupport}</Text>
            <View style={styles.settingsGroup}>
              <SettingItem icon="sparkles"         label={t.aiAssistant}     iconColor="#8B5CF6" iconBg="rgba(139,92,246,0.1)"  onPress={() => router.push("/(settings)/ai_assistant")} />
              <SettingItem icon="help-circle"      label={t.helpCenter}      iconColor="#6366F1" iconBg="rgba(99,102,241,0.1)"   onPress={() => router.push("/(settings)/help_center")} />
              <SettingItem icon="shield-checkmark" label={t.privacyPolicies} iconColor="#0EA5E9" iconBg="rgba(14,165,233,0.1)"   onPress={() => router.push("/(settings)/policies")} />
              <SettingItem icon="share-social"     label={t.inviteFriend}    iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"  onPress={shareApp} last />
            </View>

            {/* ── Account Actions ── */}
            <Text style={styles.sectionLabel}>{t.accountActions}</Text>
            <View style={styles.settingsGroup}>
              <SettingItem icon="log-out" label={t.logout}        danger      onPress={() => logout(() => router.replace("/(auth)/login"))} />
              <SettingItem icon="trash"   label={t.deleteAccount} destructive hideChevron onPress={() => deleteAccount(user?.email!, () => router.replace("/(auth)/login"))} last />
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      <LanguageSelector visible={showLanguageModal} onClose={() => setShowLanguageModal(false)} />
    </View>
  );
}

// ── SettingItem ──────────────────────────────────────────────────────────────
function SettingItem({ icon, label, onPress, danger, destructive, hideChevron, iconColor, iconBg, last }: any) {
  const textColor = destructive ? "#EF4444" : danger ? "#D97706" : "#0F172A";
  const bgColor   = destructive ? "rgba(239,68,68,0.1)" : danger ? "rgba(217,119,6,0.1)" : iconBg ?? "rgba(99,102,241,0.1)";
  const tintColor = destructive ? "#EF4444" : danger ? "#D97706" : iconColor ?? "#6366F1";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed, last && styles.itemLast]}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={20} color={tintColor} />
        </View>
        <Text style={[styles.itemText, { color: textColor }]}>{label}</Text>
      </View>
      {!hideChevron && <Ionicons name="chevron-forward" size={18} color="#94A3B8" />}
    </Pressable>
  );
}

// ── SwitchItem ───────────────────────────────────────────────────────────────
function SwitchItem({ icon, iconColor, iconBg, label, sub, value, onValueChange, disabled, trackColor, last }: any) {
  return (
    <View style={[styles.item, disabled && styles.itemDisabled, last && styles.itemLast]}>
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View>
          <Text style={styles.itemText}>{label}</Text>
          <Text style={styles.subLabel}>{sub}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#E2E8F0", true: trackColor }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaff", marginBottom: 50 },

  // Background — identical to queue/conversations
  backgroundContainer: { position: "absolute", width: "100%", height: "100%", overflow: "hidden" },
  gradientBackground:  { position: "absolute", width: "100%", height: "100%" },
  bubble:              { position: "absolute", opacity: 0.4 },

  // Scroll
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header — overline from queue/conversations
  header:  { paddingTop: 10, paddingBottom: 16 },
  overline: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0b0b0b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },

  // Profile card — queue myPositionCard proportions, settings indigo gradient
  profileCardContainer: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 32,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  profileCard: {
    padding: 24,
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  cardDecorCircleLarge: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -50,
  },
  cardDecorCircleSmall: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -30, left: -20,
  },
  profileInfo:          { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarRing:           { borderWidth: 2, borderColor: "rgba(255,255,255,0.4)", borderRadius: 36, shadowColor: "#fff", shadowOpacity: 0.3, shadowRadius: 8 },
  profileTextContainer: { flex: 1 },
  profileName:          { fontSize: 20, fontWeight: "800", color: "#fff", marginBottom: 2 },
  profileEmail:         { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 },
  badge:                { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  badgeVerified:        { backgroundColor: "rgba(16,185,129,0.2)" },
  badgeUnverified:      { backgroundColor: "rgba(255,255,255,0.15)" },
  badgeText:            { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },

  // Section label — identical to queue/conversations sectionLabel
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
    marginLeft: 4,
  },

  // Group card — matches queue queueItem glass card style
  settingsGroup: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },

  // Item row
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(241,245,249,0.9)",
  },
  itemLast:     { borderBottomWidth: 0 },
  itemPressed:  { backgroundColor: "rgba(248,250,252,0.95)" },
  itemDisabled: { opacity: 0.45 },

  itemLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  iconBox:  { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: 15, color: "#0F172A", fontWeight: "600" },
  subLabel: { fontSize: 12, color: "#94A3B8", marginTop: 2, fontWeight: "500" },
});