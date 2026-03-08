/**
 * IncidentModal — Unified incident modal for owner, admin, and intruder
 *
 * - Owner:   "Yes It's Me" / "No — Report Intruder"  (+ X dismiss)
 * - Admin:   full detail card + "Dismiss {machineId} Buzzer" / "Dismiss False Alarm"  (+ X)
 * - Intruder: info box + "I Understand"  (+ X)
 * All buttons (including X) stop urgent.mp3
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal,
  Animated, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { stopSound } from '@/services/soundState';

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
  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isUrgent  = secondsLeft <= 15;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !isUrgent) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.04, duration: 280, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 280, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [visible, isUrgent]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const progress = Math.min(1, Math.max(0, secondsLeft / 60));

  const headerColors: [string, string] = isIntruder
    ? ['#7C3AED', '#6D28D9']
    : isUrgent ? ['#DC2626', '#B91C1C'] : ['#0D2240', '#0A1A30'];

  const headerTitle = isIntruder
    ? '⚠️ Your Action Was Reported'
    : isAdmin
      ? '🚨 Unauthorized Access Alert'
      : "🚨 Someone's at Your Machine";

  const stopAndCall = (fn: () => void) => {
    stopSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fn();
  };

  const incidentTime = createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ss.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[ss.card, { transform: [{ translateY: slideAnim }, { scale: isUrgent ? pulseAnim : 1 }] }]}>

          {/* Header */}
          <LinearGradient colors={headerColors} style={ss.header}>
            <View style={ss.deco1} /><View style={ss.deco2} />
            {/* X dismiss button */}
            <TouchableOpacity style={ss.xBtn} onPress={() => stopAndCall(onDismiss || (() => {}))} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
            <View style={ss.iconCircle}>
              <Ionicons name={isIntruder ? 'warning-outline' : 'alert-circle'} size={28} color="#fff" />
            </View>
            <Text style={ss.title}>{headerTitle}</Text>
            <Text style={ss.sub}>Machine {machineId}</Text>
          </LinearGradient>

          {/* Scrollable body */}
          <ScrollView style={ss.scroll} contentContainerStyle={ss.body} showsVerticalScrollIndicator={false}>

            {/* ADMIN: Full detail card */}
            {isAdmin && (
              <View style={ss.detailCard}>
                <Text style={ss.detailTitle}>INCIDENT DETAILS</Text>
                <View style={ss.detailRow}>
                  <Ionicons name="person-circle-outline" size={16} color="#EF4444" />
                  <View style={ss.detailInfo}>
                    <Text style={ss.detailLabel}>INTRUDER</Text>
                    <Text style={ss.detailValue}>{intruderName}</Text>
                    {intruderId ? <Text style={ss.detailSub}>ID: {intruderId.slice(0, 14)}</Text> : null}
                  </View>
                </View>
                <View style={ss.divider} />
                <View style={ss.detailRow}>
                  <Ionicons name="person-outline" size={16} color="#0EA5E9" />
                  <View style={ss.detailInfo}>
                    <Text style={ss.detailLabel}>MACHINE OWNER</Text>
                    <Text style={ss.detailValue}>{ownerUserName || 'Unknown'}</Text>
                  </View>
                </View>
                <View style={ss.divider} />
                <View style={ss.detailRow}>
                  <Ionicons name="hardware-chip-outline" size={16} color="#F59E0B" />
                  <View style={ss.detailInfo}>
                    <Text style={ss.detailLabel}>MACHINE LOCATION</Text>
                    <Text style={ss.detailValue}>{machineId}</Text>
                  </View>
                </View>
                <View style={ss.divider} />
                <View style={ss.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#94A3B8" />
                  <View style={ss.detailInfo}>
                    <Text style={ss.detailLabel}>INCIDENT TIME</Text>
                    <Text style={ss.detailValue}>{incidentTime}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* OWNER: person detected card */}
            {!isAdmin && !isIntruder && (
              <View style={ss.personCard}>
                <View style={ss.personIcon}>
                  <Ionicons name="person" size={22} color="#EF4444" />
                </View>
                <View style={ss.personInfo}>
                  <Text style={ss.personLabel}>PERSON DETECTED AT {machineId}</Text>
                  <Text style={ss.personName}>{intruderName}</Text>
                  <Text style={ss.personSub}>Is this you or an intruder?</Text>
                </View>
              </View>
            )}

            {/* INTRUDER: info box */}
            {isIntruder && (
              <View style={ss.intruderBox}>
                <Ionicons name="information-circle" size={22} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={ss.intruderTitle}>Action Reported</Text>
                  <Text style={ss.intruderBody}>
                    You attempted to use Machine {machineId} which is currently in use.{'\n\n'}
                    The machine owner and admin have been notified. Please wait for their response.
                  </Text>
                </View>
              </View>
            )}

            {/* Countdown */}
            <View style={ss.countdownWrap}>
              <Text style={ss.countdownLabel}>Time remaining</Text>
              <Text style={[ss.countdownValue, isUrgent && ss.countdownUrgent]}>{fmt(secondsLeft)}</Text>
              <View style={ss.bar}>
                <View style={[ss.barFill, {
                  backgroundColor: isUrgent ? '#DC2626' : isIntruder ? '#7C3AED' : '#0EA5E9',
                  width: `${progress * 100}%` as any,
                }]} />
              </View>
              {isUrgent && !isIntruder && <Text style={ss.urgentNote}>⚠️ Auto-alert triggering soon</Text>}
            </View>

            {/* Buttons */}
            <View style={ss.actions}>
              {isIntruder ? (
                <Pressable
                  onPress={() => stopAndCall(onThatsMe)}
                  disabled={loading}
                  style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                >
                  <LinearGradient colors={['#7C3AED', '#6D28D9']} style={ss.btnGrad}>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={ss.btnText}>I Understand</Text>
                  </LinearGradient>
                </Pressable>
              ) : isAdmin ? (
                <>
                  <Pressable
                    onPress={() => stopAndCall(onNotMe)}
                    disabled={loading}
                    style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                  >
                    <LinearGradient colors={['#EF4444', '#DC2626']} style={ss.btnGrad}>
                      <Ionicons name="alarm" size={20} color="#fff" />
                      <Text style={ss.btnText}>Dismiss {machineId} Buzzer</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => stopAndCall(onThatsMe)}
                    disabled={loading}
                    style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                  >
                    <LinearGradient colors={['#64748B', '#475569']} style={ss.btnGrad}>
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <Text style={ss.btnText}>Dismiss False Alarm</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => stopAndCall(onThatsMe)}
                    disabled={loading}
                    style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                  >
                    <LinearGradient colors={['#10B981', '#059669']} style={ss.btnGrad}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={ss.btnText}>Yes It's Me</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => stopAndCall(onNotMe)}
                    disabled={loading}
                    style={({ pressed }) => [ss.btn, pressed && ss.pressed, loading && ss.disabled]}
                  >
                    <LinearGradient colors={['#EF4444', '#DC2626']} style={ss.btnGrad}>
                      <Ionicons name="shield-checkmark" size={20} color="#fff" />
                      <Text style={ss.btnText}>No — Report Intruder</Text>
                    </LinearGradient>
                  </Pressable>
                </>
              )}
            </View>

            {loading && <Text style={ss.loadingText}>Processing…</Text>}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:           { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', maxHeight: '90%', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.4, shadowRadius: 40, elevation: 24 },
  header:         { padding: 24, alignItems: 'center', overflow: 'hidden', paddingBottom: 20 },
  deco1:          { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.08)', top: -60, right: -40 },
  deco2:          { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.06)', bottom: -20, left: -20 },
  xBtn:           { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  iconCircle:     { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  title:          { fontSize: 16, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:            { fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 3, fontWeight: '600' },
  scroll:         { maxHeight: 520 },
  body:           { padding: 20, paddingBottom: 28 },
  detailCard:     { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  detailTitle:    { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1, marginBottom: 12 },
  detailRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 2 },
  detailInfo:     { flex: 1 },
  detailLabel:    { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.6 },
  detailValue:    { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 1 },
  detailSub:      { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  divider:        { height: 1, backgroundColor: '#E2E8F0', marginVertical: 8 },
  personCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF5F5', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA', gap: 12 },
  personIcon:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  personInfo:     { flex: 1 },
  personLabel:    { fontSize: 10, fontWeight: '700', color: '#EF4444', letterSpacing: 0.6 },
  personName:     { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  personSub:      { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  intruderBox:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F3F0FF', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#C4B5FD' },
  intruderTitle:  { fontSize: 14, fontWeight: '800', color: '#7C3AED', marginBottom: 4 },
  intruderBody:   { fontSize: 13, color: '#4B5563', lineHeight: 19 },
  countdownWrap:  { alignItems: 'center', marginBottom: 18 },
  countdownLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  countdownValue: { fontSize: 48, fontWeight: '800', color: '#0F172A', letterSpacing: -1, marginBottom: 8, fontVariant: ['tabular-nums'] },
  countdownUrgent: { color: '#DC2626' },
  bar:            { width: '100%', height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  barFill:        { height: '100%', borderRadius: 3 },
  urgentNote:     { fontSize: 11, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  actions:        { gap: 10 },
  btn:            { borderRadius: 14, overflow: 'hidden' },
  btnGrad:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, gap: 8 },
  btnText:        { color: '#fff', fontSize: 15, fontWeight: '800' },
  pressed:        { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled:       { opacity: 0.5 },
  loadingText:    { textAlign: 'center', marginTop: 10, color: '#64748B', fontWeight: '600' },
});
