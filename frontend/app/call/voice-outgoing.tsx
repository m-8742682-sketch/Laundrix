/**
 * Voice Outgoing Screen - Uses centralized callState
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
import { 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { container } from "@/di/container";
import { 
  startOutgoingCall,
  endOutgoingCall,
  outgoingCallData$,
  setOutgoingScreenOpen,
  sendIncomingCallNotification,
} from "@/services/callState";

export default function VoiceOutgoingScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const targetUserId = params.targetUserId as string;
  const targetName = params.targetName as string;
  const targetAvatar = params.targetAvatar as string | undefined;

  const [callState, setCallState] = useState<"calling" | "connected" | "ended">("calling");
  
  const hasAddedCallRecord = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const hasExistingData = !!outgoingCallData$.value;

  // Subscribe to outgoing call data - for remote end detection
  useEffect(() => {
    let hadData = hasExistingData; // Initialize with mount state
    
    const sub = outgoingCallData$.subscribe((data) => {
      if (data) {
        hadData = true;
      } else if (hadData && callState === "calling") {
        console.log("[VoiceOutgoing] Call ended remotely");
        setCallState("ended");
        setTimeout(() => safeNavigate(), 1500);
      }
    });
    
    return () => sub.unsubscribe();
  }, [callState, hasExistingData]);

  // Initialize call
  useEffect(() => {
    if (!user?.uid || !targetUserId) return;

    const existingCall = outgoingCallData$.value;
    if (existingCall && existingCall.targetUserId === targetUserId) {
      console.log("[VoiceOutgoing] Restoring existing call:", existingCall.callId);
    } else {
      console.log("[VoiceOutgoing] Creating new call");
      createCall();
    }

    setOutgoingScreenOpen(true);

    return () => {
      console.log("[VoiceOutgoing] Cleanup - setting screen closed");
      setOutgoingScreenOpen(false);
    };
  }, [user?.uid, targetUserId]);

  const createCall = async () => {
    try {
      const callId = `call_${user!.uid}_${targetUserId}_${Date.now()}`;

      // Create call in Firebase
      await setDoc(doc(db, "calls", callId), {
        callerId: user!.uid,
        callerName: user!.name || "Unknown",
        callerAvatar: user!.avatarUrl,
        receiverId: targetUserId,
        receiverName: targetName,
        type: "voice",
        status: "calling",
        createdAt: serverTimestamp(),
      });

      // Notify receiver via callState (which uses api.ts)
      await sendIncomingCallNotification(
        callId,
        user!.uid,
        user!.name || "Unknown",
        targetUserId,
        false
      );

      // Start global outgoing call state
      startOutgoingCall({
        id: `outgoing_${callId}`,
        callId: callId,
        targetUserId,
        targetName,
        targetAvatar,
        callerId: user!.uid,
        callerName: user!.name || "Unknown",
        callerAvatar: user!.avatarUrl || "",
        type: "voice",
        status: "calling",
        isOutgoing: true,
      });

    } catch (error) {
      console.error("[VoiceOutgoing] Error:", error);
      safeNavigate();
    }
  };

  const addCallRecordToChat = async (status: "ended" | "missed", duration: number) => {
    if (hasAddedCallRecord.current || !user?.uid || !targetUserId) return;
    hasAddedCallRecord.current = true;

    try {
      const channel = `chat-${[user.uid, targetUserId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(
        channel,
        user.uid,
        targetUserId,
        "voice",
        status,
        duration
      );
    } catch (error) {
      console.error("[VoiceOutgoing] Add record error:", error);
    }
  };

  const safeNavigate = () => {
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/conversations");
    }, 100);
  };

  const minimizeCall = useCallback(() => {
    console.log("[VoiceOutgoing] Minimize - setting screen closed");
    setOutgoingScreenOpen(false);
    
    setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/dashboard");
    }, 50);
  }, []);

  const endCall = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const callId = outgoingCallData$.value?.callId;
    if (!callId) {
      endOutgoingCall();
      safeNavigate();
      return;
    }

    try {
      await updateDoc(doc(db, "calls", callId), {
        status: "ended",
        endedAt: serverTimestamp(),
        endedBy: user?.uid,
      });
    } catch (error) {
      console.error("[VoiceOutgoing] End call error:", error);
    }

    addCallRecordToChat("ended", 0);
    endOutgoingCall();
    safeNavigate();
  };

  // Animations
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

  // Back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      minimizeCall();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#0f172a", "#1e293b", "#0f172a"]} style={StyleSheet.absoluteFill} />
      
      <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
      <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 40 }]}>
        <Text style={styles.callStatus}>{callState === "calling" ? "Calling..." : "Call ended"}</Text>

        <View style={styles.avatarSection}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
          <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.avatarGradient}>
            <Avatar name={targetName} avatarUrl={targetAvatar} size={120} />
          </LinearGradient>
        </View>

        <Text style={styles.callerName}>{targetName}</Text>
        <Text style={styles.callType}>Voice Call</Text>

        <View style={styles.controlsContainer}>
          <Pressable style={styles.minimizeButton} onPress={minimizeCall}>
            <View style={styles.minimizeCircle}>
              <Ionicons name="chevron-down" size={28} color="#94a3b8" />
            </View>
            <Text style={styles.minimizeLabel}>Minimize</Text>
          </Pressable>

          <Pressable style={styles.endCallButton} onPress={endCall}>
            <LinearGradient colors={["#ef4444", "#dc2626"]} style={styles.endCallGradient}>
              <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            </LinearGradient>
          </Pressable>
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
    flexDirection: "row",
    justifyContent: "center",
    gap: 60,
  },
  minimizeButton: {
    alignItems: "center",
  },
  minimizeCircle: {
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
  minimizeLabel: {
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