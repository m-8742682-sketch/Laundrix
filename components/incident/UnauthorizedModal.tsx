/**
 * UnauthorizedModal — Shown to the INTRUDER (unauthorized person)
 *
 * The intruder scanned / is using a machine that belongs to someone else's queue.
 * They should NOT see "Yes/No, is this you?" — they ARE the unauthorized person.
 * Instead, show them a clear warning with options to step back or explain.
 *
 * Usage: render this for the user whose scan triggered an unauthorized incident
 * (i.e., user that scanned but was NOT the next in queue)
 */

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated, Vibration,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface UnauthorizedModalProps {
  visible: boolean;
  machineId: string;
  /** Name of the rightful owner */
  ownerName: string;
  /** Position in queue of the unauthorized user */
  userQueuePosition?: number;
  onAcknowledge: () => void;
  onGetHelp: () => void;
}

export default function UnauthorizedModal({
  visible, machineId, ownerName, userQueuePosition, onAcknowledge, onGetHelp,
}: UnauthorizedModalProps) {
  const slideAnim = useRef(new Animated.Value(80)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 90, friction: 9, useNativeDriver: true }),
      ]).start();

      // Alert shake
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
        ]).start();
      }, 200);

      Vibration.vibrate([0, 500, 200, 500]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      Vibration.cancel();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ss.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[ss.card, { transform: [{ translateY: slideAnim }, { translateX: shakeAnim }] }]}>

          {/* Header */}
          <LinearGradient colors={['#7C3AED', '#4F46E5']} style={ss.header}>
            <View style={ss.deco1} /><View style={ss.deco2} />
            <View style={ss.iconCircle}>
              <Ionicons name="alert-circle" size={36} color="#fff" />
            </View>
            <Text style={ss.title}>Unauthorized Access</Text>
            <Text style={ss.sub}>Machine {machineId} is not ready for you yet</Text>
          </LinearGradient>

          {/* Body */}
          <View style={ss.body}>
            {/* Info card */}
            <View style={ss.infoCard}>
              <Ionicons name="person-circle" size={38} color="#6366F1" />
              <View style={ss.infoText}>
                <Text style={ss.infoLabel}>Currently reserved for</Text>
                <Text style={ss.infoName}>{ownerName}</Text>
              </View>
            </View>

            {/* Explanation */}
            <View style={ss.explainCard}>
              <Ionicons name="information-circle" size={20} color="#0EA5E9" />
              <Text style={ss.explainText}>
                This machine is reserved for someone else in the queue. An alert has been sent.
                {userQueuePosition
                  ? ` You are currently #${userQueuePosition} in the queue.`
                  : ' Please wait for your turn.'}
              </Text>
            </View>

            {/* What to do */}
            <Text style={ss.instructionTitle}>What should you do?</Text>
            <View style={ss.steps}>
              {[
                { icon: 'arrow-back-circle', text: 'Step away from this machine', color: '#EF4444' },
                { icon: 'time', text: 'Return to the queue and wait for your turn', color: '#F59E0B' },
                { icon: 'checkmark-circle', text: 'You will be notified when the machine is ready for you', color: '#10B981' },
              ].map((step, i) => (
                <View key={i} style={ss.step}>
                  <View style={[ss.stepIcon, { backgroundColor: `${step.color}18` }]}>
                    <Ionicons name={step.icon as any} size={18} color={step.color} />
                  </View>
                  <Text style={ss.stepText}>{step.text}</Text>
                </View>
              ))}
            </View>

            {/* Actions */}
            <View style={ss.actions}>
              <Pressable
                onPress={onAcknowledge}
                style={({ pressed }) => [ss.primaryBtn, pressed && ss.pressed]}
              >
                <LinearGradient colors={['#6366F1', '#4F46E5']} style={ss.btnGrad}>
                  <Ionicons name="checkmark" size={20} color="#fff" />
                  <Text style={ss.btnText}>Understood, I'll step back</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={onGetHelp}
                style={({ pressed }) => [ss.outlineBtn, pressed && ss.pressed]}
              >
                <Ionicons name="help-circle-outline" size={18} color="#64748B" />
                <Text style={ss.outlineBtnText}>There's a mistake — Get help</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card:          { width: '100%', maxWidth: 400, backgroundColor: '#fff', borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.35, shadowRadius: 40, elevation: 20 },
  header:        { padding: 28, alignItems: 'center', overflow: 'hidden' },
  deco1:         { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)', top: -70, right: -50 },
  deco2:         { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.07)', bottom: -25, left: -25 },
  iconCircle:    { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title:         { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub:           { fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 5, fontWeight: '600', textAlign: 'center' },
  body:          { padding: 22 },
  infoCard:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  infoText:      { flex: 1 },
  infoLabel:     { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8 },
  infoName:      { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  explainCard:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#BFDBFE' },
  explainText:   { flex: 1, fontSize: 13, color: '#1E40AF', fontWeight: '500', lineHeight: 19 },
  instructionTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  steps:         { gap: 10, marginBottom: 20 },
  step:          { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepIcon:      { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepText:      { flex: 1, fontSize: 13, color: '#334155', fontWeight: '500', lineHeight: 18 },
  actions:       { gap: 10 },
  primaryBtn:    { borderRadius: 16, overflow: 'hidden' },
  btnGrad:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  btnText:       { color: '#fff', fontSize: 16, fontWeight: '800' },
  outlineBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', gap: 8 },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  pressed:       { opacity: 0.84, transform: [{ scale: 0.98 }] },
});
