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
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

  const channel      = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName   = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callDuration, setCallDuration] = useState(0);
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
        if (room.state === 'connected') {
          await room.localParticipant.setMicrophoneEnabled(true);
          setAudioStatus('connected');

          // Sync with global start time or set new one
          const active = activeCallData$.value;
          if (active && !active.startTime) {
            activeCallData$.next({ ...active, startTime: new Date() });
          }

          // Start duration timer only AFTER LiveKit is connected
          if (!timerRef.current) {
            const start = activeCallData$.value?.startTime ? new Date(activeCallData$.value.startTime).getTime() : Date.now();
            const calc = () => Math.floor((Date.now() - start) / 1000);

            setCallDuration(calc());
            timerRef.current = setInterval(() => {
              const d = calc();
              setCallDuration(d);
              callDurationRef.current = d;
            }, 1000);
          }
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
        // Use callDurationRef (not state) — Firestore closure captures stale state value
        await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'voice', 'ended', callDurationRef.current);
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#0C1A2E', '#0D2A4A', '#0C1A2E']} style={StyleSheet.absoluteFill} />

      {/* Glow blob behind avatar */}
      <View style={s.glow} />

      <Animated.View style={[s.body, { opacity: fadeAnim, paddingTop: insets.top + 24 }]}>
        {/* Timer */}
        <Text style={s.timer}>{fmt(callDuration)}</Text>

        {/* Avatar */}
        <View style={s.avatarRing}>
          <Avatar name={targetName} avatarUrl={targetAvatar} size={118} />
        </View>

        <Text style={s.name} numberOfLines={1}>{targetName}</Text>

        {/* Connection status */}
        <View style={s.statusRow}>
          <View style={[s.statusDot, { backgroundColor: audioStatus === 'connected' ? '#22c55e' : audioStatus === 'failed' ? '#EF4444' : '#F59E0B' }]} />
          <Text style={s.statusLabel}>
            {audioStatus === 'connected' ? 'Voice connected' : audioStatus === 'failed' ? 'Connection failed' : 'Connecting…'}
          </Text>
        </View>

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

      {/* Controls */}
      <Animated.View style={[{ opacity: fadeAnim }, { paddingBottom: insets.bottom + 16 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={28} tint="dark" style={s.panel}>
            <Controls isMuted={isMuted} isSpeaker={isSpeaker} onMute={toggleMute} onSpeaker={toggleSpeaker} onMinimize={handleMinimize} onEnd={endCall} />
          </BlurView>
        ) : (
          <View style={s.panelAndroid}>
            <Controls isMuted={isMuted} isSpeaker={isSpeaker} onMute={toggleMute} onSpeaker={toggleSpeaker} onMinimize={handleMinimize} onEnd={endCall} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function Controls({ isMuted, isSpeaker, onMute, onSpeaker, onMinimize, onEnd }: {
  isMuted: boolean; isSpeaker: boolean;
  onMute: () => void; onSpeaker: () => void; onMinimize: () => void; onEnd: () => void;
}) {
  return (
    <View style={cs.wrap}>
      <View style={cs.row}>
        <CtrlBtn icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} color="#EF4444" onPress={onMute} />
        <CtrlBtn icon={isSpeaker ? 'volume-high' : 'volume-medium'} label="Speaker" active={isSpeaker} color="#3b82f6" onPress={onSpeaker} />
        <CtrlBtn icon="chevron-down" label="Minimize" active={false} color="#6366f1" onPress={onMinimize} />
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
        <Ionicons name={icon} size={24} color={active ? '#fff' : 'rgba(255,255,255,0.65)'} />
      </View>
      <Text style={[cs.ctrlLabel, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#0C1A2E' },
  glow:       { position: 'absolute', top: '22%', left: '20%', width: '60%', height: 260, borderRadius: 130, backgroundColor: '#0EA5E9', opacity: 0.06 },
  body:       { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  timer:      { fontSize: 26, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 2, marginBottom: 36, fontVariant: ['tabular-nums'] },
  avatarRing: { width: 136, height: 136, borderRadius: 68, borderWidth: 2.5, borderColor: 'rgba(14,165,233,0.5)', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1729', marginBottom: 26, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 12 },
  name:       { fontSize: 30, fontWeight: '700', color: '#fff', letterSpacing: -0.4, marginBottom: 10, maxWidth: 300, textAlign: 'center' },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 28 },
  statusDot:  { width: 7, height: 7, borderRadius: 3.5 },
  statusLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  waveRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36 },
  waveBar:    { width: 4, height: 30, borderRadius: 2, backgroundColor: '#0EA5E9' },
  mutedLabel: { fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  panel:      { margin: 16, borderRadius: 28, overflow: 'hidden', paddingTop: 6 },
  panelAndroid: { margin: 16, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
});

const cs = StyleSheet.create({
  wrap:      { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 18, alignItems: 'center' },
  row:       { flexDirection: 'row', justifyContent: 'center', gap: 28, marginBottom: 26 },
  ctrlBtn:   { alignItems: 'center', minWidth: 72 },
  circle:    { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ctrlLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  endBtn:    { width: 70, height: 70, borderRadius: 35, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12, marginBottom: 10 },
  endLabel:  { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
});
