/**
 * voice-outgoing.tsx — Full-screen outgoing voice call
 * Design: Laundrix sky-blue, Telegram-class feel
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

export default function VoiceOutgoingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const targetUserId  = params.targetUserId as string;
  const targetName    = params.targetName as string;
  const targetAvatar  = params.targetAvatar as string | undefined;

  const [callState, setCallState]   = useState<'calling' | 'ended'>('calling');
  const [dotCount, setDotCount]     = useState(1);
  const hasHandledRef               = useRef(false);
  const hasAddedRecordRef           = useRef(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(60)).current;
  const ring1      = useRef(new Animated.Value(1)).current;
  const ring2      = useRef(new Animated.Value(1)).current;
  const btnScale   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setOutgoingScreenOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 48, friction: 9, useNativeDriver: true }),
    ]).start();

    // Slow gentle ripple for outgoing
    const ripple = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1.6, duration: 2000, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])).start();
    ripple(ring1, 0);
    ripple(ring2, 1000);

    // Pulsing end button
    Animated.loop(Animated.sequence([
      Animated.timing(btnScale, { toValue: 1.1, duration: 900, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 900, useNativeDriver: true }),
    ])).start();

    const dotTimer = setInterval(() => setDotCount(d => d >= 3 ? 1 : d + 1), 600);
    return () => {
      clearInterval(dotTimer);
      setOutgoingScreenOpen(false);
    };
  }, []);

  // Init call doc + callState
  useEffect(() => {
    if (!user?.uid || !targetUserId) return;
    if (outgoingCallData$.value) return; // already initiated

    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const init = async () => {
      try {
        // Parallelize Firestore write and FCM notification for speed
        await Promise.all([
          setDoc(doc(db, 'calls', callId), {
            callerId: user.uid, callerName: user.name || 'Unknown',
            callerAvatar: user.avatarUrl || '',
            targetUserId, targetName, targetAvatar: targetAvatar || '',
            type: 'voice', status: 'calling', createdAt: serverTimestamp(),
          }),
          sendIncomingCallNotification(callId, user.uid, user.name || 'Unknown', targetUserId, false)
        ]);

        startOutgoingCall({
          id: callId, callId, targetUserId, targetName, targetAvatar,
          callerId: user.uid, callerName: user.name || 'Unknown',
          callerAvatar: user.avatarUrl || '',
          type: 'voice', status: 'calling', isOutgoing: true,
        });
      } catch (err) {
        console.error('[VoiceOutgoing] init error:', err);
        safeBack();
      }
    };
    init();
  }, [user?.uid, targetUserId]);

  // Receiver accepted → go to active call (screen handles its own transition)
  useEffect(() => {
    const sub = activeCallData$.subscribe((data) => {
      if (data?.status === 'connected' && callState === 'calling') {
        setCallState('ended');
        // Explicitly close before replace so overlay doesn't race to also navigate
        setOutgoingScreenOpen(false);
        router.replace({
          pathname: '/call/voice-call',
          params: { channel: data.callId, targetUserId: data.targetUserId, targetName: data.targetName, targetAvatar: data.targetAvatar || '' },
        });
      }
    });
    return () => sub.unsubscribe();
  }, [callState]);

  // Remote ended / rejected
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

  const safeBack = () =>
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/conversations');
    }, 120);

  const handleMinimize = () => {
    setOutgoingScreenOpen(false); // signal overlay to show
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/conversations');
  };

  const handleEnd = async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const call = outgoingCallData$.value;
    try {
      if (call?.callId) {
        await updateDoc(doc(db, 'calls', call.callId), {
          status: 'ended', endedAt: serverTimestamp(), endedBy: user?.uid,
        });
        if (!hasAddedRecordRef.current && user?.uid) {
          hasAddedRecordRef.current = true;
          const ch = `chat-${[user.uid, targetUserId].sort().join('-')}`;
          await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'voice', 'missed', 0);
        }
      }
    } catch {}
    endOutgoingCall();
    setCallState('ended');
    safeBack();
  };

  const r1o = ring1.interpolate({ inputRange: [1, 1.6], outputRange: [0.35, 0] });
  const r2o = ring2.interpolate({ inputRange: [1, 1.6], outputRange: [0.18, 0] });
  const dots = '.'.repeat(dotCount);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0C1A2E', '#0D2240', '#0C1A2E']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[s.glow, { opacity: fadeAnim }]} />

      <Animated.View style={[s.top, { opacity: fadeAnim, paddingTop: insets.top + 32 }]}>
        {/* Status pill */}
        <View style={s.statusPill}>
          <Ionicons name="call-outline" size={13} color="#0EA5E9" />
          <Text style={s.statusText}>Voice Call</Text>
        </View>

        {/* Avatar + ripples */}
        <Animated.View style={[s.avatarSection, { transform: [{ translateY: slideAnim }] }]}>
          <View style={s.ringWrap}>
            <Animated.View style={[s.ring, s.ringLg, { transform: [{ scale: ring2 }], opacity: r2o }]} />
            <Animated.View style={[s.ring, s.ringMd, { transform: [{ scale: ring1 }], opacity: r1o }]} />
            <View style={s.avatarBorder}>
              <Avatar name={targetName} avatarUrl={targetAvatar} size={116} />
            </View>
          </View>
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: slideAnim }], marginTop: 30 }}>
          <Text style={s.name} numberOfLines={1}>{targetName}</Text>
          <Text style={s.status}>
            {callState === 'ended' ? 'Call ended' : `Calling${dots}`}
          </Text>
        </Animated.View>
      </Animated.View>

      {/* Controls row: minimize (left) + end (center) */}
      <Animated.View style={[s.bottom, { opacity: fadeAnim, paddingBottom: insets.bottom + 44 }]}>
        <View style={s.controlRow}>
          {/* Minimize */}
          <View style={s.controlWrap}>
            <Pressable onPress={handleMinimize} style={({ pressed }) => [s.controlBtn, pressed && s.pressed]}>
              <Ionicons name="chevron-down" size={22} color="#fff" />
            </Pressable>
            <Text style={s.controlLabel}>Minimize</Text>
          </View>

          {/* End Call */}
          <View style={s.controlWrap}>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={handleEnd} style={({ pressed }) => [s.endBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={34} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
            </Animated.View>
            <Text style={s.endLabel}>End Call</Text>
          </View>

          {/* Spacer to balance layout */}
          <View style={s.controlWrap} />
        </View>
      </Animated.View>
    </View>
  );
}

const AVATAR = 128;
const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#0C1A2E' },
  glow:        { position: 'absolute', top: '18%', left: width / 2 - 150, width: 300, height: 300, borderRadius: 150, backgroundColor: '#0EA5E9', opacity: 0.07 },
  top:         { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(14,165,233,0.12)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(14,165,233,0.2)', marginBottom: 52 },
  statusText:  { fontSize: 12, fontWeight: '700', color: '#0EA5E9', letterSpacing: 0.3 },
  avatarSection: { alignItems: 'center' },
  ringWrap:    { width: 270, height: 270, alignItems: 'center', justifyContent: 'center' },
  ring:        { position: 'absolute', borderRadius: 999, backgroundColor: '#0EA5E9' },
  ringMd:      { width: AVATAR + 22, height: AVATAR + 22 },
  ringLg:      { width: AVATAR + 80, height: AVATAR + 80 },
  avatarBorder: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 2.5, borderColor: 'rgba(14,165,233,0.55)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1729', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 14 },
  name:        { fontSize: 32, fontWeight: '700', color: '#fff', letterSpacing: -0.5, textAlign: 'center', maxWidth: 300 },
  status:      { fontSize: 15, color: 'rgba(255,255,255,0.38)', fontWeight: '500', marginTop: 10, minWidth: 110, textAlign: 'center' },
  bottom:      { paddingHorizontal: 24 },
  controlRow:  { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 8 },
  controlWrap: { alignItems: 'center', gap: 8, minWidth: 72 },
  controlBtn:  { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  controlLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  endBtn:      { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 12 },
  pressed:     { opacity: 0.8, transform: [{ scale: 0.93 }] },
  endLabel:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
});
