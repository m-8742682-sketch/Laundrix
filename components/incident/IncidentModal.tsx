/**
 * IncidentModal — Redesigned to match Laundrix sky-blue theme
 *
 * Three roles:
 *  Owner   → "Someone's at Your Machine" — Yes It's Me (green) / Report Intruder (red)
 *  Admin   → "Unauthorized Access Alert" — Dismiss Buzzer (red) / False Alarm (outline)
 *  Intruder → "Access Reported" — I Understand (sky-blue)
 *
 * "Silence Alarm" stops sound but keeps modal open (X button closes)
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
  const slideAnim  = useRef(new Animated.Value(700)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const ring1      = useRef(new Animated.Value(0)).current;
  const ring2      = useRef(new Animated.Value(0)).current;
  const ring3      = useRef(new Animated.Value(0)).current;
  const [silenced, setSilenced] = useState(false);

  const total    = 60;
  const progress = Math.max(0, Math.min(1, secondsLeft / total));
  const isUrgent = secondsLeft <= 15 && secondsLeft > 0;
  const fmt      = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  useEffect(() => { if (visible) setSilenced(false); }, [visible]);

  // Slide + fade in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 72, friction: 12, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 700, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Pulsing rings
  useEffect(() => {
    if (!visible) return;
    const startRing = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])).start();
    startRing(ring1, 0);
    startRing(ring2, 460);
    startRing(ring3, 920);
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.08, duration: isUrgent ? 320 : 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: isUrgent ? 320 : 800, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [visible, isUrgent]);

  // Shake when urgent
  useEffect(() => {
    if (!isUrgent || !visible) return;
    const shake = Animated.loop(Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 7,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -7, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 55, useNativeDriver: true }),
      Animated.delay(1200),
    ]));
    shake.start();
    return () => shake.stop();
  }, [isUrgent, visible]);

  // ── Role-based theme ──────────────────────────────────────────────────────
  const theme = (() => {
    if (isIntruder) return {
      headerColors: ['#1E1B4B', '#312E81', '#3730A3'] as [string,string,string],
      iconColors:   ['#7C3AED', '#6D28D9'] as [string,string],
      accent: '#7C3AED',
      ringColor: 'rgba(124,58,237,',
      badgeBg: 'rgba(124,58,237,0.15)',
      badgeBorder: 'rgba(124,58,237,0.35)',
      icon: 'warning' as const,
    };
    if (isAdmin) return {
      headerColors: ['#0F172A', '#1E293B', '#0D1F35'] as [string,string,string],
      iconColors:   ['#0EA5E9', '#0369A1'] as [string,string],
      accent: '#0EA5E9',
      ringColor: 'rgba(14,165,233,',
      badgeBg: 'rgba(14,165,233,0.12)',
      badgeBorder: 'rgba(14,165,233,0.3)',
      icon: 'shield-half' as const,
    };
    // Owner — urgent = red tint header, else deep navy
    return isUrgent ? {
      headerColors: ['#7F1D1D', '#991B1B', '#B91C1C'] as [string,string,string],
      iconColors:   ['#EF4444', '#DC2626'] as [string,string],
      accent: '#EF4444',
      ringColor: 'rgba(239,68,68,',
      badgeBg: 'rgba(239,68,68,0.12)',
      badgeBorder: 'rgba(239,68,68,0.3)',
      icon: 'alert-circle' as const,
    } : {
      headerColors: ['#0C1445', '#0F172A', '#1E293B'] as [string,string,string],
      iconColors:   ['#0EA5E9', '#0284C7'] as [string,string],
      accent: '#0EA5E9',
      ringColor: 'rgba(14,165,233,',
      badgeBg: 'rgba(14,165,233,0.12)',
      badgeBorder: 'rgba(14,165,233,0.3)',
      icon: 'alert-circle' as const,
    };
  })();

  const incidentTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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

  // Progress bar color: green → amber → red
  const barColor = progress > 0.5 ? '#22C55E' : progress > 0.25 ? '#F59E0B' : '#EF4444';

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ss.backdrop, { opacity: fadeAnim }]}>
        <Animated.View style={[
          ss.sheet,
          { transform: [{ translateY: slideAnim }, { translateX: isUrgent ? shakeAnim : 0 }] }
        ]}>

          {/* ══ HEADER ══════════════════════════════════════════════════════ */}
          <LinearGradient colors={theme.headerColors} style={ss.header}>
            {/* Concentric pulsing rings */}
            {[ring1, ring2, ring3].map((anim, i) => (
              <Animated.View key={i} style={[ss.ring, {
                opacity: anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.7, 0.3, 0] }),
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] }) }],
                borderColor: `${theme.ringColor}0.5)`,
              }]} />
            ))}

            {/* X close */}
            <Pressable
              style={ss.xBtn}
              onPress={() => doAndClose(onDismiss || (() => {}))}
              hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
            </Pressable>

            {/* Central icon with pulse */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 12, marginTop: 8 }}>
              <View style={[ss.iconRing, { borderColor: `${theme.ringColor}0.4)` }]}>
                <LinearGradient colors={theme.iconColors} style={ss.iconCircle}>
                  <Ionicons name={theme.icon} size={30} color="#fff" />
                </LinearGradient>
              </View>
            </Animated.View>

            <Text style={ss.headerTitle}>
              {isIntruder ? '⚠️ Your Access Was Reported'
                : isAdmin  ? '🚨 Unauthorized Access Alert'
                : "🚨 Someone's at Your Machine"}
            </Text>
            <Text style={ss.headerSub}>
              Machine {machineId}{isAdmin ? ` · ${incidentTime}` : ''}
            </Text>

            {silenced && (
              <View style={ss.silencedBadge}>
                <Ionicons name="volume-mute" size={11} color="rgba(255,255,255,0.7)" />
                <Text style={ss.silencedText}> Alarm silenced</Text>
              </View>
            )}
          </LinearGradient>

          {/* ══ BODY ════════════════════════════════════════════════════════ */}
          <ScrollView style={ss.scroll} contentContainerStyle={ss.body} showsVerticalScrollIndicator={false}>

            {/* ── Admin: detail card ── */}
            {isAdmin && !isIntruder && (
              <View style={ss.detailCard}>
                <Text style={ss.sectionLabel}>INCIDENT DETAILS</Text>
                {[
                  { icon: 'person-circle-outline', label: 'INTRUDER', value: intruderName,          color: '#EF4444', sub: intruderId ? intruderId.slice(0,16)+'…' : null },
                  { icon: 'person-outline',         label: 'OWNER',   value: ownerUserName||'Unknown', color: '#0EA5E9', sub: null },
                  { icon: 'hardware-chip-outline',  label: 'MACHINE', value: machineId,              color: '#F59E0B', sub: null },
                  { icon: 'time-outline',            label: 'TIME',    value: incidentTime,           color: '#64748B', sub: null },
                ].map((row, i) => (
                  <View key={i}>
                    {i > 0 && <View style={ss.divider} />}
                    <View style={ss.detailRow}>
                      <View style={[ss.detailDot, { backgroundColor: row.color+'18', borderColor: row.color+'38' }]}>
                        <Ionicons name={row.icon as any} size={13} color={row.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={ss.detailLabel}>{row.label}</Text>
                        <Text style={ss.detailValue}>{row.value}</Text>
                        {row.sub && <Text style={ss.detailSub}>{row.sub}</Text>}
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ── Owner: person-detected card ── */}
            {!isAdmin && !isIntruder && (
              <View style={ss.personCard}>
                <LinearGradient colors={['#FEF2F2','#FEE2E2']} style={ss.personAvatarBg}>
                  <Ionicons name="person" size={24} color="#EF4444" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={ss.personLabel}>PERSON DETECTED</Text>
                  <Text style={ss.personName}>{intruderName}</Text>
                  <Text style={ss.personHint}>Is this someone you authorized to use this machine?</Text>
                </View>
              </View>
            )}

            {/* ── Intruder: info card ── */}
            {isIntruder && (
              <View style={ss.intruderCard}>
                <View style={ss.intruderHeader}>
                  <LinearGradient colors={['#EDE9FE','#DDD6FE']} style={ss.intruderDot}>
                    <Ionicons name="information-circle" size={18} color="#7C3AED" />
                  </LinearGradient>
                  <Text style={ss.intruderTitle}>Your Access Was Reported</Text>
                </View>
                <Text style={ss.intruderBody}>
                  You attempted to access{' '}
                  <Text style={{ fontWeight: '800', color: '#7C3AED' }}>Machine {machineId}</Text>
                  {' '}while it is in use.{'\n\n'}
                  The rightful owner has been notified and is reviewing your access.
                  Please wait for their response.
                </Text>
              </View>
            )}

            {/* ── Countdown ── */}
            <View style={[ss.countdownCard, isUrgent && ss.countdownUrgent]}>
              {/* Header row */}
              <View style={ss.cdTopRow}>
                <View>
                  <Text style={ss.cdLabel}>
                    {isUrgent ? '⚠️ AUTO-ACTION IMMINENT' : '⏱ TIME REMAINING'}
                  </Text>
                  <Text style={[ss.cdValue, { color: isUrgent ? '#EF4444' : THEME.primary }]}>
                    {fmt(secondsLeft)}
                  </Text>
                </View>
                <View style={[ss.pctBubble, { backgroundColor: isUrgent ? '#FEF2F2' : '#F0F9FF' }]}>
                  <Text style={[ss.pctNum, { color: isUrgent ? '#EF4444' : THEME.primary }]}>
                    {Math.round(progress * 100)}
                  </Text>
                  <Text style={ss.pctUnit}>%</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={ss.track}>
                <Animated.View style={[ss.fill, { backgroundColor: barColor, width: `${progress * 100}%` as any }]} />
              </View>

              {isUrgent && !isIntruder && (
                <View style={ss.urgentRow}>
                  <Ionicons name="warning" size={12} color="#EF4444" />
                  <Text style={ss.urgentNote}>Automatic action if no response</Text>
                </View>
              )}
            </View>

            {/* ── Actions ── */}
            <View style={ss.actions}>
              {/* Silence alarm */}
              {!silenced && (
                <Pressable onPress={handleSilence} style={({ pressed }) => [ss.silenceBtn, pressed && ss.pressed]}>
                  <Ionicons name="volume-mute-outline" size={16} color="#64748B" />
                  <Text style={ss.silenceBtnText}>Silence Alarm</Text>
                </Pressable>
              )}

              {isIntruder ? (
                <Pressable
                  onPress={() => doAndClose(onThatsMe)}
                  disabled={loading}
                  style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                >
                  <LinearGradient colors={['#7C3AED','#6D28D9','#5B21B6']} style={ss.btnInner}>
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
            </View>

            {loading && (
              <View style={ss.loadRow}>
                <Ionicons name="sync" size={13} color="#94A3B8" />
                <Text style={ss.loadText}>Processing…</Text>
              </View>
            )}
            <View style={{ height: 16 }} />
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const ss = StyleSheet.create({
  // Overlay
  backdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,6,23,0.72)',
  },

  // Sheet
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    overflow: 'hidden', maxHeight: '92%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.35, shadowRadius: 32, elevation: 36,
  },

  // Header
  header: {
    paddingTop: 22, paddingBottom: 24, paddingHorizontal: 24,
    alignItems: 'center', overflow: 'hidden', minHeight: 185,
  },
  ring: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    borderWidth: 1.5, top: 26,
  },
  xBtn: {
    position: 'absolute', top: 14, right: 14, zIndex: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  iconRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: -0.2, marginBottom: 4,
  },
  headerSub: {
    fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600', letterSpacing: 0.3,
  },
  silencedBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, marginTop: 10,
  },
  silencedText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },

  // Body
  scroll: { maxHeight: 540 },
  body:   { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },

  // Section label
  sectionLabel: {
    fontSize: 9, fontWeight: '800', color: '#94A3B8',
    letterSpacing: 1.8, marginBottom: 12,
  },

  // Admin detail card
  detailCard: {
    backgroundColor: '#F8FAFC', borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14,
  },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 2 },
  detailRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  detailDot:   { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8 },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 1 },
  detailSub:   { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  // Owner person card
  personCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFF1F2', borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: '#FECACA', marginBottom: 14,
  },
  personAvatarBg: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  personLabel: { fontSize: 9, fontWeight: '800', color: '#EF4444', letterSpacing: 1, marginBottom: 3 },
  personName:  { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.3 },
  personHint:  { fontSize: 12, color: '#94A3B8', marginTop: 3, lineHeight: 16 },

  // Intruder info card
  intruderCard:   { backgroundColor: '#F5F3FF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#DDD6FE', marginBottom: 14 },
  intruderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  intruderDot:    { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  intruderTitle:  { fontSize: 15, fontWeight: '800', color: '#6D28D9' },
  intruderBody:   { fontSize: 13, color: '#4B5563', lineHeight: 21 },

  // Countdown
  countdownCard:   { backgroundColor: '#F8FAFC', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  countdownUrgent: { backgroundColor: '#FFF1F2', borderColor: '#FECACA' },
  cdTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cdLabel:  { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.5, marginBottom: 4 },
  cdValue:  { fontSize: 48, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'] as any },
  pctBubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', flexDirection: 'row', gap: 1 },
  pctNum:    { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  pctUnit:   { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 4 },
  track:     { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  fill:      { height: '100%', borderRadius: 3 },
  urgentRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  urgentNote: { fontSize: 11, color: '#EF4444', fontWeight: '700' },

  // Buttons
  actions:    { gap: 10 },
  silenceBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', paddingVertical: 12,
  },
  silenceBtnText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  btn:       { borderRadius: 16, overflow: 'hidden' },
  btnInner:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 9 },
  btnText:   { color: '#fff', fontSize: 15, fontWeight: '800' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', paddingVertical: 14,
  },
  outlineBtnText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  pressed:   { opacity: 0.82, transform: [{ scale: 0.975 }] },
  disabled:  { opacity: 0.45 },

  // Loading
  loadRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  loadText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
});
