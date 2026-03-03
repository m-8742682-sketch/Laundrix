/**
 * GraceAlarmModal — FULLY SELF-CONTAINED
 *
 * Fix #3: Uses graceAlarmService directly — no props needed.
 *         Global state (AsyncStorage backed), persists across restarts.
 *         - Alarm rings at the START of grace period ("It's Your Turn!")
 *         - "Stop Ringing" silences sound but countdown continues
 *         - If user scans → alarm fully clears
 *         - If timer expires → expired notification + clear
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Easing,
  Vibration, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { graceAlarmService, GraceAlarmState } from "@/services/graceAlarmService";
import { useUser } from "@/components/UserContext";
import { useI18n } from "@/i18n/i18n";

export default function GraceAlarmModal() {
  const { user } = useUser();
  const { t } = useI18n();
  const [alarmState, setAlarmState] = useState<GraceAlarmState | null>(graceAlarmService.getState());
  const [secondsLeft, setSecondsLeft] = useState(graceAlarmService.getSecondsLeft());
  const [isHidden, setIsHidden] = useState(false);
  // Track which grace period startedAt was dismissed — only re-show for genuinely NEW ones
  const dismissedStartedAtRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // Subscribe to graceAlarmService state
  useEffect(() => {
    const unsubscribe = graceAlarmService.subscribe((state) => {
      setAlarmState(state);
      setSecondsLeft(graceAlarmService.getSecondsLeft());
      if (!state?.active) {
        // Grace cleared — reset hidden so modal is ready for next grace
        setIsHidden(false);
        dismissedStartedAtRef.current = null;
      } else if (state.active && state.startedAt !== dismissedStartedAtRef.current) {
        // New grace period (different startedAt) — always show
        setIsHidden(false);
      }
    });
    return unsubscribe;
  }, []);

  // Keep secondsLeft in sync every second when alarm is active
  useEffect(() => {
    if (!alarmState?.active) return;
    const interval = setInterval(() => {
      setSecondsLeft(graceAlarmService.getSecondsLeft());
    }, 500);
    return () => clearInterval(interval);
  }, [alarmState?.active]);

  const isMyTurn = !!alarmState && !!user?.uid && alarmState.userId === user.uid;
  const visible = isMyTurn && !isHidden;
  const isUrgent = secondsLeft <= 60;
  const alarmSilenced = alarmState?.ringSilenced ?? false;

  // Pulse animation
  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [visible]);

  // Shake when urgent
  useEffect(() => {
    if (!isUrgent || !visible) return;
    const shake = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    shake.start();
    return () => shake.stop();
  }, [isUrgent, visible]);

  // Bell ring animation — only when not silenced
  useEffect(() => {
    if (!visible || alarmSilenced) return;
    const ring = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -1, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.7, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.delay(700),
    ]));
    ring.start();
    return () => ring.stop();
  }, [visible, alarmSilenced]);

  // Fully dismiss: clear alarm GLOBALLY (all screens see it gone)
  const handleFullDismiss = useCallback(async () => {
    dismissedStartedAtRef.current = alarmState?.startedAt ?? null;
    setIsHidden(true);
    // Clear globally so dashboard, queue, admin all dismiss simultaneously
    await graceAlarmService.clear();
    Vibration.cancel();
    Vibration.cancel(); // Call twice to ensure Android cancels
  }, [alarmState?.startedAt]);

  const handleSilence = useCallback(async () => {
    await graceAlarmService.silenceRing();
    Vibration.cancel();
  }, []);

  const handleScanNow = useCallback(() => {
    // Fully dismiss: clear globally, hide modal
    dismissedStartedAtRef.current = alarmState?.startedAt ?? null;
    setIsHidden(true);
    graceAlarmService.clear().catch(() => {});
    Vibration.cancel();
    if (alarmState?.machineId) {
      router.push({ pathname: "/iot/qrscan", params: { machineId: alarmState.machineId } });
    } else {
      router.push("/iot/qrscan");
    }
  }, [alarmState?.machineId, alarmState?.startedAt]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const ringRotate = ringAnim.interpolate({ inputRange: [-1, 1], outputRange: ["-15deg", "15deg"] });
  const colors: [string, string] = isUrgent
    ? ["#EF4444", "#DC2626"]
    : ["#F59E0B", "#D97706"];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={ss.backdrop}>
        <Animated.View style={[ss.card, { transform: [{ translateX: shakeAnim }] }]}>
          <LinearGradient colors={colors} style={ss.headerBand}>
            {/* Decorative circles */}
            <View style={ss.deco1} />
            <View style={ss.deco2} />

            {/* X dismiss button — fully silences ring and hides modal */}
            <Pressable
              style={ss.closeBtn}
              onPress={handleFullDismiss}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>

            {/* Bell icon with ring animation */}
            <Animated.View style={{ transform: [{ rotate: ringRotate }] }}>
              <View style={ss.bellCircle}>
                <Ionicons name={alarmSilenced ? "notifications-off" : "notifications"} size={40} color="#fff" />
              </View>
            </Animated.View>

            <Text style={ss.headerTitle}>
              {alarmSilenced ? t.graceTimeRunningOut : t.graceYourTurn}
            </Text>
            <Text style={ss.headerSub}>
              {t.machine} {alarmState?.machineId ?? "—"} {t.graceMachineReady}
            </Text>
          </LinearGradient>

          <View style={ss.body}>
            {/* Countdown display */}
            <Text style={ss.countdownLabel}>{t.graceTimeRemaining}</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[ss.countdown, { color: isUrgent ? "#EF4444" : "#D97706" }]}>
                {formatTime(secondsLeft)}
              </Text>
            </Animated.View>
            <View style={ss.progressBar}>
              <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[ss.progressFill, { width: `${Math.min(100, Math.max(0, (secondsLeft / 300) * 100))}%` as any }]}
              />
            </View>
            <Text style={ss.progressHint}>
              {isUrgent ? t.graceUrgentWarning : t.graceFiveMinute}
            </Text>

            {/* Scan Now button */}
            <Pressable onPress={handleScanNow} style={({ pressed }) => [ss.scanBtn, pressed && { opacity: 0.9 }]}>
              <LinearGradient colors={["#10B981", "#059669"]} style={ss.scanGrad}>
                <Ionicons name="qr-code" size={22} color="#fff" />
                <Text style={ss.scanText}>{t.graceScanMachineNow}</Text>
              </LinearGradient>
            </Pressable>

            {/* Stop Ringing / Silenced notice */}
            {!alarmSilenced ? (
              <Pressable onPress={handleSilence} style={ss.silenceBtn}>
                <LinearGradient colors={["#F1F5F9", "#E2E8F0"]} style={ss.silenceGrad}>
                  <Ionicons name="volume-mute" size={18} color="#64748b" />
                  <Text style={ss.silenceText}>{t.graceStopRinging}</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={ss.silencedNotice}>
                <Ionicons name="notifications-off-outline" size={16} color="#94a3b8" />
                <Text style={ss.silencedText}>{t.graceAlarmSilenced}</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  headerBand: {
    padding: 32,
    alignItems: "center",
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  deco1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.1)", top: -80, right: -60,
  },
  deco2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.07)", bottom: -30, left: -30,
  },
  bellCircle: {
    width: 80, height: 80, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginBottom: 4,
  },
  headerSub: {
    fontSize: 14, color: "rgba(255,255,255,0.85)", fontWeight: "600",
  },
  body: {
    padding: 28, alignItems: "center",
  },
  countdownLabel: {
    fontSize: 12, fontWeight: "800", color: "#94a3b8",
    textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8,
  },
  countdown: {
    fontSize: 72, fontWeight: "900", letterSpacing: -4, marginBottom: 16,
  },
  progressBar: {
    width: "100%", height: 8, backgroundColor: "#F1F5F9",
    borderRadius: 4, overflow: "hidden", marginBottom: 8,
  },
  progressFill: {
    height: "100%", borderRadius: 4,
  },
  progressHint: {
    fontSize: 12, color: "#94a3b8", fontWeight: "600", marginBottom: 28,
  },
  scanBtn: {
    width: "100%", borderRadius: 20, overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#10B981", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  scanGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 12, paddingVertical: 18,
  },
  scanText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  silenceBtn: {
    width: "100%", borderRadius: 16, overflow: "hidden",
  },
  silenceGrad: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14,
  },
  silenceText: { color: "#64748b", fontSize: 15, fontWeight: "700" },
  silencedNotice: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
  },
  silencedText: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
});
