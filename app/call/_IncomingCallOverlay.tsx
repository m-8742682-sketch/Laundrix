/**
 * _IncomingCallOverlay.tsx — Laundrix sky-blue, slides down from top
 * Fixed: empty-dep useEffects (no infinite update loop)
 */

import Avatar from '@/components/Avatar';
import { useUser } from '@/components/UserContext';
import { db } from '@/services/firebase';
import {
  isIncomingScreenOpen$, setIncomingScreenOpen, startIncomingCall, rejectIncomingCall,
  acceptIncomingCall, incomingCallData$, incomingCallCountdown$, isIncomingCallRinging$,
} from '@/services/callState';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import {
  collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View,
} from 'react-native';
import { container } from '@/di/container';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VIBRATION = Platform.OS === 'android' ? [0, 400, 400] : [400];

export default function IncomingCallOverlay() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const slideAnim = useRef(new Animated.Value(-160)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasAddedRef = useRef(false);

  // Countdown + ringing subscriptions
  useEffect(() => {
    const cSub = incomingCallCountdown$.subscribe(setTimeLeft);
    const rSub = isIncomingCallRinging$.subscribe((ringing) => {
      if (!ringing && incomingCallData$.value === null) hideOverlay(true);
    });
    return () => { cSub.unsubscribe(); rSub.unsubscribe(); };
  }, []);

  // Sync local incomingCall state from BehaviorSubject — survives hide/show cycles
  useEffect(() => {
    const sub = incomingCallData$.subscribe(data => {
      if (data) setIncomingCall(data);
    });
    return () => sub.unsubscribe();
  }, []);

  // Visibility
  useEffect(() => {
    const check = () => {
      const callEnded = incomingCallData$.value === null;
      const screenOpen = isIncomingScreenOpen$.value;
      const should = !callEnded && !screenOpen;
      setVisible(prev => {
        if (should && !prev)  { requestAnimationFrame(showOverlay); return prev; }
        // Only clear local incomingCall when the call truly ended, not just because screen opened
        if (!should && prev)  { requestAnimationFrame(() => hideOverlay(callEnded)); return prev; }
        return prev;
      });
    };
    const d = incomingCallData$.subscribe(check);
    const s = isIncomingScreenOpen$.subscribe(check);
    check();
    return () => { d.unsubscribe(); s.unsubscribe(); };
  }, []);

  // Firebase listener — watch for incoming calls
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'calls'), where('targetUserId', '==', user.uid));
    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) return;
      let latest: any = null; let latestTime = 0;
      snapshot.docs.forEach((d) => {
        const data = d.data();
        if (data.status !== 'calling') return;
        const created = data.createdAt?.toDate?.() || new Date();
        if (Date.now() - created.getTime() < 60000 && created.getTime() > latestTime) {
          latestTime = created.getTime();
          latest = { id: d.id, ...data };
        }
      });
      if (latest) {
        setIncomingCall(latest);
        const existing = incomingCallData$.value;
        if (!existing || existing.callId !== latest.id) {
          if (!existing) setIncomingScreenOpen(false);
          startIncomingCall({
            id: `inc_${latest.id}`, callId: latest.id,
            targetUserId: user.uid, targetName: user.name || 'Me',
            targetAvatar: user.avatarUrl || undefined,
            callerId: latest.callerId, callerName: latest.callerName || 'Unknown',
            callerAvatar: latest.callerAvatar, type: latest.type || 'voice',
            status: 'calling', isOutgoing: false,
          });
          hasAddedRef.current = false;
        }
      }
    });
  }, [user?.uid]);

  // Vibration
  useEffect(() => {
    if (visible) Vibration.vibrate(VIBRATION, true);
    else Vibration.cancel();
    return () => Vibration.cancel();
  }, [visible]);

  // Pulse
  useEffect(() => {
    if (!visible) return;
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.07, duration: 600, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, [visible]);

  const showOverlay = () => {
    // Re-read call data from service in case local state was cleared during previous hide
    const latestCall = incomingCallData$.value;
    if (latestCall) setIncomingCall(latestCall);
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
  };

  const hideOverlay = (clearData = false) => {
    Vibration.cancel();
    Animated.timing(slideAnim, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => {
      setVisible(false);
      if (clearData) setIncomingCall(null);
    });
  };

  const addMissedRecord = async () => {
    if (hasAddedRef.current || !user?.uid || !incomingCall) return;
    hasAddedRef.current = true;
    try {
      const ch = `chat-${[user.uid, incomingCall.callerId].sort().join('-')}`;
      await container.chatRepository.addCallRecord(ch, incomingCall.callerId, user.uid, incomingCall.type, 'missed', 0);
    } catch {}
  };

  const maximize = () => {
    if (!incomingCall) return;
    setIncomingScreenOpen(true);
    hideOverlay(false);
    const route = incomingCall.type === 'video' ? '/call/video-incoming' : '/call/voice-incoming';
    router.push({ pathname: route, params: {
      channel: incomingCall.id, name: incomingCall.callerName,
      avatar: incomingCall.callerAvatar, callerId: incomingCall.callerId,
      receiverId: user?.uid,
    }});
  };

  const accept = async () => {
    if (!incomingCall) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Dismiss the call notification before navigating
    try {
      const { cancelAllCallNotifications } = await import('@/services/notifee.service');
      await cancelAllCallNotifications();
    } catch { /* non-critical */ }
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'connected', connectedAt: serverTimestamp() });
    } catch {}
    acceptIncomingCall();
    setIncomingScreenOpen(true);
    hideOverlay(false);
    const route = incomingCall.type === 'video' ? '/call/video-call' : '/call/voice-call';
    router.push({ pathname: route, params: {
      channel: incomingCall.id, targetUserId: incomingCall.callerId,
      targetName: incomingCall.callerName, targetAvatar: incomingCall.callerAvatar || '',
    }});
  };

  const reject = async () => {
    if (!incomingCall) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Dismiss the persistent call notification from the status bar / lock screen
    try {
      const { cancelAllCallNotifications } = await import('@/services/notifee.service');
      await cancelAllCallNotifications();
    } catch { /* non-critical */ }
    try {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'rejected', endedAt: serverTimestamp() });
    } catch {}
    await addMissedRecord();
    rejectIncomingCall();
    hideOverlay(true);
  };

  if (!visible || !incomingCall) return null;
  const isVideo = incomingCall.type === 'video';
  const topOffset = Platform.OS === 'ios' ? insets.top + 8 : 36;

  return (
    <Animated.View style={[s.container, { top: topOffset, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.95} onPress={maximize} style={s.touchable}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={s.card}>
            <OverlayContent
              incomingCall={incomingCall} isVideo={isVideo} timeLeft={timeLeft}
              pulseAnim={pulseAnim} onReject={reject} onAccept={accept}
            />
          </BlurView>
        ) : (
          <LinearGradient colors={['#0D2240', '#0A1A30']} style={[s.card, s.cardAndroid]}>
            <OverlayContent
              incomingCall={incomingCall} isVideo={isVideo} timeLeft={timeLeft}
              pulseAnim={pulseAnim} onReject={reject} onAccept={accept}
            />
          </LinearGradient>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function OverlayContent({ incomingCall, isVideo, timeLeft, pulseAnim, onReject, onAccept }: any) {
  return (
    <View style={oc.wrap}>
      {/* Left */}
      <View style={oc.left}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <View style={oc.avatarRing}>
            <Avatar name={incomingCall.callerName} avatarUrl={incomingCall.callerAvatar} size={44} />
          </View>
        </Animated.View>
        <View style={oc.info}>
          <Text style={oc.name} numberOfLines={1}>{incomingCall.callerName}</Text>
          <View style={oc.row}>
            <View style={oc.badge}>
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={10} color="#0EA5E9" />
              <Text style={oc.badgeText}>{isVideo ? 'Video' : 'Voice'}</Text>
            </View>
            <View style={oc.timerBadge}>
              <Text style={oc.timerText}>{timeLeft}s</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Right */}
      <View style={oc.actions}>
        <TouchableOpacity onPress={onReject} style={oc.rejectBtn} activeOpacity={0.8}>
          <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onAccept} style={oc.acceptBtn} activeOpacity={0.8}>
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', left: 12, right: 12, zIndex: 9999,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 24,
  },
  touchable: { borderRadius: 20 },
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cardAndroid: {},
});

const oc = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, paddingHorizontal: 14 },
  left:      { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarRing: { borderRadius: 26, borderWidth: 2, borderColor: 'rgba(14,165,233,0.6)', overflow: 'hidden' },
  info:      { marginLeft: 10, flex: 1 },
  name:      { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: -0.2 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 3 },
  badge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(14,165,233,0.25)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(14,165,233,0.4)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#0EA5E9' },
  timerBadge: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  timerText:  { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  actions:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rejectBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 6 },
  acceptBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 6 },
});
