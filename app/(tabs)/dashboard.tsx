import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { router } from "expo-router";
import { useDashboardViewModel } from "@/viewmodels/tabs/DashboardViewModel";

const { width } = Dimensions.get("window");

export default function Dashboard() {
  const { user } = useUser();
  const { 
    machines, 
    stats, 
    primaryMachine, 
    m001Status,
    queueCount,
    loading,
    refreshing,
    refresh,
    onScanPress,
    onJoinM001Queue,
  } = useDashboardViewModel();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const statusPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Status indicator pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(statusPulse, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Animated.Text style={{ transform: [{ scale: pulseAnim }], color: "#0284C7", fontWeight: "700" }}>
          Loading Laundrix...
        </Animated.Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Decorative background elements */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#0EA5E9"
            colors={["#0EA5E9"]}
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hi {user?.name || "User"} 👋</Text>
              <Text style={styles.subGreeting}>Fresh & Clean starts here</Text>
            </View>
            <View style={styles.avatarWrapper}>
              <Avatar name={user?.name} avatarUrl={user?.avatarUrl ?? null} size={52} />
            </View>
          </View>

          {/* Quick Stats Cards */}
          <View style={styles.statsRow}>
            <Animated.View style={[styles.statCard, { transform: [{ scale: fadeAnim }] }]}>
              <View style={styles.statIconCircle}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              </View>
              <Text style={styles.statNumber}>{stats.available}</Text>
              <Text style={styles.statLabel}>Available</Text>
              <Animated.View style={[styles.statStatusDot, { backgroundColor: "#22c55e", transform: [{ scale: statusPulse }] }]} />
            </Animated.View>

            <Animated.View style={[styles.statCard, { transform: [{ scale: fadeAnim }] }]}>
              <View style={[styles.statIconCircle, { backgroundColor: "#fef2f2" }]}>
                <Ionicons name="time" size={24} color="#ef4444" />
              </View>
              <Text style={styles.statNumber}>{stats.inUse}</Text>
              <Text style={styles.statLabel}>In Use</Text>
              <Animated.View style={[styles.statStatusDot, { backgroundColor: "#ef4444", transform: [{ scale: statusPulse }] }]} />
            </Animated.View>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.quickActionsRow}>
            {/* Scan QR Button */}
            <Pressable 
              style={({ pressed }) => [styles.quickActionCard, pressed && { transform: [{ scale: 0.98 }] }]}
              onPress={onScanPress}
            >
              <LinearGradient
                colors={["#0EA5E9", "#0284C7"]}
                style={styles.quickActionGradient}
              >
                <View style={styles.quickActionIcon}>
                  <Text style={{ fontSize: 28 }}>📸</Text>
                </View>
                <Text style={styles.quickActionTitle}>Scan QR</Text>
                <Text style={styles.quickActionSubtitle}>Start instantly</Text>
              </LinearGradient>
            </Pressable>

            {/* View Queue Button */}
            <Pressable 
              style={({ pressed }) => [styles.quickActionCard, pressed && { transform: [{ scale: 0.98 }] }]}
              onPress={() => router.push("/(tabs)/queue")}
            >
              <LinearGradient
                colors={["#8b5cf6", "#7c3aed"]}
                style={styles.quickActionGradient}
              >
                <View style={styles.quickActionIcon}>
                  <Text style={{ fontSize: 28 }}>⏱️</Text>
                </View>
                <Text style={styles.quickActionTitle}>Live Queue</Text>
                <Text style={styles.quickActionSubtitle}>{queueCount} waiting</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* M001 Machine Card - Main Feature */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Machine M001</Text>
            <View style={[styles.statusBadge, m001Status === "Available" ? styles.statusAvailable : styles.statusInUse]}>
              <Animated.View style={[styles.statusDot, { transform: [{ scale: statusPulse }] }]} />
              <Text style={styles.statusText}>{m001Status}</Text>
            </View>
          </View>

          <View style={styles.m001Card}>
            <LinearGradient
              colors={m001Status === "Available" ? ["#f0fdf4", "#dcfce7"] : ["#fef2f2", "#fee2e2"]}
              style={styles.m001Gradient}
            >
              <View style={styles.m001Header}>
                <View style={styles.m001IconContainer}>
                  <Text style={{ fontSize: 40 }}>🧺</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.m001Title}>Primary Washer</Text>
                  <Text style={styles.m001Subtitle}>
                    {m001Status === "Available" ? "Ready for your laundry" : "Currently in use"}
                  </Text>
                  {queueCount > 0 && (
                    <Text style={styles.m001Queue}>
                      <Ionicons name="people" size={14} /> {queueCount} in queue
                    </Text>
                  )}
                </View>
              </View>

              {m001Status === "Available" ? (
                <Pressable
                  style={({ pressed }) => [styles.m001ActionButton, pressed && { opacity: 0.9 }]}
                  onPress={onScanPress}
                >
                  <LinearGradient
                    colors={["#22c55e", "#16a34a"]}
                    style={styles.m001ActionGradient}
                  >
                    <Ionicons name="scan" size={20} color="#fff" />
                    <Text style={styles.m001ActionText}>Scan to Start</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.m001ActionButton, pressed && { opacity: 0.9 }]}
                  onPress={onJoinM001Queue}
                >
                  <View style={styles.m001JoinButton}>
                    <Ionicons name="time-outline" size={20} color="#0284C7" />
                    <Text style={styles.m001JoinText}>Join Queue</Text>
                  </View>
                </Pressable>
              )}
            </LinearGradient>
          </View>

          {/* Primary Machine Section (if active) */}
          {primaryMachine && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Session</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>RUNNING</Text></View>
              </View>
              <View style={styles.primaryCard}>
                <View style={styles.primaryInfo}>
                  <Text style={styles.machineTitle}>Machine {primaryMachine.machineId}</Text>
                  <Text style={styles.machineSub}>
                    {primaryMachine.status === "Available" ? "Ready for duty" : "Wash in progress"}
                  </Text>
                </View>
                
                <Pressable
                  style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.9 }]}
                  onPress={() => router.push({
                    pathname: "/iot/[machineId]",
                    params: { machineId: primaryMachine.machineId },
                  })}
                >
                  <Text style={styles.actionButtonText}>Control Panel</Text>
                  <Ionicons name="chevron-forward" size={18} color="#fff" />
                </Pressable>
               
              </View>
            </>
          )}

          {/* Other Nearby Machines */}
          {machines.length > 1 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Other Machines</Text>
              <View style={styles.machineList}>
                {machines.filter(m => m.machineId !== "M001").map((machine) => (
                  <View key={machine.machineId} style={styles.machineItem}>
                    <View style={styles.iconCircle}>
                      <Text style={{ fontSize: 18 }}>🧺</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.machineIdText}>Machine {machine.machineId}</Text>
                      <Text style={[styles.machineStatusText, machine.status === "In Use" && { color: "#94a3b8" }]}>
                        {machine.status}
                      </Text>
                    </View>

                    {machine.status === "Available" ? (
                      <Pressable style={styles.useButton}>
                        <Text style={styles.useButtonText}>Use</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.busyBadge}>
                        <Text style={styles.busyText}>Busy</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backgroundDecor: { position: "absolute", width: "100%", height: "100%" },
  decorCircle1: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#E0F7FA",
    opacity: 0.5,
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 50,
    left: -40,
  },
  scrollContent: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  greeting: { fontSize: 26, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  subGreeting: { fontSize: 15, color: "#64748b", fontWeight: "500", marginTop: 2 },
  avatarWrapper: {
    elevation: 8,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  statCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statNumber: { fontSize: 30, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 4 },
  statStatusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3, marginBottom: 12 },
  
  quickActionsRow: { flexDirection: "row", gap: 12, marginBottom: 28 },
  quickActionCard: { flex: 1, borderRadius: 20, overflow: "hidden", elevation: 6 },
  quickActionGradient: { padding: 20, alignItems: "center" },
  quickActionIcon: { marginBottom: 8 },
  quickActionTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  quickActionSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusAvailable: { backgroundColor: "#dcfce7" },
  statusInUse: { backgroundColor: "#fee2e2" },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e", marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: "700", color: "#166534" },

  m001Card: { marginBottom: 28, borderRadius: 24, overflow: "hidden", elevation: 8 },
  m001Gradient: { padding: 24 },
  m001Header: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  m001IconContainer: { 
    width: 70, 
    height: 70, 
    borderRadius: 16, 
    backgroundColor: "rgba(255,255,255,0.9)", 
    alignItems: "center", 
    justifyContent: "center",
    elevation: 2,
  },
  m001Title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  m001Subtitle: { fontSize: 14, color: "#64748b", marginTop: 2 },
  m001Queue: { fontSize: 13, color: "#0284C7", marginTop: 6, fontWeight: "600" },
  m001ActionButton: { borderRadius: 16, overflow: "hidden" },
  m001ActionGradient: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 16, 
    gap: 8 
  },
  m001ActionText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  m001JoinButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 16, 
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#0284C7",
  },
  m001JoinText: { color: "#0284C7", fontSize: 16, fontWeight: "800" },

  badge: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { color: "#166534", fontSize: 10, fontWeight: "800" },
  
  primaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  primaryInfo: { marginBottom: 20 },
  machineTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  machineSub: { fontSize: 14, color: "#64748b", marginTop: 4 },
  actionButton: {
    backgroundColor: "#0f172a",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  actionButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  
  machineList: { gap: 12 },
  machineItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  machineIdText: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  machineStatusText: { fontSize: 13, color: "#22c55e", fontWeight: "600", marginTop: 2 },
  useButton: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  useButtonText: { color: "#0284C7", fontWeight: "700", fontSize: 14 },
  busyBadge: { paddingHorizontal: 12, paddingVertical: 6 },
  busyText: { color: "#94a3b8", fontWeight: "600", fontSize: 14 },
});
