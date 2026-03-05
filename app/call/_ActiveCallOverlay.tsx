/**
 * _ActiveCallOverlay.tsx — Laundrix sky-blue, live call banner
 * Fixed: empty-dep useEffects
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  activeCallData$, isActiveCallScreenOpen$, clearAllCallState, maximizeActiveCall,
} from '@/services/callState';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useUser } from '@/components/UserContext';
import { container } from '@/di/container';

export default function ActiveCallOverlay() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [activeCall, setActiveCall]     = useState<any>(null);
  const [visible, setVisible]           = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const slideAnim    = useRef(new Animated.Value(-80)).current;
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordRef = useRef(false);

  useEffect(() => {
    const check = () => {
      const should = activeCallData$.value !== null && !isActiveCallScreenOpen$.value;
      setVisible(prev => {
        if (should && !prev)  { setActiveCall(activeCallData$.value); requestAnimationFrame(showOverlay); return prev; }
        if (!should && prev)  { requestAnimationFrame(hideOverlay); return prev; }
        return prev;
      });
    };
    const d = activeCallData$.subscribe(check);
    const s = isActiveCallScreenOpen$.subscribe(check);
    check();
    return () => { d.unsubscribe(); s.unsubscribe(); stopTimer(); };
  }, []);

  useEffect(() => {
    if (visible && activeCall?.startTime) {
      const elapsed = Math.floor((Date.now() - new Date(activeCall.startTime).getTime()) / 1000);
      setCallDuration(elapsed);
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return stopTimer;
  }, [visible, activeCall?.callId]);

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const showOverlay = () => {
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 11, useNativeDriver: true }).start();
  };

  const hideOverlay = () => {
    Animated.timing(slideAnim, { toValue: -80, duration: 210, useNativeDriver: true }).start(() => {
      setVisible(false);
      stopTimer();
    });
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const maximize = () => {
    if (!activeCall) return;
    maximizeActiveCall();
    const route = activeCall.type === 'video' ? '/call/video-call' : '/call/voice-call';
    router.push({ pathname: route, params: {
      channel: activeCall.callId, targetUserId: activeCall.targetUserId,
      targetName: activeCall.targetName, targetAvatar: activeCall.targetAvatar || '',
    }});
  };

  const endCall = async () => {
    if (!activeCall?.callId) return;
    try {
      await updateDoc(doc(db, 'calls', activeCall.callId), {
        status: 'ended', endedAt: serverTimestamp(), endedBy: user?.uid,
      });
    } catch {}
    if (!hasRecordRef.current && user?.uid && activeCall.targetUserId) {
      hasRecordRef.current = true;
      try {
        const ch = `chat-${[user.uid, activeCall.targetUserId].sort().join('-')}`;
        await container.chatRepository.addCallRecord(ch, user.uid, activeCall.targetUserId, activeCall.type, 'ended', callDuration);
      } catch {}
    }
    clearAllCallState();
    hideOverlay();
  };

  if (!visible || !activeCall) return null;
  const displayName = activeCall.isOutgoing !== false ? activeCall.targetName : (activeCall.callerName || activeCall.targetName);
  const topOffset = Platform.OS === 'ios' ? insets.top + 8 : 36;

  const Content = () => (
    <View style={oc.wrap}>
      {/* Live indicator */}
      <View style={oc.liveWrap}>
        <View style={oc.liveDot} />
        <Ionicons name={activeCall.type === 'video' ? 'videocam' : 'call'} size={16} color="#fff" />
      </View>

      <View style={oc.info}>
        <Text style={oc.name} numberOfLines={1}>{displayName}</Text>
        <View style={oc.row}>
          <View style={oc.liveBadge}>
            <Text style={oc.liveBadgeText}>LIVE</Text>
          </View>
          <Text style={oc.dur}>{fmt(callDuration)}</Text>
        </View>
      </View>

      <TouchableOpacity onPress={endCall} style={oc.endBtn} activeOpacity={0.8}>
        <Ionicons name="call" size={18} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </TouchableOpacity>
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
  touchable:    { borderRadius: 18 },
  card:         { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  cardAndroid:  {},
});

const oc = StyleSheet.create({
  wrap:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14 },
  liveWrap:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(14,165,233,0.2)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  liveDot:      { position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22c55e', borderWidth: 1.5, borderColor: '#0D2240' },
  info:         { flex: 1 },
  name:         { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: -0.2 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  liveBadge:    { backgroundColor: 'rgba(34,197,94,0.22)', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1.5, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' },
  liveBadgeText: { fontSize: 9, fontWeight: '900', color: '#22c55e', letterSpacing: 0.8 },
  dur:          { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  endBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.45, shadowRadius: 6, elevation: 6 },
});
