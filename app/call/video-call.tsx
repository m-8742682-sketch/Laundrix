/**
 * Video Call Screen
 * 
 * High-end UI matching the login page style.
 * Caller initiates the video call and waits for receiver to join.
 * 
 * Flow:
 * - Caller creates call document with status "calling"
 * - Receiver accepts → status becomes "connected"
 * - Either party ends → status becomes "ended"
 * - 30s timeout with no answer → status becomes "missed", notification sent
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
import { 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { useSettings } from "@/stores/settings.store";

const { width, height } = Dimensions.get("window");
const CALL_TIMEOUT_MS = 30000; // 30 seconds timeout

export default function VideoCallScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { ringEnabled } = useSettings();

  const targetUserId = params.targetUserId as string;
  const targetName = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callState, setCallState] = useState<"calling" | "connected" | "ended">("calling");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  // Use refs to track state in callbacks
  const callStateRef = useRef<"calling" | "connected" | "ended">("calling");
  const callDocId = useRef<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Update ref when state changes
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

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

    return () => pulse.stop();
  }, []);

  // Initialize call
  useEffect(() => {
    if (!user?.uid || !targetUserId) return;

    let unsubscribe: (() => void) | undefined;

    const initializeCall = async () => {
      try {
        // Create call document
        const callId = `videocall_${user.uid}_${targetUserId}_${Date.now()}`;
        callDocId.current = callId;

        await setDoc(doc(db, "calls", callId), {
          callerId: user.uid,
          callerName: user.name || "Unknown",
          receiverId: targetUserId,
          receiverName: targetName,
          type: "video",
          status: "calling",
          createdAt: serverTimestamp(),
        });

        console.log("[VideoCall] Created call document:", callId);

        // Send push notification to receiver
        await notifyReceiver(callId);

        // Start ringing sound
        if (ringEnabled) {
          await startRinging();
        }

        // Listen for call status changes
        unsubscribe = onSnapshot(doc(db, "calls", callId), (snapshot) => {
          const data = snapshot.data();
          if (!data) return;

          console.log("[VideoCall] Call status changed:", data.status);

          if (data.status === "connected") {
            // Clear timeout since call was answered
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setCallState("connected");
            callStateRef.current = "connected";
            void stopRinging();
            startDurationTimer();
          } else if (data.status === "ended" || data.status === "rejected") {
            // Clear timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            setCallState("ended");
            callStateRef.current = "ended";
            void stopRinging();
            stopDurationTimer();
            setTimeout(() => safeNavigate(), 1500);
          }
        });

        // Set timeout for unanswered calls - ONLY sends missed notification here
        timeoutRef.current = setTimeout(async () => {
          if (callStateRef.current === "calling") {
            console.log("[VideoCall] 30s timeout - call not answered, sending missed notification");
            await handleMissedCall();
          }
        }, CALL_TIMEOUT_MS);

      } catch (error) {
        console.error("[VideoCall] Error initializing call:", error);
        safeNavigate();
      }
    };

    initializeCall();

    return () => {
      if (unsubscribe) unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      void stopRinging();
      stopDurationTimer();
    };
  }, [user?.uid, targetUserId]);

  const notifyReceiver = async (callId: string) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/notify-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId,
          callerId: user?.uid,
          callerName: user?.name || "Unknown",
          recipientId: targetUserId,
          isVideo: true,
          action: "incoming",
        }),
      });

      const result = await response.json();
      console.log("[VideoCall] Notification sent:", result);
    } catch (error) {
      console.error("[VideoCall] Failed to notify receiver:", error);
    }
  };

  /**
   * Handle missed call - ONLY called after 30s timeout with no answer
   */
  const handleMissedCall = async () => {
    try {
      // Update call status to missed
      if (callDocId.current) {
        await updateDoc(doc(db, "calls", callDocId.current), {
          status: "missed",
          endedAt: serverTimestamp(),
        });
      }

      // Send missed call notification
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/notify-call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callerId: user?.uid,
          callerName: user?.name || "Unknown",
          recipientId: targetUserId,
          isVideo: true,
          action: "missed",
        }),
      });

      console.log("[VideoCall] Sent missed call notification");
      setCallState("ended");
      callStateRef.current = "ended";
      void stopRinging();
      setTimeout(() => safeNavigate(), 1500);
    } catch (error) {
      console.error("[VideoCall] Error handling missed call:", error);
      safeNavigate();
    }
  };

  const startRinging = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/calling.mp3"),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error("[VideoCall] Failed to start ringing:", error);
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
      console.error("[VideoCall] Failed to stop ringing:", error);
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

  /**
   * End call - user manually ended, NO missed notification
   */
  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Clear timeout to prevent missed notification
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    try {
      if (callDocId.current) {
        await updateDoc(doc(db, "calls", callDocId.current), {
          status: "ended",
          endedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("[VideoCall] Error ending call:", error);
    }

    void stopRinging();
    stopDurationTimer();
    safeNavigate();
  };

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCameraOff(!isCameraOff);
  };

  const flipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFrontCamera(!isFrontCamera);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={["#1e1e2e", "#0f0f1a"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Background decorations */}
      <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 40 }]}>
        {/* Call Status */}
        <Text style={styles.callStatus}>
          {callState === "calling" ? "Calling..." : 
           callState === "connected" ? formatDuration(callDuration) : 
           "Call ended"}
        </Text>

        {/* Avatar with pulse effect */}
        <View style={styles.avatarSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <LinearGradient
            colors={["#8b5cf6", "#7c3aed"]}
            style={styles.avatarGradient}
          >
            <Avatar name={targetName} avatarUrl={targetAvatar} size={120} />
          </LinearGradient>
        </View>

        {/* Caller Name */}
        <Text style={styles.callerName}>{targetName}</Text>
        <View style={styles.callTypeContainer}>
          <Ionicons name="videocam" size={18} color="#a78bfa" />
          <Text style={styles.callType}>Video Call</Text>
        </View>

        {/* Call Controls */}
        <View style={styles.controlsContainer}>
          {callState === "connected" && (
            <View style={styles.controlsRow}>
              <Pressable style={styles.controlButton} onPress={toggleMute}>
                <View style={[styles.controlCircle, isMuted && styles.controlCircleActive]}>
                  <Ionicons 
                    name={isMuted ? "mic-off" : "mic"} 
                    size={26} 
                    color={isMuted ? "#fff" : "#94a3b8"} 
                  />
                </View>
                <Text style={styles.controlLabel}>Mute</Text>
              </Pressable>

              <Pressable style={styles.controlButton} onPress={toggleCamera}>
                <View style={[styles.controlCircle, isCameraOff && styles.controlCircleActive]}>
                  <Ionicons 
                    name={isCameraOff ? "videocam-off" : "videocam"} 
                    size={26} 
                    color={isCameraOff ? "#fff" : "#94a3b8"} 
                  />
                </View>
                <Text style={styles.controlLabel}>Camera</Text>
              </Pressable>

              <Pressable style={styles.controlButton} onPress={flipCamera}>
                <View style={styles.controlCircle}>
                  <Ionicons name="camera-reverse" size={26} color="#94a3b8" />
                </View>
                <Text style={styles.controlLabel}>Flip</Text>
              </Pressable>
            </View>
          )}

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
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    top: -80,
    right: -80,
  },
  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(139, 92, 246, 0.05)",
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
    borderColor: "rgba(139, 92, 246, 0.3)",
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
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 60,
  },
  callType: {
    fontSize: 16,
    fontWeight: "500",
    color: "#64748b",
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
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  controlCircleActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
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
