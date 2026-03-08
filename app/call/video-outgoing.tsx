/**
 * video-outgoing.tsx — Full-screen outgoing video call
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  setOutgoingScreenOpen, sendIncomingCallNotification, sendMissedCallNotification, activeCallData$,
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
  const callMessageIdRef          = useRef<string | null>(null);

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
        await setDoc(doc(db, 'calls', callId), {
          callerId: user.uid, callerName: user.name || 'Unknown',
          callerAvatar: user.avatarUrl || '',
          targetUserId, targetName, targetAvatar: targetAvatar || '',
          type: 'video', status: 'calling', createdAt: serverTimestamp(),
        });
        startOutgoingCall({
          id: callId, callId, targetUserId, targetName, targetAvatar,
          callerId: user.uid, callerName: user.name || 'Unknown',
          callerAvatar: user.avatarUrl || '',
          type: 'video', status: 'calling', isOutgoing: true,
        });
        await sendIncomingCallNotification(callId, user.uid, user.name || 'Unknown', targetUserId, true);
        // Create call bubble immediately with "calling" status
        if (!hasAddedRecordRef.current && user?.uid) {
          hasAddedRecordRef.current = true;
          const ch = `chat-${[user.uid, targetUserId].sort().join('-')}`;
          const result = await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'video', 'calling', 0);
          callMessageIdRef.current = result?.id || null;
        }
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
        router.replace({ pathname: '/call/video-call', params: { channel: data.callId, targetUserId: data.targetUserId, targetName: data.targetName, targetAvatar: data.targetAvatar || '', callMessageId: callMessageIdRef.current || '' } });
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
        const ch = `chat-${[user!.uid, targetUserId].sort().join('-')}`;
        if (callMessageIdRef.current) {
          await container.chatRepository.updateCallRecord(ch, callMessageIdRef.current, 'missed', 0);
        } else if (!hasAddedRecordRef.current && user?.uid) {
          hasAddedRecordRef.current = true;
          await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'video', 'missed', 0);
        }
        // Notify recipient that they missed this call
        await sendMissedCallNotification(user!.uid, user!.name || 'Unknown', targetUserId, true).catch(() => {});
      }
    } catch {}
    endOutgoingCall();
    setCallState('ended');
    safeBack();
  };

  const r1o = ring1.interpolate({ inputRange: [1, 1.6], outputRange: [0.2, 0] });
  const r2o = ring2.interpolate({ inputRange: [1, 1.6], outputRange: [0.1, 0] });
  const dots = '.'.repeat(dotCount);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={s.blobTop} />
      <View style={s.blobBottom} />

      {/* Top bar: minimize left */}
      <Animated.View style={[s.topBar, { opacity: fadeAnim, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleMinimize} style={({ pressed }) => [s.minimizeBtn, pressed && { opacity: 0.7 }]} hitSlop={10}>
          <Ionicons name="chevron-down" size={20} color="#0284C7" />
        </Pressable>
        <View style={s.statusPill}>
          <Ionicons name="videocam-outline" size={12} color="#0284C7" />
          <Text style={s.statusPillText}>Video Call</Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.View style={[s.avatarSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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

      <Animated.View style={[s.bottom, { opacity: fadeAnim, paddingBottom: insets.bottom + 44 }]}>
        <View style={s.controlRow}>
          <View style={{ width: 72 }} />
          <View style={s.controlWrap}>
            <Animated.View style={{ transform: [{ scale: btnScale }] }}>
              <Pressable onPress={handleEnd} style={({ pressed }) => [s.endBtn, pressed && s.pressed]}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
            </Animated.View>
            <Text style={s.endLabel}>End Call</Text>
          </View>
          <View style={{ width: 72 }} />
        </View>
      </Animated.View>
    </View>
  );
}

const AVATAR = 120;
const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#ffffff' },
  blobTop:       { position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#E0F2FE', opacity: 0.9 },
  blobBottom:    { position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: '#BAE6FD', opacity: 0.5 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  minimizeBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  statusPill:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#BAE6FD' },
  statusPillText: { fontSize: 12, fontWeight: '700', color: '#0284C7', letterSpacing: 0.3 },
  avatarSection: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: -12 },
  ringWrap:      { width: 270, height: 270, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring:          { position: 'absolute', borderRadius: 999, backgroundColor: '#0EA5E9' },
  ringMd:        { width: AVATAR + 22, height: AVATAR + 22 },
  ringLg:        { width: AVATAR + 76, height: AVATAR + 76 },
  avatarBorder:  { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, borderWidth: 3, borderColor: '#0EA5E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 8 },
  name:          { fontSize: 30, fontWeight: '700', color: '#0F172A', letterSpacing: -0.5, textAlign: 'center', maxWidth: 300 },
  status:        { fontSize: 15, color: '#64748B', fontWeight: '500', marginTop: 8, minWidth: 110, textAlign: 'center' },
  bottom:        { paddingHorizontal: 24 },
  controlRow:    { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 8 },
  controlWrap:   { alignItems: 'center', gap: 8 },
  endBtn:        { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 10 },
  pressed:       { opacity: 0.8, transform: [{ scale: 0.93 }] },
  endLabel:      { fontSize: 13, color: '#64748B', fontWeight: '600' },
});
