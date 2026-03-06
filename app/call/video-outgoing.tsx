/**
 * video-outgoing.tsx — Full-screen outgoing video call
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useUser } from '@/components/UserContext';
import Avatar from '@/components/Avatar';
import { container } from '@/di/container';
import {
  startOutgoingCall, endOutgoingCall, outgoingCallData$,
  setOutgoingScreenOpen, sendIncomingCallNotification, activeCallData$,
} from '@/services/callState';

const { width } = Dimensions.get('window');

export default function VideoOutgoingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const targetUserId = params.targetUserId as string;
  const targetName   = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callState, setCallState] = useState<'calling' | 'ended'>('calling');
  const [dotCount, setDotCount]   = useState(1);
  const hasHandledRef             = useRef(false);
  const hasAddedRecordRef         = useRef(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;
  const ring1     = useRef(new Animated.Value(1)).current;
  const ring2     = useRef(new Animated.Value(1)).current;
  const btnScale  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setOutgoingScreenOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 48, friction: 9, useNativeDriver: true }),
    ]).start();

    const ripple = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(700),
      ])).start();
    ripple(ring1, 0); ripple(ring2, 1000);

    Animated.loop(Animated.sequence([
      Animated.timing(btnScale, { toValue: 1.1, duration: 900, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();

    const dotTimer = setInterval(() => setDotCount(d => d >= 3 ? 1 : d + 1), 600);
    return () => { clearInterval(dotTimer); setOutgoingScreenOpen(false); };
  }, []);

  useEffect(() => {
    if (!user?.uid || !targetUserId || outgoingCallData$.value) return;
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const init = async () => {
      try {
        // Parallelize for speed
        await Promise.all([
          setDoc(doc(db, 'calls', callId), {
            callerId: user.uid, callerName: user.name || 'Unknown',
            callerAvatar: user.avatarUrl || '',
            targetUserId, targetName, targetAvatar: targetAvatar || '',
            type: 'video', status: 'calling', createdAt: serverTimestamp(),
          }),
          sendIncomingCallNotification(callId, user.uid, user.name || 'Unknown', targetUserId, true)
        ]);

        startOutgoingCall({
          id: callId, callId, targetUserId, targetName, targetAvatar,
          callerId: user.uid, callerName: user.name || 'Unknown',
          callerAvatar: user.avatarUrl || '',
          type: 'video', status: 'calling', isOutgoing: true,
        });
      } catch (err) {
        console.error('[VideoOutgoing] init error:', err);
        safeBack();
      }
    };
    init();
  }, [user?.uid, targetUserId]);

  useEffect(() => {
    const sub = activeCallData$.subscribe((data) => {
      if (data?.status === 'connected' && callState === 'calling') {
        setCallState('ended');
        setOutgoingScreenOpen(false); // prevent overlay from racing
        router.replace({ pathname: '/call/video-call', params: { channel: data.callId, targetUserId: data.targetUserId, targetName: data.targetName, targetAvatar: data.targetAvatar || '' } });
      }
    });
    return () => sub.unsubscribe();
  }, [callState]);

  useEffect(() => {
    let hadData = !!outgoingCallData$.value;
    const sub = outgoingCallData$.subscribe((data) => {
      if (data) { hadData = true; return; }
      if (hadData && callState === 'calling' && !hasHandledRef.current) {
        hasHandledRef.current = true;
        setCallState('ended');
        setTimeout(safeBack, 1000);
      }
    });
    return () => sub.unsubscribe();
  }, [callState]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { handleMinimize(); return true; });
    return () => h.remove();
  }, []);

  const safeBack = () => setTimeout(() => {
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/conversations');
  }, 120);

  const handleMinimize = () => {
    setOutgoingScreenOpen(false);
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/conversations');
  };

  const handleEnd = async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const call = outgoingCallData$.value;
    try {
      if (call?.callId) {
        await updateDoc(doc(db, 'calls', call.callId), { status: 'ended', endedAt: serverTimestamp(), endedBy: user?.uid });
        if (!hasAddedRecordRef.current && user?.uid) {
          hasAddedRecordRef.current = true;
          const ch = `chat-${[user.uid, targetUserId].sort().join('-')}`;
          await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'video', 'missed', 0);
        }
      }
    } catch {}
    endOutgoingCall();
    setCallState('ended');
    safeBack();
  };

  const r1o = ring1.interpolate({ inputRange: [1, 1.6], outputRange: [0.32, 0] });
  const r2o = ring2.interpolate({ inputRange: [1, 1.6], outputRange: [0.16, 0] });
  const dots = '.'.repeat(dotCount);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0C1A2E', '#0D2240', '#0C1A2E']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[s.glow, { opacity: fadeAnim }]} />

      <Animated.View style={[s.top, { opacity: fadeAnim, paddingTop: insets.top + 32 }]}>
        <View style={s.statusPill}>
          <Ionicons name="videocam-outline" size={13} color="#0EA5E9" />
          <Text style={s.statusText}>Video Call</Text>
        </View>

        <Animated.View style={[{ alignItems: 'center' }, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.ringWrap}>
            <Animated.View style={[s.ring, s.ringLg, { transform: [{ scale: ring2 }], opacity: r2o }]} />
            <Animated.View style={[s.ring, s.ringMd, { transform: [{ scale: ring1 }], opacity: r1o }]} />
            <View style={s.avatarBorder}>
              <Avatar name={targetName} avatarUrl={targetAvatar} size={116} />
            </View>
          </View>
          <Text style={s.name} numberOfLines={1}>{targetName}</Text>
          <Text style={s.status}>{callState === 'ended' ? 'Call ended' : `Calling${dots}`}</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.bottom, { opacity: fadeAnim, paddingBottom: insets.bottom + 44 }]}>
        <View style={s.controlRow}>
          <View style={s.controlWrap}>
            <Pressable onPress={handleMinimize} style={({ pressed }) => [s.controlBtn, pressed && s.pressed]}>
              <Ionicons name="chevron-down" size={22} color="#fff" />
            </Pressable>
            <Text style={s.controlLabel}>Minimize</Text>
          </View>

          <View style={s.controlWrap}>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={handleEnd} style={({ pressed }) => [s.endBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
            </Animated.View>
            <Text style={s.endLabel}>End Call</Text>
          </View>

          <View style={s.controlWrap} />
        </View>
      </Animated.View>
    </View>
  );
}

const AVATAR = 128;
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0C1A2E' },
  glow:        { position: 'absolute', top: '18%', left: width / 2 - 140, width: 280, height: 280, borderRadius: 140, backgroundColor: '#0EA5E9', opacity: 0.07 },
  top:         { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(14,165,233,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)', marginBottom: 52 },
  statusText:  { fontSize: 12, fontWeight: '700', color: '#0EA5E9' },
  ringWrap:    { width: 270, height: 270, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring:        { position: 'absolute', borderRadius: 999, backgroundColor: '#0EA5E9' },
  ringMd:      { width: AVATAR + 22, height: AVATAR + 22 },
  ringLg:      { width: AVATAR + 80, height: AVATAR + 80 },
  avatarBorder: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2.5, borderColor: 'rgba(14,165,233,0.55)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1729', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 22, elevation: 14 },
  name:        { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.5, textAlign: 'center', maxWidth: 300, marginBottom: 10 },
  status:      { fontSize: 15, color: 'rgba(255,255,255,0.36)', fontWeight: '500', minWidth: 110, textAlign: 'center' },
  bottom:      { paddingHorizontal: 24 },
  controlRow:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 8 },
  controlWrap: { alignItems: 'center', gap: 8, minWidth: 72 },
  controlBtn:  { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  endBtn:      { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 12 },
  pressed:     { opacity: 0.8, transform: [{ scale: 0.93 }] },
  endLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
});
