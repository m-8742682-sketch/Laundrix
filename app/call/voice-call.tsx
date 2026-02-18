/**
 * Voice Call Screen - ACTIVE CALL VERSION (Integrated)
 * 
 * This is the ACTIVE call screen used by BOTH caller and receiver.
 * - Does NOT create calls (call already exists)
 * - Listens to call status
 * - Shows call duration
 * - Supports minimize to overlay via centralized state
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
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
  setActiveCallScreenOpen,    // ✅ Use centralized screen state
  minimizeActiveCall,          // ✅ Use centralized minimize
  clearAllCallState,           // ✅ Use centralized cleanup
  activeCallData$,             // ✅ Subscribe to active call data
} from "@/services/callState";

export default function VoiceCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel = params.channel as string;
  const targetUserId = params.targetUserId as string;
  const targetName = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [otherUserName, setOtherUserName] = useState(targetName || "User");

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAddedCallRecord = useRef(false);
  const startTimeRef = useRef<Date | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // ✅ Set active screen open on mount - this controls overlay visibility
  useEffect(() => {
    setActiveCallScreenOpen(true);
    
    // Subscribe to active call data for duration sync
    const sub = activeCallData$.subscribe((data) => {
      if (data?.startTime && !startTimeRef.current) {
        startTimeRef.current = data.startTime;
        const elapsed = Math.floor((Date.now() - data.startTime.getTime()) / 1000);
        setCallDuration(elapsed);
      }
    });

    return () => {
      setActiveCallScreenOpen(false);
      sub.unsubscribe();
    };
  }, []);

  // Handle back button - minimize instead of end
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      minimizeCall();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  // Start animations
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, []);

  // Listen for call status changes
  useEffect(() => {
    if (!channel) return;

    const unsubscribe = onSnapshot(doc(db, "calls", channel), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      // If call ended by other party
      if (["ended", "rejected", "missed"].includes(data.status)) {
        handleCallEnd();
      } else if (data.status === "connected" && !startTimeRef.current) {
        startTimeRef.current = new Date();
        startDurationTimer();
      }
    });

    // Start duration timer immediately (call is already connected)
    startDurationTimer();

    return () => {
      unsubscribe();
      stopDurationTimer();
    };
  }, [channel]);

  const startDurationTimer = () => {
    if (durationTimerRef.current) return;
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopDurationTimer = () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleCallEnd = async () => {
    stopDurationTimer();
    
    // Add call record
    if (!hasAddedCallRecord.current && user?.uid && targetUserId) {
      hasAddedCallRecord.current = true;
      try {
        const chatChannel = `chat-${[user.uid, targetUserId].sort().join("-")}`;
        await container.chatRepository.addCallRecord(
          chatChannel,
          user.uid,
          targetUserId,
          "voice",
          "ended",
          callDuration
        );
      } catch (error) {
        console.error("[VoiceCall] Failed to add call record:", error);
      }
    }

    // ✅ Use centralized clear all
    clearAllCallState();
    
    // Navigate back
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/conversations");
    }, 100);
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      await updateDoc(doc(db, "calls", channel), {
        status: "ended",
        endedAt: serverTimestamp(),
        endedBy: user?.uid,
      });
    } catch (error) {
      console.error("[VoiceCall] Error ending call:", error);
    }

    await handleCallEnd();
  };

  // ✅ Use centralized minimize function
  const minimizeCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeActiveCall();
    
    // Navigate back to app
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/dashboard");
    }
  };

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
    // TODO: Implement actual mute logic with WebRTC
  };

  const toggleSpeaker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeaker(!isSpeaker);
    // TODO: Implement actual speaker logic
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={["#0f172a", "#1e293b", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 40 }]}>
        {/* Call Duration */}
        <Text style={styles.callStatus}>{formatDuration(callDuration)}</Text>

        {/* Avatar with pulse effect */}
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <LinearGradient
            colors={["#22c55e", "#16a34a"]}
            style={styles.avatarGradient}
          >
            <Avatar name={otherUserName} avatarUrl={targetAvatar} size={120} />
          </LinearGradient>
        </View>

        {/* Caller Name */}
        <Text style={styles.callerName}>{otherUserName}</Text>
        <Text style={styles.callType}>Voice Call</Text>

        {/* Call Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.controlsRow}>
            <Pressable style={styles.controlButton} onPress={toggleMute}>
              <View style={[styles.controlCircle, isMuted && styles.controlCircleActive]}>
                <Ionicons 
                  name={isMuted ? "mic-off" : "mic"} 
                  size={28} 
                  color={isMuted ? "#fff" : "#94a3b8"} 
                />
              </View>
              <Text style={styles.controlLabel}>Mute</Text>
            </Pressable>

            <Pressable style={styles.controlButton} onPress={toggleSpeaker}>
              <View style={[styles.controlCircle, isSpeaker && styles.controlCircleActive]}>
                <Ionicons 
                  name={isSpeaker ? "volume-high" : "volume-medium"} 
                  size={28} 
                  color={isSpeaker ? "#fff" : "#94a3b8"} 
                />
              </View>
              <Text style={styles.controlLabel}>Speaker</Text>
            </Pressable>

            {/* Minimize Button */}
            <Pressable style={styles.controlButton} onPress={minimizeCall}>
              <View style={styles.controlCircle}>
                <Ionicons name="chevron-down" size={28} color="#94a3b8" />
              </View>
              <Text style={styles.controlLabel}>Minimize</Text>
            </Pressable>
          </View>

          {/* End Call Button */}
          <Pressable style={styles.endCallButton} onPress={endCall}>
            <LinearGradient
              colors={["#ef4444", "#dc2626"]}
              style={styles.endCallGradient}
            >
              <Ionicons 
                name="call" 
                size={32} 
                color="#fff" 
                style={{ transform: [{ rotate: "135deg" }] }} 
              />
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  decorCircle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(34, 197, 94, 0.08)",
    top: -80,
    right: -80,
  },
  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(34, 197, 94, 0.05)",
    bottom: 100,
    left: -60,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  callStatus: {
    fontSize: 18,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 40,
    letterSpacing: 1,
  },
  avatarSection: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  pulseRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  avatarGradient: {
    padding: 4,
    borderRadius: 70,
  },
  callerName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  callType: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748b",
    marginBottom: 60,
  },
  controlsContainer: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 32,
    marginBottom: 40,
  },
  controlButton: {
    alignItems: "center",
  },
  controlCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  controlCircleActive: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  controlLabel: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  endCallButton: {
    borderRadius: 40,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  endCallGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});