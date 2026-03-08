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
import { useGracePeriod } from "@/services/useGracePeriod";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardStatusCard from "@/components/dashboard/DashboardStatusCard";
import DashboardSlideshow from "@/components/dashboard/DashboardSlideShow";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardFooter from "@/components/dashboard/DashboardFooter";
import { useI18n } from "@/i18n/i18n";

const { width, height } = Dimensions.get("window");

// Animated background bubbles
const Bubble = ({ delay, size, color, position }: { delay: number; size: number; color: string; position: { top?: number; left?: number; right?: number; bottom?: number } }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 4000 + Math.random() * 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 4000 + Math.random() * 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 3000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 3000 + Math.random() * 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...position,
          transform: [{ translateY }, { scale: scaleAnim }],
        },
      ]}
    />
  );
};

export default function Dashboard() {
  const { user } = useUser();
  const [unreadCount, setUnreadCount] = useState(0);

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
          colors={["#ffffff", "#F0F9FF", "#E0F2FE", "#BAE6FD"]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradientBackground}
        />
        
        {/* Floating Glass Bubbles */}
        <Bubble delay={0} size={280} color="rgba(14, 165, 233, 0.08)" position={{ top: -100, right: -80 }} />
        <Bubble delay={1000} size={200} color="rgba(14, 165, 233, 0.06)" position={{ top: 100, left: -60 }} />
        <Bubble delay={2000} size={160} color="rgba(2, 132, 199, 0.06)" position={{ top: 300, right: -40 }} />
        <Bubble delay={1500} size={120} color="rgba(16, 185, 129, 0.05)" position={{ bottom: 200, left: 20 }} />
        <Bubble delay={800} size={180} color="rgba(245, 158, 11, 0.04)" position={{ bottom: 100, right: 60 }} />
        
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

            {/* Status Card - HERO Section with Glassmorphism */}
            <View style={styles.sectionLarge}>
              <Text style={styles.sectionLabel}>{t.yourStatus}</Text>
              <DashboardStatusCard
                type={statusCardType}
                progress={activeSession?.progress}
                timeRemaining={activeSession?.timeRemaining}
                machineId={activeSession?.machineId || userQueueMachineId || ""}
                machineLocation={activeSession?.machineLocation}
                queuePosition={userQueuePosition}
                graceSecondsLeft={gracePeriod?.secondsLeft ?? null}
                onActionPress={onStatusActionPress}
              />
            </View>

            {/* Quick Actions - Floating Glass Buttons */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t.quickActions}</Text>
              <DashboardQuickActions 
                onScan={onScanPress} 
                onJoinQueue={onJoinQueue} 
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
    backgroundColor: "#fafaff" 
  },
  // Grace period banner styles
  graceBanner: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 100,
  },
  graceBannerGrad: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  graceBannerSubText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  graceBannerTimer: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginHorizontal: 8,
  },
  graceBannerText: {
    flex: 1,
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  graceBannerBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  graceBannerBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
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
    paddingTop: 10 
  },
  
  // Section Spacing
  section: { 
    marginBottom: 32 
  },
  sectionLarge: { 
    marginBottom: 36,
    marginTop: 8
  },
  
  // Section Header - Unified with Settings
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionLabel: { 
    fontSize: 13, 
    fontWeight: "800", 
    color: "#0F172A", 
    textTransform: "uppercase", 
    letterSpacing: 1.2, 
    marginBottom: 16, 
    marginLeft: 4 
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(14, 165, 233, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(14, 165, 233, 0.2)",
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0EA5E9",
    letterSpacing: 0.3,
  },
});