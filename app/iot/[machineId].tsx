/**
 * Machine Control Screen
 * 
 * High-end UI showing real-time machine status and controls.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { useUser } from "@/components/UserContext";
import { releaseMachine, dismissAlarm } from "@/services/api";

const { width } = Dimensions.get("window");

type MachineState = {
  load: number;
  vibration: number;
  state: string;
  locked: boolean;
  buzzerState: boolean;
  lastPing: number;
};

const STATUS_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  gradient: [string, string]; 
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  "Available": {
    color: "#22c55e",
    bgColor: "#f0fdf4",
    gradient: ["#22c55e", "#16a34a"],
    icon: "checkmark-circle",
    label: "Available",
  },
  "In Use": {
    color: "#0EA5E9",
    bgColor: "#f0f9ff",
    gradient: ["#0EA5E9", "#0284C7"],
    icon: "sync",
    label: "In Use",
  },
  "Clothes Inside": {
    color: "#f97316",
    bgColor: "#fff7ed",
    gradient: ["#f97316", "#ea580c"],
    icon: "shirt",
    label: "Clothes Inside",
  },
  "Unauthorized Use": {
    color: "#ef4444",
    bgColor: "#fef2f2",
    gradient: ["#ef4444", "#dc2626"],
    icon: "warning",
    label: "Unauthorized",
  },
};

export default function MachineControlScreen() {
  const insets = useSafeAreaInsets();
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { user } = useUser();

  const [machine, setMachine] = useState<MachineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
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
  }, []);

  // Subscribe to machine state from RTDB
  useEffect(() => {
    if (!machineId) return;

    const db = getDatabase();
    const machineRef = ref(db, `iot/${machineId}`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        setMachine(data);
      }
      setLoading(false);
    };

    onValue(machineRef, handleValue);

    return () => {
      off(machineRef, "value", handleValue);
    };
  }, [machineId]);

  const handleRelease = async () => {
    if (!machineId || !user?.uid) return;

    Alert.alert(
      "Release Machine",
      "Are you done with the laundry? The next person in queue will be notified.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Release",
          style: "destructive",
          onPress: async () => {
            setReleasing(true);
            try {
              const result = await releaseMachine(machineId, user.uid);
              if (result.success) {
                Alert.alert("Released!", result.message, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } else {
                Alert.alert("Error", result.message);
              }
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to release");
            } finally {
              setReleasing(false);
            }
          },
        },
      ]
    );
  };

  const handleDismissAlarm = async () => {
    if (!machineId || !user?.uid) return;

    setDismissing(true);
    try {
      await dismissAlarm(machineId, user.uid);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to dismiss alarm");
    } finally {
      setDismissing(false);
    }
  };

  const getStatusConfig = (state: string) => {
    return STATUS_CONFIG[state] || {
      color: "#64748b",
      bgColor: "#f8fafc",
      gradient: ["#64748b", "#475569"] as [string, string],
      icon: "help-circle" as keyof typeof Ionicons.glyphMap,
      label: state,
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>Connecting to machine...</Text>
        </View>
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <Ionicons name="warning-outline" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Machine not found</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const config = getStatusConfig(machine.state);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={28} color="#0f172a" />
          </Pressable>
          <Text style={styles.headerTitle}>{machineId}</Text>
          <View style={styles.headerPlaceholder} />
        </Animated.View>

        {/* Status Card */}
        <Animated.View 
          style={[
            styles.statusCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={config.gradient}
            style={styles.statusIconCircle}
          >
            <Ionicons name={config.icon} size={40} color="#fff" />
          </LinearGradient>
          <Text style={[styles.statusText, { color: config.color }]}>
            {config.label}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
            <View style={[styles.statusDot, { backgroundColor: config.color }]} />
            <Text style={[styles.statusBadgeText, { color: config.color }]}>Live</Text>
          </View>
        </Animated.View>

        {/* Sensor Data */}
        <Animated.View 
          style={[
            styles.sensorSection,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Text style={styles.sectionTitle}>Sensor Data</Text>
          <View style={styles.sensorRow}>
            {/* Load */}
            <View style={styles.sensorCard}>
              <View style={styles.sensorHeader}>
                <Ionicons name="scale-outline" size={20} color="#0EA5E9" />
                <Text style={styles.sensorLabel}>Load</Text>
              </View>
              <Text style={styles.sensorValue}>
                {machine.load?.toFixed(1) ?? "0"} <Text style={styles.sensorUnit}>kg</Text>
              </Text>
              <View style={styles.sensorBar}>
                <LinearGradient
                  colors={["#0EA5E9", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.sensorBarFill,
                    { width: `${Math.min(100, (machine.load / 10) * 100)}%` },
                  ]}
                />
              </View>
            </View>

            {/* Vibration */}
            <View style={styles.sensorCard}>
              <View style={styles.sensorHeader}>
                <Ionicons name="pulse-outline" size={20} color="#22c55e" />
                <Text style={styles.sensorLabel}>Vibration</Text>
              </View>
              <Text style={styles.sensorValue}>
                {machine.vibration ?? 0}<Text style={styles.sensorUnit}>%</Text>
              </Text>
              <View style={styles.sensorBar}>
                <LinearGradient
                  colors={machine.vibration > 30 ? ["#22c55e", "#16a34a"] : ["#94a3b8", "#64748b"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.sensorBarFill,
                    { width: `${Math.min(100, machine.vibration)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Status Row */}
        <Animated.View 
          style={[
            styles.statusRow,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Lock Status */}
          <View style={styles.statusItem}>
            <View style={[
              styles.statusItemIcon,
              { backgroundColor: machine.locked ? "#fef2f2" : "#f0fdf4" }
            ]}>
              <Ionicons 
                name={machine.locked ? "lock-closed" : "lock-open"} 
                size={24} 
                color={machine.locked ? "#ef4444" : "#22c55e"} 
              />
            </View>
            <Text style={styles.statusItemLabel}>Door</Text>
            <Text style={[
              styles.statusItemValue,
              { color: machine.locked ? "#ef4444" : "#22c55e" }
            ]}>
              {machine.locked ? "Locked" : "Unlocked"}
            </Text>
          </View>

          {/* Online Status */}
          <View style={styles.statusItem}>
            <View style={[styles.statusItemIcon, { backgroundColor: "#f0f9ff" }]}>
              <Ionicons name="wifi" size={24} color="#0EA5E9" />
            </View>
            <Text style={styles.statusItemLabel}>Status</Text>
            <Text style={[styles.statusItemValue, { color: "#0EA5E9" }]}>Online</Text>
          </View>
        </Animated.View>

        {/* Buzzer Alert */}
        {machine.buzzerState && (
          <Animated.View style={[styles.buzzerAlert, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={["#fef2f2", "#fee2e2"]}
              style={styles.buzzerGradient}
            >
              <View style={styles.buzzerContent}>
                <Ionicons name="notifications" size={24} color="#ef4444" />
                <Text style={styles.buzzerText}>Buzzer Active</Text>
              </View>
              <Pressable
                style={styles.dismissButton}
                onPress={handleDismissAlarm}
                disabled={dismissing}
              >
                <Text style={styles.dismissButtonText}>
                  {dismissing ? "..." : "Dismiss"}
                </Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Last Update */}
        <Animated.Text style={[styles.lastUpdate, { opacity: fadeAnim }]}>
          Last update: {machine.lastPing
            ? new Date(machine.lastPing).toLocaleTimeString()
            : "Unknown"}
        </Animated.Text>

        {/* Release Button */}
        <Animated.View style={[styles.releaseSection, { opacity: fadeAnim }]}>
          <Pressable
            style={({ pressed }) => [
              styles.releaseButton,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleRelease}
            disabled={releasing}
          >
            <LinearGradient
              colors={["#ef4444", "#dc2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.releaseGradient}
            >
              {releasing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={22} color="#fff" />
                  <Text style={styles.releaseButtonText}>Release Machine</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: "#ef4444",
    fontWeight: "600",
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: "#0f172a",
    fontWeight: "600",
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
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -60,
    right: -60,
  },
  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 150,
    left: -40,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerBack: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerPlaceholder: {
    width: 44,
  },
  statusCard: {
    alignItems: "center",
    paddingVertical: 32,
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: "#fff",
    borderRadius: 24,
    elevation: 4,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusText: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sensorSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sensorRow: {
    flexDirection: "row",
    gap: 12,
  },
  sensorCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  sensorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sensorLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  sensorValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  sensorUnit: {
    fontSize: 16,
    fontWeight: "600",
    color: "#94a3b8",
  },
  sensorBar: {
    height: 6,
    backgroundColor: "#f1f5f9",
    borderRadius: 3,
    overflow: "hidden",
  },
  sensorBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  statusRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statusItem: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  statusItemIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statusItemLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    marginBottom: 4,
  },
  statusItemValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  buzzerAlert: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  buzzerGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  buzzerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  buzzerText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ef4444",
  },
  dismissButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  lastUpdate: {
    textAlign: "center",
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 24,
  },
  releaseSection: {
    paddingHorizontal: 20,
  },
  releaseButton: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  releaseGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  releaseButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
  },
});
