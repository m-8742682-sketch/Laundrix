/**
 * Voice Call Screen (Active) — FIXED
 *
 * Fixes:
 * 1. Room is a module-level singleton — not recreated on every mount/maximize.
 *    Prevents double-Room WebRTC negotiation errors and SDP corruption.
 * 2. callDuration starts from activeCallData$.startTime, not from 0 — fixes
 *    the 0:01 reset when incomer minimizes then maximizes.
 * 3. LiveKit connect only runs when room is disconnected — prevents
 *    "cannot send signal before connected" and "Client initiated disconnect" errors.
 * 4. Cleanup only disconnects on real end (endCall/handleCallEnd), not on minimize.
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
import { AudioSession, AndroidAudioTypePresets } from "@livekit/react-native";
import { Room } from "livekit-client";

const LIVEKIT_WS_URL = process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "";

// ── Singleton Room — persists across minimize/maximize navigation ─────────────
// A new Room is only created if the previous one was explicitly disconnected.
let _sharedRoom: Room | null = null;
function getSharedRoom(): Room {
  if (!_sharedRoom || _sharedRoom.state === "disconnected") {
    _sharedRoom = new Room();
  }
  return _sharedRoom;
}

export default function VoiceCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel      = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName   = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  // FIX 2: initialise duration from activeCallData$.startTime so maximize doesn't reset to 0
  const [callDuration, setCallDuration] = useState(() => {
    const active = activeCallData$.value;
    if (active?.startTime) {
      return Math.floor((Date.now() - new Date(active.startTime).getTime()) / 1000);
    }
    return 0;
  });

  const [isMuted,      setIsMuted]      = useState(false);
  const [isSpeaker,    setIsSpeaker]    = useState(false);
  const [audioStatus,  setAudioStatus]  = useState<"connecting"|"connected"|"failed">("connecting");

  // FIX 1: use singleton room
  const room = getSharedRoom();

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasRecordRef  = useRef(false);
  const isMinimizing  = useRef(false); // track intentional minimize vs real end

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(0.4)).current;
  const waveAnim2 = useRef(new Animated.Value(0.7)).current;
  const waveAnim3 = useRef(new Animated.Value(0.5)).current;
  const waveAnim4 = useRef(new Animated.Value(0.8)).current;
  const waveAnim5 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    setActiveCallScreenOpen(true);
    isMinimizing.current = false;

    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    const animWave = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 300 + Math.random() * 200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 300 + Math.random() * 200, useNativeDriver: true }),
      ])).start();

    animWave(waveAnim1, 0);
    animWave(waveAnim2, 80);
    animWave(waveAnim3, 160);
    animWave(waveAnim4, 240);
    animWave(waveAnim5, 320);

    timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);

    return () => {
      setActiveCallScreenOpen(false);
      if (timerRef.current) clearInterval(timerRef.current);
      // FIX 3: DO NOT disconnect here — only disconnect on real call end
      // Minimizing navigates back but keeps the room connected
    };
  }, []);

  // LiveKit — FIX 3: only connect if room is not already connected
  useEffect(() => {
    if (!user?.uid || !channel) return;

    // Already connected to this room — nothing to do (maximize case)
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
            preferredOutputList: ["earpiece", "speaker"],
            audioTypeOptions: AndroidAudioTypePresets.communication,
          },
          ios: { defaultOutput: "earpiece" },
        });

        const result = await getLivekitToken(channel, user.uid, user.name || "Unknown", false);
        if (!result.success || !result.token) throw new Error("Token failed");

        // Disconnect any stale state before connecting
        if (room.state !== "disconnected") {
          await room.disconnect();
          await new Promise(r => setTimeout(r, 300));
        }

        await room.connect(LIVEKIT_WS_URL, result.token, { autoSubscribe: true });

        if (room.state === "connected") {
          await room.localParticipant.setMicrophoneEnabled(true);
        }
        setAudioStatus("connected");
      } catch (e: any) {
        // "Client initiated disconnect" is expected on minimize — not a real error
        if (e?.message?.includes("Client initiated disconnect")) return;
        console.error("[VoiceCall] LiveKit error:", e);
        setAudioStatus("failed");
      }
    };

    init();

    // FIX 3: cleanup only runs on real unmount (not minimize)
    // We detect minimize via isMinimizing.current
    return () => {
      if (!isMinimizing.current && room.state !== "disconnected") {
        room.disconnect().catch(() => {});
        AudioSession.stopAudioSession().catch(() => {});
      }
    };
  }, [user?.uid, channel]);

  // Firestore listener
  useEffect(() => {
    if (!channel) return;
    const unsub = onSnapshot(doc(db, "calls", channel), (snap) => {
      const data = snap.data();
      if (!data) return;
      if (["ended", "rejected", "missed"].includes(data.status)) handleCallEnd();
    });
    return () => unsub();
  }, [channel]);

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
        await container.chatRepository.addCallRecord(chatChannel, user.uid, targetUserId, "voice", "ended", callDuration);
      } catch {}
    }
    // Real end — disconnect room and clear singleton
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      await room.disconnect();
      _sharedRoom = null;
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
      await room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(p => !p);
    } catch {}
  };

  const toggleSpeaker = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const next = !isSpeaker;
      await AudioSession.configureAudio({
        android: { preferredOutputList: [next ? "speaker" : "earpiece"], audioTypeOptions: AndroidAudioTypePresets.communication },
        ios: { defaultOutput: next ? "speaker" : "earpiece" },
      });
      setIsSpeaker(p => !p);
    } catch {}
  };

  const ControlPanel = () => (
    <View style={s.controlPanel}>
      <View style={s.ctrlRow}>
        <CtrlBtn icon={isMuted ? "mic-off" : "mic"} label={isMuted ? "Unmute" : "Mute"} active={isMuted} color="#f15c6d" onPress={toggleMute} />
        <CtrlBtn icon={isSpeaker ? "volume-high" : "volume-medium"} label="Speaker" active={isSpeaker} color="#3b82f6" onPress={toggleSpeaker} />
        <CtrlBtn icon="chevron-down" label="Minimize" active={false} color="#6366f1" onPress={handleMinimize} />
      </View>
      <Pressable onPress={endCall} style={({ pressed }) => [s.endBtn, pressed && { opacity: 0.85 }]}>
        <Ionicons name="call" size={34} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
      </Pressable>
      <Text style={s.endLabel}>End call</Text>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#111b21" />
      <View style={StyleSheet.absoluteFill}>
        <View style={s.bgTop} />
        <View style={s.bgBot} />
      </View>

      <Animated.View style={[s.body, { opacity: fadeAnim, paddingTop: insets.top + 20 }]}>
        <Text style={s.timer}>{formatDuration(callDuration)}</Text>

        <View style={s.avatarBorder}>
          <Avatar name={targetName} avatarUrl={targetAvatar} size={120} />
        </View>

        <Text style={s.name} numberOfLines={1}>{targetName}</Text>
        <Text style={s.subtitle}>Voice Call</Text>

        {audioStatus === "connected" && !isMuted && (
          <View style={s.waveRow}>
            {[waveAnim1, waveAnim2, waveAnim3, waveAnim4, waveAnim5].map((a, i) => (
              <Animated.View key={i} style={[s.waveBar, { transform: [{ scaleY: a }] }]} />
            ))}
          </View>
        )}
      </Animated.View>

      <Animated.View style={[{ opacity: fadeAnim }, { paddingBottom: insets.bottom + 12 }]}>
        {Platform.OS === "ios" ? (
          <BlurView intensity={30} tint="dark" style={s.blurWrap}>
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
        <Ionicons name={icon} size={26} color={active ? "#fff" : "rgba(255,255,255,0.7)"} />
      </View>
      <Text style={[s.ctrlLabel, active && { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111b21" },
  bgTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: "60%",
    backgroundColor: "#1a6e47", borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999, transform: [{ scaleX: 1.6 }], opacity: 0.4,
  },
  bgBot: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
    backgroundColor: "#0a1410", opacity: 0.75,
  },
  body: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  timer: {
    fontSize: 24, fontWeight: "700", color: "rgba(255,255,255,0.9)",
    letterSpacing: 2, marginBottom: 40, fontVariant: ["tabular-nums"],
  },
  avatarBorder: {
    width: 136, height: 136, borderRadius: 68,
    borderWidth: 3, borderColor: "rgba(37,211,102,0.5)",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1f2c33", marginBottom: 28,
    shadowColor: "#25d366", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  name: {
    fontSize: 32, fontWeight: "700", color: "#fff", letterSpacing: -0.5,
    marginBottom: 8, maxWidth: 300, textAlign: "center",
  },
  subtitle: { fontSize: 15, color: "rgba(255,255,255,0.45)", fontWeight: "500" },
  waveRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 32, height: 36 },
  waveBar: { width: 4, height: 30, borderRadius: 2, backgroundColor: "#25d366" },
  blurWrap: { borderRadius: 28, overflow: "hidden", margin: 16, paddingTop: 8 },
  androidWrap: {
    margin: 16, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  controlPanel: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 16, alignItems: "center" },
  ctrlRow: { flexDirection: "row", justifyContent: "center", gap: 28, marginBottom: 28 },
  ctrlBtn: { alignItems: "center", minWidth: 72 },
  ctrlCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  ctrlLabel: { fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  endBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#f15c6d", alignItems: "center", justifyContent: "center",
    shadowColor: "#f15c6d", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 12, marginBottom: 10,
  },
  endLabel: { fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
});
