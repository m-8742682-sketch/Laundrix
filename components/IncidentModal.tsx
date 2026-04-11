/**
 * IncidentModal — Redesigned to match GraceAlarmModal structure
 *
 * Structure mirrors GraceAlarmModal:
 *   • Centered floating card (not bottom-sheet)
 *   • Gradient header with decorative bubbles + animated icon
 *   • Clean white body with countdown, info card, actions
 *   • Urgent red palette (more intense than GraceAlarmModal's amber)
 *
 * Three roles:
 *  Owner   → "Someone's at Your Machine"   — Yes It's Me (green) / Report Intruder (red)
 *  Admin   → "Unauthorized Access Alert"   — Dismiss Buzzer (red) / False Alarm (outline)
 *  Intruder → "Access Reported"            — I Understand (indigo)
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, ScrollView, Easing, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { stopSound } from '@/services/soundState';
import { THEME } from '@/constants/Theme';

const { width } = Dimensions.get('window');

export interface IncidentModalProps {
  visible: boolean;
  machineId: string;
  intruderName: string;
  intruderId?: string;
  ownerUserName?: string;
  createdAt?: string;
  secondsLeft: number;
  onThatsMe: () => void;
  onNotMe: () => void;
  onDismiss?: () => void;
  loading?: boolean;
  isAdmin?: boolean;
  isIntruder?: boolean;
}

export default function IncidentModal({
  visible, machineId, intruderName, intruderId, ownerUserName,
  createdAt, secondsLeft, onThatsMe, onNotMe, onDismiss,
  loading = false, isAdmin = false, isIntruder = false,
}: IncidentModalProps) {
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const ringAnim   = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const [silenced, setSilenced] = useState(false);

  const total    = 60;
  const progress = Math.max(0, Math.min(1, secondsLeft / total));
  const isUrgent = secondsLeft <= 15 && secondsLeft > 0;
  const fmt      = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  useEffect(() => { if (visible) setSilenced(false); }, [visible]);

  // Fade in/out
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  // Pulse icon
  useEffect(() => {
    if (!visible) return;
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.12, duration: isUrgent ? 300 : 750, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: isUrgent ? 300 : 750, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [visible, isUrgent]);

  // Bell swing animation (like GraceAlarmModal)
  useEffect(() => {
    if (!visible || silenced) return;
    const r = Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1,  duration: 140, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: -1, duration: 140, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: .6, duration: 140, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0,  duration: 140, useNativeDriver: true }),
      Animated.delay(800),
    ]));
    r.start();
    return () => r.stop();
  }, [visible, silenced]);

  // Shake when urgent
  useEffect(() => {
    if (!isUrgent || !visible) return;
    const shake = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 50, useNativeDriver: true }),
      Animated.delay(1200),
    ]));
    shake.start();
    return () => shake.stop();
  }, [isUrgent, visible]);

  // ── Role-based palette ────────────────────────────────────────────────────
  const palette = (() => {
    if (isIntruder) return {
      headerColors: ['#7F1D1D', '#991B1B', '#B91C1C'] as [string,string,string],
      iconBg:   ['#DC2626','#B91C1C'] as [string,string],
      accent:   '#EF4444',
      urgentBg: '#F5F3FF',
      icon: 'warning' as const,
      title: '⚠️ Your Access Was Reported',
      sub: `Machine ${machineId}`,
    };
    if (isAdmin) return {
      headerColors: (isUrgent
        ? ['#7F1D1D','#991B1B','#B91C1C']
        : ['#991B1B','#B91C1C','#DC2626']) as [string,string,string],
      iconBg:   ['#EF4444','#DC2626'] as [string,string],
      accent:   '#EF4444',
      urgentBg: '#FFF1F2',
      icon: 'shield-half' as const,
      title: '🚨 Unauthorized Access Alert',
      sub: `Machine ${machineId}`,
    };
    return (isUrgent ? {
      headerColors: ['#7F1D1D','#991B1B','#B91C1C'] as [string,string,string],
      iconBg:   ['#EF4444','#DC2626'] as [string,string],
      accent:   '#EF4444',
      urgentBg: '#FFF1F2',
      icon: 'alert-circle' as const,
      title: "🚨 Someone's at Your Machine",
      sub: `Machine ${machineId}`,
    } : {
      headerColors: ['#450A0A','#7F1D1D','#991B1B'] as [string,string,string],
      iconBg:   ['#F87171','#EF4444'] as [string,string],
      accent:   '#EF4444',
      urgentBg: '#FFF1F2',
      icon: 'alert-circle' as const,
      title: "🚨 Someone's at Your Machine",
      sub: `Machine ${machineId}`,
    });
  })();

  const incidentTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const barColor = progress > 0.5 ? '#22C55E' : progress > 0.25 ? '#F59E0B' : '#EF4444';

  const doAndClose = (fn: () => void) => {
    stopSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fn();
  };

  const handleSilence = () => {
    stopSound();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSilenced(true);
  };

  const ringRot = ringAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ss.backdrop, { opacity: fadeAnim }]}>
        <Animated.View style={[ss.card, {
          transform: [{ translateX: isUrgent ? shakeAnim : 0 }],
        }]}>

          {/* ══ HEADER — matches GraceAlarmModal structure ══════════════════ */}
          <LinearGradient colors={palette.headerColors} style={ss.header}>
            {/* Decorative bubbles (identical to GraceAlarmModal) */}
            <View style={ss.deco1} />
            <View style={ss.deco2} />

            {/* Close button */}
            <Pressable
              style={ss.closeBtn}
              onPress={() => doAndClose(onDismiss || (() => {}))}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </Pressable>

            {/* Animated icon (bell-swing like GraceAlarmModal) */}
            <Animated.View style={{ transform: [{ rotate: ringRot }, { scale: pulseAnim }] }}>
              <LinearGradient colors={palette.iconBg} style={ss.iconCircle}>
                <Ionicons name={silenced ? 'notifications-off' : palette.icon} size={36} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <Text style={ss.title}>{palette.title}</Text>
            <Text style={ss.sub}>{palette.sub}</Text>

            {isAdmin && (
              <View style={ss.adminBadge}>
                <Ionicons name="shield-checkmark" size={11} color="rgba(255,255,255,0.9)" />
                <Text style={ss.adminBadgeText}>Admin View · {incidentTime}</Text>
              </View>
            )}
            {silenced && (
              <View style={ss.silencedBadge}>
                <Ionicons name="volume-mute" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={ss.silencedBadgeText}> Alarm silenced</Text>
              </View>
            )}
          </LinearGradient>

          {/* ══ BODY ════════════════════════════════════════════════════════ */}
          <View style={ss.body}>

            {/* ── Info card (role-specific) ── */}
            {isAdmin && !isIntruder && (
              <View style={ss.infoCard}>
                {[
                  { icon: 'person-circle-outline' as const, label: 'INTRUDER', value: intruderName,           color: '#EF4444' },
                  { icon: 'person-outline' as const,         label: 'OWNER',   value: ownerUserName || 'Unknown', color: THEME.primary },
                  { icon: 'hardware-chip-outline' as const,  label: 'MACHINE', value: machineId,               color: '#F59E0B' },
                ].map((row, i) => (
                  <View key={i} style={[ss.infoRow, i > 0 && ss.infoRowBorder]}>
                    <View style={[ss.infoDot, { backgroundColor: row.color + '18', borderColor: row.color + '38' }]}>
                      <Ionicons name={row.icon} size={13} color={row.color} />
                    </View>
                    <View>
                      <Text style={ss.infoLabel}>{row.label}</Text>
                      <Text style={ss.infoValue}>{row.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!isAdmin && !isIntruder && (
              <View style={ss.infoCard}>
                <View style={ss.infoRow}>
                  <LinearGradient colors={['#FEF2F2','#FEE2E2']} style={ss.personAvatar}>
                    <Ionicons name="person" size={22} color="#EF4444" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={ss.infoLabel}>PERSON DETECTED</Text>
                    <Text style={[ss.infoValue, { fontSize: 17 }]}>{intruderName}</Text>
                    <Text style={ss.infoHint}>Is this someone you authorized?</Text>
                  </View>
                </View>
              </View>
            )}

            {isIntruder && (
              <View style={ss.infoCard}>
                <View style={ss.infoRow}>
                  <LinearGradient colors={['#EDE9FE','#DDD6FE']} style={ss.personAvatar}>
                    <Ionicons name="information-circle" size={22} color="#EF4444" />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={[ss.infoLabel, { color: '#EF4444' }]}>ACCESS REPORTED</Text>
                    <Text style={[ss.infoValue, { fontSize: 13, fontWeight: '500', color: '#4B5563', marginTop: 4, lineHeight: 18 }]}>
                      You accessed <Text style={{ fontWeight: '800', color: '#EF4444' }}>Machine {machineId}</Text> while it's in use.
                      The owner is reviewing.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ── Countdown (matches GraceAlarmModal countdown style) ── */}
            <Text style={ss.countLabel}>
              {isUrgent ? '⚠️ AUTO-ACTION IMMINENT' : '⏱ TIME REMAINING'}
            </Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={[ss.countdown, { color: isUrgent ? '#EF4444' : palette.accent }]}>
                {fmt(secondsLeft)}
              </Text>
            </Animated.View>

            <View style={ss.bar}>
              <LinearGradient
                colors={isUrgent ? ['#EF4444','#DC2626'] : ['#F59E0B','#D97706']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[ss.barFill, { width: `${progress * 100}%` as any }]}
              />
            </View>
            {isUrgent && !isIntruder && (
              <Text style={ss.urgentHint}>Automatic action if no response</Text>
            )}

            {/* ── Action buttons ── */}
            {isIntruder ? (
              <Pressable
                onPress={() => doAndClose(onThatsMe)}
                disabled={loading}
                style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
              >
                <LinearGradient colors={['#EF4444','#DC2626','#B91C1C']} style={ss.btnInner}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={ss.btnText}>I Understand</Text>
                </LinearGradient>
              </Pressable>

            ) : isAdmin ? (
              <>
                <Pressable
                  onPress={() => doAndClose(onThatsMe)}
                  disabled={loading}
                  style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                >
                  <LinearGradient colors={['#DC2626','#B91C1C','#991B1B']} style={ss.btnInner}>
                    <Ionicons name="alarm" size={20} color="#fff" />
                    <Text style={ss.btnText}>Dismiss Buzzer</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => doAndClose(onNotMe)}
                  disabled={loading}
                  style={({ pressed }) => [ss.outlineBtn, pressed && ss.pressed, loading && ss.disabled]}
                >
                  <Ionicons name="close-circle-outline" size={18} color="#64748B" />
                  <Text style={ss.outlineBtnText}>False Alarm</Text>
                </Pressable>
              </>

            ) : (
              <>
                <Pressable
                  onPress={() => doAndClose(onThatsMe)}
                  disabled={loading}
                  style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                >
                  <LinearGradient colors={['#059669','#047857','#065F46']} style={ss.btnInner}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={ss.btnText}>Yes, It's Me</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  onPress={() => doAndClose(onNotMe)}
                  disabled={loading}
                  style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                >
                  <LinearGradient colors={['#DC2626','#B91C1C','#991B1B']} style={ss.btnInner}>
                    <Ionicons name="shield-checkmark" size={20} color="#fff" />
                    <Text style={ss.btnText}>Report Intruder</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}

            {/* Silence alarm */}
            {!silenced ? (
              <Pressable onPress={handleSilence} style={ss.silenceBtn}>
                <LinearGradient colors={['#F1F5F9','#E2E8F0']} style={ss.silenceGrad}>
                  <Ionicons name="volume-mute" size={16} color="#64748b" />
                  <Text style={ss.silenceText}>Silence Alarm</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={ss.silencedRow}>
                <Ionicons name="notifications-off-outline" size={14} color="#94a3b8" />
                <Text style={ss.silencedRowText}>Alarm silenced</Text>
              </View>
            )}

            {loading && (
              <View style={ss.loadRow}>
                <Ionicons name="sync" size={13} color="#94A3B8" />
                <Text style={ss.loadText}>Processing…</Text>
              </View>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  // Backdrop — same as GraceAlarmModal
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },

  // Floating card — same border-radius as GraceAlarmModal
  card: {
    width: '100%', maxWidth: 360,
    borderRadius: 32, overflow: 'hidden', backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.55, shadowRadius: 40, elevation: 24,
  },

  // Header — matches GraceAlarmModal header style
  header: { padding: 32, alignItems: 'center', overflow: 'hidden' },
  deco1:  { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.08)', top: -80,  right: -60 },
  deco2:  { position: 'absolute', width: 130, height: 130, borderRadius: 65,  backgroundColor: 'rgba(255,255,255,0.06)', bottom: -35, left: -30 },
  closeBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  iconCircle: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: -0.4, marginBottom: 4, textAlign: 'center' },
  sub:   { fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8,
    backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  adminBadgeText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '700' },
  silencedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 10,
  },
  silencedBadgeText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  // Body — same padding as GraceAlarmModal body
  body: { padding: 24, alignItems: 'center' },

  // Info card
  infoCard: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, padding: 14,
  },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9', marginTop: 4 },
  infoDot:       { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  infoLabel:     { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  infoValue:     { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 1 },
  infoHint:      { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  personAvatar:  { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Countdown — large like GraceAlarmModal
  countLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 4 },
  countdown:  { fontSize: 68, fontWeight: '900', letterSpacing: -4, marginBottom: 12, fontVariant: ['tabular-nums'] as any },
  bar:        { width: '100%', height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  barFill:    { height: '100%', borderRadius: 4 },
  urgentHint: { fontSize: 11, color: '#EF4444', fontWeight: '700', marginBottom: 16 },

  // Buttons
  btn:     { width: '100%', borderRadius: 20, overflow: 'hidden', marginBottom: 10,
             shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  btnText:  { color: '#fff', fontSize: 16, fontWeight: '900' },
  outlineBtn: {
    width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', paddingVertical: 13, marginBottom: 10,
  },
  outlineBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },

  // Silence button — matches GraceAlarmModal silenceBtn
  silenceBtn:  { width: '100%', borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  silenceGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  silenceText: { color: '#64748b', fontSize: 14, fontWeight: '700' },
  silencedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  silencedRowText: { fontSize: 12, color: '#94a3b8', fontWeight: '600' },

  pressed:  { opacity: 0.82, transform: [{ scale: 0.975 }] },
  disabled: { opacity: 0.45 },

  loadRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 },
  loadText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
});
