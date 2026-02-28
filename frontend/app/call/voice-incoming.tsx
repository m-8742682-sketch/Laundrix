/**
 * Voice Incoming Screen - Uses global countdown from callState
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
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
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import { 
  setIncomingScreenOpen,
  acceptIncomingCall,
  rejectIncomingCall,
  incomingCallData$,
  incomingCallCountdown$,
  isIncomingCallRinging$,
  sendMissedCallNotification,
} from "@/services/callState";

export default function VoiceIncomingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const channel = params.channel as string;
  const callerName = params.name as string;
  const callerAvatar = params.avatar as string | undefined;
  const callerId = params.callerId as string;
  const autoAccept = params.autoAccept === "true";

  const [callState, setCallState] = useState<"ringing" | "connected" | "ended" | "missed">("ringing");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAddedCallRecord = useRef(false);
  const hasHandledMissed = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // Subscribe to global countdown and ringing state
  useEffect(() => {
    const countdownSub = incomingCallCountdown$.subscribe((count) => {
      setTimeLeft(count);
      
      if (count === 0 && callState === "ringing" && !hasHandledMissed.current) {
        hasHandledMissed.current = true;
        console.log('[VoiceIncoming] Countdown reached 0, auto-missing call');
        handleMissedCall();
      }
    });
    
    const ringingSub = isIncomingCallRinging$.subscribe((isRinging) => {
      if (!isRinging && callState === "ringing") {
        if (!hasHandledMissed.current) {
          setCallState("missed");
          setTimeout(() => safeNavigate(), 1500);
        }
      }
    });
    
    const callDataSub = incomingCallData$.subscribe((data) => {
      if (!data && callState === "ringing") {
        if (!hasHandledMissed.current) {
          setCallState("missed");
        }
      }
    });
    
    return () => {
      countdownSub.unsubscribe();
      ringingSub.unsubscribe();
      callDataSub.unsubscribe();
    };
  }, [callState]);

  useEffect(() => {
    setIncomingScreenOpen(true);

    return () => {
      if (callState !== "ringing") {
        setIncomingScreenOpen(false);
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [callState]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (callState === "ringing") {
        minimizeIncomingCall();
        return true;
      }
      return false;
    });
    return () => backHandler.remove();
  }, [callState]);

  useEffect(() => {
    if (autoAccept && callState === "ringing") {
      acceptCall();
    }
  }, [autoAccept]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

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

  const startDurationTimer = () => {
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const safeNavigate = () => {
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/conversations");
    }, 100);
  };

  const handleMissedCall = useCallback(async () => {
    // Prevent double handling
    if (hasAddedCallRecord.current || !user?.uid || !callerId) return;
    hasAddedCallRecord.current = true;
    hasHandledMissed.current = true; // Also set this here

    console.log('[VideoIncoming] Handling missed call');

    try {
      // Only update if not already updated
      await updateDoc(doc(db, "calls", channel), {
        status: "missed",
        endedAt: serverTimestamp(),
        missedReason: "timeout",
      });

      const chatChannel = `chat-${[user.uid, callerId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(
        chatChannel,
        callerId,        // A called
        user.uid,        // B (current user) missed it
        "video",
        "missed",
        0
      );

      // Send missed call notification to B (current user) via callState
      await sendMissedCallNotification(
        callerId,      // A's ID (who called)
        callerName,    // A's name
        user.uid,      // B's ID (who receives notification - current user)
        true
      );
      
    } catch (error) {
      console.error("[VideoIncoming] Handle missed call error:", error);
    }

    rejectIncomingCall();
    setCallState("missed");
    setTimeout(() => safeNavigate(), 1500);
  }, [callerId, callerName, user?.uid, channel]);

  const acceptCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await updateDoc(doc(db, "calls", channel), {
        status: "connected",
        connectedAt: serverTimestamp(),
      });

      acceptIncomingCall();
      setCallState("connected");
      startDurationTimer();

      router.replace({
        pathname: "/call/voice-call",
        params: {
          channel: channel,
          targetUserId: callerId,
          targetName: callerName,
          targetAvatar: callerAvatar || "",
        },
      });
    } catch (error) {
      console.error("[VoiceIncoming] Accept error:", error);
    }
  };

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }

    const isMissed = callState === "ringing";
    const isConnected = callState === "connected";

    try {
      await updateDoc(doc(db, "calls", channel), {
        status: isMissed ? "missed" : "ended",
        endedAt: serverTimestamp(),
        endedBy: user?.uid,
      });
    } catch (error) {
      console.error("[VoiceIncoming] End call error:", error);
    }

    if (isMissed) {
      await handleMissedCall();
    } else if (isConnected) {
      await addCallRecordToChat("ended", callDuration);
    }
    
    rejectIncomingCall();
    safeNavigate();
  };

  const addCallRecordToChat = async (status: "ended" | "missed", duration: number) => {
    if (hasAddedCallRecord.current || !user?.uid || !callerId) return;
    hasAddedCallRecord.current = true;

    try {
      const chatChannel = `chat-${[user.uid, callerId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(
        chatChannel,
        callerId,
        user.uid,
        "voice",
        status,
        duration
      );
    } catch (error) {
      console.error("[VoiceIncoming] Add record error:", error);
    }
  };

  const minimizeIncomingCall = () => {
    router.back();
  };

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
  };

  const toggleSpeaker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSpeaker(!isSpeaker);
  };

  const getStatusText = () => {
    if (callState === "missed") return "Call missed";
    if (callState === "ended") return "Call ended";
    if (callState === "connected") return formatDuration(callDuration);
    return `Incoming call... (${timeLeft}s)`;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0f172a", "#1e293b", "#0f172a"]} style={StyleSheet.absoluteFill} />
      
      <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 40 }]}>
        <Text style={[styles.callStatus, callState === "missed" && styles.missedStatus]}>
          {getStatusText()}
        </Text>

        <View style={styles.avatarSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <Animated.View style={{ transform: [{ rotate: callState === "ringing" ? ringAnim.interpolate({
            inputRange: [-15, 15],
            outputRange: ["-15deg", "15deg"],
          }) : "0deg" }] }}>
            <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.avatarGradient}>
              <Avatar name={callerName} avatarUrl={callerAvatar} size={120} />
            </LinearGradient>
          </Animated.View>
        </View>

        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callType}>Voice Call</Text>

        <View style={styles.controlsContainer}>
          {callState === "connected" && (
            <View style={styles.controlsRow}>
              <Pressable style={styles.controlButton} onPress={toggleMute}>
                <View style={[styles.controlCircle, isMuted && styles.controlCircleActive]}>
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={28} color={isMuted ? "#fff" : "#94a3b8"} />
                </View>
                <Text style={styles.controlLabel}>Mute</Text>
              </Pressable>

              <Pressable style={styles.controlButton} onPress={toggleSpeaker}>
                <View style={[styles.controlCircle, isSpeaker && styles.controlCircleActive]}>
                  <Ionicons name={isSpeaker ? "volume-high" : "volume-medium"} size={28} color={isSpeaker ? "#fff" : "#94a3b8"} />
                </View>
                <Text style={styles.controlLabel}>Speaker</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actionButtons}>
            {callState === "ringing" && (
              <Pressable style={styles.minimizeButton} onPress={minimizeIncomingCall}>
                <View style={styles.minimizeCircle}>
                  <Ionicons name="chevron-down" size={28} color="#94a3b8" />
                </View>
                <Text style={styles.minimizeLabel}>Minimize</Text>
              </Pressable>
            )}

            <Pressable style={styles.rejectButton} onPress={endCall}>
              <LinearGradient colors={["#ef4444", "#dc2626"]} style={styles.actionGradient}>
                <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
              </LinearGradient>
            </Pressable>

            {callState === "ringing" && (
              <Pressable style={styles.acceptButton} onPress={acceptCall}>
                <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.actionGradient}>
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
  container: { flex: 1 },
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
  missedStatus: {
    color: "#ef4444",
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
    alignItems: "center",
    gap: 30,
  },
  minimizeButton: {
    alignItems: "center",
  },
  minimizeCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  minimizeLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
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