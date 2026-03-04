/**
 * Voice Incoming Screen — WhatsApp Style
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, Pressable, Animated,
  StatusBar, BackHandler, Vibration, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import {
  setIncomingScreenOpen, acceptIncomingCall, rejectIncomingCall,
  incomingCallData$, incomingCallCountdown$, sendMissedCallNotification,
} from "@/services/callState";

export default function VoiceIncomingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel = params.channel as string;
  const callerName = params.name as string;
  const callerAvatar = params.avatar as string | undefined;
  const callerId = params.callerId as string;

  const hasHandledRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(60)).current;
  const ring1 = useRef(new Animated.Value(1)).current;
  const ring2 = useRef(new Animated.Value(1)).current;
  const ring3 = useRef(new Animated.Value(1)).current;
  const btnAcceptScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setIncomingScreenOpen(true);
    if (Platform.OS !== "web") Vibration.vibrate([0, 1000, 500, 1000, 500], true);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(slideUp, { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
    ]).start();

    const makeRipple = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1.7, duration: 1400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(600),
      ])).start();

    makeRipple(ring1, 0);
    makeRipple(ring2, 466);
    makeRipple(ring3, 932);

    Animated.loop(Animated.sequence([
      Animated.timing(btnAcceptScale, { toValue: 1.12, duration: 700, useNativeDriver: true }),
      Animated.timing(btnAcceptScale, { toValue: 1, duration: 700, useNativeDriver: true }),
    ])).start();

    return () => {
      Vibration.cancel();
      setIncomingScreenOpen(false);
    };
  }, []);

  useEffect(() => {
    const sub = incomingCallCountdown$.subscribe((count) => {
      if (count === 0 && !hasHandledRef.current) handleMissed();
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = incomingCallData$.subscribe((data) => {
      if (!data && !hasHandledRef.current) {
        hasHandledRef.current = true;
        safeBack();
      }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleDecline();
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

  const handleMissed = useCallback(async () => {
    if (hasHandledRef.current || !user?.uid || !callerId) return;
    hasHandledRef.current = true;
    Vibration.cancel();
    try {
      await updateDoc(doc(db, "calls", channel), {
        status: "missed", endedAt: serverTimestamp(), missedReason: "timeout",
      });
      const chatChannel = `chat-${[user.uid, callerId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(chatChannel, callerId, user.uid, "voice", "missed", 0);
      await sendMissedCallNotification(callerId, callerName, user.uid, false);
    } catch {}
    rejectIncomingCall();
    safeBack();
  }, [callerId, callerName, user?.uid, channel]);

  const handleDecline = useCallback(async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Vibration.cancel();
    try {
      await updateDoc(doc(db, "calls", channel), {
        status: "rejected", endedAt: serverTimestamp(), endedBy: user?.uid,
      });
      const chatChannel = `chat-${[user!.uid, callerId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(chatChannel, callerId, user!.uid, "voice", "missed", 0);
    } catch {}
    rejectIncomingCall();
    safeBack();
  }, [callerId, user?.uid, channel]);

  const handleAccept = useCallback(async () => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Vibration.cancel();
    try {
      await updateDoc(doc(db, "calls", channel), {
        status: "connected", connectedAt: serverTimestamp(),
      });
      acceptIncomingCall();
      router.replace({
        pathname: "/call/voice-call",
        params: { channel, targetUserId: callerId, targetName: callerName, targetAvatar: callerAvatar || "" },
      });
    } catch {}
  }, [callerId, callerName, callerAvatar, channel]);

  const ring1Opacity = ring1.interpolate({ inputRange: [1, 1.7], outputRange: [0.4, 0] });
  const ring2Opacity = ring2.interpolate({ inputRange: [1, 1.7], outputRange: [0.25, 0] });
  const ring3Opacity = ring3.interpolate({ inputRange: [1, 1.7], outputRange: [0.12, 0] });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#111b21" />
      <View style={StyleSheet.absoluteFill}>
        <View style={s.bgTop} />
        <View style={s.bgBottom} />
      </View>

      <Animated.View style={[s.content, { opacity: fadeAnim, paddingTop: insets.top + 24 }]}>
        <Text style={s.statusLabel}>Incoming voice call</Text>

        <Animated.View style={[s.avatarWrap, { transform: [{ translateY: slideUp }] }]}>
          <Animated.View style={[s.ring, { transform: [{ scale: ring3 }], opacity: ring3Opacity }]} />
          <Animated.View style={[s.ring, s.ring2, { transform: [{ scale: ring2 }], opacity: ring2Opacity }]} />
          <Animated.View style={[s.ring, s.ring1, { transform: [{ scale: ring1 }], opacity: ring1Opacity }]} />
          <View style={s.avatarBorder}>
            <Avatar name={callerName} avatarUrl={callerAvatar} size={120} />
          </View>
        </Animated.View>

        <Animated.View style={{ alignItems: "center", transform: [{ translateY: slideUp }] }}>
          <Text style={s.name} numberOfLines={1}>{callerName}</Text>
          <Text style={s.callSubtitle}>Voice Call</Text>
        </Animated.View>
      </Animated.View>

      <Animated.View style={[s.actions, { paddingBottom: insets.bottom + 48, opacity: fadeAnim }]}>
        <Text style={s.hint}>Tap to answer</Text>
        <View style={s.btnRow}>
          <View style={s.btnWrap}>
            <Pressable
              onPress={handleDecline}
              style={({ pressed }) => [s.btnCircle, s.declineBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="call" size={34} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <Text style={s.btnLabel}>Decline</Text>
          </View>

          <View style={s.btnWrap}>
            <Animated.View style={{ transform: [{ scale: btnAcceptScale }] }}>
              <Pressable
                onPress={handleAccept}
                style={({ pressed }) => [s.btnCircle, s.acceptBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="call" size={34} color="#fff" />
              </Pressable>
            </Animated.View>
            <Text style={s.btnLabel}>Accept</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111b21" },
  bgTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: "55%",
    backgroundColor: "#1a6e47", borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999, transform: [{ scaleX: 1.6 }], opacity: 0.5,
  },
  bgBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0, height: "55%",
    backgroundColor: "#0a1410", opacity: 0.7,
  },
  content: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  statusLabel: {
    fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.55)",
    letterSpacing: 1.2, marginBottom: 52, textTransform: "uppercase",
  },
  avatarWrap: {
    width: 260, height: 260, alignItems: "center", justifyContent: "center", marginBottom: 36,
  },
  ring: {
    position: "absolute", width: 165, height: 165, borderRadius: 82.5, backgroundColor: "#25d366",
  },
  ring1: { width: 165, height: 165, borderRadius: 82.5 },
  ring2: { width: 205, height: 205, borderRadius: 102.5 },
  avatarBorder: {
    width: 132, height: 132, borderRadius: 66,
    borderWidth: 3, borderColor: "#25d366",
    overflow: "hidden", alignItems: "center", justifyContent: "center",
    backgroundColor: "#1f2c33",
    shadowColor: "#25d366", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 16,
  },
  name: {
    fontSize: 34, fontWeight: "700", color: "#fff", letterSpacing: -0.5,
    textAlign: "center", marginBottom: 10, maxWidth: 300,
  },
  callSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.45)", fontWeight: "500", textAlign: "center" },
  actions: { paddingHorizontal: 24, alignItems: "center" },
  hint: { fontSize: 13, color: "rgba(255,255,255,0.3)", marginBottom: 32, fontWeight: "500" },
  btnRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 90 },
  btnWrap: { alignItems: "center", gap: 14 },
  btnCircle: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
  },
  declineBtn: { backgroundColor: "#f15c6d", shadowColor: "#f15c6d" },
  acceptBtn: { backgroundColor: "#25d366", shadowColor: "#25d366" },
  btnLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "600" },
});
