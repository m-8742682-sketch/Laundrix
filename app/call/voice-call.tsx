/**
 * voice-call.tsx — Active voice call screen
 *
 * Architecture:
 * 1. Global singleton Room — no double WebRTC negotiation on minimize/maximize
 * 2. isConnecting lock — prevents race condition where disconnect fires before connect
 * 3. isMinimizing ref — cleanup never disconnects on minimize, only on real end
 * 4. hasEndedRef — single-fire guard, prevents double-disconnect from Firestore + cleanup
 * 5. Timer starts only after LiveKit room is actually connected (not during "Connecting...")
 * 6. Cleanup order: disconnect() first (lets LiveKit finalize), removeAllListeners() after
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { useUser } from '@/components/UserContext';
import Avatar from '@/components/Avatar';
import { container } from '@/di/container';
import {
  setActiveCallScreenOpen, minimizeActiveCall, clearAllCallState, activeCallData$,
} from '@/services/callState';
import { getLivekitToken } from '@/services/api';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';
import { Room } from 'livekit-client';

const LIVEKIT_WS_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';

// ── Singleton Room — survives minimize/maximize ───────────────────────────────
let _voiceRoom: Room | null = null;
let _voiceConnecting = false; // connection guard

function getVoiceRoom(): Room {
  if (!_voiceRoom || _voiceRoom.state === 'disconnected') {
    _voiceRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
    });
  }
  return _voiceRoom;
}

export default function VoiceCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel        = params.channel as string;
  const targetUserId   = params.targetUserId as string;
  const targetName     = params.targetName as string;
  const targetAvatar   = params.targetAvatar as string | undefined;
  const callMessageId  = params.callMessageId as string | undefined;

  const [callDuration, setCallDuration] = useState(() => {
    const active = activeCallData$.value;
    if (active?.startTime) return Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
    return 0;
  });
  const [isMuted,     setIsMuted]     = useState(false);
  const [isSpeaker,   setIsSpeaker]   = useState(false);
  const [audioStatus, setAudioStatus] = useState<'connecting' | 'connected' | 'failed'>('connecting');

  const roomRef = useRef<Room>(getVoiceRoom());
  // FIX (Bug 5): Stable room reference — prevents LiveKit hooks from re-subscribing each render
  const room = roomRef.current;
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordRef    = useRef(false);
  const hasEndedRef     = useRef(false); // GUARD: prevents double-disconnect from Firestore + cleanup
  const isMinimizing    = useRef(false);
  const callDurationRef = useRef(0);     // Track duration in ref so Firestore closure is never stale

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const wave1      = useRef(new Animated.Value(0.4)).current;
  const wave2      = useRef(new Animated.Value(0.7)).current;
  const wave3      = useRef(new Animated.Value(0.5)).current;
  const wave4      = useRef(new Animated.Value(0.8)).current;
  const wave5      = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    setActiveCallScreenOpen(true);
    isMinimizing.current = false;
    hasEndedRef.current  = false; // reset on every mount
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();

    const animWave = (a: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(a, { toValue: 1, duration: 280 + Math.random() * 200, useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.2, duration: 280 + Math.random() * 200, useNativeDriver: true }),
      ])).start();
    animWave(wave1, 0); animWave(wave2, 80); animWave(wave3, 160); animWave(wave4, 240); animWave(wave5, 320);

    return () => {
      setActiveCallScreenOpen(false);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // LiveKit connect with guard
  useEffect(() => {
    if (!user?.uid || !channel) return;
    if (room.state === 'connected') {
      setAudioStatus('connected');
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setCallDuration(d => {
          callDurationRef.current = d + 1;
          return d + 1;
        }), 1000);
      }
      return;
    }

    const connect = async () => {
      if (_voiceConnecting) return;
      if (!LIVEKIT_WS_URL) { setAudioStatus('failed'); return; }
      _voiceConnecting = true;
      try {
        await AudioSession.startAudioSession();
        await AudioSession.configureAudio({
          android: { preferredOutputList: ['earpiece', 'speaker'], audioTypeOptions: AndroidAudioTypePresets.communication },
          ios: { defaultOutput: 'earpiece' },
        });
        const result = await getLivekitToken(channel, user.uid, user.name || 'Unknown', false);
        if (!result.success || !result.token) throw new Error('Token failed');

        if (room.state !== 'disconnected') {
          await room.disconnect();
          await new Promise(r => setTimeout(r, 300));
        }
        await room.connect(LIVEKIT_WS_URL, result.token, { autoSubscribe: true });
        if (room.state === 'connected') await room.localParticipant.setMicrophoneEnabled(true);
        setAudioStatus('connected');
        // Start duration timer only AFTER LiveKit is connected — connecting time doesn't count
        if (!timerRef.current) {
          timerRef.current = setInterval(() => setCallDuration(d => {
            callDurationRef.current = d + 1;
            return d + 1;
          }), 1000);
        }
      } catch (e: any) {
        if (e?.message?.includes('Client initiated disconnect')) return; // expected on minimize
        console.error('[VoiceCall] LiveKit error:', e);
        setAudioStatus('failed');
      } finally {
        _voiceConnecting = false;
      }
    };
    connect();

    return () => {
      // Only disconnect here if the call wasn't already ended by handleCallEnd.
      // hasEndedRef guards against double-disconnect which causes LiveKit ghost PeerConnections.
      if (!isMinimizing.current && !hasEndedRef.current) {
        const r = _voiceRoom;
        if (r && r.state !== 'disconnected') {
          _voiceRoom = null;          // null FIRST so getVoiceRoom() won't return zombie
          r.disconnect().catch(() => {});
          r.removeAllListeners();     // after disconnect
          AudioSession.stopAudioSession().catch(() => {});
        }
      }
    };
  }, [user?.uid, channel]);

  // Firestore status listener
  useEffect(() => {
    if (!channel) return;
    const unsub = onSnapshot(doc(db, 'calls', channel), (snap) => {
      const data = snap.data();
      if (!data) return;
      if (['ended', 'rejected', 'missed'].includes(data.status)) handleCallEnd();
    });
    return () => unsub();
  }, [channel]);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { handleMinimize(); return true; });
    return () => h.remove();
  }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleCallEnd = async () => {
    // GUARD: Firestore listener, endCall button, and useEffect cleanup can all call this.
    // Without the guard, multiple concurrent disconnects corrupt LiveKit's internal state
    // and create ghost PeerConnections that keep reconnecting (pc:DEBUG 0..8 in logs).
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;

    if (timerRef.current) clearInterval(timerRef.current);

    if (!hasRecordRef.current && user?.uid && targetUserId) {
      hasRecordRef.current = true;
      try {
        const ch = `chat-${[user.uid, targetUserId].sort().join('-')}`;
        if (callMessageId) {
          // Update existing "calling" bubble to "ended" with duration
          await container.chatRepository.updateCallRecord(ch, callMessageId, 'ended', callDurationRef.current);
        } else {
          // Fallback: create new record if no callMessageId (e.g., incoming side)
          await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'voice', 'ended', callDurationRef.current);
        }
      } catch {}
    }

    // Stop audio hardware FIRST to prevent ping-timeout reconnect from leaking audio
    AudioSession.stopAudioSession().catch(() => {});

    // Capture + null BEFORE awaiting so getVoiceRoom() won't return the zombie room
    const roomToClose = _voiceRoom;
    _voiceRoom = null;

    try {
      await roomToClose?.localParticipant?.setMicrophoneEnabled(false);
      await roomToClose?.disconnect();    // LiveKit internal cleanup
      roomToClose?.removeAllListeners();
    } catch {}

    clearAllCallState();
    setTimeout(() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/conversations'); }, 100);
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try { await updateDoc(doc(db, 'calls', channel), { status: 'ended', endedAt: serverTimestamp(), endedBy: user?.uid }); } catch {}
    await handleCallEnd();
  };

  const handleMinimize = () => {
    isMinimizing.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeActiveCall();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  };

  const toggleMute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await room.localParticipant.setMicrophoneEnabled(isMuted); setIsMuted(p => !p); } catch {}
  };

  const toggleSpeaker = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSpeaker;
    try {
      await AudioSession.configureAudio({
        android: { preferredOutputList: [next ? 'speaker' : 'earpiece'], audioTypeOptions: AndroidAudioTypePresets.communication },
        ios: { defaultOutput: next ? 'speaker' : 'earpiece' },
      });
      setIsSpeaker(p => !p);
    } catch {}
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={s.blobTop} />

      {/* Minimize button top-left */}
      <Animated.View style={[s.topBar, { opacity: fadeAnim, paddingTop: insets.top + 8 }]}>
        <Pressable onPress={handleMinimize} style={({ pressed }) => [s.minimizeBtn, pressed && { opacity: 0.7 }]} hitSlop={10}>
          <Ionicons name="chevron-down" size={20} color="#0284C7" />
        </Pressable>
        <View style={s.callTypePill}>
          <View style={[s.statusDotSmall, { backgroundColor: audioStatus === 'connected' ? '#22c55e' : audioStatus === 'failed' ? '#EF4444' : '#F59E0B' }]} />
          <Text style={s.callTypeText}>
            {audioStatus === 'connected' ? 'Voice connected' : audioStatus === 'failed' ? 'Connection failed' : 'Connecting…'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </Animated.View>

      <Animated.View style={[s.body, { opacity: fadeAnim }]}>
        {/* Timer */}
        <Text style={s.timer}>{fmt(callDuration)}</Text>

        {/* Avatar */}
        <View style={s.avatarRing}>
          <Avatar name={targetName} avatarUrl={targetAvatar} size={118} />
        </View>

        <Text style={s.name} numberOfLines={1}>{targetName}</Text>

        {/* Voice wave */}
        {audioStatus === 'connected' && !isMuted && (
          <View style={s.waveRow}>
            {[wave1, wave2, wave3, wave4, wave5].map((a, i) => (
              <Animated.View key={i} style={[s.waveBar, { transform: [{ scaleY: a }] }]} />
            ))}
          </View>
        )}
        {isMuted && <Text style={s.mutedLabel}>🔇 Microphone muted</Text>}
      </Animated.View>

      {/* Controls panel */}
      <Animated.View style={[{ opacity: fadeAnim }, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.panel}>
          <Controls isMuted={isMuted} isSpeaker={isSpeaker} onMute={toggleMute} onSpeaker={toggleSpeaker} onEnd={endCall} />
        </View>
      </Animated.View>
    </View>
  );
}


function Controls({ isMuted, isSpeaker, onMute, onSpeaker, onEnd }: {
  isMuted: boolean; isSpeaker: boolean;
  onMute: () => void; onSpeaker: () => void; onEnd: () => void;
}) {
  return (
    <View style={cs.wrap}>
      <View style={cs.row}>
        <CtrlBtn icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} color="#EF4444" onPress={onMute} />
        <CtrlBtn icon={isSpeaker ? 'volume-high' : 'volume-medium'} label="Speaker" active={isSpeaker} color="#0EA5E9" onPress={onSpeaker} />
      </View>
      <Pressable onPress={onEnd} style={({ pressed }) => [cs.endBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.94 }] }]}>
        <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
      </Pressable>
      <Text style={cs.endLabel}>End Call</Text>
    </View>
  );
}

function CtrlBtn({ icon, label, active, color, onPress }: { icon: any; label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={cs.ctrlBtn}>
      <View style={[cs.circle, active && { backgroundColor: color, borderColor: color }]}>
        <Ionicons name={icon} size={24} color={active ? '#fff' : '#64748B'} />
      </View>
      <Text style={[cs.ctrlLabel, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#ffffff' },
  blobTop:       { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: '#E0F2FE', opacity: 0.8 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  minimizeBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F0F9FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BAE6FD' },
  callTypePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#E2E8F0' },
  statusDotSmall: { width: 7, height: 7, borderRadius: 3.5 },
  callTypeText:  { fontSize: 12, fontWeight: '600', color: '#64748B' },
  body:          { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 20 },
  timer:         { fontSize: 28, fontWeight: '700', color: '#0284C7', letterSpacing: 2, marginBottom: 36, fontVariant: ['tabular-nums'] },
  avatarRing:    { width: 136, height: 136, borderRadius: 68, borderWidth: 3, borderColor: '#0EA5E9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF', marginBottom: 26, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  name:          { fontSize: 28, fontWeight: '700', color: '#0F172A', letterSpacing: -0.4, marginBottom: 10, maxWidth: 300, textAlign: 'center' },
  waveRow:       { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, marginTop: 8 },
  waveBar:       { width: 4, height: 30, borderRadius: 2, backgroundColor: '#0EA5E9' },
  mutedLabel:    { fontSize: 13, color: '#94A3B8', fontWeight: '500', marginTop: 8 },
  panel:         { margin: 16, borderRadius: 24, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  panelAndroid:  { margin: 16, borderRadius: 24, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
});

const cs = StyleSheet.create({
  wrap:      { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 20, alignItems: 'center' },
  row:       { flexDirection: 'row', justifyContent: 'center', gap: 32, marginBottom: 24 },
  ctrlBtn:   { alignItems: 'center', minWidth: 72 },
  circle:    { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ctrlLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  endBtn:    { width: 68, height: 68, borderRadius: 34, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 10, marginBottom: 8 },
  endLabel:  { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
});
