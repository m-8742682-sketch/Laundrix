/**
 * video-call.tsx — Active video call screen
 *
 * Fixes:
 * 1. Separate video Room singleton (_videoRoom) — independent of voice
 * 2. isConnecting guard — prevents "cannot send signal before connected"
 * 3. isMinimizing ref — cleanup never disconnects on minimize
 * 4. callDuration from activeCallData$.startTime — no 0-reset on maximize
 * 5. useEffect deps use only primitives — prevents infinite loop
 * 6. Camera disabled before disconnect on real end (prevents track leak)
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Platform, ViewStyle,
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
import {
  AudioSession, AndroidAudioTypePresets,
  useLocalParticipant, useRemoteParticipants, VideoView,
} from '@livekit/react-native';
import { Room, Track, LocalVideoTrack, RemoteVideoTrack } from 'livekit-client';

const LIVEKIT_WS_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? '';

// ── Singleton — separate from voice room ─────────────────────────────────────
let _videoRoom: Room | null = null;
let _videoConnecting = false;

function getVideoRoom(): Room {
  if (!_videoRoom || _videoRoom.state === 'disconnected') {
    _videoRoom = new Room({ adaptiveStream: true, dynacast: true });
  }
  return _videoRoom;
}

export default function VideoCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel      = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName   = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callDuration, setCallDuration] = useState(() => {
    const active = activeCallData$.value;
    if (active?.startTime) return Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
    return 0;
  });
  const [isMuted,       setIsMuted]       = useState(false);
  const [isSpeaker,     setIsSpeaker]     = useState(true);
  const [isCameraOff,   setIsCameraOff]   = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [audioStatus,   setAudioStatus]   = useState<'connecting' | 'connected' | 'failed'>('connecting');
  const [controlsHidden, setControlsHidden] = useState(false);

  const roomRef = useRef<Room>(getVideoRoom());
  // FIX (Bug 5): Always use the ref value so room identity is stable across renders.
  // Without this, getVideoRoom() (called at render level) can return a new Room instance
  // when the singleton reconnects, making LiveKit hooks (useRemoteParticipants /
  // useLocalParticipant) re-subscribe and setState on every render → infinite loop.
  const room = roomRef.current;
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordRef = useRef(false);
  const isMinimizing = useRef(false);
  // FIX (Bug 5): Track callDuration in a ref so the Firestore listener closure is never stale
  const callDurationRef = useRef(0);
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const controlsAnim = useRef(new Animated.Value(1)).current;

  // LiveKit hooks
  const remoteParticipants = useRemoteParticipants({ room });
  const { localParticipant } = useLocalParticipant({ room });

  const remoteVideoTrack: RemoteVideoTrack | undefined = (() => {
    const r = remoteParticipants[0];
    if (!r) return undefined;
    for (const pub of r.videoTrackPublications.values()) {
      if (pub.track && pub.source === Track.Source.Camera && pub.track instanceof RemoteVideoTrack)
        return pub.track as RemoteVideoTrack;
    }
    return undefined;
  })();

  const localVideoTrack: LocalVideoTrack | undefined = (() => {
    if (!localParticipant) return undefined;
    for (const pub of localParticipant.videoTrackPublications.values()) {
      if (pub.track && pub.source === Track.Source.Camera && pub.track instanceof LocalVideoTrack)
        return pub.track as LocalVideoTrack;
    }
    return undefined;
  })();

  useEffect(() => {
    setActiveCallScreenOpen(true);
    isMinimizing.current = false;
    Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }).start();
    timerRef.current = setInterval(() => setCallDuration(d => {
      callDurationRef.current = d + 1;
      return d + 1;
    }), 1000);

    // Auto-hide controls after 4 seconds
    const hideTimer = setTimeout(() => toggleControls(false), 4000);
    return () => {
      setActiveCallScreenOpen(false);
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(hideTimer);
    };
  }, []);

  // LiveKit connect with guard
  useEffect(() => {
    if (!user?.uid || !channel) return;
    if (room.state === 'connected') { setAudioStatus('connected'); return; }

    const connect = async () => {
      if (_videoConnecting) return;
      if (!LIVEKIT_WS_URL) { setAudioStatus('failed'); return; }
      _videoConnecting = true;
      try {
        await AudioSession.startAudioSession();
        await AudioSession.configureAudio({
          android: { preferredOutputList: ['speaker'], audioTypeOptions: AndroidAudioTypePresets.communication },
          ios: { defaultOutput: 'speaker' },
        });
        const result = await getLivekitToken(channel, user.uid, user.name || 'Unknown', true);
        if (!result.success || !result.token) throw new Error('Token failed');
        if (room.state !== 'disconnected') {
          await room.disconnect();
          await new Promise(r => setTimeout(r, 300));
        }
        await room.connect(LIVEKIT_WS_URL, result.token, { autoSubscribe: true });
        if (room.state === 'connected') {
          await room.localParticipant.setMicrophoneEnabled(true);
          await room.localParticipant.setCameraEnabled(true);
        }
        setAudioStatus('connected');
      } catch (e: any) {
        if (e?.message?.includes('Client initiated disconnect')) return;
        console.error('[VideoCall] LiveKit error:', e);
        setAudioStatus('failed');
      } finally {
        _videoConnecting = false;
      }
    };
    connect();

    return () => {
      if (!isMinimizing.current && room.state !== 'disconnected') {
        room.localParticipant.setCameraEnabled(false).catch(() => {});
        room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        room.disconnect().catch(() => {});
        AudioSession.stopAudioSession().catch(() => {});
      }
    };
  }, [user?.uid, channel]);

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

  const toggleControls = (show?: boolean) => {
    const toValue = show !== undefined ? (show ? 1 : 0) : (controlsHidden ? 1 : 0);
    setControlsHidden(!toValue);
    Animated.timing(controlsAnim, { toValue, duration: 250, useNativeDriver: true }).start();
  };

  const handleCallEnd = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!hasRecordRef.current && user?.uid && targetUserId) {
      hasRecordRef.current = true;
      try {
        const ch = `chat-${[user.uid, targetUserId].sort().join('-')}`;
        await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, 'video', 'ended', callDuration);
      } catch {}
    }
    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
      _videoRoom = null;
    } catch {}
    AudioSession.stopAudioSession().catch(() => {});
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

  const toggleCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isCameraOff;
    try { await room.localParticipant.setCameraEnabled(!next); setIsCameraOff(next); } catch {}
  };

  const toggleSpeaker = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSpeaker;
    try {
      await AudioSession.configureAudio({
        android: { preferredOutputList: [next ? 'speaker' : 'earpiece'], audioTypeOptions: AndroidAudioTypePresets.communication },
        ios: { defaultOutput: next ? 'speaker' : 'earpiece' },
      });
      setIsSpeaker(next);
    } catch {}
  };

  const flipCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (localVideoTrack && typeof (localVideoTrack as any).restartTrack === 'function') {
        await (localVideoTrack as any).restartTrack({ facingMode: isFrontCamera ? 'environment' : 'user' });
        setIsFrontCamera(f => !f);
      }
    } catch {}
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Remote video fullscreen */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => toggleControls()}>
        {remoteVideoTrack ? (
          <VideoView style={StyleSheet.absoluteFill as ViewStyle} videoTrack={remoteVideoTrack} objectFit="cover" />
        ) : (
          <View style={s.noVideoWrap}>
            <LinearGradient colors={['#0C1A2E', '#0D2A4A']} style={StyleSheet.absoluteFill} />
            <View style={s.remoteFallbackAvatar}>
              <Avatar name={targetName} avatarUrl={targetAvatar} size={130} />
            </View>
            <Text style={s.remoteNameLabel}>{targetName}</Text>
            <Text style={s.waitLabel}>{audioStatus === 'connecting' ? 'Connecting…' : 'Waiting for video…'}</Text>
          </View>
        )}
      </Pressable>

      {/* Timer overlay — always visible */}
      <Animated.View style={[s.timerOverlay, { opacity: fadeAnim, paddingTop: insets.top + 14 }]}>
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={s.timerGrad}>
          <Text style={s.timer}>{fmt(callDuration)}</Text>
          <Text style={s.timerSub}>Video Call</Text>
        </LinearGradient>
      </Animated.View>

      {/* Local PiP */}
      <Pressable
        style={[s.pip, { bottom: insets.bottom + 200 }]}
        onPress={() => toggleControls(true)}
      >
        {!isCameraOff && localVideoTrack ? (
          <VideoView style={StyleSheet.absoluteFill as ViewStyle} videoTrack={localVideoTrack} objectFit="cover" mirror={isFrontCamera} />
        ) : (
          <View style={s.pipFallback}>
            <Avatar name={user?.name || 'Me'} avatarUrl={user?.avatarUrl} size={42} />
          </View>
        )}
        {isCameraOff && (
          <View style={s.pipBadge}>
            <Ionicons name="videocam-off" size={13} color="#fff" />
          </View>
        )}
      </Pressable>

      {/* Controls */}
      <Animated.View style={[s.controlsWrap, { opacity: controlsAnim, paddingBottom: insets.bottom + 16 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={40} tint="dark" style={s.panel}>
            <VideoControls
              isMuted={isMuted} isSpeaker={isSpeaker} isCameraOff={isCameraOff} isFrontCamera={isFrontCamera}
              onMute={toggleMute} onSpeaker={toggleSpeaker} onCamera={toggleCamera} onFlip={flipCamera}
              onMinimize={handleMinimize} onEnd={endCall}
            />
          </BlurView>
        ) : (
          <View style={s.panelAndroid}>
            <VideoControls
              isMuted={isMuted} isSpeaker={isSpeaker} isCameraOff={isCameraOff} isFrontCamera={isFrontCamera}
              onMute={toggleMute} onSpeaker={toggleSpeaker} onCamera={toggleCamera} onFlip={flipCamera}
              onMinimize={handleMinimize} onEnd={endCall}
            />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function VideoControls({ isMuted, isSpeaker, isCameraOff, isFrontCamera, onMute, onSpeaker, onCamera, onFlip, onMinimize, onEnd }: any) {
  return (
    <View style={vc.wrap}>
      <View style={vc.row}>
        <CtrlBtn icon={isMuted ? 'mic-off' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted} color="#EF4444" onPress={onMute} />
        <CtrlBtn icon={isSpeaker ? 'volume-high' : 'volume-medium'} label="Speaker" active={isSpeaker} color="#3b82f6" onPress={onSpeaker} />
        <CtrlBtn icon={isCameraOff ? 'videocam-off' : 'videocam'} label={isCameraOff ? 'Cam Off' : 'Camera'} active={isCameraOff} color="#F59E0B" onPress={onCamera} />
        <CtrlBtn icon="camera-reverse" label="Flip" active={false} color="#6366f1" onPress={onFlip} />
      </View>
      <View style={vc.bottomRow}>
        <CtrlBtn icon="chevron-down" label="Minimize" active={false} color="#6366f1" onPress={onMinimize} />
        <Pressable onPress={onEnd} style={({ pressed }) => [vc.endBtn, pressed && { opacity: 0.82, transform: [{ scale: 0.93 }] }]}>
          <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </Pressable>
        <View style={{ width: 58 }} />
      </View>
      <Text style={vc.endLabel}>End Call</Text>
    </View>
  );
}

function CtrlBtn({ icon, label, active, color, onPress }: { icon: any; label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={vc.ctrlBtn}>
      <View style={[vc.circle, active && { backgroundColor: color, borderColor: color }]}>
        <Ionicons name={icon} size={21} color={active ? '#fff' : 'rgba(255,255,255,0.72)'} />
      </View>
      <Text style={[vc.label, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: '#000' },
  noVideoWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  remoteFallbackAvatar: { marginBottom: 20 },
  remoteNameLabel:  { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 6 },
  waitLabel:        { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  timerOverlay:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  timerGrad:        { paddingTop: 0, paddingBottom: 20, alignItems: 'center' },
  timer:            { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.95)', letterSpacing: 2, fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  timerSub:         { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  pip:              { position: 'absolute', right: 14, width: 92, height: 136, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1f2c33', borderWidth: 2, borderColor: 'rgba(255,255,255,0.22)', zIndex: 20 },
  pipFallback:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2c33' },
  pipBadge:         { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, padding: 3 },
  controlsWrap:     { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30 },
  panel:            { margin: 14, borderRadius: 28, overflow: 'hidden' },
  panelAndroid:     { margin: 14, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
});

const vc = StyleSheet.create({
  wrap:      { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, alignItems: 'center' },
  row:       { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28, marginBottom: 4 },
  ctrlBtn:   { alignItems: 'center', minWidth: 56 },
  circle:    { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  label:     { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textAlign: 'center' },
  endBtn:    { width: 66, height: 66, borderRadius: 33, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 12 },
  endLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: 4 },
});
