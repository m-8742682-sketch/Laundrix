/**
 * Voice Outgoing Screen — WhatsApp Style
 * Shows "Calling..." with avatar, single end-call button
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  doc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import {
  startOutgoingCall, endOutgoingCall, outgoingCallData$,
  setOutgoingScreenOpen, sendIncomingCallNotification, activeCallData$,
} from "@/services/callState";

export default function VoiceOutgoingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const targetUserId = params.targetUserId as string;
  const targetName = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callState, setCallState] = useState<"calling" | "ended">("calling");
  const [dotCount, setDotCount] = useState(1);
  const hasHandledRef = useRef(false);
  const hasAddedRecordRef = useRef(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setOutgoingScreenOpen(true);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
    ]).start();

    // Slow ripple
    const makeRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(800),
      ])).start();

    makeRipple(ring1, 0);
    makeRipple(ring2, 900);

    // Pulsing end button
    Animated.loop(Animated.sequence([
      Animated.timing(btnScale, { toValue: 1.08, duration: 800, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 800, useNativeDriver: true }),
    ])).start();

    // Dot animation "Calling..."
    const dotTimer = setInterval(() => setDotCount(d => d >= 3 ? 1 : d + 1), 600);

    return () => {
      clearInterval(dotTimer);
      setOutgoingScreenOpen(false);
    };
  }, []);

  // Init call
  useEffect(() => {
    if (!user?.uid || !targetUserId) return;
    const existing = outgoingCallData$.value;
    if (existing) return;

    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = callId;

    const initCall = async () => {
      try {
        await setDoc(doc(db, "calls", channel), {
          callerId: user.uid,
          callerName: user.name || "Unknown",
          callerAvatar: user.avatarUrl || "",
          targetUserId,
          targetName,
          targetAvatar: targetAvatar || "",
          type: "voice",
          status: "calling",
          createdAt: serverTimestamp(),
        });

        startOutgoingCall({
          id: channel, callId: channel, targetUserId,
          targetName, targetAvatar,
          callerId: user.uid, callerName: user.name || "Unknown",
          callerAvatar: user.avatarUrl || "",
          type: "voice", status: "calling", isOutgoing: true,
        });

        await sendIncomingCallNotification(channel, user.uid, user.name || "Unknown", targetUserId, false);
      } catch (err) {
        console.error("[VoiceOutgoing] Init error:", err);
        safeBack();
      }
    };

    initCall();
  }, [user?.uid, targetUserId]);

  // Listen for receiver accepting
  useEffect(() => {
    const sub = activeCallData$.subscribe((data) => {
      if (data?.status === "connected" && callState === "calling") {
        setCallState("ended");
        router.replace({
          pathname: "/call/voice-call",
          params: {
            channel: data.callId,
            targetUserId: data.targetUserId,
            targetName: data.targetName,
            targetAvatar: data.targetAvatar || "",
          },
        });
      }
    });
    return () => sub.unsubscribe();
  }, [callState]);

  // Remote end / rejection
  useEffect(() => {
    let hadData = !!outgoingCallData$.value;
    const sub = outgoingCallData$.subscribe((data) => {
      if (data) { hadData = true; return; }
      if (hadData && callState === "calling" && !hasHandledRef.current) {
        hasHandledRef.current = true;
        setCallState("ended");
        setTimeout(safeBack, 1000);
      }
    });
    return () => sub.unsubscribe();
  }, [callState]);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleEndCall();
      return true;
    });
    return () => handler.remove();
  }, []);

  const safeBack = () => {
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/conversations");
    }, 150);
  };

  const handleEndCall = async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const call = outgoingCallData$.value;
    try {
      if (call?.callId) {
        await updateDoc(doc(db, "calls", call.callId), {
          status: "ended", endedAt: serverTimestamp(), endedBy: user?.uid,
        });
        if (!hasAddedRecordRef.current && user?.uid) {
          hasAddedRecordRef.current = true;
          const chatChannel = `chat-${[user.uid, targetUserId].sort().join("-")}`;
          await container.chatRepository.addCallRecord(chatChannel, user.uid, targetUserId, "voice", "missed", 0);
        }
      }
    } catch {}
    endOutgoingCall();
    setCallState("ended");
    safeBack();
  };

  const ring1Opacity = ring1.interpolate({ inputRange: [1, 1.5], outputRange: [0.35, 0] });
  const ring2Opacity = ring2.interpolate({ inputRange: [1, 1.5], outputRange: [0.2, 0] });
  const dots = ".".repeat(dotCount);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#111b21" />
      <View style={StyleSheet.absoluteFill}>
        <View style={s.bgTop} />
        <View style={s.bgBottom} />
      </View>

      <Animated.View style={[s.content, { opacity: fadeAnim, paddingTop: insets.top + 32 }]}>
        <Text style={s.statusLabel}>Voice Call</Text>

        <Animated.View style={[s.avatarWrap, { transform: [{ translateY: slideUp }] }]}>
          <Animated.View style={[s.ring, s.ringLg, { transform: [{ scale: ring2 }], opacity: ring2Opacity }]} />
          <Animated.View style={[s.ring, { transform: [{ scale: ring1 }], opacity: ring1Opacity }]} />
          <View style={s.avatarBorder}>
            <Avatar name={targetName} avatarUrl={targetAvatar} size={120} />
          </View>
        </Animated.View>

        <Animated.View style={{ alignItems: "center", transform: [{ translateY: slideUp }] }}>
          <Text style={s.name} numberOfLines={1}>{targetName}</Text>
          <Text style={s.callingText}>
            {callState === "ended" ? "Call ended" : `Calling${dots}`}
          </Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.actions, { paddingBottom: insets.bottom + 60, opacity: fadeAnim }]}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <Pressable
            onPress={handleEndCall}
            style={({ pressed }) => [s.endBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="call" size={36} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
        </Animated.View>
        <Text style={s.endLabel}>End</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111b21" },
  bgTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: "55%",
    backgroundColor: "#1a6e47", borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999, transform: [{ scaleX: 1.6 }], opacity: 0.45,
  },
  bgBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
    backgroundColor: "#0a1410", opacity: 0.7,
  },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  statusLabel: {
    fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.2, marginBottom: 56, textTransform: "uppercase",
  },
  avatarWrap: {
    width: 260, height: 260, alignItems: "center", justifyContent: "center", marginBottom: 36,
  },
  ring: {
    position: "absolute", width: 165, height: 165, borderRadius: 82.5, backgroundColor: "#25d366",
  },
  ringLg: { width: 210, height: 210, borderRadius: 105 },
  avatarBorder: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 2.5, borderColor: "rgba(37,211,102,0.6)",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1f2c33",
    shadowColor: "#25d366", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  name: {
    fontSize: 34, fontWeight: "700", color: "#fff", letterSpacing: -0.5,
    textAlign: "center", marginBottom: 12, maxWidth: 300,
  },
  callingText: {
    fontSize: 17, color: "rgba(255,255,255,0.5)", fontWeight: "500",
    minWidth: 100, textAlign: "center",
  },
  actions: { alignItems: "center", gap: 14 },
  endBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#f15c6d", alignItems: "center", justifyContent: "center",
    shadowColor: "#f15c6d", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
  },
  endLabel: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
});
