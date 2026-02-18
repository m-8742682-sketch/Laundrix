import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Alert, ActivityIndicator, ScrollView, Animated, StatusBar, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/components/UserContext";
import { releaseMachine, dismissAlarm } from "@/services/api";
import { subscribeMachine, Machine, IoTData, checkMachineOnline } from "@/services/machine.service";
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");

type CombinedMachineState = Machine & Partial<IoTData> & { 
  load?: number; 
  vibration?: number; 
  locked?: boolean;
  buzzerState?: boolean;
  lastPing?: number;
  state?: string;
  iot?: IoTData;
};

const STATUS_CONFIG: Record<string, { 
  gradient: [string, string]; 
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  "Available": { gradient: ["#22D3EE", "#06B6D4"], icon: "checkmark-circle", label: "Available" },
  "In Use": { gradient: ["#0EA5E9", "#0284C7"], icon: "sync", label: "In Use" },
  "Clothes Inside": { gradient: ["#8B5CF6", "#7C3AED"], icon: "shirt", label: "Clothes Inside" },
  "Unauthorized Use": { gradient: ["#6366F1", "#4F46E5"], icon: "warning", label: "Unauthorized" },
};

export default function MachineControlScreen() {
  const insets = useSafeAreaInsets();
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { user } = useUser();
  const { t } = useI18n();

  const [machine, setMachine] = useState<CombinedMachineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 5000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 5000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Subscribe to machine data via machine.service
  useEffect(() => {
    if (!machineId) return;

    const unsubscribe = subscribeMachine(machineId, (machineData) => {
      // Merge Firestore + IoT data into compatible format
      const mergedData: CombinedMachineState = {
        ...machineData,
        // Map IoT data to component expected format
        load: machineData.iot?.load ?? machineData.currentLoad,
        vibration: machineData.iot?.vibration ?? machineData.vibrationLevel,
        buzzerState: machineData.iot?.buzzerState ?? machineData.buzzerActive,
        lastPing: machineData.iot?.lastPing,
        locked: machineData.status !== "Available", // Derived from status
        state: machineData.status, // Map status to state
      };
      
      setMachine(mergedData);
      setLoading(false);
    });

    return unsubscribe;
  }, [machineId]);

  // Redirect if machine is not live/available
  useEffect(() => {
    if (!loading && machine) {
      // Only show control screen for active machines
      const isOnline = machine.iot?.lastPing 
        ? checkMachineOnline(machine.iot.lastPing) 
        : machine.isLive;
        
      if (!isOnline && machine.status === "Available") {
        // Machine exists but not active - go back to list
        router.replace("/iot/machines");
      }
    }
  }, [loading, machine]);

  const handleRelease = async () => {
    if (!machineId || !user?.uid) return;
    Alert.alert(t.releaseMachine, t.releaseMachineConfirm, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.yesRelease,
        style: "destructive",
        onPress: async () => {
          setReleasing(true);
          try {
            const result = await releaseMachine(machineId, user.uid);
            if (result.success) {
              Alert.alert(t.released, result.message, [{ text: t.ok, onPress: () => router.back() }]);
            } else {
              Alert.alert(t.error, result.message);
            }
          } catch (err: any) {
            Alert.alert(t.error, err?.message ?? t.failedToRelease);
          } finally {
            setReleasing(false);
          }
        },
      },
    ]);
  };

  const handleDismissAlarm = async () => {
    if (!machineId || !user?.uid) return;
    setDismissing(true);
    try {
      await dismissAlarm(machineId, user.uid);
    } catch (err: any) {
      Alert.alert(t.error, err?.message ?? t.failedToDismissAlarm);
    } finally {
      setDismissing(false);
    }
  };

  const getStatusConfig = (state: string) => {
    return STATUS_CONFIG[state] || {
      gradient: ["#64748b", "#475569"] as [string, string],
      icon: "help-circle" as keyof typeof Ionicons.glyphMap,
      label: state,
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.backgroundDecor}>
          <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        </View>
        <View style={styles.center}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.loadingIcon}>
            <Ionicons name="hardware-chip" size={36} color="#fff" />
          </LinearGradient>
          <Text style={styles.loadingText}>{t.connectingToMachine}</Text>
        </View>
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.errorIcon}>
            <Ionicons name="alert-circle" size={36} color="#fff" />
          </LinearGradient>
          <Text style={styles.errorText}>{t.machineNotFound}</Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t.goBack}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const config = getStatusConfig(machine.state || machine.status);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Exaggerated Background */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorTriangle} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Pressable onPress={() => router.back()} style={styles.headerBack}>
            <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.headerBackGradient}>
              <Ionicons name="chevron-back" size={24} color="#4F46E5" />
            </LinearGradient>
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{machineId}</Text>
            <Text style={styles.headerSubtitle}>Machine Control</Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </Animated.View>

        {/* Status Card */}
        <Animated.View style={[styles.statusCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={config.gradient} style={styles.statusIconCircle}>
            <Ionicons name={config.icon} size={40} color="#fff" />
          </LinearGradient>
          <Text style={styles.statusText}>{config.label}</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: machine.isLive ? "#22D3EE" : "#94a3b8" }]} />
            <Text style={styles.statusBadgeText}>{machine.isLive ? t.live : t.offline}</Text>
          </View>
        </Animated.View>

        {/* Sensor Data */}
        <Animated.View style={[styles.sensorSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.sectionTitle}>{t.sensorData}</Text>
          <View style={styles.sensorRow}>
            <View style={styles.sensorCard}>
              <View style={styles.sensorHeader}>
                <LinearGradient colors={["#22D3EE", "#06B6D4"]} style={styles.sensorIconGradient}>
                  <Ionicons name="scale-outline" size={18} color="#fff" />
                </LinearGradient>
                <Text style={styles.sensorLabel}>{t.load}</Text>
              </View>
              <Text style={styles.sensorValue}>{(machine.load ?? 0).toFixed(1)} <Text style={styles.sensorUnit}>kg</Text></Text>
              <View style={styles.sensorBar}>
                <LinearGradient
                  colors={["#22D3EE", "#06B6D4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.sensorBarFill, { width: `${Math.min(100, ((machine.load ?? 0) / 10) * 100)}%` }]}
                />
              </View>
            </View>

            <View style={styles.sensorCard}>
              <View style={styles.sensorHeader}>
                <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={styles.sensorIconGradient}>
                  <Ionicons name="pulse-outline" size={18} color="#fff" />
                </LinearGradient>
                <Text style={styles.sensorLabel}>{t.vibration}</Text>
              </View>
              <Text style={styles.sensorValue}>{machine.vibration ?? 0}<Text style={styles.sensorUnit}>%</Text></Text>
              <View style={styles.sensorBar}>
                <LinearGradient
                  colors={(machine.vibration ?? 0) > 30 ? ["#22D3EE", "#06B6D4"] : ["#94a3b8", "#64748b"]}
                  style={[styles.sensorBarFill, { width: `${Math.min(100, machine.vibration ?? 0)}%` }]}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Status Row */}
        <Animated.View style={[styles.statusRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.statusItem}>
            <LinearGradient
              colors={machine.locked ? ["#6366F1", "#4F46E5"] : ["#22D3EE", "#06B6D4"]}
              style={styles.statusItemIcon}
            >
              <Ionicons name={machine.locked ? "lock-closed" : "lock-open"} size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.statusItemLabel}>{t.door}</Text>
            <Text style={[styles.statusItemValue, { color: machine.locked ? "#6366F1" : "#0891B2" }]}>
              {machine.locked ? t.locked : t.unlocked}
            </Text>
          </View>

          <View style={styles.statusItem}>
            <LinearGradient colors={machine.isLive ? ["#10B981", "#059669"] : ["#94a3b8", "#64748b"]} style={styles.statusItemIcon}>
              <Ionicons name={machine.isLive ? "wifi" : "wifi-off" as any} size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.statusItemLabel}>{t.status}</Text>
            <Text style={[styles.statusItemValue, { color: machine.isLive ? "#059669" : "#64748b" }]}>
              {machine.isLive ? t.online : t.offline}
            </Text>
          </View>
        </Animated.View>

        {/* Buzzer Alert */}
        {machine.buzzerState && (
          <Animated.View style={[styles.buzzerAlert, { opacity: fadeAnim }]}>
            <LinearGradient colors={["#FEF2F2", "#FEE2E2"]} style={styles.buzzerGradient}>
              <View style={styles.buzzerContent}>
                <LinearGradient colors={["#F87171", "#EF4444"]} style={styles.buzzerIcon}>
                  <Ionicons name="notifications" size={20} color="#fff" />
                </LinearGradient>
                <Text style={[styles.buzzerText, { color: "#DC2626" }]}>{t.buzzerActive}</Text>
              </View>
              <Pressable style={styles.dismissButton} onPress={handleDismissAlarm} disabled={dismissing}>
                <Text style={styles.dismissButtonText}>{dismissing ? "..." : t.dismiss}</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Last Update */}
        <Animated.Text style={[styles.lastUpdate, { opacity: fadeAnim }]}>
          {t.lastUpdate}: {machine.lastPing ? new Date(machine.lastPing).toLocaleTimeString() : t.unknown}
        </Animated.Text>

        {/* Release Button - RED for Danger */}
        <Animated.View style={[styles.releaseSection, { opacity: fadeAnim }]}>
          <Pressable
            style={({ pressed }) => [styles.releaseButton, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={handleRelease}
            disabled={releasing}
          >
            <LinearGradient colors={["#F87171", "#EF4444", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.releaseGradient}>
              {releasing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="exit-outline" size={22} color="#fff" />
                  <Text style={styles.releaseButtonText}>{t.releaseMachine}</Text>
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
  container: { flex: 1, backgroundColor: "#fff" },
  
  // Background
  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 350, height: 350, borderRadius: 175, backgroundColor: "#E0E7FF", opacity: 0.5, top: -100, right: -80 },
  decorCircle2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 100, left: -60 },
  decorTriangle: { position: "absolute", width: 180, height: 180, backgroundColor: "#ECFEFF", opacity: 0.3, top: "25%", right: -40, transform: [{ rotate: "45deg" }] },

  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  loadingIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20, shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  loadingText: { fontSize: 16, color: "#6366F1", fontWeight: "700" },
  errorIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20, shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  errorText: { fontSize: 18, color: "#4F46E5", fontWeight: "700", marginBottom: 20 },
  backButton: { paddingHorizontal: 24, paddingVertical: 14, backgroundColor: "#EEF2FF", borderRadius: 16, borderWidth: 1, borderColor: "#C7D2FE" },
  backButtonText: { fontSize: 16, color: "#4F46E5", fontWeight: "700" },

  scrollContent: { paddingBottom: 40 },
  
  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  headerBack: { borderRadius: 16, overflow: "hidden" },
  headerBackGradient: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerContent: { flex: 1, marginLeft: 12 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: "#64748b", fontWeight: "600", marginTop: 2 },
  headerPlaceholder: { width: 48 },

  // Status Card
  statusCard: { alignItems: "center", paddingVertical: 32, marginHorizontal: 20, marginBottom: 24, backgroundColor: "#fff", borderRadius: 32, elevation: 8, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, borderWidth: 1, borderColor: "#f1f5f9" },
  statusIconCircle: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 20, elevation: 8, shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
  statusText: { fontSize: 28, fontWeight: "800", color: "#0f172a", marginBottom: 12, letterSpacing: -0.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#ECFEFF" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusBadgeText: { fontSize: 13, fontWeight: "700", color: "#0891B2" },

  // Sensors
  sensorSection: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  sensorRow: { flexDirection: "row", gap: 14 },
  sensorCard: { flex: 1, backgroundColor: "#fff", padding: 18, borderRadius: 24, borderWidth: 1, borderColor: "#f1f5f9", elevation: 4, shadowColor: "#22D3EE", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
  sensorHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  sensorIconGradient: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  sensorLabel: { fontSize: 14, color: "#64748b", fontWeight: "700" },
  sensorValue: { fontSize: 30, fontWeight: "800", color: "#0f172a", marginBottom: 12, letterSpacing: -1 },
  sensorUnit: { fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  sensorBar: { height: 8, backgroundColor: "#f1f5f9", borderRadius: 4, overflow: "hidden" },
  sensorBarFill: { height: "100%", borderRadius: 4 },

  // Status Row
  statusRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 20, gap: 14 },
  statusItem: { flex: 1, alignItems: "center", backgroundColor: "#fff", padding: 20, borderRadius: 24, borderWidth: 1, borderColor: "#f1f5f9", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statusItemIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statusItemLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginBottom: 4 },
  statusItemValue: { fontSize: 16, fontWeight: "800" },

  // Buzzer
  buzzerAlert: { marginHorizontal: 20, marginBottom: 20, borderRadius: 24, overflow: "hidden" },
  buzzerGradient: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  buzzerContent: { flexDirection: "row", alignItems: "center", gap: 14 },
  buzzerIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buzzerText: { fontSize: 16, fontWeight: "800" },
  dismissButton: { backgroundColor: "#EF4444", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  dismissButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  lastUpdate: { textAlign: "center", fontSize: 13, color: "#94a3b8", marginBottom: 24, fontWeight: "600" },
  
  // Release Button - Red
  releaseSection: { paddingHorizontal: 20 },
  releaseButton: { borderRadius: 20, overflow: "hidden", elevation: 8, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
  releaseGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  releaseButtonText: { fontSize: 17, fontWeight: "800", color: "#fff" },
});