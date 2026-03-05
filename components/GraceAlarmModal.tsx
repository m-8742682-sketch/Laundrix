/**
 * GraceAlarmModal — Fixed first-load timing issue
 *
 * Root cause of "first open doesn't show":
 *   UserContext.user starts as null, then sets to real user.
 *   The RTDB listener starts with uid = '' which immediately returns nothing,
 *   then uid changes to the real UID, but sometimes the subscription misses
 *   the initial RTDB value if data was already loaded.
 *
 * Fix: use a 'ready' flag + onValue fires immediately with current data,
 *       so re-subscribing when uid is valid always captures the current state.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, Animated, Easing, Vibration, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getDatabase, onValue, off, ref, update } from 'firebase/database';
import { playSound, stopSound } from '@/services/soundState';
import { graceAlarmService } from '@/services/graceAlarmService';
import { useUser } from '@/components/UserContext';

type GraceNodeData = {
  machineId:    string;
  userId:       string;
  userName:     string;
  expiresAt:    string;
  startedAt:    string;
  status:       string;
  ringSilenced: boolean;
  dismissed:    boolean;
};

export default function GraceAlarmModal() {
  const { user } = useUser();

  const [graceData, setGraceData]     = useState<GraceNodeData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // FIX: isReady prevents rendering before user context is loaded
  const [isReady, setIsReady]         = useState(false);
  // FIX (Bug 1): Track dismissed in LOCAL state only — never read from RTDB.
  // This ensures grace ALWAYS shows on app restart (even if user dismissed it
  // last session). Dismissed is session-scoped; ringSilenced remains in RTDB.
  const [isDismissed, setIsDismissed] = useState(false);
  const lastGraceKeyRef               = useRef<string | null>(null);

  const activeAlarmKeyRef = useRef<string | null>(null);
  const tickerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;

  const isAdmin  = user?.role === 'admin';
  const uid      = user?.uid ?? '';

  const graceEnded = !graceData || graceData.status === 'claimed' || graceData.status === 'expired';
  const isMyTurn   = !!graceData && graceData.userId === uid;
  // FIX (Bug 1): Use local isDismissed — NOT graceData.dismissed from RTDB.
  // Dismissed resets every session so grace re-appears after app restart.
  const shouldShow = isReady && !graceEnded && (isMyTurn || isAdmin) && !isDismissed;
  const silenced   = graceData?.ringSilenced ?? false;
  const isUrgent   = secondsLeft > 0 && secondsLeft <= 60;

  // FIX (Bug 1): Reset local dismissed whenever a genuinely new grace arrives
  // (different machineId or expiresAt = brand new grace period).
  useEffect(() => {
    if (!graceData) return;
    const key = `${graceData.machineId}::${graceData.expiresAt}`;
    if (key !== lastGraceKeyRef.current) {
      lastGraceKeyRef.current = key;
      setIsDismissed(false);   // new grace → always show
    }
  }, [graceData?.machineId, graceData?.expiresAt]);

  // FIX: Only subscribe when uid is non-empty
  useEffect(() => {
    if (!uid) {
      setIsReady(false);
      setGraceData(null);
      graceAlarmService.set(null);
      return;
    }

    const db      = getDatabase();
    const rootRef = ref(db, 'gracePeriods');

    const handler = (snapshot: any) => {
      setIsReady(true); // mark ready once we get any RTDB response

      const all = snapshot.val() as Record<string, any> | null;
      if (!all) {
        setGraceData(null);
        graceAlarmService.set(null);
        return;
      }

      let found: { machineId: string; data: any } | null = null;
      for (const [machineId, data] of Object.entries(all)) {
        if (!data || data.status !== 'active') continue;
        if (!isAdmin && data.userId !== uid) continue;
        if (!found) found = { machineId, data };
      }

      if (!found) {
        setGraceData(null);
        graceAlarmService.set(null);
        return;
      }

      const { machineId, data } = found;
      const perUser = (data.perUser ?? {})[uid] ?? {};

      setGraceData({
        machineId,
        userId:       data.userId,
        userName:     data.userName || 'Unknown',
        expiresAt:    data.expiresAt,
        startedAt:    data.startedAt,
        status:       data.status,
        ringSilenced: !!perUser.ringSilenced,
        dismissed:    !!perUser.dismissed,
      });

      graceAlarmService.set({
        active: true, machineId,
        userId:    data.userId,
        userName:  data.userName || 'Unknown',
        expiresAt: data.expiresAt,
        startedAt: data.startedAt,
      });
    };

    onValue(rootRef, handler);
    return () => {
      off(rootRef, 'value', handler);
      graceAlarmService.set(null);
    };
  }, [uid, isAdmin]);

  // Alarm
  useEffect(() => {
    if (!graceData) { stopSound(); Vibration.cancel(); activeAlarmKeyRef.current = null; return; }
    const alarmKey = `${graceData.machineId}::${graceData.expiresAt}`;

    if (graceEnded || !shouldShow || silenced) {
      stopSound(); Vibration.cancel();
      return;
    }

    if (activeAlarmKeyRef.current !== alarmKey) {
      activeAlarmKeyRef.current = alarmKey;
      playSound('alarm');
      Vibration.vibrate([0, 500, 200, 500, 200, 500], true);
    }
    return () => {
      if (activeAlarmKeyRef.current === alarmKey) { stopSound(); Vibration.cancel(); }
    };
  }, [graceData, graceEnded, shouldShow, silenced]);

  // Countdown
  useEffect(() => {
    if (!graceData || graceEnded) {
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
      setSecondsLeft(0);
      return;
    }
    const calc = () => Math.max(0, Math.floor((new Date(graceData.expiresAt).getTime() - Date.now()) / 1000));
    setSecondsLeft(calc());
    tickerRef.current = setInterval(() => setSecondsLeft(calc()), 500);
    return () => { if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; } };
  }, [graceData?.expiresAt, graceEnded]);

  // Pulse animation
  useEffect(() => {
    if (!shouldShow) return;
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [shouldShow]);

  // Urgent shake
  useEffect(() => {
    if (!isUrgent || !shouldShow) return;
    const s = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    s.start();
    return () => s.stop();
  }, [isUrgent, shouldShow]);

  // Bell animation
  useEffect(() => {
    if (!shouldShow || silenced) return;
    const r = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -1, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.7, duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.delay(700),
    ]));
    r.start();
    return () => r.stop();
  }, [shouldShow, silenced]);

  const handleSilence = useCallback(async () => {
    if (!graceData || !uid) return;
    stopSound(); Vibration.cancel();
    try { await update(ref(getDatabase(), `gracePeriods/${graceData.machineId}/perUser/${uid}`), { ringSilenced: true }); } catch {}
  }, [graceData, uid]);

  const handleDismiss = useCallback(async () => {
    if (!graceData || !uid) return;
    stopSound(); Vibration.cancel();
    graceAlarmService.set(null);
    setIsDismissed(true);   // local dismiss — resets on next app launch
    // Still write to RTDB so ringSilenced is persisted cross-device
    try { await update(ref(getDatabase(), `gracePeriods/${graceData.machineId}/perUser/${uid}`), { dismissed: true, ringSilenced: true }); } catch {}
  }, [graceData, uid]);

  const handleScan = useCallback(async () => {
    if (!graceData) return;
    stopSound(); Vibration.cancel();
    graceAlarmService.set(null);
    setIsDismissed(true);
    if (uid) {
      try { await update(ref(getDatabase(), `gracePeriods/${graceData.machineId}/perUser/${uid}`), { dismissed: true, ringSilenced: true }); } catch {}
    }
    router.push({ pathname: '/iot/qrscan', params: { machineId: graceData.machineId } });
  }, [graceData, uid]);

  if (!shouldShow) return null;

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const colors: [string, string] = isUrgent ? ['#EF4444', '#DC2626'] : ['#F59E0B', '#D97706'];
  const ringRot = ringAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '15deg'] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={ss.backdrop}>
        <Animated.View style={[ss.card, { transform: [{ translateX: shakeAnim }] }]}>

          <LinearGradient colors={colors} style={ss.header}>
            <View style={ss.deco1} />
            <View style={ss.deco2} />

            <Pressable style={ss.closeBtn} onPress={handleDismiss} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>

            <Animated.View style={{ transform: [{ rotate: ringRot }] }}>
              <View style={ss.bellCircle}>
                <Ionicons name={silenced ? 'notifications-off' : 'notifications'} size={40} color="#fff" />
              </View>
            </Animated.View>

            <Text style={ss.title}>
              {silenced ? '⏰ Time Running Out' : isMyTurn ? '🎉 Your Turn!' : "🔔 User's Turn"}
            </Text>
            <Text style={ss.sub}>
              {isAdmin && !isMyTurn
                ? `${graceData!.userName}  ·  Machine ${graceData!.machineId}`
                : `Machine ${graceData!.machineId} is ready`}
            </Text>

            {isAdmin && !isMyTurn && (
              <View style={ss.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={ss.adminBadgeText}>Admin View</Text>
              </View>
            )}
          </LinearGradient>

          <View style={ss.body}>
            <Text style={ss.label}>TIME REMAINING</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[ss.countdown, { color: isUrgent ? '#EF4444' : '#D97706' }]}>
                {fmt(secondsLeft)}
              </Text>
            </Animated.View>
            <View style={ss.bar}>
              <LinearGradient
                colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[ss.barFill, { width: `${Math.min(100, (secondsLeft / 300) * 100)}%` as any }]}
              />
            </View>
            <Text style={ss.hint}>
              {isUrgent ? '⚠️ Less than 1 minute!' : 'You have 5 minutes to scan in'}
            </Text>

            {isMyTurn && (
              <Pressable onPress={handleScan} style={({ pressed }) => [ss.scanBtn, pressed && { opacity: 0.85 }]}>
                <LinearGradient colors={['#10B981', '#059669']} style={ss.scanGrad}>
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
                <LinearGradient colors={['#F1F5F9', '#E2E8F0']} style={ss.silenceGrad}>
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
  backdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:           { width: '100%', maxWidth: 360, borderRadius: 32, overflow: 'hidden', backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 40, elevation: 20 },
  header:         { padding: 32, alignItems: 'center', overflow: 'hidden' },
  closeBtn:       { position: 'absolute', top: 14, right: 14, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  deco1:          { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)', top: -80, right: -60 },
  deco2:          { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -30, left: -30 },
  bellCircle:     { width: 80, height: 80, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:          { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4 },
  sub:            { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  adminBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  adminBadgeText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  body:           { padding: 28, alignItems: 'center' },
  label:          { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 8 },
  countdown:      { fontSize: 72, fontWeight: '900', letterSpacing: -4, marginBottom: 16, fontVariant: ['tabular-nums'] },
  bar:            { width: '100%', height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill:        { height: '100%', borderRadius: 4 },
  hint:           { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 20 },
  scanBtn:        { width: '100%', borderRadius: 20, overflow: 'hidden', marginBottom: 12, shadowColor: '#10B981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  scanGrad:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  scanText:       { color: '#fff', fontSize: 18, fontWeight: '900' },
  adminNote:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 12, width: '100%' },
  adminNoteText:  { fontSize: 12, color: '#64748b', fontWeight: '600' },
  silenceBtn:     { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  silenceGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  silenceText:    { color: '#64748b', fontSize: 15, fontWeight: '700' },
  silencedRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  silencedText:   { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  dismissBtn:     { paddingVertical: 8, paddingHorizontal: 20 },
  dismissText:    { fontSize: 13, color: '#94a3b8', fontWeight: '600', textDecorationLine: 'underline' },
});
