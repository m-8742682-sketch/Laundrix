/**
 * ClothesGraceModal
 *
 * Shown when RTDB clothesGrace/{machineId}/status === 'active' for the current user.
 * Admins also see it in monitoring mode (no dismiss-to-collecting button for them).
 *
 * On dismiss (any button / X):
 *   - Stops the alarm locally
 *   - Calls POST /api/clothes-collect → transitions RTDB status to 'collecting'
 *   - Queue screen reacts: "Currently In Use" → "Collecting clothes"
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Modal, Pressable, StatusBar, StyleSheet, Text, View, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getDatabase, onValue, off, ref, update } from 'firebase/database';
import { playSound, stopSound } from '@/services/soundState';
import { useUser } from '@/components/UserContext';
import { acknowledgeClothesCollection } from '@/services/api';

type ClothesGraceData = {
  machineId:   string;
  userId:      string;
  userName:    string;
  expiresAt:   string;
  startedAt:   string;
  status:      string;
  warningSent: boolean;
};

export default function ClothesGraceModal() {
  const { user } = useUser();
  const uid      = user?.uid ?? '';
  const isAdmin  = user?.role === 'admin';

  const [graceData, setGraceData]     = useState<ClothesGraceData | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isReady, setIsReady]         = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const lastKeyRef    = useRef<string | null>(null);
  const alarmKeyRef   = useRef<string | null>(null);
  const tickerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingRef    = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim  = useRef(new Animated.Value(0)).current;

  const graceEnded = !graceData
    || graceData.status === 'collecting'
    || graceData.status === 'expired';

  const isMyGrace  = !!graceData && graceData.userId === uid;
  const shouldShow = isReady && !graceEnded && !isDismissed && (isMyGrace || isAdmin);
  const isUrgent   = secondsLeft > 0 && secondsLeft <= 60;

  // Reset dismissed when a new grace arrives
  useEffect(() => {
    if (!graceData) return;
    const key = `${graceData.machineId}::${graceData.expiresAt}`;
    if (key !== lastKeyRef.current) {
      lastKeyRef.current = key;
      setIsDismissed(false);
    }
  }, [graceData?.machineId, graceData?.expiresAt]);

  // RTDB subscription
  useEffect(() => {
    if (!uid) { setIsReady(false); setGraceData(null); return; }

    const db      = getDatabase();
    const rootRef = ref(db, 'clothesGrace');

    const handler = (snapshot: any) => {
      setIsReady(true);
      const all = snapshot.val() as Record<string, any> | null;
      if (!all) { setGraceData(null); return; }

      let found: { machineId: string; data: any } | null = null;
      for (const [machineId, data] of Object.entries(all)) {
        if (!data || data.status === 'expired') continue;
        if (!isAdmin && data.userId !== uid) continue;
        if (!found) found = { machineId, data };
      }

      if (!found) { setGraceData(null); return; }

      setGraceData({
        machineId:   found.machineId,
        userId:      found.data.userId,
        userName:    found.data.userName || 'Unknown',
        expiresAt:   found.data.expiresAt,
        startedAt:   found.data.startedAt,
        status:      found.data.status,
        warningSent: !!found.data.warningSent,
      });
    };

    onValue(rootRef, handler);
    return () => { off(rootRef, 'value', handler); };
  }, [uid, isAdmin]);

  // Alarm
  useEffect(() => {
    if (!graceData) { stopSound(); Vibration.cancel(); alarmKeyRef.current = null; return; }
    const key = `${graceData.machineId}::${graceData.expiresAt}`;
    if (graceEnded || !shouldShow) { stopSound(); Vibration.cancel(); return; }
    if (alarmKeyRef.current !== key) {
      alarmKeyRef.current = key;
      playSound('alarm');
      Vibration.vibrate([0, 500, 200, 500, 200, 500], true);
    }
    return () => { if (alarmKeyRef.current === key) { stopSound(); Vibration.cancel(); } };
  }, [graceData, graceEnded, shouldShow]);

  // Countdown ticker
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

  // Pulse
  useEffect(() => {
    if (!shouldShow) return;
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    p.start();
    return () => p.stop();
  }, [shouldShow]);

  // Urgent shake
  useEffect(() => {
    if (!isUrgent || !shouldShow) return;
    const s = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
      Animated.delay(600),
    ]));
    s.start();
    return () => s.stop();
  }, [isUrgent, shouldShow]);

  // Bell ring
  useEffect(() => {
    if (!shouldShow) return;
    const r = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1,    duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -1,   duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0.7,  duration: 150, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0,    duration: 150, useNativeDriver: true }),
      Animated.delay(700),
    ]));
    r.start();
    return () => r.stop();
  }, [shouldShow]);

  // Dismiss → calls backend to transition status to 'collecting'
  const handleDismiss = useCallback(async () => {
    if (!graceData || pendingRef.current) return;
    stopSound(); Vibration.cancel();
    setIsDismissed(true);

    // Only the actual user transitions to 'collecting' — admins just dismiss locally
    if (isMyGrace && uid) {
      pendingRef.current = true;
      try {
        await acknowledgeClothesCollection(graceData.machineId, uid);
      } catch (err) {
        console.warn('[ClothesGraceModal] acknowledge failed:', err);
        // Fallback: write directly to RTDB
        try {
          await update(ref(getDatabase(), `clothesGrace/${graceData.machineId}`), {
            status: 'collecting',
            collectingAt: new Date().toISOString(),
          });
        } catch {}
      } finally {
        pendingRef.current = false;
      }
    }
  }, [graceData, uid, isMyGrace]);

  if (!shouldShow) return null;

  const fmt    = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const colors: [string, string] = isUrgent ? ['#EF4444', '#DC2626'] : ['#06B6D4', '#0284C7'];
  const ringRot = ringAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '15deg'] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={ss.backdrop}>
        <Animated.View style={[ss.card, { transform: [{ translateX: shakeAnim }] }]}>

          <LinearGradient colors={colors} style={ss.header}>
            <View style={ss.deco1} />
            <View style={ss.deco2} />

            {/* Close / dismiss button */}
            <Pressable style={ss.closeBtn} onPress={handleDismiss} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>

            <Animated.View style={{ transform: [{ rotate: ringRot }] }}>
              <View style={ss.iconCircle}>
                <Ionicons name="shirt" size={40} color="#fff" />
              </View>
            </Animated.View>

            <Text style={ss.title}>
              {isMyGrace ? '👕 Collect Your Clothes!' : `👁️ ${graceData!.userName}'s Laundry Done`}
            </Text>
            <Text style={ss.sub}>
              {isAdmin && !isMyGrace
                ? `Machine ${graceData!.machineId} · Monitoring`
                : `Machine ${graceData!.machineId} is waiting`}
            </Text>

            {isAdmin && !isMyGrace && (
              <View style={ss.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={ss.adminBadgeText}>Admin View</Text>
              </View>
            )}
          </LinearGradient>

          <View style={ss.body}>
            <Text style={ss.label}>TIME TO COLLECT</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[ss.countdown, { color: isUrgent ? '#EF4444' : '#0284C7' }]}>
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
              {isUrgent ? '⚠️ Less than 1 minute left!' : 'You have 5 minutes to collect your laundry'}
            </Text>

            {isMyGrace && (
              <Pressable onPress={handleDismiss} style={({ pressed }) => [ss.collectBtn, pressed && { opacity: 0.85 }]}>
                <LinearGradient colors={['#06B6D4', '#0284C7']} style={ss.collectGrad}>
                  <Ionicons name="checkmark-circle" size={22} color="#fff" />
                  <Text style={ss.collectText}>On My Way!</Text>
                </LinearGradient>
              </Pressable>
            )}

            {isAdmin && !isMyGrace && (
              <View style={ss.adminNote}>
                <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                <Text style={ss.adminNoteText}>Waiting for user to collect clothes</Text>
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
  iconCircle:     { width: 80, height: 80, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title:          { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5, marginBottom: 4, textAlign: 'center' },
  sub:            { fontSize: 14, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  adminBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  adminBadgeText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  body:           { padding: 28, alignItems: 'center' },
  label:          { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 8 },
  countdown:      { fontSize: 72, fontWeight: '900', letterSpacing: -4, marginBottom: 16, fontVariant: ['tabular-nums'] as any },
  bar:            { width: '100%', height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill:        { height: '100%', borderRadius: 4 },
  hint:           { fontSize: 12, color: '#94a3b8', fontWeight: '600', marginBottom: 20 },
  collectBtn:     { width: '100%', borderRadius: 20, overflow: 'hidden', marginBottom: 12, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  collectGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  collectText:    { color: '#fff', fontSize: 18, fontWeight: '900' },
  adminNote:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#F8FAFC', borderRadius: 12, width: '100%' },
  adminNoteText:  { fontSize: 12, color: '#64748b', fontWeight: '600' },
  dismissBtn:     { paddingVertical: 8, paddingHorizontal: 20 },
  dismissText:    { fontSize: 13, color: '#94a3b8', fontWeight: '600', textDecorationLine: 'underline' },
});
