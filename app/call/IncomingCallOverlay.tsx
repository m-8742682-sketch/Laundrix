/**
 * IncomingCallOverlay - Uses global countdown from callState
 */

import Avatar from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { db } from "@/services/firebase";
import { 
  isIncomingScreenOpen$, 
  setIncomingScreenOpen, 
  startIncomingCall,
  rejectIncomingCall,
  acceptIncomingCall,
  incomingCallData$,
  incomingCallCountdown$, // ✅ Use global countdown
  isIncomingCallRinging$, // ✅ Use global ringing state
} from "@/services/callState";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { container } from "@/di/container";

const VIBRATION_PATTERN = Platform.OS === "android" ? [0, 500, 500] : [500];

export default function IncomingCallOverlay() {
  const { user } = useUser();
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // ✅ Local state synced from global

  const slideAnim = useRef(new Animated.Value(-150)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hasAddedCallRecord = useRef(false);

  // Subscribe to global countdown
  useEffect(() => {
    const countdownSub = incomingCallCountdown$.subscribe((count) => {
      setTimeLeft(count);
    });
    
    const ringingSub = isIncomingCallRinging$.subscribe((isRinging) => {
      // If ringing stopped but we still have call data, hide overlay
      if (!isRinging && incomingCallData$.value === null && visible) {
        hideOverlay(true);
      }
    });
    
    return () => {
      countdownSub.unsubscribe();
      ringingSub.unsubscribe();
    };
  }, [visible]);

  // Listen to screen state and call data
  useEffect(() => {
    let shouldShow = false;

    const updateVisibility = () => {
      const hasCall = incomingCallData$.value !== null;
      const isScreenOpen = isIncomingScreenOpen$.value;
      
      // FIXED: Show overlay when we have call data, regardless of screen state
      // The overlay should show if: we have incoming call AND (screen not open OR we just minimized)
      const newShouldShow = hasCall && !isScreenOpen;

      if (newShouldShow && !visible) {
        showOverlay();
      } else if (!newShouldShow && visible) {
        hideOverlay(true);
      }
    };

    const dataSub = incomingCallData$.subscribe(() => updateVisibility());
    const screenSub = isIncomingScreenOpen$.subscribe(() => updateVisibility());

    updateVisibility();

    return () => {
      dataSub.unsubscribe();
      screenSub.unsubscribe();
    };
  }, [visible]);

  // Firebase Listener - only starts ring if not already ringing
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "calls"),
      where("targetUserId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Don't hide here - let the countdown handler or status listener handle it
        return;
      }

      let latestCall: any = null;
      let latestTime = 0;
      
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status !== "calling") return; // client-side filter (avoids composite index)
        const createdAt = data.createdAt?.toDate?.() || new Date();
        
        if (Date.now() - createdAt.getTime() < 60000 && createdAt.getTime() > latestTime) {
          latestTime = createdAt.getTime();
          latestCall = { 
            id: docSnap.id, 
            callerId: data.callerId,
            callerName: data.callerName || "Unknown",
            callerAvatar: data.callerAvatar,
            type: data.type || "voice",
          };
        }
      });

      if (latestCall) {
        setIncomingCall(latestCall);
        
        // FIX: Always start ring if this is a new/different call.
        // Checking isIncomingScreenOpen$.value was wrong — if that flag is stale
        // (stuck=true from a previous crashed screen), the receiver gets no ring.
        // Check incomingCallData$ instead: only skip if we already have THIS exact call.
        const existingCall = incomingCallData$.value;
        if (!existingCall || existingCall.callId !== latestCall.id) {
          // Reset stuck isIncomingScreenOpen flag before starting
          if (!existingCall) setIncomingScreenOpen(false);
          startIncomingCall({
            id: `incoming_${latestCall.id}`,
            callId: latestCall.id,
            targetUserId: user!.uid,  // FIXED - this is B (current user)
            targetName: user!.name || "Me",
            targetAvatar: user!.avatarUrl || undefined,
            callerId: latestCall.callerId,  // A
            callerName: latestCall.callerName,
            callerAvatar: latestCall.callerAvatar,
            type: latestCall.type,
            status: "calling",
            isOutgoing: false,
          });
          
          hasAddedCallRecord.current = false;
        }
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Vibration
  useEffect(() => {
    if (visible && Platform.OS === "android") {
      Vibration.vibrate(VIBRATION_PATTERN, true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [visible]);

  // Pulse Animation
  useEffect(() => {
    if (visible) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [visible]);

  const showOverlay = () => {
    setVisible(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
  };

  const hideOverlay = (clearData = false) => {
    Vibration.cancel();
    Animated.timing(slideAnim, { toValue: -150, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
      if (clearData) {
        setIncomingCall(null);
      }
    });
  };

  const addCallRecordToChat = async (status: "missed", duration: number) => {
    if (hasAddedCallRecord.current || !user?.uid || !incomingCall?.callerId) return;
    hasAddedCallRecord.current = true;

    try {
      const channel = `chat-${[user.uid, incomingCall.callerId].sort().join("-")}`;
      await container.chatRepository.addCallRecord(
        channel,
        incomingCall.callerId,
        user.uid,
        incomingCall.type,
        status,
        duration
      );
    } catch (error) {
      console.error("[IncomingOverlay] Add record error:", error);
    }
  };

  const maximize = () => {
    if (!incomingCall) return;
    setIncomingScreenOpen(true);
    hideOverlay(false);

    const route = incomingCall.type === "video" ? "/call/video-incoming" : "/call/voice-incoming";
    router.push({
      pathname: route,
      params: {
        channel: incomingCall.id,
        name: incomingCall.callerName,
        avatar: incomingCall.callerAvatar,
        callerId: incomingCall.callerId,
        receiverId: user?.uid,
        autoAccept: "false"
      }
    });
  };

  const accept = async () => {
    if (!incomingCall) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Update Firebase first
    try {
      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "connected",
        connectedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("[IncomingOverlay] Accept error:", error);
    }

    // Transition global state to active
    acceptIncomingCall();
    setIncomingScreenOpen(true);
    hideOverlay(false);

    // Navigate directly to the ACTIVE call screen (not incoming screen)
    const route = incomingCall.type === "video" ? "/call/video-call" : "/call/voice-call";
    router.push({
      pathname: route,
      params: {
        channel: incomingCall.id,
        targetUserId: incomingCall.callerId,
        targetName: incomingCall.callerName,
        targetAvatar: incomingCall.callerAvatar || "",
      },
    });
  };

  const reject = async () => {
    if (!incomingCall) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      await updateDoc(doc(db, "calls", incomingCall.id), { 
        status: "rejected", 
        endedAt: serverTimestamp() 
      });
    } catch(e) {}
    
    await addCallRecordToChat("missed", 0);
    rejectIncomingCall(); // Global reject
    hideOverlay(true);
  };

  if (!visible || !incomingCall) return null;

  const isVideo = incomingCall.type === "video";

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity activeOpacity={0.95} onPress={maximize} style={styles.touchableArea}>
        <LinearGradient colors={["#1e293b", "#0f172a"]} style={styles.card}>
          <View style={styles.leftInfo}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Avatar name={incomingCall.callerName} avatarUrl={incomingCall.callerAvatar} size={48} />
            </Animated.View>
            <View style={styles.textContainer}>
              <Text style={styles.name} numberOfLines={1}>{incomingCall.callerName}</Text>
              <Text style={styles.type}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={12} color="#94a3b8" />
                {" "}{isVideo ? "Incoming Video" : "Incoming Voice"} • {timeLeft}s
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={reject} style={styles.rejectButton}>
              <LinearGradient colors={["#ef4444", "#dc2626"]} style={styles.actionGradient}>
                <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={accept} style={styles.acceptButton}>
              <LinearGradient colors={["#22c55e", "#16a34a"]} style={styles.actionGradient}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 20,
  },
  touchableArea: { borderRadius: 16 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  leftInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  textContainer: { marginLeft: 12, flex: 1 },
  name: { color: "#fff", fontWeight: "700", fontSize: 16 },
  type: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", alignItems: "center", gap: 12 },
  rejectButton: {
    borderRadius: 28,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  acceptButton: {
    borderRadius: 28,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});