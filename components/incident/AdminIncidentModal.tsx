/**
 * AdminIncidentModal — Real-time admin alert
 *
 * Changes from original:
 * - Shows REAL-TIME as soon as incident is detected (not just after timeout)
 * - Buzzer Off button works immediately
 * - Shows who the intruder is, who the machine belongs to, live countdown
 * - Admin can take immediate action before the 60s window expires
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

export interface AdminIncidentInfo {
  incidentId: string;
  machineId: string;
  intruderName: string;
  ownerName: string;        // rightful machine owner
  secondsLeft?: number;     // live countdown (0 = timed out)
  isResolved?: boolean;
  resolvedAt?: Date;
}

export interface AdminIncidentModalProps {
  visible: boolean;
  incident: AdminIncidentInfo | null;
  onBuzzerOff: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

export default function AdminIncidentModal({
  visible, incident, onBuzzerOff, onDismiss, loading = false,
}: AdminIncidentModalProps) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const alertAnim = useRef(new Animated.Value(0)).current;

  const isTimedOut = (incident?.secondsLeft ?? 1) <= 0;
  const headerColors: [string, string] = isTimedOut
    ? ['#7C3AED', '#4F46E5']
    : ['#EF4444', '#DC2626'];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
      ]).start();

      // Urgent flash if not timed out
      if (!isTimedOut) {
        const loop = Animated.loop(Animated.sequence([
          Animated.timing(alertAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(alertAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]));
        loop.start();
      }

      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      Vibration.cancel();
    }
  }, [visible, isTimedOut]);

  const handleViewRecords = () => {
    onDismiss();
    router.push('/(tabs)/admin');
  };

  const handleBuzzerOff = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onBuzzerOff();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const alertBorderColor = alertAnim.interpolate({
    inputRange: [0, 1], outputRange: ['rgba(239,68,68,0)', 'rgba(239,68,68,0.6)'],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ss.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[ss.card, { transform: [{ translateY: slideAnim }], borderColor: alertBorderColor, borderWidth: 2 }]}>

          {/* Header */}
          <LinearGradient colors={headerColors} style={ss.header}>
            <View style={ss.deco1} /><View style={ss.deco2} />

            <View style={ss.adminRow}>
              <View style={ss.adminBadge}>
                <Ionicons name="shield-checkmark" size={12} color="rgba(255,255,255,0.9)" />
                <Text style={ss.adminBadgeText}>ADMIN</Text>
              </View>
              {!isTimedOut && (
                <View style={ss.liveBadge}>
                  <View style={ss.liveDot} />
                  <Text style={ss.liveText}>LIVE ALERT</Text>
                </View>
              )}
            </View>

            <View style={ss.iconCircle}>
              <Ionicons name={isTimedOut ? 'time' : 'warning'} size={30} color="#fff" />
            </View>

            <Text style={ss.title}>
              {isTimedOut ? 'Incident Timed Out' : '🚨 Unauthorized Access'}
            </Text>
            <Text style={ss.sub}>Machine {incident?.machineId ?? '–'}</Text>

            {/* Live countdown */}
            {!isTimedOut && typeof incident?.secondsLeft === 'number' && (
              <View style={ss.countdownPill}>
                <Ionicons name="timer-outline" size={13} color="#fff" />
                <Text style={ss.countdownText}>{fmt(incident.secondsLeft)} remaining</Text>
              </View>
            )}
          </LinearGradient>

          {/* Body */}
          <View style={ss.body}>
            {/* Intruder */}
            <View style={ss.row}>
              <InfoCard
                icon="person-circle-outline" color="#EF4444" bg="#FEF2F2"
                label="INTRUDER" value={incident?.intruderName ?? '–'} badge={isTimedOut ? 'TIMEOUT' : 'ACTIVE'}
                badgeColor={isTimedOut ? '#DC2626' : '#EF4444'}
              />
              <InfoCard
                icon="checkmark-shield-outline" color="#10B981" bg="#ECFDF5"
                label="MACHINE OWNER" value={incident?.ownerName ?? '–'}
              />
            </View>

            <Text style={ss.desc}>
              {isTimedOut
                ? 'The 60-second response window has ended. Review records and stop the buzzer if still active.'
                : 'An unauthorized person was detected. You can stop the buzzer immediately or wait for the machine owner to respond.'}
            </Text>

            {/* Actions */}
            <View style={ss.actions}>
              {/* Buzzer Off — always prominent */}
              <Pressable
                onPress={handleBuzzerOff}
                disabled={loading}
                style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
              >
                <LinearGradient colors={['#EF4444', '#DC2626']} style={ss.btnGrad}>
                  <Ionicons name="volume-mute" size={18} color="#fff" />
                  <Text style={ss.btnText}>Stop Buzzer Now</Text>
                </LinearGradient>
              </Pressable>

              {/* View Records */}
              <Pressable
                onPress={handleViewRecords}
                style={({ pressed }) => [ss.btn, pressed && ss.pressed]}
              >
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={ss.btnGrad}>
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={ss.btnText}>View Incident Records</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [ss.outlineBtn, pressed && ss.pressed]}
              >
                <Text style={ss.outlineBtnText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function InfoCard({ icon, color, bg, label, value, badge, badgeColor }: {
  icon: any; color: string; bg: string; label: string; value: string; badge?: string; badgeColor?: string;
}) {
  return (
    <View style={[ic.card, { borderColor: `${color}30` }]}>
      <View style={[ic.iconWrap, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={ic.label}>{label}</Text>
      <Text style={ic.value} numberOfLines={1}>{value}</Text>
      {badge && (
        <View style={[ic.badge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}40` }]}>
          <Text style={[ic.badgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

const ic = StyleSheet.create({
  card:       { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, gap: 4 },
  iconWrap:   { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  label:      { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8 },
  value:      { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  badge:      { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, marginTop: 4 },
  badgeText:  { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
});

const ss = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:          { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 22 },
  header:        { padding: 24, alignItems: 'center', overflow: 'hidden' },
  deco1:         { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.1)', top: -80, right: -60 },
  deco2:         { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -30, left: -30 },
  adminRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  adminBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  adminBadgeText: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.8 },
  liveBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.3)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText:      { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.8 },
  iconCircle:    { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title:         { fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:           { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4, fontWeight: '600' },
  countdownPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countdownText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  body:          { padding: 22 },
  row:           { flexDirection: 'row', gap: 10, marginBottom: 14 },
  desc:          { fontSize: 13, color: '#64748B', lineHeight: 20, marginBottom: 18 },
  actions:       { gap: 10 },
  btn:           { borderRadius: 14, overflow: 'hidden' },
  btnGrad:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 8 },
  btnText:       { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineBtn:    { paddingVertical: 13, alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0' },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  pressed:       { opacity: 0.84, transform: [{ scale: 0.98 }] },
  disabled:      { opacity: 0.5 },
});
