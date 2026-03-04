/**
 * ActiveCallOverlay — FIXED
 *
 * Fix: show the correct name/avatar for the person you're talking to.
 * For the incomer: activeCallData$ contains callerName/callerAvatar (who called them).
 *   isOutgoing is false → display callerName/callerAvatar.
 * For the caller: isOutgoing is true → display targetName/targetAvatar.
 *
 * Fix: timer reads startTime from activeCallData$ on mount, not starting from 0.
 * This prevents the 0:01 reset when the incomer minimizes then maximizes.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  activeCallData$,
  isActiveCallScreenOpen$,
  clearAllCallState,
  maximizeActiveCall,
} from "@/services/callState";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import { container } from "@/di/container";

export default function ActiveCallOverlay() {
  const { user } = useUser();
  const [activeCall, setActiveCall]   = useState<any>(null);
  const [visible, setVisible]         = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const slideAnim = useRef(new Animated.Value(-150)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAddedCallRecord  = useRef(false);

  useEffect(() => {
    const updateVisibility = () => {
      const hasCall    = activeCallData$.value !== null;
      const isScreenOpen = isActiveCallScreenOpen$.value;
      const shouldShow = hasCall && !isScreenOpen;

      if (shouldShow && !visible) showOverlay();
      else if (!shouldShow && visible) hideOverlay();
    };

    const dataSub   = activeCallData$.subscribe(() => updateVisibility());
    const screenSub = isActiveCallScreenOpen$.subscribe(() => updateVisibility());

    updateVisibility();

    return () => {
      dataSub.unsubscribe();
      screenSub.unsubscribe();
      stopDurationTimer();
    };
  }, [visible]);

  // Timer — FIX: start from elapsed time, not 0
  useEffect(() => {
    if (visible && activeCall?.startTime) {
      const startTime = new Date(activeCall.startTime);
      const elapsed   = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setCallDuration(elapsed);

      durationTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => stopDurationTimer();
  }, [visible, activeCall?.callId]); // use callId not full activeCall object to avoid restart on re-renders

  useEffect(() => {
    if (visible) {
      const anim = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ]));
      anim.start();
      return () => anim.stop();
    }
  }, [visible]);

  const stopDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const showOverlay = () => {
    setActiveCall(activeCallData$.value);
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
  };

  const hideOverlay = () => {
    Animated.timing(slideAnim, { toValue: -150, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
      stopDurationTimer();
    });
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const maximize = () => {
    if (!activeCall) return;
    maximizeActiveCall();
    const route = activeCall.type === "video" ? "/call/video-call" : "/call/voice-call";
    router.push({
      pathname: route,
      params: {
        channel:       activeCall.callId,
        targetUserId:  activeCall.targetUserId,
        targetName:    activeCall.targetName,
        targetAvatar:  activeCall.targetAvatar || "",
      },
    });
  };

  const addCallRecordToChat = async (status: "ended" | "missed", duration: number) => {
    if (hasAddedCallRecord.current || !user?.uid || !activeCall?.targetUserId) return;
    hasAddedCallRecord.current = true;
    try {
      const channel = `chat-${[user.uid, activeCall.targetUserId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(
        channel, user.uid, activeCall.targetUserId, activeCall.type, status, duration
      );
    } catch (error) {
      console.error("[ActiveCallOverlay] Add record error:", error);
    }
  };

  const endCall = async () => {
    if (!activeCall?.callId) return;
    try {
      await updateDoc(doc(db, "calls", activeCall.callId), {
        status: "ended", endedAt: serverTimestamp(), endedBy: user?.uid,
      });
    } catch (error) {
      console.error("[ActiveCallOverlay] End call error:", error);
    }
    await addCallRecordToChat("ended", callDuration);
    clearAllCallState();
    hideOverlay();
  };

  if (!visible || !activeCall) return null;

  const isVideo = activeCall.type === "video";

  // FIX: show caller info for incomer, target info for outgoing caller
  const isOutgoing  = activeCall.isOutgoing !== false;
  const displayName = isOutgoing ? activeCall.targetName   : (activeCall.callerName   || activeCall.targetName);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.95} onPress={maximize} style={styles.touchableArea}>
        <LinearGradient
          colors={isVideo ? ["#7c3aed", "#5b21b6"] : ["#059669", "#047857"]}
          style={styles.card}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={styles.iconContainer}>
              <Ionicons name={isVideo ? "videocam" : "call"} size={24} color="#fff" />
            </View>
          </Animated.View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.duration}>
              {isVideo ? "Video" : "Voice"} • {formatDuration(callDuration)}
            </Text>
          </View>

          <TouchableOpacity onPress={endCall} style={styles.endButton}>
            <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute", top: Platform.OS === "ios" ? 60 : 40,
    left: 16, right: 16, zIndex: 9999,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 20,
  },
  touchableArea: { borderRadius: 16 },
  card: {
    flexDirection: "row", alignItems: "center",
    padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  iconContainer: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1, marginLeft: 12 },
  name: { color: "#fff", fontWeight: "700", fontSize: 16 },
  duration: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  endButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center",
  },
});
