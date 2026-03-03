/**
 * Video Call Screen — WhatsApp-style Professional UI
 *
 * Uses LiveKit for real video + audio. Falls back gracefully if connection fails.
 * Features: mute, camera off, flip camera, minimize, live duration timer.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  BackHandler,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  doc, updateDoc, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import {
  setActiveCallScreenOpen, minimizeActiveCall, clearAllCallState, activeCallData$,
} from "@/services/callState";
import { getLivekitToken } from "@/services/api";

import { AudioSession, AndroidAudioTypePresets, VideoTrack } from "@livekit/react-native";
import { Room, RoomEvent, Track } from "livekit-client";

const LIVEKIT_WS_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "";

export default function VideoCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel      = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName   = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callDuration, setCallDuration] = useState(0);
  const [videoStatus, setVideoStatus] = useState<"connecting"|"connected"|"failed">("connecting");
  const [isMuted,      setIsMuted]      = useState(false);
  const [isCameraOff,  setIsCameraOff]  = useState(false);
  const [isFrontCam,   setIsFrontCam]   = useState(true);
  const [remoteRef,    setRemoteRef]    = useState<any>(null);
  const [localRef,     setLocalRef]     = useState<any>(null);
  const [room]                          = useState(() => new Room());

  const durationRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCallRecord    = useRef(false);
  const startTimeRef     = useRef<Date | null>(null);
  const pulseAnim        = useRef(new Animated.Value(1)).current;
  const fadeAnim         = useRef(new Animated.Value(0)).current;

  // ── LiveKit init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !channel) return;

    const init = async () => {
      if (!LIVEKIT_WS_URL || LIVEKIT_WS_URL.includes("YOUR_LIVEKIT")) {
        console.warn("[VideoCall] EXPO_PUBLIC_LIVEKIT_URL not set.");
        setVideoStatus("failed");
        return;
      }
      try {
        await AudioSession.startAudioSession();
        await AudioSession.configureAudio({
          android: { preferredOutputList: ["speaker"], audioTypeOptions: AndroidAudioTypePresets.communication },
          ios:     { defaultOutput: "speaker" },
        });

        const result = await getLivekitToken(channel, user.uid, user.name || "Unknown", true);
        if (!result.success || !result.token) throw new Error("Token unavailable");

        room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
          if (track.kind === Track.Kind.Video)
            setRemoteRef({ participant, publication: pub, source: Track.Source.Camera });
        });
        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Video) setRemoteRef(null);
        });

        await room.connect(LIVEKIT_WS_URL, result.token, { autoSubscribe: true });
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);

        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub) setLocalRef({ participant: room.localParticipant, publication: pub, source: Track.Source.Camera });

        setVideoStatus("connected");
        console.log("[VideoCall] LiveKit connected:", channel);
      } catch (err) {
        console.error("[VideoCall] LiveKit init error:", err);
        setVideoStatus("failed");
      }
    };

    init();
    return () => { room.disconnect().catch(() => {}); AudioSession.stopAudioSession().catch(() => {}); };
  }, [user?.uid, channel]);

  // ── Active call screen ────────────────────────────────────────────────
  useEffect(() => {
    setActiveCallScreenOpen(true);
    const sub = activeCallData$.subscribe((data) => {
      if (data?.startTime && !startTimeRef.current) {
        startTimeRef.current = new Date(data.startTime);
        setCallDuration(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000));
      }
    });
    return () => { setActiveCallScreenOpen(false); sub.unsubscribe(); };
  }, []);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => { minimizeCall(); return true; });
    return () => back.remove();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.1, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 900, useNativeDriver: true }),
    ])).start();
  }, []);

  // ── Firestore listener ────────────────────────────────────────────────
  useEffect(() => {
    if (!channel) return;
    const unsub = onSnapshot(doc(db, "calls", channel), (snap) => {
      const d = snap.data();
      if (!d) return;
      if (["ended","rejected","missed"].includes(d.status)) handleCallEnd();
      else if (d.status === "connected" && !startTimeRef.current) {
        startTimeRef.current = new Date();
        startTimer();
      }
    });
    startTimer();
    return () => { unsub(); stopTimer(); };
  }, [channel]);

  const startTimer = () => {
    if (durationRef.current) return;
    durationRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
  };
  const stopTimer = () => {
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Call end ──────────────────────────────────────────────────────────
  const handleCallEnd = async () => {
    stopTimer();
    if (!hasCallRecord.current && user?.uid && targetUserId) {
      hasCallRecord.current = true;
      try {
        const ch = `chat-${[user.uid, targetUserId].sort().join("-")}`;
        await container.chatRepository.addCallRecord(ch, user.uid, targetUserId, "video", "ended", callDuration);
      } catch {}
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.localParticipant.setCameraEnabled(false);
      await room.disconnect();
    } catch {}
    clearAllCallState();
    setTimeout(() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/conversations"); }, 100);
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try { await updateDoc(doc(db, "calls", channel), { status: "ended", endedAt: serverTimestamp(), endedBy: user?.uid }); } catch {}
    await handleCallEnd();
  };

  const minimizeCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeActiveCall();
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)/dashboard");
  };

  const toggleMute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await room.localParticipant.setMicrophoneEnabled(isMuted); setIsMuted((p) => !p); } catch {}
  };

  const toggleCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try { await room.localParticipant.setCameraEnabled(isCameraOff); setIsCameraOff((p) => !p); } catch {}
  };

  const flipCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextIsFront = !isFrontCam;
    try {
      // Disable camera first, then re-enable with new facing mode
      await room.localParticipant.setCameraEnabled(false);
      await new Promise(r => setTimeout(r, 150)); // brief pause for device to release
      await room.localParticipant.setCameraEnabled(true, {
        facingMode: nextIsFront ? "user" : "environment",
      });
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub) setLocalRef({ participant: room.localParticipant, publication: pub, source: Track.Source.Camera });
      setIsFrontCam(nextIsFront);
    } catch (err) {
      console.warn("[VideoCall] flipCamera error:", err);
    }
  };

  const hasRemoteVideo = !!remoteRef && !isCameraOff;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Background: remote video or dark gradient */}
      {hasRemoteVideo
        ? <VideoTrack trackRef={remoteRef} style={StyleSheet.absoluteFillObject} objectFit="cover" />
        : <LinearGradient colors={["#0a0a1a","#111128"]} style={StyleSheet.absoluteFill} />
      }

      <View style={s.scrim} />

      {/* PiP local video */}
      {localRef && !isCameraOff && (
        <View style={[s.pip, { top: insets.top + 16 }]}>
          <VideoTrack trackRef={localRef} style={s.pipVideo} objectFit="cover" mirror={isFrontCam} />
        </View>
      )}

      {/* Top bar */}
      <Animated.View style={[s.topBar, { opacity: fadeAnim, paddingTop: insets.top + 8 }]}>
        {Platform.OS === "ios"
          ? <BlurView intensity={50} tint="dark" style={s.topBlur}><TopBar name={targetName} avatar={targetAvatar} dur={fmt(callDuration)} connected={videoStatus === "connected"} showAvatar={!hasRemoteVideo} /></BlurView>
          : <View style={s.topAndroid}><TopBar name={targetName} avatar={targetAvatar} dur={fmt(callDuration)} connected={videoStatus === "connected"} showAvatar={!hasRemoteVideo} /></View>
        }
      </Animated.View>

      {/* Bottom controls */}
      <View style={[s.ctrlWrap, { paddingBottom: insets.bottom + 12 }]}>
        {Platform.OS === "ios"
          ? <BlurView intensity={40} tint="dark" style={s.ctrlBlur}><Controls isMuted={isMuted} isCameraOff={isCameraOff} onMute={toggleMute} onCamera={toggleCamera} onFlip={flipCamera} onMinimize={minimizeCall} onEnd={endCall} /></BlurView>
          : <View style={s.ctrlAndroid}><Controls isMuted={isMuted} isCameraOff={isCameraOff} onMute={toggleMute} onCamera={toggleCamera} onFlip={flipCamera} onMinimize={minimizeCall} onEnd={endCall} /></View>
        }
      </View>
    </View>
  );
}

function TopBar({ name, avatar, dur, connected, showAvatar }: { name: string; avatar?: string; dur: string; connected: boolean; showAvatar: boolean }) {
  return (
    <View style={s.topRow}>
      {showAvatar && <View style={s.topAvatarWrap}><Avatar name={name} avatarUrl={avatar} size={40} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={s.topName} numberOfLines={1}>{name}</Text>
        <Text style={s.topSub}>{`📹 • ${dur}`}</Text>
      </View>
    </View>
  );
}

function Controls({ isMuted, isCameraOff, onMute, onCamera, onFlip, onMinimize, onEnd }: {
  isMuted: boolean; isCameraOff: boolean;
  onMute: ()=>void; onCamera: ()=>void; onFlip: ()=>void; onMinimize: ()=>void; onEnd: ()=>void;
}) {
  return (
    <>
      <View style={s.btnRow}>
        <Btn icon={isMuted ? "mic-off" : "mic"}         label={isMuted ? "Unmute":"Mute"}     active={isMuted}      color="#ef4444" onPress={onMute} />
        <Btn icon={isCameraOff ? "videocam-off":"videocam"} label={isCameraOff ? "Cam Off":"Camera"} active={isCameraOff}  color="#ef4444" onPress={onCamera} />
        <Btn icon="camera-reverse"                        label="Flip"                         active={false}        color="#8b5cf6" onPress={onFlip} />
        <Btn icon="chevron-down"                          label="Minimize"                     active={false}        color="#6366f1" onPress={onMinimize} />
      </View>
      <Pressable onPress={onEnd} style={({ pressed }) => [s.endBtn, pressed && { opacity: 0.85 }]}>
        <LinearGradient colors={["#ef4444","#b91c1c"]} style={s.endGrad}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </LinearGradient>
      </Pressable>
    </>
  );
}

function Btn({ icon, label, active, color, onPress }: { icon: any; label: string; active: boolean; color: string; onPress: ()=>void }) {
  return (
    <Pressable onPress={onPress} style={s.btn}>
      <View style={[s.btnCircle, active && { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color={active ? "#fff" : "rgba(255,255,255,0.8)"} />
      </View>
      <Text style={s.btnLabel}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.2)" },
  pip: { position: "absolute", right: 14, width: 100, height: 140, borderRadius: 14, overflow: "hidden", zIndex: 20, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" },
  pipVideo: { width: "100%", height: "100%" },
  topBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 15, paddingHorizontal: 16 },
  topBlur: { borderRadius: 20, overflow: "hidden", padding: 14 },
  topAndroid: { borderRadius: 20, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", padding: 14 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topAvatarWrap: { borderRadius: 20, overflow: "hidden", width: 40, height: 40 },
  topName: { fontSize: 16, fontWeight: "800", color: "#fff" },
  topSub: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2, fontVariant: ["tabular-nums"] },
  ctrlWrap: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20 },
  ctrlBlur: { borderRadius: 28, overflow: "hidden", padding: 20 },
  ctrlAndroid: { borderRadius: 28, backgroundColor: "rgba(0,0,0,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", padding: 20 },
  btnRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginBottom: 24 },
  btn: { alignItems: "center", minWidth: 58 },
  btnCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  btnLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  endBtn: { alignSelf: "center", borderRadius: 40, elevation: 10 },
  endGrad: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
});