/**
 * Voice Incoming Screen
 * 
 * High-end UI for receiver to join a voice call.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { doc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { useSettings } from "@/stores/settings.store";

const { width, height } = Dimensions.get("window");

export default function VoiceIncomingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { ringEnabled } = useSettings();

  const channel = params.channel as string;
  const callerName = params.name as string;

  const [callState, setCallState] = useState<"ringing" | "connected" | "ended">("ringing");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // Safe navigation helper
  const safeNavigate = () => {
    setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/conversations");
      }
    }, 100);
  };

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

    // Ring animation
    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: -15, duration: 100, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 15, duration: 100, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: -15, duration: 100, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    ring.start();

    return () => {
      pulse.stop();
      ring.stop();
    };
  }, []);

  // Listen for call status changes
  useEffect(() => {
    if (!channel) return;

    const unsubscribe = onSnapshot(doc(db, "calls", channel), (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (data.status === "ended" || data.status === "rejected") {
        setCallState("ended");
        void stopRinging();
        setTimeout(() => safeNavigate(), 1500);
      }
    });

    return () => unsubscribe();
  }, [channel]);

  // Ring on mount
  useEffect(() => {
    if (callState === "ringing" && ringEnabled) {
      startRinging();
    }

    return () => {
      void stopRinging();
      stopDurationTimer();
    };
  }, []);

  const startRinging = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/calling.mp3"),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error("[VoiceIncoming] Failed to start ringing:", error);
    }
  };

  const stopRinging = async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {
      console.error("[VoiceIncoming] Failed to stop ringing:", error);
    }
  };

  const startDurationTimer = () => {
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

  const acceptCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      // Update call status to connected
      await updateDoc(doc(db, "calls", channel), {
        status: "connected",
        connectedAt: serverTimestamp(),
      });

      void stopRinging();
      setCallState("connected");
      startDurationTimer();
    } catch (error) {
      console.error("[VoiceIncoming] Error accepting call:", error);
    }
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      await updateDoc(doc(db, "calls", channel), {
        status: callState === "ringing" ? "rejected" : "ended",
        endedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[VoiceIncoming] Error ending call:", error);
    }

    void stopRinging();
    stopDurationTimer();
    safeNavigate();
  };

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeaker(!isSpeaker);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={["#0f172a", "#1e293b", "#0f172a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Background decorations */}
      <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 40 }]}>
        {/* Call Status */}
        <Text style={styles.callStatus}>
          {callState === "ringing" ? "Incoming call..." : 
           callState === "connected" ? formatDuration(callDuration) : 
           "Call ended"}
        </Text>

        {/* Avatar with pulse effect */}
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={{ transform: [{ rotate: callState === "ringing" ? ringAnim.interpolate({
            inputRange: [-15, 15],
            outputRange: ["-15deg", "15deg"],
          }) : "0deg" }] }}>
            <LinearGradient
              colors={["#22c55e", "#16a34a"]}
              style={styles.avatarGradient}
            >
              <Avatar name={callerName} size={120} />
            </LinearGradient>
          </Animated.View>
        </View>

        {/* Caller Name */}
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callType}>Voice Call</Text>

        {/* Call Controls */}
        <View style={styles.controlsContainer}>
          {callState === "connected" && (
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
            </View>
          )}

          {/* Accept/Reject Buttons */}
          <View style={styles.actionButtons}>
            {/* Reject */}
            <Pressable style={styles.rejectButton} onPress={endCall}>
              <LinearGradient
                colors={["#ef4444", "#dc2626"]}
                style={styles.actionGradient}
              >
                <Ionicons 
                  name="call" 
                  size={32} 
                  color="#fff" 
                  style={{ transform: [{ rotate: "135deg" }] }} 
                />
              </LinearGradient>
            </Pressable>

            {/* Accept (only when ringing) */}
            {callState === "ringing" && (
              <Pressable style={styles.acceptButton} onPress={acceptCall}>
                <LinearGradient
                  colors={["#22c55e", "#16a34a"]}
                  style={styles.actionGradient}
                >
                  <Ionicons name="call" size={32} color="#fff" />
                </LinearGradient>
              </Pressable>
            )}
          </View>
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
    gap: 40,
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
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 60,
  },
  rejectButton: {
    borderRadius: 40,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  acceptButton: {
    borderRadius: 40,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  actionGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
