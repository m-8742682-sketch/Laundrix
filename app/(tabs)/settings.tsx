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
import { BlurView } from "expo-blur";

import Avatar from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { useSettings } from "../../stores/settings.store";
import { useSettingsViewModel } from "@/viewmodels/tabs/SettingsViewModel";
import { useNotificationSettingsViewModel } from "@/viewmodels/settings/NotificationSettingsViewModel";
import LanguageSelector from "@/components/LanguageSelector";
import { useI18n, Language } from "@/i18n/i18n";
import EnhancedBubble from "@/components/ui/EnhancedBubble";
import { haptic } from "@/utils/haptics";
import { LP } from "@/constants/LaundrixColors";

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
        <EnhancedBubble delay={0}    size={260} color="rgba(14, 165, 233, 0.07)" position={{ top: -80,    right: -60 }} driftX={14} floatY={26} />
        <EnhancedBubble delay={800}  size={180} color="rgba(14, 165, 233, 0.05)" position={{ top: 80,     left: -40  }} driftX={9}  floatY={20} />
        <EnhancedBubble delay={1600} size={140} color="rgba(2,  132, 199, 0.06)" position={{ top: 380,    right: -30 }} driftX={11} floatY={16} />
        <EnhancedBubble delay={2400} size={100} color="rgba(16, 185, 129, 0.04)" position={{ bottom: 200, left: 20   }} driftX={7}  floatY={14} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" colors={["#0EA5E9"]} />
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
                colors={["#0EA5E9", "#0369A1", "#3730A3"]}
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
              <BlurView intensity={22} tint="light" style={styles.settingsGroupBlur} />
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.settingsGroupGradient}
                pointerEvents="none"
              />
              <SettingItem icon="person"      label={t.personalInformation} iconColor="#0EA5E9" iconBg="rgba(14, 165, 233, 0.1)"  onPress={() => router.push("/(settings)/profile")} />
              <SettingItem icon="lock-closed" label={t.securityPassword}    iconColor="#0284C7" iconBg="rgba(2, 132, 199, 0.1)" onPress={() => router.push("/(auth)/forgot_password")} last />
            </View>

            {/* ── Notifications ── */}
            <Text style={styles.sectionLabel}>{t.notifications}</Text>
            <View style={styles.settingsGroup}>
              <BlurView intensity={22} tint="light" style={styles.settingsGroupBlur} />
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.settingsGroupGradient}
                pointerEvents="none"
              />
              <SwitchItem icon="notifications"  iconColor="#0891B2" iconBg="rgba(8,145,178,0.1)"   label={t.allNotifications} sub={t.enableOrDisableAlerts}  value={notificationsEnabled} onValueChange={toggleNotifications}  trackColor="#22D3EE" />
              <SwitchItem icon="checkmark-circle" iconColor="#22D3EE" iconBg="rgba(34,211,238,0.1)" label={t.machineReady}     sub={t.whenLaundryDone}        value={machineReady}         onValueChange={toggleMachineReady}  trackColor="#22D3EE" disabled={!notificationsEnabled} />
              <SwitchItem icon="time"            iconColor="#0EA5E9" iconBg="rgba(14,165,233,0.1)"  label={t.queueReminders}   sub={t.whenAlmostYourTurn}     value={reminders}            onValueChange={toggleReminders}     trackColor="#0EA5E9" disabled={!notificationsEnabled} last />
            </View>

            {/* ── Preferences ── */}
            <Text style={styles.sectionLabel}>{t.preferences}</Text>
            <View style={styles.settingsGroup}>
              <BlurView intensity={22} tint="light" style={styles.settingsGroupBlur} />
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.settingsGroupGradient}
                pointerEvents="none"
              />
              <SwitchItem icon="volume-high" iconColor="#0284C7" iconBg="rgba(2, 132, 199, 0.1)" label={t.queueRing} sub={t.ringWhenMyTurn} value={ringEnabled} onValueChange={toggleRing} trackColor="#0284C7" />
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
              <BlurView intensity={22} tint="light" style={styles.settingsGroupBlur} />
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.settingsGroupGradient}
                pointerEvents="none"
              />
              <SettingItem icon="sparkles"         label={t.aiAssistant}     iconColor="#0284C7" iconBg="rgba(2, 132, 199, 0.1)"  onPress={() => router.push("/(settings)/ai_assistant")} />
              <SettingItem icon="help-circle"      label={t.helpCenter}      iconColor="#0EA5E9" iconBg="rgba(14, 165, 233, 0.1)"   onPress={() => router.push("/(settings)/help_center")} />
              <SettingItem icon="shield-checkmark" label={t.privacyPolicies} iconColor="#0EA5E9" iconBg="rgba(14,165,233,0.1)"   onPress={() => router.push("/(settings)/policies")} />
              <SettingItem icon="share-social"     label={t.inviteFriend}    iconColor="#10B981" iconBg="rgba(16,185,129,0.1)"  onPress={shareApp} last />
            </View>

            {/* ── Account Actions ── */}
            <Text style={styles.sectionLabel}>{t.accountActions}</Text>
            <View style={styles.settingsGroup}>
              <BlurView intensity={22} tint="light" style={styles.settingsGroupBlur} />
              <LinearGradient
                colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)"]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={styles.settingsGroupGradient}
                pointerEvents="none"
              />
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
  const textColor = destructive ? "#EF4444" : danger ? "#D97706" : LP.Text.primary;
  const bgColor   = destructive ? "rgba(239,68,68,0.1)" : danger ? "rgba(217,119,6,0.1)" : iconBg ?? LP.TechBlue[100];
  const tintColor = destructive ? "#EF4444" : danger ? "#D97706" : iconColor ?? LP.TechBlue.solid;

  const handlePress = () => {
    if (destructive) haptic.heavy();
    else if (danger)  haptic.medium();
    else              haptic.light();
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
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
  const handleChange = (v: boolean) => {
    haptic.light();
    onValueChange?.(v);
  };
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
        onValueChange={handleChange}
        disabled={disabled}
        trackColor={{ false: "#E2E8F0", true: trackColor }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LP.Surface.base, marginBottom: 50 },

  // Background
  backgroundContainer: { position: "absolute", width: "100%", height: "100%", overflow: "hidden" },
  gradientBackground:  { position: "absolute", width: "100%", height: "100%" },
  bubble:              { position: "absolute", opacity: 0.4 },

  // Scroll
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header:  { paddingTop: 10, paddingBottom: 16 },
  overline: {
    fontSize: 25,
    fontWeight: "800",
    color: LP.Text.heading,
    textTransform: "uppercase",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  // Profile card — layered glass treatment
  profileCardContainer: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 34,
    shadowColor: LP.Glow.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 12,
    // Outer glass border
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  profileCard: {
    padding: 24,
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    // Mid-layer border
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.18)",
  },
  cardDecorCircleLarge: {
    position: "absolute", width: 190, height: 190, borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.07)", top: -65, right: -55,
  },
  cardDecorCircleSmall: {
    position: "absolute", width: 110, height: 110, borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -35, left: -25,
  },
  profileInfo:          { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarRing:           { borderWidth: 2, borderColor: "rgba(255,255,255,0.45)", borderRadius: 36, shadowColor: "#fff", shadowOpacity: 0.30, shadowRadius: 10 },
  profileTextContainer: { flex: 1 },
  profileName:          { fontSize: 20, fontWeight: "800", color: LP.Text.onDark, marginBottom: 2, letterSpacing: -0.5, lineHeight: 26 },
  profileEmail:         { fontSize: 13, color: LP.Text.onDarkMuted, marginBottom: 8, lineHeight: 19 },
  badge:                { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  badgeVerified:        { backgroundColor: "rgba(16,185,129,0.22)" },
  badgeUnverified:      { backgroundColor: "rgba(255,255,255,0.16)" },
  badgeText:            { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  // Section label — muted premium badge
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: LP.Text.muted,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    marginBottom: 12,
    marginLeft: 4,
    opacity: 0.75,
  },

  // Settings group — BlurView glass card
  settingsGroup: {
    borderRadius: 22,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
    // Outer glass rim
    borderWidth: 1,
    borderColor: LP.LayeredGlass.outer,
    // Shadow
    shadowColor: LP.Glow.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    // Fallback fill for platforms where BlurView is unavailable
    backgroundColor: LP.Surface.glass,
  },
  // BlurView fills the group absolutely
  settingsGroupBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },
  // Gradient sheen sits on top of blur, below content
  settingsGroupGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
  },

  // Item row
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: LP.Border.divider,
  },
  itemLast:     { borderBottomWidth: 0 },
  itemPressed:  { backgroundColor: LP.Surface.pressed },
  itemDisabled: { opacity: 0.42 },

  itemLeft: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },

  // Icon box with subtle inner ring for depth
  iconBox: {
    width: 40, height: 40,
    borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    borderColor: LP.Border.glassInner,
  },
  itemText: {
    fontSize: 15, color: LP.Text.primary, fontWeight: "600",
    letterSpacing: -0.1, lineHeight: 22,
  },
  subLabel: {
    fontSize: 12, color: LP.Text.soft, marginTop: 2,
    fontWeight: "500", lineHeight: 17,
  },
});