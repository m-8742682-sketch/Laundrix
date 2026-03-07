/**
 * voice-incoming.tsx — Full-screen incoming voice call
 * Design: Laundrix sky-blue theme, Telegram-class feel
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Vibration, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useUser } from '@/components/UserContext';
import Avatar from '@/components/Avatar';
import { container } from '@/di/container';
import {
  setIncomingScreenOpen, acceptIncomingCall, rejectIncomingCall,
  incomingCallData$, incomingCallCountdown$, sendMissedCallNotification,
} from '@/services/callState';

const { width } = Dimensions.get('window');

export default function VoiceIncomingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel     = params.channel as string;
  const callerName  = params.name as string;
  const callerAvatar = params.avatar as string | undefined;
  const callerId    = params.callerId as string;

  const hasHandledRef   = useRef(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const fadeAnim        = useRef(new Animated.Value(0)).current;
  const slideAnim       = useRef(new Animated.Value(80)).current;
  const ring1           = useRef(new Animated.Value(1)).current;
  const ring2           = useRef(new Animated.Value(1)).current;
  const ring3           = useRef(new Animated.Value(1)).current;
  const btnAcceptScale  = useRef(new Animated.Value(1)).current;
  const btnDeclineShake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setIncomingScreenOpen(true);
    if (Platform.OS !== 'web') Vibration.vibrate([0, 800, 400, 800, 400], true);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
    ]).start();

    // Ripple rings — staggered outward
    const ripple = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1.85, duration: 1600, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])).start();

    ripple(ring1, 0);
    ripple(ring2, 530);
    ripple(ring3, 1060);

    // Accept button breathe
    Animated.loop(Animated.sequence([
      Animated.timing(btnAcceptScale, { toValue: 1.14, duration: 750, useNativeDriver: true }),
      Animated.timing(btnAcceptScale, { toValue: 1, duration: 750, useNativeDriver: true }),
    ])).start();

    return () => {
      Vibration.cancel();
      setIncomingScreenOpen(false);
    };
  }, []);

  useEffect(() => {
    const sub = incomingCallCountdown$.subscribe((n) => {
      setTimeLeft(n);
      if (n === 0 && !hasHandledRef.current) handleMissed();
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = incomingCallData$.subscribe((data) => {
      if (!data && !hasHandledRef.current) {
        hasHandledRef.current = true;
        safeBack();
      }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      handleMinimize();
      return true;
    });
    return () => h.remove();
  }, []);

  const safeBack = () =>
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/conversations');
    }, 120);

  const handleMinimize = () => {
    setIncomingScreenOpen(false); // overlay shows, call still rings
    Vibration.cancel();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/conversations');
  };

  const handleMissed = useCallback(async () => {
    if (hasHandledRef.current || !user?.uid || !callerId) return;
    hasHandledRef.current = true;
    Vibration.cancel();
    try {
      await updateDoc(doc(db, 'calls', channel), {
        status: 'missed', endedAt: serverTimestamp(), missedReason: 'timeout',
      });
      const ch = `chat-${[user.uid, callerId].sort().join('-')}`;
      await container.chatRepository.addCallRecord(ch, callerId, user.uid, 'voice', 'missed', 0);
      await sendMissedCallNotification(callerId, callerName, user.uid, false);
    } catch {}
    rejectIncomingCall();
    safeBack();
  }, [callerId, callerName, user?.uid, channel]);

  const handleDecline = useCallback(async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.cancel();
    // Shake decline button feedback
    Animated.sequence([
      Animated.timing(btnDeclineShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(btnDeclineShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(btnDeclineShake, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(btnDeclineShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    // Dismiss the notifee call notification (clears lock-screen / status bar)
    try {
      const { cancelAllCallNotifications } = await import('@/services/notifee.service');
      await cancelAllCallNotifications();
    } catch { /* non-critical */ }
    try {
      await updateDoc(doc(db, 'calls', channel), { status: 'rejected', endedAt: serverTimestamp() });
      const ch = `chat-${[user!.uid, callerId].sort().join('-')}`;
      await container.chatRepository.addCallRecord(ch, callerId, user!.uid, 'voice', 'missed', 0);
    } catch {}
    rejectIncomingCall();
    safeBack();
  }, [callerId, user?.uid, channel]);

  const handleAccept = useCallback(async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.cancel();
    // Dismiss the notifee call notification before navigating to active call screen
    try {
      const { cancelAllCallNotifications } = await import('@/services/notifee.service');
      await cancelAllCallNotifications();
    } catch { /* non-critical */ }
    try {
      await updateDoc(doc(db, 'calls', channel), {
        status: 'connected', connectedAt: serverTimestamp(),
      });
      acceptIncomingCall();
      router.replace({
        pathname: '/call/voice-call',
        params: { channel, targetUserId: callerId, targetName: callerName, targetAvatar: callerAvatar || '' },
      });
    } catch {}
  }, [callerId, callerName, callerAvatar, channel]);

  const r1o = ring1.interpolate({ inputRange: [1, 1.85], outputRange: [0.38, 0] });
  const r2o = ring2.interpolate({ inputRange: [1, 1.85], outputRange: [0.22, 0] });
  const r3o = ring3.interpolate({ inputRange: [1, 1.85], outputRange: [0.10, 0] });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Background gradient */}
      <LinearGradient colors={['#0C1A2E', '#0D2240', '#0C1A2E']} style={StyleSheet.absoluteFill} />
      {/* Glow behind avatar */}
      <Animated.View style={[s.glowCircle, { opacity: fadeAnim }]} />

      <Animated.View style={[s.top, { opacity: fadeAnim, paddingTop: insets.top + 28 }]}>
        {/* Status pill */}
        <View style={s.statusPill}>
          <View style={s.statusDot} />
          <Text style={s.statusText}>Incoming Voice Call</Text>
        </View>

        {/* Avatar with ripple rings */}
        <Animated.View style={[s.avatarSection, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.ringContainer}>
            <Animated.View style={[s.ring, s.ringXl, { transform: [{ scale: ring3 }], opacity: r3o }]} />
            <Animated.View style={[s.ring, s.ringLg, { transform: [{ scale: ring2 }], opacity: r2o }]} />
            <Animated.View style={[s.ring, s.ringMd, { transform: [{ scale: ring1 }], opacity: r1o }]} />
            <View style={s.avatarContainer}>
              <Avatar name={callerName} avatarUrl={callerAvatar} size={116} />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: slideAnim }], marginTop: 28 }}>
          <Text style={s.callerName} numberOfLines={1}>{callerName}</Text>
          <Text style={s.callType}>Voice Call</Text>
          {/* Countdown — shows urgency as time runs out */}
          <View style={s.countdownRow}>
            <View style={[s.countdownDot, timeLeft <= 10 && { backgroundColor: '#EF4444' }]} />
            <Text style={[s.countdownText, timeLeft <= 10 && { color: '#EF4444' }]}>
              {timeLeft}s
            </Text>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Actions */}
      <Animated.View style={[s.bottom, { opacity: fadeAnim, paddingBottom: insets.bottom + 44 }]}>
        <View style={s.btnRow}>
          {/* Decline */}
          <View style={s.btnWrap}>
            <Animated.View style={{ transform: [{ translateX: btnDeclineShake }] }}>
              <Pressable onPress={handleDecline} style={({ pressed }) => [s.btn, s.declineBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
            </Animated.View>
            <Text style={s.btnLabel}>Decline</Text>
          </View>

          {/* Minimize */}
          <View style={s.btnWrap}>
            <Pressable onPress={handleMinimize} style={({ pressed }) => [s.btn, s.minimizeBtn, pressed && s.pressed]}>
              <Ionicons name="chevron-down" size={28} color="#fff" />
            </Pressable>
            <Text style={s.btnLabel}>Minimize</Text>
          </View>

          {/* Accept */}
          <View style={s.btnWrap}>
            <Animated.View style={{ transform: [{ scale: btnAcceptScale }] }}>
              <Pressable onPress={handleAccept} style={({ pressed }) => [s.btn, s.acceptBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={32} color="#fff" />
              </Pressable>
            </Animated.View>
            <Text style={s.btnLabel}>Accept</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const AVATAR_SIZE = 128;

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0C1A2E' },
  glowCircle:    {
    position: 'absolute', top: '20%', left: width / 2 - 150,
    width: 300, height: 300, borderRadius: 150,
    backgroundColor: '#0EA5E9', opacity: 0.08,
  },
  top:           { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  statusPill:    {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(14,165,233,0.15)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(14,165,233,0.25)',
    marginBottom: 48,
  },
  statusDot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#0EA5E9' },
  statusText:    { fontSize: 12, fontWeight: '700', color: '#0EA5E9', letterSpacing: 0.5 },
  avatarSection: { alignItems: 'center' },
  ringContainer: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
  ring:          { position: 'absolute', borderRadius: 999, backgroundColor: '#0EA5E9' },
  ringMd:        { width: AVATAR_SIZE + 20, height: AVATAR_SIZE + 20 },
  ringLg:        { width: AVATAR_SIZE + 60, height: AVATAR_SIZE + 60 },
  ringXl:        { width: AVATAR_SIZE + 110, height: AVATAR_SIZE + 110 },
  avatarContainer: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3, borderColor: '#0EA5E9',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0F1729',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 28, elevation: 18,
  },
  callerName: {
    fontSize: 32, fontWeight: '700', color: '#fff',
    letterSpacing: -0.5, textAlign: 'center', maxWidth: 300,
  },
  callType:   { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: '500', marginTop: 6 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  countdownDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#0EA5E9' },
  countdownText: { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  bottom:     { paddingHorizontal: 32, alignItems: 'center' },
  hint:       { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 28, fontWeight: '500' },
  btnRow:     { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
  btnWrap:    { alignItems: 'center', gap: 12 },
  btn: {
    width: 70, height: 70, borderRadius: 35,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
  },
  declineBtn: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  minimizeBtn: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  acceptBtn:  { backgroundColor: '#0EA5E9', shadowColor: '#0EA5E9' },
  pressed:    { opacity: 0.8, transform: [{ scale: 0.94 }] },
  btnLabel:   { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
});
