/**
 * Voice Call Screen — WhatsApp-style Professional UI
 *
 * Uses LiveKit for real audio. Falls back gracefully if audio fails.
 * Features: mute, speaker toggle, minimize, live duration timer.
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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import {
  setActiveCallScreenOpen,
  minimizeActiveCall,
  clearAllCallState,
  activeCallData$,
} from "@/services/callState";
import { getLivekitToken } from "@/services/api";

// LiveKit
import { AudioSession, AndroidAudioTypePresets } from "@livekit/react-native";
import { Room } from "livekit-client";

const LIVEKIT_WS_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "";

export default function VoiceCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callDuration, setCallDuration] = useState(0);
  const [audioStatus, setAudioStatus] = useState<"connecting" | "connected" | "failed">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [room] = useState(() => new Room());

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAddedCallRecord = useRef(false);
  const startTimeRef = useRef<Date | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(0.6)).current;
  const waveAnim2 = useRef(new Animated.Value(0.4)).current;
  const waveAnim3 = useRef(new Animated.Value(0.8)).current;

  // ── LiveKit audio init ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !channel) return;

    const initAudio = async () => {
      if (!LIVEKIT_WS_URL || LIVEKIT_WS_URL.includes("YOUR_LIVEKIT")) {
        console.warn("[VoiceCall] EXPO_PUBLIC_LIVEKIT_URL not configured.");
        setAudioStatus("failed");
        return;
      }

      try {
        await AudioSession.startAudioSession();
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ["earpiece", "speaker"],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
          ios: { defaultOutput: "earpiece" },
        });

        const result = await getLivekitToken(channel, user.uid, user.name || "Unknown", false);
        if (!result.success || !result.token) throw new Error("Token fetch failed");

        await room.connect(LIVEKIT_WS_URL, result.token, { autoSubscribe: true });
        await room.localParticipant.setMicrophoneEnabled(true);
        setAudioStatus("connected");
        console.log("[VoiceCall] LiveKit connected:", channel);
      } catch (err) {
        console.error("[VoiceCall] LiveKit init error:", err);
        setAudioStatus("failed");
      }
    };

    initAudio();
    return () => {
      room.disconnect().catch(() => {});
      AudioSession.stopAudioSession().catch(() => {});
    };
  }, [user?.uid, channel]);

  // ── Active call registration ───────────────────────────────────────────
  useEffect(() => {
    setActiveCallScreenOpen(true);

    const sub = activeCallData$.subscribe((data) => {
      if (data?.startTime && !startTimeRef.current) {
        startTimeRef.current = new Date(data.startTime);
        const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
        setCallDuration(elapsed);
      }
    });

    return () => {
      setActiveCallScreenOpen(false);
      sub.unsubscribe();
    };
  }, []);

  // ── Back → minimize ───────────────────────────────────────────────────
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      minimizeCall();
      return true;
    });
    return () => back.remove();
  }, []);

  // ── Entrance animations ───────────────────────────────────────────────
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    // Sound wave bars
    const animateBar = (anim: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    };
    animateBar(waveAnim1, 0);
    animateBar(waveAnim2, 133);
    animateBar(waveAnim3, 266);
  }, []);

  // ── Firestore call status listener ────────────────────────────────────
  useEffect(() => {
    if (!channel) return;
    const unsub = onSnapshot(doc(db, "calls", channel), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;
      if (["ended", "rejected", "missed"].includes(data.status)) {
        handleCallEnd();
      } else if (data.status === "connected" && !startTimeRef.current) {
        startTimeRef.current = new Date();
        startDurationTimer();
      }
    });
    startDurationTimer();
    return () => {
      unsub();
      stopDurationTimer();
    };
  }, [channel]);

  const startDurationTimer = () => {
    if (durationTimerRef.current) return;
    durationTimerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000);
  };

  const stopDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleCallEnd = async () => {
    stopDurationTimer();
    if (!hasAddedCallRecord.current && user?.uid && targetUserId) {
      hasAddedCallRecord.current = true;
      try {
        const chatChannel = `chat-${[user.uid, targetUserId].sort().join("-")}`;
        await container.chatRepository.addCallRecord(chatChannel, user.uid, targetUserId, "voice", "ended", callDuration);
      } catch {}
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
    } catch {}
    clearAllCallState();
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/conversations");
    }, 100);
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await updateDoc(doc(db, "calls", channel), { status: "ended", endedAt: serverTimestamp(), endedBy: user?.uid });
    } catch {}
    await handleCallEnd();
  };

  const minimizeCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeActiveCall();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dashboard");
  };

  const toggleMute = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted((p) => !p);
    } catch {}
  };

  const toggleSpeaker = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const nextIsSpeaker = !isSpeaker;
      await AudioSession.configureAudio({
        android: {
          preferredOutputList: [nextIsSpeaker ? "speaker" : "earpiece"],
          audioTypeOptions: AndroidAudioTypePresets.communication,
        },
        ios: { defaultOutput: nextIsSpeaker ? "speaker" : "earpiece" },
      });
      setIsSpeaker(nextIsSpeaker);
    } catch {}
  };

  const statusLabel = formatDuration(callDuration);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* Background gradient */}
      <LinearGradient colors={["#0a0a1a", "#0d1b2a", "#0a0a1a"]} style={StyleSheet.absoluteFill} />

      {/* Decorative blobs */}
      <Animated.View style={[styles.blob1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.blob2, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[styles.body, { opacity: fadeAnim, paddingTop: insets.top + 32 }]}>

        {/* Status row */}
        <Text style={styles.statusText}>{statusLabel}</Text>

        {/* Avatar with pulse rings */}
        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.ring3, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.ring2, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={[styles.ring1, { transform: [{ scale: pulseAnim }] }]} />
          <View style={styles.avatarBorder}>
            <Avatar name={targetName} avatarUrl={targetAvatar} size={110} />
          </View>
        </View>

        <Text style={styles.name} numberOfLines={1}>{targetName}</Text>
        <Text style={styles.callType}>Voice Call</Text>

        {/* Live sound-wave indicator (only when connected) */}
        {audioStatus === "connected" && !isMuted && (
          <View style={styles.waveRow}>
            {[waveAnim1, waveAnim2, waveAnim3, waveAnim2, waveAnim1].map((a, i) => (
              <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: a }] }]} />
            ))}
          </View>
        )}
      </Animated.View>

      {/* Bottom controls panel */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 20 }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={40} tint="dark" style={styles.controlsBlur}>
            <ControlsContent
              isMuted={isMuted}
              isSpeaker={isSpeaker}
              onMute={toggleMute}
              onSpeaker={toggleSpeaker}
              onMinimize={minimizeCall}
              onEnd={endCall}
            />
          </BlurView>
        ) : (
          <View style={styles.controlsAndroid}>
            <ControlsContent
              isMuted={isMuted}
              isSpeaker={isSpeaker}
              onMute={toggleMute}
              onSpeaker={toggleSpeaker}
              onMinimize={minimizeCall}
              onEnd={endCall}
            />
          </View>
        )}
      </View>
    </View>
  );
}

// ── Controls sub-component ───────────────────────────────────────────────────

function ControlsContent({ isMuted, isSpeaker, onMute, onSpeaker, onMinimize, onEnd }: {
  isMuted: boolean; isSpeaker: boolean;
  onMute: () => void; onSpeaker: () => void; onMinimize: () => void; onEnd: () => void;
}) {
  return (
    <>
      <View style={styles.btnRow}>
        <CtrlButton
          icon={isMuted ? "mic-off" : "mic"}
          label={isMuted ? "Unmute" : "Mute"}
          active={isMuted}
          activeColor="#ef4444"
          onPress={onMute}
        />
        <CtrlButton
          icon={isSpeaker ? "volume-high" : "volume-medium"}
          label="Speaker"
          active={isSpeaker}
          activeColor="#3b82f6"
          onPress={onSpeaker}
        />
        <CtrlButton
          icon="chevron-down"
          label="Minimize"
          active={false}
          activeColor="#6366f1"
          onPress={onMinimize}
        />
      </View>

      {/* End call button */}
      <Pressable onPress={onEnd} style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.85 }]}>
        <LinearGradient colors={["#ef4444", "#b91c1c"]} style={styles.endBtnGrad}>
          <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </LinearGradient>
      </Pressable>
    </>
  );
}

function CtrlButton({ icon, label, active, activeColor, onPress }: {
  icon: any; label: string; active: boolean; activeColor: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.ctrlBtn}>
      <View style={[styles.ctrlCircle, active && { backgroundColor: activeColor }]}>
        <Ionicons name={icon} size={26} color={active ? "#fff" : "#94a3b8"} />
      </View>
      <Text style={[styles.ctrlLabel, active && { color: activeColor }]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a1a" },
  blob1: {
    position: "absolute", width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(34,197,94,0.06)", top: -120, right: -100,
  },
  blob2: {
    position: "absolute", width: 240, height: 240, borderRadius: 120,
    backgroundColor: "rgba(34,197,94,0.04)", bottom: 140, left: -80,
  },
  body: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  statusText: {
    fontSize: 22, fontWeight: "700", color: "rgba(255,255,255,0.85)",
    letterSpacing: 1.2, marginBottom: 8, fontVariant: ["tabular-nums"],
  },
  warnText: { fontSize: 12, color: "#f59e0b", marginBottom: 8, textAlign: "center" },
  avatarWrap: { alignItems: "center", justifyContent: "center", marginTop: 24, marginBottom: 28 },
  ring3: {
    position: "absolute", width: 210, height: 210, borderRadius: 105,
    backgroundColor: "rgba(34,197,94,0.05)",
  },
  ring2: {
    position: "absolute", width: 168, height: 168, borderRadius: 84,
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  ring1: {
    position: "absolute", width: 136, height: 136, borderRadius: 68,
    borderWidth: 1.5, borderColor: "rgba(34,197,94,0.25)", backgroundColor: "transparent",
  },
  avatarBorder: {
    width: 118, height: 118, borderRadius: 59,
    borderWidth: 3, borderColor: "rgba(34,197,94,0.6)",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1e293b",
  },
  name: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: -0.5, marginBottom: 6, maxWidth: 280, textAlign: "center" },
  callType: { fontSize: 15, color: "rgba(255,255,255,0.45)", fontWeight: "500" },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 24, height: 32 },
  waveBar: { width: 4, height: 28, borderRadius: 2, backgroundColor: "#22c55e" },
  controls: { paddingHorizontal: 24 },
  controlsBlur: { borderRadius: 28, overflow: "hidden", paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 },
  controlsAndroid: {
    borderRadius: 28, backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8,
  },
  btnRow: { flexDirection: "row", justifyContent: "center", gap: 28, marginBottom: 28 },
  ctrlBtn: { alignItems: "center", minWidth: 70 },
  ctrlCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center", marginBottom: 7,
  },
  ctrlLabel: { fontSize: 12, color: "#64748b", fontWeight: "600" },
  endBtn: { alignSelf: "center", marginBottom: 8, borderRadius: 40, elevation: 10, shadowColor: "#ef4444", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 16 },
  endBtnGrad: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
});