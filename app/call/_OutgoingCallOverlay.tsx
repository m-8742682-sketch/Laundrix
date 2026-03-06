/**
 * _OutgoingCallOverlay.tsx — Laundrix sky-blue, outgoing call banner
 */

import Avatar from '@/components/Avatar';
import { useUser } from '@/components/UserContext';
import { db } from '@/services/firebase';
import {
  outgoingCallData$, isOutgoingScreenOpen$, setOutgoingScreenOpen,
  endOutgoingCall, activeCallData$, isActiveCallScreenOpen$,
} from '@/services/callState';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { container } from '@/di/container';

export default function OutgoingCallOverlay() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [outgoingCall, setOutgoingCall] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [dotCount, setDotCount] = useState(1);

  const slideAnim = useRef(new Animated.Value(-80)).current;
  const hasAddedRef = useRef(false);
  const dotTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () => {
      const should = outgoingCallData$.value !== null && !isOutgoingScreenOpen$.value;
      setVisible(prev => {
        if (should && !prev)  { requestAnimationFrame(showOverlay); return prev; }
        if (!should && prev)  { requestAnimationFrame(hideOverlay); return prev; }
        return prev;
      });
    };
    const d = outgoingCallData$.subscribe(check);
    const s = isOutgoingScreenOpen$.subscribe(check);
    check();
    return () => { d.unsubscribe(); s.unsubscribe(); };
  }, []);

  // Watch for call accepted → navigate to active call ONLY if overlay is visible
  // (outgoing screen handles its own navigation when it's still open)
  useEffect(() => {
    const sub = activeCallData$.subscribe((data) => {
      // Don't navigate if the active call screen is already handling it
      if (data && outgoingCallData$.value === null && !isActiveCallScreenOpen$.value) {
        setVisible(prev => {
          if (prev) {
            requestAnimationFrame(() => {
              hideOverlay();
              const route = data.type === 'video' ? '/call/video-call' : '/call/voice-call';
              router.replace({ pathname: route, params: {
                channel: data.callId, targetUserId: data.targetUserId,
                targetName: data.targetName, targetAvatar: data.targetAvatar || '',
              }});
            });
          }
          return prev;
        });
      }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (visible) {
      dotTimerRef.current = setInterval(() => setDotCount(d => d >= 3 ? 1 : d + 1), 500);
      return () => { if (dotTimerRef.current) clearInterval(dotTimerRef.current); };
    }
  }, [visible]);

  const showOverlay = () => {
    setOutgoingCall(outgoingCallData$.value);
    hasAddedRef.current = false;
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }).start();
  };

  const hideOverlay = () => {
    Animated.timing(slideAnim, { toValue: -80, duration: 210, useNativeDriver: true }).start(() => {
      setVisible(false);
      setOutgoingCall(null);
    });
  };

  const maximize = () => {
    if (!outgoingCall) return;
    setOutgoingScreenOpen(true);
    hideOverlay();
    const route = outgoingCall.type === 'video' ? '/call/video-outgoing' : '/call/voice-outgoing';
    router.push({ pathname: route, params: {
      targetUserId: outgoingCall.targetUserId,
      targetName: outgoingCall.targetName,
      targetAvatar: outgoingCall.targetAvatar || '',
    }});
  };

  const endCall = async () => {
    if (!outgoingCall?.callId) return;
    try {
      await updateDoc(doc(db, 'calls', outgoingCall.callId), {
        status: 'ended', endedAt: serverTimestamp(), endedBy: user?.uid,
      });
    } catch {}
    if (!hasAddedRef.current && user?.uid) {
      hasAddedRef.current = true;
      try {
        const ch = `chat-${[user.uid, outgoingCall.targetUserId].sort().join('-')}`;
        await container.chatRepository.addCallRecord(ch, user.uid, outgoingCall.targetUserId, outgoingCall.type, 'missed', 0);
      } catch {}
    }
    endOutgoingCall();
    hideOverlay();
  };

  if (!visible || !outgoingCall) return null;
  const isVideo = outgoingCall.type === 'video';
  const topOffset = Platform.OS === 'ios' ? insets.top + 8 : 36;
  const dots = '.'.repeat(dotCount);

  const Content = () => (
    <View style={oc.wrap}>
      <View style={oc.avatarRing}>
        <Avatar name={outgoingCall.targetName} avatarUrl={outgoingCall.targetAvatar} size={44} />
      </View>
      <View style={oc.info}>
        <Text style={oc.name} numberOfLines={1}>{outgoingCall.targetName}</Text>
        <View style={oc.row}>
          <View style={oc.badge}>
            <Ionicons name={isVideo ? 'videocam' : 'call'} size={10} color="#0EA5E9" />
            <Text style={oc.badgeText}>{isVideo ? 'Video' : 'Voice'}</Text>
          </View>
          <Text style={oc.status}>Calling{dots}</Text>
        </View>
      </View>
      <Pressable style={({ pressed }) => [oc.endBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.93 }] }]} onPress={endCall}>
        <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </Pressable>
    </View>
  );

  return (
    <Animated.View style={[s.container, { top: topOffset, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.95} onPress={maximize} style={s.touchable}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={s.card}><Content /></BlurView>
        ) : (
          <LinearGradient colors={['#0D2240', '#0A1A30']} style={[s.card, s.cardAndroid]}><Content /></LinearGradient>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', left: 12, right: 12, zIndex: 9999,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 18, elevation: 22,
  },
  touchable:   { borderRadius: 18 },
  card:        { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  cardAndroid: {},
});

const oc = StyleSheet.create({
  wrap:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  avatarRing: { borderRadius: 26, borderWidth: 2, borderColor: 'rgba(14,165,233,0.55)', overflow: 'hidden' },
  info:     { flex: 1 },
  name:     { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: -0.2 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(14,165,233,0.2)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(14,165,233,0.35)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#0EA5E9' },
  status:   { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', minWidth: 65 },
  endBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 6 },
});
