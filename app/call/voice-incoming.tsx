/**
 * voice-incoming.tsx — Full-screen incoming voice call
 * Design: Light / white theme, sky-blue accents
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Vibration, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

  const channel      = params.channel as string;
  const callerName   = params.name as string;
  const callerAvatar = params.avatar as string | undefined;
  const callerId     = params.callerId as string;

  const hasHandledRef   = useRef(false);
  const fadeAnim        = useRef(new Animated.Value(0)).current;
  const slideAnim       = useRef(new Animated.Value(60)).current;
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

    const ripple = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1.9, duration: 1800, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(400),
      ])).start();

    ripple(ring1, 0); ripple(ring2, 600); ripple(ring3, 1200);

    Animated.loop(Animated.sequence([
      Animated.timing(btnAcceptScale, { toValue: 1.12, duration: 700, useNativeDriver: true }),
      Animated.timing(btnAcceptScale, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();

    return () => { Vibration.cancel(); setIncomingScreenOpen(false); };
  }, []);

  useEffect(() => {
    const sub = incomingCallCountdown$.subscribe((n) => {
      if (n === 0 && !hasHandledRef.current) handleMissed();
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = incomingCallData$.subscribe((data) => {
      if (!data && !hasHandledRef.current) { hasHandledRef.current = true; safeBack(); }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { handleMinimize(); return true; });
    return () => h.remove();
  }, []);

  const safeBack = () =>
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/conversations');
    }, 120);

  const handleMinimize = () => {
    setIncomingScreenOpen(false);
    Vibration.cancel();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/conversations');
  };

  const handleMissed = useCallback(async () => {
    if (hasHandledRef.current || !user?.uid || !callerId) return;
    hasHandledRef.current = true;
    Vibration.cancel();
    try {
      await updateDoc(doc(db, 'calls', channel), { status: 'missed', endedAt: serverTimestamp(), missedReason: 'timeout' });
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
    Animated.sequence([
      Animated.timing(btnDeclineShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(btnDeclineShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(btnDeclineShake, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(btnDeclineShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
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
    try {
      await updateDoc(doc(db, 'calls', channel), { status: 'connected', connectedAt: serverTimestamp() });
      acceptIncomingCall();
      router.replace({ pathname: '/call/voice-call', params: { channel, targetUserId: callerId, targetName: callerName, targetAvatar: callerAvatar || '' } });
    } catch {}
  }, [callerId, callerName, callerAvatar, channel]);

  const r1o = ring1.interpolate({ inputRange: [1, 1.9], outputRange: [0.22, 0] });
  const r2o = ring2.interpolate({ inputRange: [1, 1.9], outputRange: [0.13, 0] });
  const r3o = ring3.interpolate({ inputRange: [1, 1.9], outputRange: [0.06, 0] });

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Decorative blobs */}
      <View style={s.blobTop} />
      <View style={s.blobBottom} />

      {/* Top bar: minimize (left) + pill (center) */}
      <Animated.View style={[s.topBar, { opacity: fadeAnim, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleMinimize} style={({ pressed }) => [s.minimizeBtn, pressed && { opacity: 0.7 }]} hitSlop={10}>
          <Ionicons name="chevron-down" size={20} color="#0284C7" />
        </Pressable>
        <View style={s.callTypePill}>
          <View style={s.callDot} />
          <Text style={s.callTypeText}>Incoming Voice Call</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      {/* Avatar + ripples */}
      <Animated.View style={[s.avatarSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={s.ringContainer}>
          <Animated.View style={[s.ring, s.ringXl, { transform: [{ scale: ring3 }], opacity: r3o }]} />
          <Animated.View style={[s.ring, s.ringLg, { transform: [{ scale: ring2 }], opacity: r2o }]} />
          <Animated.View style={[s.ring, s.ringMd, { transform: [{ scale: ring1 }], opacity: r1o }]} />
          <View style={s.avatarContainer}>
            <Avatar name={callerName} avatarUrl={callerAvatar} size={116} />
          </View>
        </View>
        <Text style={s.callerName} numberOfLines={1}>{callerName}</Text>
        <Text style={s.callSubtitle}>is calling you…</Text>
      </Animated.View>

      {/* Action buttons */}
      <Animated.View style={[s.bottom, { opacity: fadeAnim, paddingBottom: insets.bottom + 40 }]}>
        <View style={s.btnRow}>
          <View style={s.btnWrap}>
            <Animated.View style={{ transform: [{ translateX: btnDeclineShake }] }}>
              <Pressable onPress={handleDecline} style={({ pressed }) => [s.btn, s.declineBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
            </Animated.View>
            <Text style={s.btnLabel}>Decline</Text>
          </View>

          <View style={s.btnWrap}>
            <Animated.View style={{ transform: [{ scale: btnAcceptScale }] }}>
              <Pressable onPress={handleAccept} style={({ pressed }) => [s.btn, s.acceptBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={30} color="#fff" />
              </Pressable>
            </Animated.View>
            <Text style={s.btnLabel}>Accept</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const AVATAR_SIZE = 120;

const s = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#ffffff' },
  blobTop:        { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#E0F2FE', opacity: 0.9 },
  blobBottom:     { position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: '#BAE6FD', opacity: 0.5 },
  topBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  minimizeBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  callTypePill:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#BAE6FD' },
  callDot:        { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#0EA5E9' },
  callTypeText:   { fontSize: 12, fontWeight: '700', color: '#0284C7', letterSpacing: 0.3 },
  avatarSection:  { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -12 },
  ringContainer:  { width: 300, height: 300, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  ring:           { position: 'absolute', borderRadius: 999, backgroundColor: '#0EA5E9' },
  ringMd:         { width: AVATAR_SIZE + 24, height: AVATAR_SIZE + 24 },
  ringLg:         { width: AVATAR_SIZE + 72, height: AVATAR_SIZE + 72 },
  ringXl:         { width: AVATAR_SIZE + 130, height: AVATAR_SIZE + 130 },
  avatarContainer: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3, borderColor: '#0EA5E9',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 14, elevation: 8,
  },
  callerName:   { fontSize: 30, fontWeight: '700', color: '#0F172A', letterSpacing: -0.5, textAlign: 'center', maxWidth: 280 },
  callSubtitle: { fontSize: 15, color: '#64748B', fontWeight: '500', marginTop: 6 },
  bottom:       { paddingHorizontal: 32 },
  btnRow:       { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  btnWrap:      { alignItems: 'center', gap: 12 },
  btn: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10,
  },
  declineBtn: { backgroundColor: '#EF4444', shadowColor: '#EF4444' },
  acceptBtn:  { backgroundColor: '#0EA5E9', shadowColor: '#0EA5E9' },
  pressed:    { opacity: 0.82, transform: [{ scale: 0.93 }] },
  btnLabel:   { fontSize: 13, color: '#64748B', fontWeight: '600' },
});
