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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { router } from "expo-router";
import { useDashboardViewModel } from "@/viewmodels/tabs/DashboardViewModel";

const { width } = Dimensions.get("window");

export default function Dashboard() {
  const { user } = useUser();
  const { machines, stats, primaryMachine, loading, onScanPress } = useDashboardViewModel();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

      {/* Decorative background elements (consistent with Login) */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.available}</Text>
              <Text style={styles.statLabel}>Available</Text>
              <View style={[styles.statStatusDot, { backgroundColor: "#22c55e" }]} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.inUse}</Text>
              <Text style={styles.statLabel}>In Use</Text>
              <View style={[styles.statStatusDot, { backgroundColor: "#ef4444" }]} />
            </View>
          </View>

          {/* Scan Button (Themed like Primary Button) */}
          <Pressable 
            style={({ pressed }) => [styles.scanButtonWrapper, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={onScanPress}
          >
            <LinearGradient
              colors={["#0EA5E9", "#0284C7", "#0369A1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.scanGradient}
            >
              <Text style={styles.scanIcon}>📸</Text>
              <View>
                <Text style={styles.scanTitle}>Scan Machine QR</Text>
                <Text style={styles.scanSubtitle}>Start your laundry instantly</Text>
              </View>
            </LinearGradient>
          </Pressable>

          {/* Primary Machine Section */}
          {primaryMachine && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Session</Text>
                <View style={styles.badge}><Text style={styles.badgeText}>PRIMARY</Text></View>
              </View>
              <View style={styles.primaryCard}>
                <View style={styles.primaryInfo}>
                  <Text style={styles.machineTitle}>Machine {primaryMachine.machineId}</Text>
                  <Text style={styles.machineSub}>
                    {primaryMachine.status === "Available" ? "Ready for duty" : "Wash in progress"}
                  </Text>
                </View>
                
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push({
                    pathname: "/iot/[machineId]",
                    params: { machineId: primaryMachine.machineId },
                  })}
                >
                  <Text style={styles.actionButtonText}>Open Control Panel</Text>
                </Pressable>
              </View>
            </>
          )}

          {/* Nearby machines */}
          <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Nearby Machines</Text>
          <View style={styles.machineList}>
            {machines.map((machine) => (
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
    marginBottom: 32,
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
    width: "47%",
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
  statNumber: { fontSize: 30, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 4 },
  statStatusDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  scanButtonWrapper: {
    marginBottom: 32,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  scanGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
  },
  scanIcon: { fontSize: 32, marginRight: 16 },
  scanTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800" },
  scanSubtitle: { color: "#e0f2fe", fontSize: 13, fontWeight: "500", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3 },
  badge: { backgroundColor: "#e0f2fe", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 10 },
  badgeText: { color: "#0284C7", fontSize: 10, fontWeight: "800" },
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
  },
  actionButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  machineList: { gap: 12, marginTop: 12 },
  machineItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#f1f5f9",
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