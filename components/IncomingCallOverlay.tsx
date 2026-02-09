/**
 * IncomingCallOverlay
 * 
 * Telegram-style incoming call popup overlay.
 * Shows as a floating card at the top of the screen when receiving a call.
 * Listens to Firestore "calls" collection for incoming calls.
 */

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
  Vibration,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp,
  Timestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface IncomingCall {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  type: "voice" | "video";
  status: "calling" | "connected" | "ended" | "rejected" | "missed";
  createdAt: Date;
}

// Vibration pattern: vibrate 500ms, pause 500ms (looping)
const VIBRATION_PATTERN = Platform.OS === "android" 
  ? [0, 500, 500] // [wait, vibrate, wait] - will loop
  : [500]; // iOS only supports single vibration

export default function IncomingCallOverlay() {
  const { user } = useUser();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [visible, setVisible] = useState(false);

  // Animation
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Sound
  const soundRef = useRef<Audio.Sound | null>(null);
  
  // Vibration interval for iOS (Android uses pattern)
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to incoming calls
  useEffect(() => {
    if (!user?.uid) {
      console.log("[IncomingCallOverlay] No user, not listening for calls");
      return;
    }

    console.log("[IncomingCallOverlay] Starting to listen for calls for user:", user.uid);

    // Query for calls where:
    // - Current user is the receiver
    // - Status is "calling" (not answered yet)
    const callsQuery = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid),
      where("status", "==", "calling")
    );

    const unsubscribe = onSnapshot(callsQuery, (snapshot) => {
      console.log("[IncomingCallOverlay] Snapshot received, docs:", snapshot.docs.length);
      
      if (snapshot.empty) {
        // No incoming calls
        console.log("[IncomingCallOverlay] No incoming calls");
        if (incomingCall) {
          hideOverlay();
        }
        return;
      }

      // Get the most recent incoming call
      let latestCall: IncomingCall | null = null;
      let latestTime = 0;

      for (const callDoc of snapshot.docs) {
        const data = callDoc.data();
        
        // Parse timestamp
        let createdAt = new Date();
        if (data.createdAt instanceof Timestamp) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt?.seconds) {
          createdAt = new Date(data.createdAt.seconds * 1000);
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt);
        }

        // Check if call is not too old (max 60 seconds)
        const ageMs = Date.now() - createdAt.getTime();
        if (ageMs > 60000) continue;

        if (createdAt.getTime() > latestTime) {
          latestTime = createdAt.getTime();
          latestCall = {
            id: callDoc.id,
            callerId: data.callerId,
            callerName: data.callerName || "Unknown",
            receiverId: data.receiverId,
            type: data.type || "voice",
            status: data.status,
            createdAt,
          };
        }
      }

      if (latestCall) {
        console.log("[IncomingCallOverlay] Showing overlay for call:", latestCall);
        setIncomingCall(latestCall);
        showOverlay();
      } else if (incomingCall) {
        hideOverlay();
      }
    }, (error) => {
      console.error("[IncomingCallOverlay] Subscription error:", error);
    });

    return () => {
      console.log("[IncomingCallOverlay] Unsubscribing");
      unsubscribe();
    };
  }, [user?.uid]);

  // Start/stop ringtone and vibration
  useEffect(() => {
    if (visible && incomingCall) {
      startRinging();
    } else {
      stopRinging();
    }

    // Cleanup
    return () => {
      stopRinging();
    };
  }, [visible, incomingCall?.id]);

  // Pulse animation
  useEffect(() => {
    if (visible) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [visible]);

  // Auto-hide after 30 seconds (call will be marked as missed by sender)
  useEffect(() => {
    if (!visible || !incomingCall) return;

    const timeout = setTimeout(() => {
      hideOverlay();
    }, 30000);

    return () => clearTimeout(timeout);
  }, [visible, incomingCall?.id]);

  // Listen for call status changes (when caller ends/cancels the call)
  useEffect(() => {
    if (!incomingCall?.id) return;

    console.log("[IncomingCallOverlay] Subscribing to call status:", incomingCall.id);
    
    const callRef = doc(db, "calls", incomingCall.id);
    const unsubscribe = onSnapshot(callRef, (docSnap) => {
      if (!docSnap.exists()) {
        console.log("[IncomingCallOverlay] Call document deleted, hiding overlay");
        hideOverlay();
        return;
      }

      const data = docSnap.data();
      const status = data?.status;
      
      // If the call status is no longer "calling", the caller has ended/cancelled
      if (status && status !== "calling") {
        console.log("[IncomingCallOverlay] Call status changed to:", status, "- hiding overlay");
        hideOverlay();
      }
    }, (error) => {
      console.error("[IncomingCallOverlay] Call status subscription error:", error);
    });

    return () => {
      console.log("[IncomingCallOverlay] Unsubscribing from call status");
      unsubscribe();
    };
  }, [incomingCall?.id]);

  const startRinging = async () => {
    console.log("[IncomingCallOverlay] Starting ringtone and vibration");
    
    // Start vibration
    try {
      if (Platform.OS === "android") {
        // Android: use pattern with repeat
        Vibration.vibrate(VIBRATION_PATTERN, true); // true = repeat
      } else {
        // iOS: manually repeat vibration
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        vibrationIntervalRef.current = setInterval(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        }, 1000);
      }
    } catch (error) {
      console.warn("[IncomingCallOverlay] Vibration error:", error);
    }

    // Try to play ringtone
    try {
      // Set audio mode for ringtone
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });

      // Try loading ringtone - use try/catch for each attempt
      let sound: Audio.Sound | null = null;
      
      try {
        // Try local file first
        const result = await Audio.Sound.createAsync(
          require("@/assets/sounds/calling.mp3"),
          { isLooping: true, volume: 1.0 }
        );
        sound = result.sound;
      } catch (e1) {
        console.warn("[IncomingCallOverlay] Local ringtone not found, trying default");
        try {
          // Fallback: system notification sound or built-in
          const result = await Audio.Sound.createAsync(
            { uri: "https://www.soundjay.com/phone/phone-calling-1.mp3" },
            { isLooping: true, volume: 1.0 }
          );
          sound = result.sound;
        } catch (e2) {
          console.warn("[IncomingCallOverlay] Could not load any ringtone:", e2);
        }
      }

      if (sound) {
        soundRef.current = sound;
        await sound.playAsync();
        console.log("[IncomingCallOverlay] Ringtone playing");
      }
    } catch (error) {
      console.warn("[IncomingCallOverlay] Audio setup error:", error);
      // Continue without sound - vibration still works
    }
  };

  const stopRinging = async () => {
    console.log("[IncomingCallOverlay] Stopping ringtone and vibration");
    
    // Stop vibration
    try {
      Vibration.cancel();
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
    } catch (error) {
      console.warn("[IncomingCallOverlay] Stop vibration error:", error);
    }

    // Stop sound
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    } catch (error) {
      console.warn("[IncomingCallOverlay] Stop sound error:", error);
    }
  };

  const showOverlay = () => {
    setVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const hideOverlay = () => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setIncomingCall(null);
    });
    stopRinging();
  };

  const acceptCall = () => {
    if (!incomingCall) return;

    console.log("[IncomingCallOverlay] Accepting call:", incomingCall.id);
    stopRinging();
    setVisible(false);

    // Navigate to the appropriate call screen
    const pathname = incomingCall.type === "video" 
      ? "/call/video-incoming"
      : "/call/voice-incoming";

    router.push({
      pathname: pathname as "/call/video-incoming" | "/call/voice-incoming",
      params: {
        channel: incomingCall.id,
        name: incomingCall.callerName,
        callerId: incomingCall.callerId,
        receiverId: user?.uid ?? "",
      },
    });

    setIncomingCall(null);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    console.log("[IncomingCallOverlay] Rejecting call:", incomingCall.id);

    try {
      // Update call status to rejected
      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "rejected",
        endedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[IncomingCallOverlay] Failed to reject call:", error);
    }

    hideOverlay();
  };

  if (!visible || !incomingCall) {
    return null;
  }

  const isVideo = incomingCall.type === "video";

  return (
    <Animated.View 
      style={[
        styles.container, 
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <LinearGradient
        colors={["#1e293b", "#0f172a"]}
        style={styles.card}
      >
        {/* Caller info */}
        <View style={styles.callerInfo}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LinearGradient
              colors={isVideo ? ["#8b5cf6", "#7c3aed"] : ["#22c55e", "#16a34a"]}
              style={styles.avatarGradient}
            >
              <Avatar name={incomingCall.callerName} size={52} />
            </LinearGradient>
          </Animated.View>
          <View style={styles.callerText}>
            <Text style={styles.callerName} numberOfLines={1}>
              {incomingCall.callerName}
            </Text>
            <View style={styles.callTypeContainer}>
              <Ionicons 
                name={isVideo ? "videocam" : "call"} 
                size={14} 
                color={isVideo ? "#a78bfa" : "#4ade80"} 
              />
              <Text style={styles.callType}>
                {isVideo ? "Video call" : "Voice call"}
              </Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {/* Reject */}
          <Pressable 
            style={styles.rejectButton} 
            onPress={rejectCall}
          >
            <LinearGradient
              colors={["#ef4444", "#dc2626"]}
              style={styles.buttonGradient}
            >
              <Ionicons 
                name="call" 
                size={22} 
                color="#fff" 
                style={{ transform: [{ rotate: "135deg" }] }} 
              />
            </LinearGradient>
          </Pressable>

          {/* Accept */}
          <Pressable 
            style={styles.acceptButton} 
            onPress={acceptCall}
          >
            <LinearGradient
              colors={["#22c55e", "#16a34a"]}
              style={styles.buttonGradient}
            >
              <Ionicons name={isVideo ? "videocam" : "call"} size={22} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 20,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  callerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarGradient: {
    padding: 3,
    borderRadius: 30,
  },
  callerText: {
    marginLeft: 14,
    flex: 1,
  },
  callerName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  callTypeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  callType: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rejectButton: {
    borderRadius: 24,
    overflow: "hidden",
  },
  acceptButton: {
    borderRadius: 24,
    overflow: "hidden",
  },
  buttonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
