/**
 * Machine Control Screen — REDESIGNED #9
 * Rich dark-glass aesthetic with real-time sensor bars and clean action layout.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Alert, ActivityIndicator,
  ScrollView, Animated, StatusBar, Dimensions, Easing,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/components/UserContext";
import { releaseMachine } from "@/services/api";
import {
  subscribeMachineRTDB, Machine,
  toggleBuzzerRTDB, toggleLockRTDB,
} from "@/services/machine.service";
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");

const STATUS_CFG: Record<string, { grad: [string, string]; icon: string; glow: string }> = {
  "Available":        { grad: ["#10B981", "#059669"], icon: "checkmark-circle",  glow: "#10B981" },
  "In Use":           { grad: ["#6366F1", "#4F46E5"], icon: "sync",              glow: "#6366F1" },
  "Clothes Inside":   { grad: ["#8B5CF6", "#7C3AED"], icon: "shirt",             glow: "#8B5CF6" },
  "Unauthorized Use": { grad: ["#F59E0B", "#D97706"], icon: "warning",           glow: "#F59E0B" },
};

export default function MachineControlScreen() {
  const insets = useSafeAreaInsets();
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { user } = useUser();
  const { t } = useI18n();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();

    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, []);

  useEffect(() => {
    if (!machineId) return;
    const unsub = subscribeMachineRTDB(machineId, (data) => { setMachine(data); setLoading(false); });
    return unsub;
  }, [machineId]);

  const handleRelease = () => {
    if (!machineId || !user?.uid) return;
    Alert.alert(t.releaseMachine, t.releaseMachineConfirm, [
      { text: t.cancel, style: "cancel" },
      { text: t.yesRelease, style: "destructive", onPress: async () => {
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
        } finally { setReleasing(false); }
      }},
    ]);
  };

  const handleDismissAlarm = async () => {
    if (!machineId) return;
    setDismissing(true);
    try { await toggleBuzzerRTDB(machineId, false); }
    catch (err: any) { Alert.alert(t.error, err?.message ?? t.failedToDismissAlarm); }
    finally { setDismissing(false); }
  };

  const handleToggleLock = async () => {
    if (!machineId) return;
    setTogglingLock(true);
    try { await toggleLockRTDB(machineId, !(machine?.locked ?? true)); }
    catch (err: any) { Alert.alert(t.error, err?.message ?? t.failedToToggleLock); }
    finally { setTogglingLock(false); }
  };

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Available": return t.available;
      case "In Use": return t.inUse;
      case "Unauthorized Use": return t.unauthorized;
      default: return status;
    }
  };

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#fafaff", "#f0f4ff"]} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={s.loadingIcon}>
            <Ionicons name="hardware-chip" size={36} color="#fff" />
          </LinearGradient>
          <Text style={s.loadingText}>{t.connectingToMachine}</Text>
          <ActivityIndicator color="#6366F1" style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={["#fafaff", "#f0f4ff"]} style={StyleSheet.absoluteFill} />
        <View style={s.center}>
          <LinearGradient colors={["#EF4444", "#DC2626"]} style={s.loadingIcon}>
            <Ionicons name="alert-circle" size={36} color="#fff" />
          </LinearGradient>
          <Text style={[s.loadingText, { color: "#EF4444" }]}>{t.machineNotFound}</Text>
          <Pressable onPress={() => router.back()} style={s.backAction}>
            <Text style={s.backActionText}>{t.goBack}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const cfg = STATUS_CFG[machine.status] || { grad: ["#64748b", "#475569"] as [string,string], icon: "help-circle", glow: "#64748b" };
  const isInUse = machine.status === "In Use";
  const loadPct = Math.min(100, ((machine.currentLoad ?? 0) / 10) * 100);
  const vibPct = Math.min(100, machine.vibrationLevel ?? 0);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <LinearGradient colors={["#fafaff", "#f0f4ff", "#e8edff"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[s.bgBlob, { backgroundColor: cfg.glow + "18", transform: [{ scale: pulseAnim }] }]} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[s.header, { opacity: fadeAnim }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={s.backGrad}>
              <Ionicons name="chevron-back" size={22} color="#4F46E5" />
            </LinearGradient>
          </Pressable>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.headerOverline}>{t.controlPanel.toUpperCase()}</Text>
            <Text style={s.headerTitle}>{machineId}</Text>
          </View>
          <View style={s.liveBadge}>
            <Animated.View style={[s.liveDot, { backgroundColor: machine.isLive ? "#10B981" : "#94a3b8", transform: [{ scale: machine.isLive ? pulseAnim : 1 }] }]} />
            <Text style={[s.liveText, { color: machine.isLive ? "#059669" : "#94a3b8" }]}>
              {machine.isLive ? t.live.toUpperCase() : t.offline.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[s.heroCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient colors={[...cfg.grad, cfg.grad[1] + "CC"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroGrad}>
            <View style={s.heroDeco1} />
            <View style={s.heroDeco2} />

            <View style={s.heroContent}>
              <Animated.View style={[s.heroIconWrap, isInUse && { transform: [{ rotate: spin }] }]}>
                <LinearGradient colors={["rgba(255,255,255,0.3)", "rgba(255,255,255,0.1)"]} style={s.heroIconCircle}>
                  <Ionicons name={cfg.icon as any} size={48} color="#fff" />
                </LinearGradient>
              </Animated.View>
              <Text style={s.heroStatus}>{getStatusLabel(machine.status)}</Text>
              <Text style={s.heroSub}>
                {machine.currentLoad ? `${(machine.currentLoad).toFixed(1)} ${t.kg} ${t.load.toLowerCase()} · ` : ""}
                {t.lastUpdate}: {machine.lastPing ? new Date(machine.lastPing).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </Text>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[s.sensorRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={s.sensorCard}>
            <View style={s.sensorTop}>
              <LinearGradient colors={["#6366F1", "#4F46E5"]} style={s.sensorIcon}>
                <Ionicons name="scale-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={s.sensorLabel}>{t.load}</Text>
            </View>
            <Text style={s.sensorVal}>
              {(machine.currentLoad ?? 0).toFixed(1)}
              <Text style={s.sensorUnit}> {t.kg}</Text>
            </Text>
            <View style={s.bar}>
              <LinearGradient colors={["#6366F1", "#818CF8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.barFill, { width: `${loadPct}%` }]} />
            </View>
          </View>

          <View style={s.sensorCard}>
            <View style={s.sensorTop}>
              <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={s.sensorIcon}>
                <Ionicons name="pulse-outline" size={16} color="#fff" />
              </LinearGradient>
              <Text style={s.sensorLabel}>{t.vibration}</Text>
            </View>
            <Text style={s.sensorVal}>
              {machine.vibrationLevel ?? 0}
              <Text style={s.sensorUnit}>%</Text>
            </Text>
            <View style={s.bar}>
              <LinearGradient
                colors={vibPct > 60 ? ["#10B981", "#34D399"] : ["#0EA5E9", "#38BDF8"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[s.barFill, { width: `${vibPct}%` }]}
              />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[s.controlRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Pressable style={s.controlCard} onPress={handleToggleLock} disabled={togglingLock}>
            <LinearGradient
              colors={machine.locked ? ["#6366F1", "#4F46E5"] : ["#10B981", "#059669"]}
              style={s.controlIcon}
            >
              {togglingLock
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name={machine.locked ? "lock-closed" : "lock-open"} size={22} color="#fff" />
              }
            </LinearGradient>
            <Text style={s.controlLabel}>{t.door}</Text>
            <Text style={[s.controlVal, { color: machine.locked ? "#6366F1" : "#059669" }]}>
              {machine.locked ? t.locked : t.unlocked}
            </Text>
          </Pressable>

          <View style={s.controlCard}>
            <LinearGradient
              colors={machine.buzzerActive ? ["#EF4444", "#DC2626"] : ["#94a3b8", "#64748b"]}
              style={s.controlIcon}
            >
              <Ionicons name="notifications" size={22} color="#fff" />
            </LinearGradient>
            <Text style={s.controlLabel}>{t.buzzerStatus}</Text>
            <Text style={[s.controlVal, { color: machine.buzzerActive ? "#EF4444" : "#94a3b8" }]}>
              {machine.buzzerActive ? t.buzzerActiveLabel : t.buzzerSilentLabel}
            </Text>
          </View>
        </Animated.View>

        {machine.buzzerActive && (
          <Animated.View style={[s.buzzerBanner, { opacity: fadeAnim }]}>
            <LinearGradient colors={["#FEF2F2", "#FEE2E2"]} style={s.buzzerGrad}>
              <View style={s.buzzerLeft}>
                <LinearGradient colors={["#F87171", "#EF4444"]} style={s.buzzerIconBox}>
                  <Ionicons name="volume-high" size={18} color="#fff" />
                </LinearGradient>
                <View>
                  <Text style={s.buzzerTitle}>{t.buzzerActive}</Text>
                  <Text style={s.buzzerSub}>{t.incidentBuzzerActivated}</Text>
                </View>
              </View>
              <Pressable onPress={handleDismissAlarm} disabled={dismissing} style={s.dismissBtn}>
                <Text style={s.dismissText}>{dismissing ? "..." : t.dismiss}</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        )}

        <Text style={s.lastUpdate}>
          {t.lastUpdate}: {machine.lastPing ? new Date(machine.lastPing).toLocaleTimeString() : "—"}
        </Text>

        <Animated.View style={[s.releaseWrap, { opacity: fadeAnim }]}>
          <Pressable
            onPress={handleRelease}
            disabled={releasing}
            style={({ pressed }) => [s.releaseBtn, pressed && { transform: [{ scale: 0.97 }] }]}
          >
            <LinearGradient colors={["#F87171", "#EF4444", "#DC2626"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.releaseGrad}>
              {releasing
                ? <ActivityIndicator color="#fff" />
                : <>
                    <LinearGradient colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.1)"]} style={s.releaseIconBox}>
                      <Ionicons name="exit-outline" size={20} color="#fff" />
                    </LinearGradient>
                    <Text style={s.releaseText}>{t.releaseMachine}</Text>
                  </>
              }
            </LinearGradient>
          </Pressable>
        </Animated.View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  scroll: { paddingBottom: 50 },

  bgBlob: { position: "absolute", width: 400, height: 400, borderRadius: 200, top: -100, right: -100 },

  loadingIcon: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  loadingText: { fontSize: 18, color: "#6366F1", fontWeight: "700" },
  backAction: { marginTop: 24, backgroundColor: "#EEF2FF", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  backActionText: { color: "#4F46E5", fontWeight: "700", fontSize: 16 },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  backBtn: { borderRadius: 16, overflow: "hidden" },
  backGrad: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  headerOverline: { fontSize: 10, fontWeight: "800", color: "#6366F1", letterSpacing: 2 },
  headerTitle: { fontSize: 28, fontWeight: "900", color: "#0f172a", letterSpacing: -1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 11, fontWeight: "800" },

  heroCard: { marginHorizontal: 20, borderRadius: 28, overflow: "hidden", marginBottom: 20, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 10 },
  heroGrad: { padding: 32, alignItems: "center" },
  heroDeco1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -60 },
  heroDeco2: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)", bottom: -30, left: -30 },
  heroContent: { alignItems: "center" },
  heroIconWrap: { marginBottom: 20 },
  heroIconCircle: { width: 96, height: 96, borderRadius: 32, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  heroStatus: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: -1, marginBottom: 8 },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", textAlign: "center" },

  sensorRow: { flexDirection: "row", gap: 14, marginHorizontal: 20, marginBottom: 16 },
  sensorCard: { flex: 1, backgroundColor: "#fff", borderRadius: 22, padding: 18, shadowColor: "#6366F1", shadowOpacity: 0.07, shadowRadius: 12, elevation: 4 },
  sensorTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  sensorIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  sensorLabel: { fontSize: 13, fontWeight: "700", color: "#64748b" },
  sensorVal: { fontSize: 32, fontWeight: "900", color: "#0f172a", letterSpacing: -1, marginBottom: 10 },
  sensorUnit: { fontSize: 14, color: "#94a3b8", fontWeight: "600" },
  bar: { height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 4, minWidth: 4 },

  controlRow: { flexDirection: "row", gap: 14, marginHorizontal: 20, marginBottom: 16 },
  controlCard: { flex: 1, backgroundColor: "#fff", borderRadius: 22, padding: 20, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 },
  controlIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  controlLabel: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginBottom: 4 },
  controlVal: { fontSize: 16, fontWeight: "800" },

  buzzerBanner: { marginHorizontal: 20, marginBottom: 16, borderRadius: 20, overflow: "hidden" },
  buzzerGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 18 },
  buzzerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  buzzerIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buzzerTitle: { fontSize: 16, fontWeight: "800", color: "#DC2626" },
  buzzerSub: { fontSize: 12, color: "#EF4444", fontWeight: "600", marginTop: 2 },
  dismissBtn: { backgroundColor: "#EF4444", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  dismissText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  lastUpdate: { textAlign: "center", fontSize: 12, color: "#94a3b8", fontWeight: "600", marginBottom: 20, marginHorizontal: 20 },

  releaseWrap: { paddingHorizontal: 20 },
  releaseBtn: { borderRadius: 22, overflow: "hidden", shadowColor: "#EF4444", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  releaseGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 22 },
  releaseIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  releaseText: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
});