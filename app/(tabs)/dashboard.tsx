import React, { useRef, useEffect, useCallback, useState } from "react";
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  StatusBar, 
  Animated, 
  RefreshControl, 
  Text, 
  Pressable,
  Dimensions,
  Easing
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "@/components/UserContext";
import { router } from "expo-router";
import { useDashboardViewModel } from "@/viewmodels/tabs/DashboardViewModel";
import { setDashboardReady } from "@/services/appState";
import { useGracePeriod } from "@/services/useGracePeriod";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardStatusCard from "@/components/dashboard/DashboardStatusCard";
import DashboardSlideshow from "@/components/dashboard/DashboardSlideShow";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardFooter from "@/components/dashboard/DashboardFooter";
import EnhancedBubble from "@/components/ui/EnhancedBubble";
import { PulseCard } from "@/components/dashboard/ActivePulseRing";
import { haptic } from "@/utils/haptics";
import { LP } from "@/constants/LaundrixColors";
import { useI18n } from "@/i18n/i18n";

const { width, height } = Dimensions.get("window");

// Notify setDashboardReady once on mount (was inside old Bubble useEffect)
function useDashboardInit() {
  useEffect(() => { setDashboardReady(); }, []);
}

export default function Dashboard() {
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);
  useDashboardInit();

  // Real-time unread notification count for bell icon
  useEffect(() => {
    if (!user?.uid) { setUnreadCount(0); return; }
    const db = getFirestore();
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      where("read", "==", false)
    );
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size));
    return unsub;
  }, [user?.uid]);

  const {
    machines, 
    stats, 
    queueCount, 
    userQueuePosition, 
    userQueueMachineId,
    queueJoinedAt,
    sessionStartTime,
    isUserTurn, 
    hasActiveSession, 
    activeSession, 
    loading, 
    refreshing, 
    refresh, 
    onScanPress, 
    onJoinQueue, 
    onViewAll, 
    onViewNotifications, 
    onViewSettings, 
    onViewHelp, 
    onViewAI, 
    onViewPolicies,
    onViewChats,
    onStatusActionPress,
  } = useDashboardViewModel();
  const { t } = useI18n();

  // Only subscribe to grace period for a real machine the user is associated with
  const activeMachineId = activeSession?.machineId || userQueueMachineId || null;
  const { gracePeriod, formatTime: formatGraceTime } = useGracePeriod({
    machineId: activeMachineId ?? "",
    userId: user?.uid,
    isAdmin: user?.role === "admin",
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const headerY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    const entranceAnimation = Animated.stagger(100, [
      Animated.timing(headerY, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 900, 
        useNativeDriver: true 
      }),
      Animated.spring(slideAnim, { 
        toValue: 0, 
        tension: 50, 
        friction: 8,
        useNativeDriver: true 
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true
      })
    ]);

    entranceAnimation.start();
  }, []);

  // Determine status card type based on real state
  // Grace period counts as "turn" state (first-position user must scan now)
  let statusCardType: "active" | "turn" | "queue" | "none" = "none";
  if (hasActiveSession) {
    statusCardType = "active";
  } else if (gracePeriod && gracePeriod.userId === user?.uid) {
    statusCardType = "turn";
  } else if (userQueuePosition) {
    statusCardType = "queue";
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Premium Animated Background */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#FAFAFF", "#F2F6FF", "#E4EDFF", "#D6E8FF"]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradientBackground}
        />
        
        {/* Floating Glass Bubbles — EnhancedBubble with 4-axis parallel animation */}
        <EnhancedBubble delay={0}    size={300} color="rgba(14, 165, 233, 0.07)" position={{ top: -110, right: -90 }}  driftX={18} floatY={32} />
        <EnhancedBubble delay={700}  size={210} color="rgba(14, 165, 233, 0.05)" position={{ top:  90,  left:  -65 }}  driftX={10} floatY={24} />
        <EnhancedBubble delay={1400} size={170} color="rgba(2,  132, 199, 0.06)" position={{ top:  310, right: -45 }}  driftX={14} floatY={20} />
        <EnhancedBubble delay={2100} size={130} color="rgba(16, 185, 129, 0.04)" position={{ bottom: 220, left: 22 }}  driftX={8}  floatY={16} />
        <EnhancedBubble delay={900}  size={190} color="rgba(245,158, 11, 0.035)" position={{ bottom: 110, right: 55 }} driftX={16} floatY={22} />
        
        {/* Mesh Gradient Overlay */}
        <View style={styles.meshOverlay} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={refresh} 
              tintColor="#0EA5E9"
              colors={["#0EA5E9", "#0284C7", "#0EA5E9"]}
              progressBackgroundColor="#fff"
            />
          }
        >
          <Animated.View 
            style={{ 
              opacity: fadeAnim, 
              transform: [{ translateY: slideAnim }] 
            }}
          >
            {/* Header with slide animation */}
            <Animated.View style={{ transform: [{ translateY: headerY }] }}>
              <DashboardHeader
                userName={user?.name || "User"}
                userAvatarUrl={user?.avatarUrl ?? null}
                onScanPress={onScanPress}
                onNotificationsPress={onViewNotifications}
                onProfilePress={() => router.push("/(settings)/profile")}
                unreadCount={unreadCount}
              />
            </Animated.View>

            {/* Status Card - HERO Section with Glassmorphism + Pulse Ring */}
            <View style={styles.sectionLarge}>
              <Text style={styles.sectionLabel}>{t.yourStatus}</Text>
              <PulseCard
                active={statusCardType === "active"}
                activeColor={LP.Glow.primary}
                borderRadius={32}
              >
                <DashboardStatusCard
                  type={statusCardType}
                  progress={activeSession?.progress}
                  timeRemaining={activeSession?.timeRemaining}
                  machineId={activeSession?.machineId || userQueueMachineId || ""}
                  machineLocation={activeSession?.machineLocation}
                  queuePosition={userQueuePosition}
                  graceSecondsLeft={gracePeriod?.secondsLeft ?? null}
                  queueJoinedAt={queueJoinedAt ?? null}
                  sessionStartTime={activeSession?.startTime?.toISOString() ?? null}
                  onActionPress={() => { haptic.medium(); onStatusActionPress(); }}
                />
              </PulseCard>
            </View>

            {/* Quick Actions - Floating Glass Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.quickActions}</Text>
              <DashboardQuickActions 
                onScan={() => { haptic.light(); onScanPress(); }}
                onJoinQueue={() => { haptic.medium(); onJoinQueue(); }}
                onViewMachines={onViewAll}
                onChat={onViewChats}
              />
            </View>

            {/* Features Carousel - Premium Glass Slides */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.features}</Text>
              <DashboardSlideshow />
            </View>

            {/* Footer - Glass Group */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.supportAndInfo}</Text>
              <DashboardFooter 
                onHelpPress={onViewHelp} 
                onAIPress={onViewAI} 
                onPoliciesPress={onViewPolicies} 
              />
            </View>
            
            {/* Bottom Spacer */}
            <View style={{ height: 40 }} />
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* 🔔 GRACE PERIOD BANNER — shown only to admins observing another user's grace period */}
      {gracePeriod && user?.role === "admin" && gracePeriod.userId !== user?.uid && (
        <View style={styles.graceBanner}>
          <LinearGradient
            colors={gracePeriod.secondsLeft <= 180 ? ["#EF4444", "#DC2626"] : ["#F59E0B", "#D97706"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.graceBannerGrad}
          >
            <Ionicons name="timer-outline" size={20} color="#fff" />
            <Text style={styles.graceBannerText}>
              {`⏳ Grace period: ${formatGraceTime(gracePeriod.secondsLeft)} remaining`}
            </Text>
            <Pressable
              onPress={() => router.push({ pathname: "/(tabs)/queue", params: { machineId: gracePeriod.machineId } })}
              style={styles.graceBannerBtn}
            >
              <Text style={styles.graceBannerBtnText}>{t.view}</Text>
            </Pressable>
          </LinearGradient>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: LP.Surface.base,
  },
  // Grace period banner styles
  graceBanner: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  graceBannerGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  graceBannerSubText: {
    color: LP.Text.onDarkMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  graceBannerTimer: {
    color: LP.Text.onDark,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginHorizontal: 8,
  },
  graceBannerText: {
    flex: 1,
    color: LP.Text.onDark,
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: -0.2,
    lineHeight: 19,
  },
  graceBannerBtn: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.40)",
  },
  graceBannerBtnText: {
    color: LP.Text.onDark,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 0.4,
  },
  backgroundContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  gradientBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  meshOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
    opacity: 0.4,
  },
  bubble: {
    position: "absolute",
    opacity: 0.4,
  },
  scrollContent: { 
    paddingHorizontal: 20, 
    paddingBottom: 40, 
    paddingTop: 10,
  },
  
  // Section Spacing
  section: { marginBottom: 34 },
  sectionLarge: { 
    marginBottom: 38,
    marginTop: 10,
  },
  
  // Section Header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginLeft: 4,
  },
  // Premium badge label — muted, wide letter-spacing
  sectionLabel: { 
    fontSize: 11, 
    fontWeight: "800", 
    color: LP.Text.muted,
    textTransform: "uppercase", 
    letterSpacing: 1.8,
    marginBottom: 16, 
    marginLeft: 4,
    opacity: 0.75,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: LP.TechBlue[100],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LP.Border.glow,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: LP.Text.accent,
    letterSpacing: 0.2,
  },
});