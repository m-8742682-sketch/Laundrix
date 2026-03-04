/**
 * GraceAlarmModal — FIXED
 *
 * Bugs fixed:
 * 1. Sound effect no longer calls stopSound() in the else-branch or cleanup unconditionally.
 *    stopSound() is ONLY called as cleanup when THIS effect was the one that started the sound.
 *    This prevents the rapid stop/start race that silenced the alarm for regular users.
 * 2. isAdmin is read inside the handler via a ref so it never goes stale in the closure.
 *
 * RTDB structure:
 *   gracePeriods/{machineId}/
 *     status      : "active"
 *     userId      : string
 *     userName    : string
 *     expiresAt   : ISO string
 *     startedAt   : ISO string
 *     {uid}/
 *       ringSilenced : boolean
 *       dismissed    : boolean
 */

import React, { useEffect, useState, useCallback, useRef as useReactRef } from "react";
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Easing,
  Vibration, StatusBar,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getDatabase, onValue, off, ref, update } from "firebase/database";
import { playSound, stopSound } from "@/services/soundState";
import { useUser } from "@/components/UserContext";

type GraceData = {
  machineId: string;
  userId: string;
  userName: string;
  expiresAt: string;
  startedAt: string;
  iDismissed: boolean;
  iSilenced: boolean;
};

export default function GraceAlarmModal() {
  const { user } = useUser();

  const [grace, setGrace] = useState<GraceData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const tickerRef    = useReactRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim    = useReactRef(new Animated.Value(1)).current;
  const shakeAnim    = useReactRef(new Animated.Value(0)).current;
  const ringAnim     = useReactRef(new Animated.Value(0)).current;
  // Keep isAdmin fresh inside the RTDB handler without re-subscribing
  const isAdminRef   = useReactRef(false);

  const isAdmin  = user?.role === "admin";
  const isMyTurn = !!grace && grace.userId === user?.uid;
  const visible  = !!grace && !grace.iDismissed && (isMyTurn || isAdmin);
  const silenced = grace?.iSilenced ?? false;
  const isUrgent = secondsLeft <= 60;

  // Keep ref in sync
  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

  // ── Subscribe RTDB ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const myUid = user.uid;
    const db    = getDatabase();
    const rootRef = ref(db, "gracePeriods");

    const handler = (snapshot: any) => {
      const all = snapshot.val() as Record<string, any> | null;
      if (!all) { setGrace(null); return; }

      let found: GraceData | null = null;
      for (const [machineId, data] of Object.entries(all)) {
        if (!data || data.status !== "active") continue;
        if (!isAdminRef.current && data.userId !== myUid) continue;

        const myData     = (data as any)[myUid] ?? {};
        const iDismissed = !!myData.dismissed;
        const iSilenced  = !!myData.ringSilenced;

        found = {
          machineId,
          userId:    (data as any).userId,
          userName:  (data as any).userName || "Unknown",
          expiresAt: (data as any).expiresAt,
          startedAt: (data as any).startedAt,
          iDismissed,
          iSilenced,
        };
        break;
      }

      setGrace(found);
    };

    onValue(rootRef, handler);
    return () => off(rootRef, "value", handler);
  }, [user?.uid]); // isAdmin read via ref — no re-subscribe needed

  // ── Countdown ticker ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!grace || !visible) {
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
      setSecondsLeft(0);
      return;
    }
    const calc = () =>
      Math.max(0, Math.floor((new Date(grace.expiresAt).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => setSecondsLeft(calc()), 500);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [grace?.expiresAt, visible]);

  // ── Sound — FIX: only stopSound() in cleanup when WE started it ──────────
  useEffect(() => {
    if (visible && !silenced) {
      playSound("alarm");
      return () => stopSound(); // only clean up if we started the sound
    }
    // Do NOT call stopSound() here — graceAlarmService or another effect manages it
    return undefined;
  }, [visible, silenced]);

  // ── Vibration ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible && !silenced) {
      Vibration.vibrate([0, 500, 200, 500, 200, 500], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [visible, silenced]);

  // ── Animations ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    p.start(); return () => p.stop();
  }, [visible]);

  useEffect(() => {
    if (!isUrgent || !visible) return;
    const s = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    s.start(); return () => s.stop();
  }, [isUrgent, visible]);

  useEffect(() => {
    if (!visible || silenced) return;
    const r = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1,   duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -1,  duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.7, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0,   duration: 150, useNativeDriver: true }),
      Animated.delay(700),
    ]));
    r.start(); return () => r.stop();
  }, [visible, silenced]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSilence = useCallback(async () => {
    if (!grace || !user?.uid) return;
    stopSound();
    Vibration.cancel();
    try {
      await update(ref(getDatabase(), `gracePeriods/${grace.machineId}/${user.uid}`), {
        ringSilenced: true,
      });
    } catch {}
  }, [grace, user?.uid]);

  const handleDismiss = useCallback(async () => {
    if (!grace || !user?.uid) return;
    stopSound();
    Vibration.cancel();
    try {
      await update(ref(getDatabase(), `gracePeriods/${grace.machineId}/${user.uid}`), {
        dismissed: true,
      });
    } catch {}
  }, [grace, user?.uid]);

  const handleScan = useCallback(() => {
    if (!grace) return;
    stopSound();
    Vibration.cancel();
    router.push({ pathname: "/iot/qrscan", params: { machineId: grace.machineId } });
  }, [grace]);

  if (!visible) return null;

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "00")}`;
  const colors: [string, string] = isUrgent
    ? ["#EF4444", "#DC2626"]
    : ["#F59E0B", "#D97706"];
  const ringRot = ringAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ["-15deg", "15deg"],
  });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={ss.backdrop}>
        <Animated.View style={[ss.card, { transform: [{ translateX: shakeAnim }] }]}>

          {/* ── Header ── */}
          <LinearGradient colors={colors} style={ss.header}>
            <View style={ss.deco1} />
            <View style={ss.deco2} />

            <Pressable
              style={ss.closeBtn}
              onPress={handleDismiss}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>

            <Animated.View style={{ transform: [{ rotate: ringRot }] }}>
              <View style={ss.bellCircle}>
                <Ionicons
                  name={silenced ? "notifications-off" : "notifications"}
                  size={40}
                  color="#fff"
                />
              </View>
            </Animated.View>

            <Text style={ss.title}>
              {silenced ? "⏰ Time Running Out" : isMyTurn ? "🎉 Your Turn!" : "🔔 User's Turn"}
            </Text>
            <Text style={ss.sub}>
              {isAdmin && !isMyTurn
                ? `${grace.userName}  ·  Machine ${grace.machineId}`
                : `Machine ${grace.machineId} is ready for you`}
            </Text>

            {isAdmin && !isMyTurn && (
              <View style={ss.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={ss.adminBadgeText}>Admin View</Text>
              </View>
            )}
          </LinearGradient>

          {/* ── Body ── */}
          <View style={ss.body}>
            <Text style={ss.label}>TIME REMAINING</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[ss.countdown, { color: isUrgent ? "#EF4444" : "#D97706" }]}>
                {fmt(secondsLeft)}
              </Text>
            </Animated.View>
            <View style={ss.bar}>
              <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[ss.barFill, { width: `${Math.min(100, (secondsLeft / 300) * 100)}%` as any }]}
              />
            </View>
            <Text style={ss.hint}>
              {isUrgent ? "⚠️ Less than 1 minute!" : "You have 5 minutes to scan in"}
            </Text>

            {isMyTurn && (
              <Pressable
                onPress={handleScan}
                style={({ pressed }) => [ss.scanBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient colors={["#10B981", "#059669"]} style={ss.scanGrad}>
                  <Ionicons name="qr-code" size={22} color="#fff" />
                  <Text style={ss.scanText}>Scan Machine Now</Text>
                </LinearGradient>
              </Pressable>
            )}

            {isAdmin && !isMyTurn && (
              <View style={ss.adminNote}>
                <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                <Text style={ss.adminNoteText}>Only the user can scan in</Text>
              </View>
            )}

            {!silenced ? (
              <Pressable onPress={handleSilence} style={ss.silenceBtn}>
                <LinearGradient colors={["#F1F5F9", "#E2E8F0"]} style={ss.silenceGrad}>
                  <Ionicons name="volume-mute" size={18} color="#64748b" />
                  <Text style={ss.silenceText}>Stop Ringing</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={ss.silencedRow}>
                <Ionicons name="notifications-off-outline" size={15} color="#94a3b8" />
                <Text style={ss.silencedText}>Alarm silenced</Text>
              </View>
            )}

            <Pressable onPress={handleDismiss} style={ss.dismissBtn}>
              <Text style={ss.dismissText}>Dismiss</Text>
            </Pressable>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  card: { width: "100%", maxWidth: 360, borderRadius: 32, overflow: "hidden", backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 40, elevation: 20 },
  header: { padding: 32, alignItems: "center", overflow: "hidden" },
  closeBtn: { position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  deco1: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.1)", top: -80, right: -60 },
  deco2: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.07)", bottom: -30, left: -30 },
  bellCircle: { width: 80, height: 80, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginBottom: 4 },
  sub: { fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: "600" },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  adminBadgeText: { fontSize: 11, color: "rgba(255,255,255,0.9)", fontWeight: "700" },
  body: { padding: 28, alignItems: "center" },
  label: { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1.5, marginBottom: 8 },
  countdown: { fontSize: 72, fontWeight: "900", letterSpacing: -4, marginBottom: 16 },
  bar: { width: "100%", height: 8, backgroundColor: "#F1F5F9", borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  barFill: { height: "100%", borderRadius: 4 },
  hint: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginBottom: 20 },
  scanBtn: { width: "100%", borderRadius: 20, overflow: "hidden", marginBottom: 12, shadowColor: "#10B981", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  scanGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, paddingVertical: 18 },
  scanText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  adminNote: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#F8FAFC", borderRadius: 12, width: "100%" },
  adminNoteText: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  silenceBtn: { width: "100%", borderRadius: 16, overflow: "hidden", marginBottom: 8 },
  silenceGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  silenceText: { color: "#64748b", fontSize: 15, fontWeight: "700" },
  silencedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  silencedText: { fontSize: 13, color: "#94a3b8", fontWeight: "600" },
  dismissBtn: { paddingVertical: 8, paddingHorizontal: 20 },
  dismissText: { fontSize: 13, color: "#94a3b8", fontWeight: "600", textDecorationLine: "underline" },
});
