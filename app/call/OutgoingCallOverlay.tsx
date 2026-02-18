/**
 * OutgoingCallOverlay - Shows when an outgoing call is minimized
 * 
 * Uses centralized callState - automatically hides when call ends
 */

import Avatar from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { db } from "@/services/firebase";
import { 
  outgoingCallData$, 
  isOutgoingScreenOpen$,
  setOutgoingScreenOpen,
  endOutgoingCall,
} from "@/services/callState";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { 
  doc, 
  updateDoc, 
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { container } from "@/di/container";

export default function OutgoingCallOverlay() {
  const { user } = useUser();
  const [outgoingCall, setOutgoingCall] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(-150)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasAddedCallRecord = useRef(false);

  // Subscribe to outgoing call data AND screen state
  useEffect(() => {
    const updateVisibility = () => {
      const hasCall = outgoingCallData$.value !== null;
      const isScreenOpen = isOutgoingScreenOpen$.value;
      const newShouldShow = hasCall && !isScreenOpen;

      if (newShouldShow && !visible) {
        showOverlay();
      } else if (!newShouldShow && visible) {
        hideOverlay();
      }
    };

    const dataSub = outgoingCallData$.subscribe(() => updateVisibility());
    const screenSub = isOutgoingScreenOpen$.subscribe(() => updateVisibility());

    updateVisibility();

    return () => {
      dataSub.unsubscribe();
      screenSub.unsubscribe();
    };
  }, [visible]);

  const showOverlay = () => {
    setOutgoingCall(outgoingCallData$.value);
    hasAddedCallRecord.current = false;
    setVisible(true);
    Animated.spring(slideAnim, { 
      toValue: 0, 
      tension: 60, 
      friction: 9, 
      useNativeDriver: true 
    }).start();
  };

  const hideOverlay = () => {
    Animated.timing(slideAnim, { 
      toValue: -150, 
      duration: 200, 
      useNativeDriver: true 
    }).start(() => {
      setVisible(false);
      setOutgoingCall(null);
    });
  };

  const addCallRecordToChat = async (status: "ended" | "missed", duration: number) => {
    if (hasAddedCallRecord.current || !user?.uid || !outgoingCall?.targetUserId) return;
    hasAddedCallRecord.current = true;

    try {
      const channel = `chat-${[user.uid, outgoingCall.targetUserId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(
        channel,
        user.uid,
        outgoingCall.targetUserId,
        outgoingCall.type,
        status,
        duration
      );
      console.log(`[OutgoingOverlay] Added call record: ${status}`);
    } catch (error) {
      console.error("[OutgoingOverlay] Add record error:", error);
    }
  };

  const maximize = () => {
    if (!outgoingCall) return;
    
    setOutgoingScreenOpen(true);
    hideOverlay();

    const route = outgoingCall.type === "video" ? "/call/video-outgoing" : "/call/voice-outgoing";
    router.push({
      pathname: route,
      params: {
        targetUserId: outgoingCall.targetUserId,
        targetName: outgoingCall.targetName,
        targetAvatar: outgoingCall.targetAvatar || "",
      }
    });
  };

  const endCall = async () => {
    if (!outgoingCall?.callId) return;
    
    try {
      await updateDoc(doc(db, "calls", outgoingCall.callId), {
        status: "ended",
        endedAt: serverTimestamp(),
        endedBy: user?.uid,
      });
    } catch (e) {
      console.error("[OutgoingOverlay] End call error:", e);
    }
    
    await addCallRecordToChat("ended", 0);
    endOutgoingCall(); // Global end - clears state, stops ringtone, stops listener
    hideOverlay();
  };

  if (!visible || !outgoingCall) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.9} onPress={maximize}>
        <LinearGradient
          colors={outgoingCall.type === "video" ? ["#7c3aed", "#5b21b6"] : ["#059669", "#047857"]}
          style={styles.card}
        >
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Avatar name={outgoingCall.targetName} avatarUrl={outgoingCall.targetAvatar} size={40} />
          </Animated.View>

          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>{outgoingCall.targetName}</Text>
            <Text style={styles.status}>Calling...</Text>
          </View>

          <Pressable style={styles.endButton} onPress={endCall}>
            <Ionicons name="call" size={20} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
          </Pressable>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
    gap: 12,
  },
  info: { flex: 1 },
  name: { color: "#fff", fontSize: 16, fontWeight: "700" },
  status: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  endButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
});