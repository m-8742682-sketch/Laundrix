/**
 * Video Call Screen (Active) — FIXED
 *
 * Same fixes as voice-call.tsx:
 * 1. Singleton Room via getSharedRoom() — separate instance from voice call.
 *    Prevents double-Room WebRTC negotiation on minimize/maximize.
 * 2. callDuration starts from activeCallData$.startTime — no 0:01 reset on maximize.
 * 3. isMinimizing ref prevents cleanup from disconnecting on minimize.
 * 4. "Client initiated disconnect" error suppressed on minimize (expected, not a real error).
 * 5. Camera is disabled before disconnect on real end to prevent track leak.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { doc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import {
  setActiveCallScreenOpen, minimizeActiveCall, clearAllCallState, activeCallData$,
} from "@/services/callState";
import { getLivekitToken } from "@/services/api";
import {
  AudioSession,
  AndroidAudioTypePresets,
  useLocalParticipant,
  useRemoteParticipants,
  VideoView,
} from "@livekit/react-native";
import {
  Room,
  Track,
  LocalVideoTrack,
  RemoteVideoTrack,
} from "livekit-client";

const LIVEKIT_WS_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "";

// ── Singleton Room for video calls — separate from voice call singleton ───────
let _sharedVideoRoom: Room | null = null;
function getSharedVideoRoom(): Room {
  if (!_sharedVideoRoom || _sharedVideoRoom.state === "disconnected") {
    _sharedVideoRoom = new Room();
  }
  return _sharedVideoRoom;
}

export default function VideoCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel      = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName   = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  // FIX: initialise duration from activeCallData$.startTime so maximize doesn't reset to 0
  const [callDuration, setCallDuration] = useState(() => {
    const active = activeCallData$.value;
    if (active?.startTime) {
      return Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
    }
    return 0;
  });

  const [isMuted,       setIsMuted]       = useState(false);
  const [isSpeaker,     setIsSpeaker]     = useState(true);
  const [isCameraOff,   setIsCameraOff]   = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [audioStatus,   setAudioStatus]   = useState<"connecting" | "connected" | "failed">("connecting");

  // FIX: use singleton room
  const room = getSharedVideoRoom();

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordRef = useRef(false);
  const isMinimizing = useRef(false);
  const fadeAnim     = useRef(new Animated.Value(0)).current;

  // LiveKit hooks — subscribe to participant track changes
  const remoteParticipants = useRemoteParticipants({ room });
  const { localParticipant } = useLocalParticipant({ room });

  // Get remote camera video track
  const remoteVideoTrack: RemoteVideoTrack | undefined = (() => {
    const remote = remoteParticipants[0];
    if (!remote) return undefined;
    for (const pub of remote.videoTrackPublications.values()) {
      if (pub.track && pub.source === Track.Source.Camera && pub.track instanceof RemoteVideoTrack) {
        return pub.track as RemoteVideoTrack;
      }
    }
    return undefined;
  })();

  // Get local camera video track
  const localVideoTrack: LocalVideoTrack | undefined = (() => {
    if (!localParticipant) return undefined;
    for (const pub of localParticipant.videoTrackPublications.values()) {
      if (pub.track && pub.source === Track.Source.Camera && pub.track instanceof LocalVideoTrack) {
        return pub.track as LocalVideoTrack;
      }
    }
    return undefined;
  })();

  useEffect(() => {
    setActiveCallScreenOpen(true);
    isMinimizing.current = false;
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    timerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => {
      setActiveCallScreenOpen(false);
      if (timerRef.current) clearInterval(timerRef.current);
      // FIX: do NOT disconnect here — only disconnect on real call end
    };
  }, []);

  // LiveKit — FIX: only connect if room is not already connected
  useEffect(() => {
    if (!user?.uid || !channel) return;

    // Already connected (maximize case) — nothing to do
    if (room.state === "connected") {
      setAudioStatus("connected");
      return;
    }

    const init = async () => {
      if (!LIVEKIT_WS_URL) { setAudioStatus("failed"); return; }
      try {
        await AudioSession.startAudioSession();
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ["speaker"],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
          ios: { defaultOutput: "speaker" },
        });

        const result = await getLivekitToken(channel, user.uid, user.name || "Unknown", true);
        if (!result.success || !result.token) throw new Error("Token failed");

        if (room.state !== "disconnected") {
          await room.disconnect();
          await new Promise((r) => setTimeout(r, 300));
        }

        await room.connect(LIVEKIT_WS_URL, result.token, { autoSubscribe: true });

        if (room.state === "connected") {
          await room.localParticipant.setMicrophoneEnabled(true);
          await room.localParticipant.setCameraEnabled(true);
        }
        setAudioStatus("connected");
      } catch (e: any) {
        // "Client initiated disconnect" is expected on minimize — not a real error
        if (e?.message?.includes("Client initiated disconnect")) return;
        console.error("[VideoCall] LiveKit error:", e);
        setAudioStatus("failed");
      }
    };

    init();

    return () => {
      // FIX: only disconnect on real unmount, not minimize
      if (!isMinimizing.current && room.state !== "disconnected") {
        room.localParticipant.setCameraEnabled(false).catch(() => {});
        room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        room.disconnect().catch(() => {});
        AudioSession.stopAudioSession().catch(() => {});
      }
    };
  }, [user?.uid, channel]);

  // Firestore status listener
  useEffect(() => {
    if (!channel) return;
    const unsub = onSnapshot(doc(db, "calls", channel), (snap) => {
      const data = snap.data();
      if (!data) return;
      if (["ended", "rejected", "missed"].includes(data.status)) handleCallEnd();
    });
    return () => unsub();
  }, [channel]);

  // Android back → minimize
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleMinimize();
      return true;
    });
    return () => handler.remove();
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleCallEnd = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!hasRecordRef.current && user?.uid && targetUserId) {
      hasRecordRef.current = true;
      try {
        const chatChannel = `chat-${[user.uid, targetUserId].sort().join("-")}`;
        await container.chatRepository.addCallRecord(
          chatChannel, user.uid, targetUserId, "video", "ended", callDuration
        );
      } catch {}
    }
    // Real end — disable tracks, disconnect, clear singleton
    try {
      await room.localParticipant.setCameraEnabled(false);
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
      _sharedVideoRoom = null;
    } catch {}
    AudioSession.stopAudioSession().catch(() => {});
    clearAllCallState();
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/conversations");
    }, 100);
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await updateDoc(doc(db, "calls", channel), {
        status: "ended", endedAt: serverTimestamp(), endedBy: user?.uid,
      });
    } catch {}
    await handleCallEnd();
  };

  const handleMinimize = () => {
    isMinimizing.current = true; // signal cleanup NOT to disconnect
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeActiveCall();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dashboard");
  };

  const toggleMute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const next = !isMuted;
      await room.localParticipant.setMicrophoneEnabled(!next);
      setIsMuted(next);
    } catch {}
  };

  const toggleCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const next = !isCameraOff;
      await room.localParticipant.setCameraEnabled(!next);
      setIsCameraOff(next);
    } catch {}
  };

  const toggleSpeaker = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const next = !isSpeaker;
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: [next ? "speaker" : "earpiece"],
          audioTypeOptions: AndroidAudioTypePresets.communication,
        },
        ios: { defaultOutput: next ? "speaker" : "earpiece" },
      });
      setIsSpeaker(next);
    } catch {}
  };

  const flipCamera = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const localVid = localVideoTrack;
      if (localVid && typeof (localVid as any).restartTrack === "function") {
        await (localVid as any).restartTrack({
          facingMode: isFrontCamera ? "environment" : "user",
        });
        setIsFrontCamera((f) => !f);
      }
    } catch (e) {
      console.warn("[VideoCall] Flip camera error:", e);
    }
  };

  const ControlPanel = () => (
    <View style={s.controlPanel}>
      <View style={s.ctrlRow}>
        <CtrlBtn icon={isMuted ? "mic-off" : "mic"} label={isMuted ? "Unmute" : "Mute"} active={isMuted} color="#f15c6d" onPress={toggleMute} />
        <CtrlBtn icon={isSpeaker ? "volume-high" : "volume-medium"} label="Speaker" active={isSpeaker} color="#3b82f6" onPress={toggleSpeaker} />
        <CtrlBtn icon={isCameraOff ? "videocam-off" : "videocam"} label={isCameraOff ? "Cam Off" : "Camera"} active={isCameraOff} color="#f59e0b" onPress={toggleCamera} />
        <CtrlBtn icon="camera-reverse" label="Flip" active={false} color="#6366f1" onPress={flipCamera} />
      </View>
      <View style={s.bottomRow}>
        <CtrlBtn icon="chevron-down" label="Minimize" active={false} color="#6366f1" onPress={handleMinimize} />
        <Pressable onPress={endCall} style={({ pressed }) => [s.endBtn, pressed && { opacity: 0.85 }]}>
          <Ionicons name="call" size={34} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
        <View style={{ width: 60 }} />
      </View>
      <Text style={s.endLabel}>End call</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Remote video — full screen background */}
      <View style={s.remoteVideoContainer}>
        {remoteVideoTrack ? (
          <VideoView style={s.videoFill} videoTrack={remoteVideoTrack} objectFit="cover" />
        ) : (
          <View style={s.avatarFullScreen}>
            <View style={s.avatarBorderLarge}>
              <Avatar name={targetName} avatarUrl={targetAvatar} size={140} />
            </View>
            <Text style={s.remoteNameLabel}>{targetName}</Text>
            <Text style={s.waitingLabel}>
              {audioStatus === "connecting" ? "Connecting…" : "Waiting for video…"}
            </Text>
          </View>
        )}
      </View>

      {/* Timer top overlay */}
      <Animated.View style={[s.timerOverlay, { opacity: fadeAnim, paddingTop: insets.top + 12 }]}>
        <Text style={s.timer}>{formatDuration(callDuration)}</Text>
        <Text style={s.timerLabel}>Video Call</Text>
      </Animated.View>

      {/* Local camera PiP — bottom right */}
      <View style={[s.localPip, { bottom: insets.bottom + 220 }]}>
        {!isCameraOff && localVideoTrack ? (
          <VideoView style={s.videoFill} videoTrack={localVideoTrack} objectFit="cover" mirror={isFrontCamera} />
        ) : (
          <View style={s.pipAvatarFallback}>
            <Avatar name={user?.name || "Me"} avatarUrl={user?.avatarUrl} size={44} />
          </View>
        )}
        {isCameraOff && (
          <View style={s.cameraOffBadge}>
            <Ionicons name="videocam-off" size={14} color="#fff" />
          </View>
        )}
      </View>

      {/* Controls panel */}
      <Animated.View style={[s.controlsWrapper, { opacity: fadeAnim, paddingBottom: insets.bottom + 12 }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={40} tint="dark" style={s.blurWrap}>
            <ControlPanel />
          </BlurView>
        ) : (
          <View style={s.androidWrap}>
            <ControlPanel />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function CtrlBtn({ icon, label, active, color, onPress }: {
  icon: any; label: string; active: boolean; color: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={s.ctrlBtn}>
      <View style={[s.ctrlCircle, active && { backgroundColor: color, borderColor: color }]}>
        <Ionicons name={icon} size={22} color={active ? "#fff" : "rgba(255,255,255,0.75)"} />
      </View>
      <Text style={[s.ctrlLabel, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  videoFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const,
  remoteVideoContainer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#0b141a" },
  avatarFullScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b141a" },
  avatarBorderLarge: {
    width: 156, height: 156, borderRadius: 78,
    borderWidth: 3, borderColor: "rgba(37,211,102,0.5)",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1f2c33", marginBottom: 20,
  },
  remoteNameLabel: { fontSize: 26, fontWeight: "700", color: "#fff", marginBottom: 8 },
  waitingLabel: { fontSize: 14, color: "rgba(255,255,255,0.45)" },
  timerOverlay: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", zIndex: 10 },
  timer: {
    fontSize: 22, fontWeight: "700", color: "rgba(255,255,255,0.95)",
    letterSpacing: 2, fontVariant: ["tabular-nums"],
    textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  timerLabel: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: "500", marginTop: 2 },
  localPip: {
    position: "absolute", right: 16,
    width: 90, height: 130, borderRadius: 14,
    overflow: "hidden", backgroundColor: "#1f2c33",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)", zIndex: 20,
  },
  pipAvatarFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#1f2c33" },
  cameraOffBadge: { position: "absolute", bottom: 6, right: 6, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 8, padding: 3 },
  controlsWrapper: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 30 },
  blurWrap: { borderRadius: 28, overflow: "hidden", margin: 16, paddingTop: 4 },
  androidWrap: { margin: 16, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  controlPanel: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, alignItems: "center" },
  ctrlRow: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32, marginBottom: 4 },
  ctrlBtn: { alignItems: "center", minWidth: 58 },
  ctrlCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", marginBottom: 6,
  },
  ctrlLabel: { fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: "600", textAlign: "center" },
  endBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#f15c6d", alignItems: "center", justifyContent: "center",
    shadowColor: "#f15c6d", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
  },
  endLabel: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginBottom: 4 },
});