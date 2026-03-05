/**
 * IncidentModal — Machine owner's view
 *
 * Shows when someone is using a machine reserved for the current user.
 * Owner gets "Yes, That's Me" / "No, Report It" — clear ownership confirmation.
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface IncidentModalProps {
  visible: boolean;
  machineId: string;
  intruderName: string;
  secondsLeft: number;
  onThatsMe: () => void;
  onNotMe: () => void;
  loading?: boolean;
}

export default function IncidentModal({
  visible, machineId, intruderName, secondsLeft, onThatsMe, onNotMe, loading = false,
}: IncidentModalProps) {
  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isUrgent = secondsLeft <= 15;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
      ]).start();
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      Vibration.cancel();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !isUrgent) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.04, duration: 280, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]));
    loop.start();
    if (isUrgent) Vibration.vibrate([0, 300, 200, 300]);
    return () => loop.stop();
  }, [visible, isUrgent]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const headerColors: [string, string] = isUrgent ? ['#DC2626', '#B91C1C'] : ['#F59E0B', '#D97706'];
  const progress = Math.min(1, secondsLeft / 60);

  const handleThatsMe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onThatsMe();
  };

  const handleNotMe = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onNotMe();
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ss.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[ss.card, { transform: [{ translateY: slideAnim }, { scale: isUrgent ? pulseAnim : 1 }] }]}>

          {/* Header */}
          <LinearGradient colors={headerColors} style={ss.header}>
            <View style={ss.deco1} /><View style={ss.deco2} />
            <View style={ss.iconCircle}>
              <Ionicons name="warning" size={30} color="#fff" />
            </View>
            <Text style={ss.title}>🚨 Someone's at Your Machine</Text>
            <Text style={ss.sub}>Machine {machineId} • Is this you?</Text>
          </LinearGradient>

          {/* Body */}
          <View style={ss.body}>
            {/* Who is it */}
            <View style={ss.personCard}>
              <View style={ss.personIcon}>
                <Ionicons name="person" size={22} color="#6366F1" />
              </View>
              <View style={ss.personInfo}>
                <Text style={ss.personLabel}>PERSON DETECTED</Text>
                <Text style={ss.personName}>{intruderName}</Text>
              </View>
            </View>

            {/* Countdown */}
            <View style={ss.countdownWrap}>
              <Text style={ss.countdownLabel}>Respond within</Text>
              <Text style={[ss.countdownValue, isUrgent && ss.countdownUrgent]}>{fmt(secondsLeft)}</Text>
              {/* Progress bar */}
              <View style={ss.bar}>
                <Animated.View style={[ss.barFill, { backgroundColor: isUrgent ? '#DC2626' : '#F59E0B', width: `${progress * 100}%` as any }]} />
              </View>
              {isUrgent && <Text style={ss.urgentNote}>⚠️ Auto-alert triggering soon</Text>}
            </View>

            {/* Buttons */}
            <View style={ss.actions}>
              <Pressable
                onPress={handleThatsMe}
                disabled={loading}
                style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
              >
                <LinearGradient colors={['#10B981', '#059669']} style={ss.btnGrad}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={ss.btnText}>Yes, That's Me</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleNotMe}
                disabled={loading}
                style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
              >
                <LinearGradient colors={['#EF4444', '#DC2626']} style={ss.btnGrad}>
                  <Ionicons name="shield-checkmark" size={20} color="#fff" />
                  <Text style={ss.btnText}>No — Report Intruder</Text>
                </LinearGradient>
              </Pressable>
            </View>

            {loading && <Text style={ss.loadingText}>Processing…</Text>}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:           { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.35, shadowRadius: 40, elevation: 20 },
  header:         { padding: 28, alignItems: 'center', overflow: 'hidden' },
  deco1:          { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -70, right: -50 },
  deco2:          { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -25, left: -25 },
  iconCircle:     { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title:          { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:            { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 4, fontWeight: '600' },
  body:           { padding: 24 },
  personCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  personIcon:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  personInfo:     { flex: 1 },
  personLabel:    { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8 },
  personName:     { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  countdownWrap:  { alignItems: 'center', marginBottom: 22 },
  countdownLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  countdownValue: { fontSize: 52, fontWeight: '800', color: '#0F172A', letterSpacing: -1, marginBottom: 10, fontVariant: ['tabular-nums'] },
  countdownUrgent: { color: '#DC2626' },
  bar:            { width: '100%', height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  barFill:        { height: '100%', borderRadius: 3 },
  urgentNote:     { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  actions:        { gap: 10 },
  btn:            { borderRadius: 16, overflow: 'hidden' },
  btnGrad:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnText:        { color: '#fff', fontSize: 16, fontWeight: '800' },
  pressed:        { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled:       { opacity: 0.5 },
  loadingText:    { textAlign: 'center', marginTop: 10, color: '#64748B', fontWeight: '600' },
});
