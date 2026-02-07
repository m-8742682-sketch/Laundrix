import React, { useRef, useState } from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  withSpring,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get('window');
const CANCEL_X = -width + 120; 
const LOCK_Y = -100;

export default function VoiceRecorder({ onSend, onRecordingStateChange, onTick, onLockChange }: any) {
  const isRecordingRef = useRef(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isLocked = useSharedValue(false);
  const glowPulse = useSharedValue(1);
  const waveScale = useSharedValue(1);

  const [status, setStatus] = useState<"idle" | "recording" | "locked">("idle");

  const triggerVibration = (style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(style);
  };

  const startRecording = async () => {
    if (isRecordingRef.current) return;
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) return;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();

    recordingRef.current = rec;
    isRecordingRef.current = true;
    runOnJS(setStatus)("recording");
    onRecordingStateChange?.(true);
    startTimeRef.current = Date.now();
    triggerVibration(Haptics.ImpactFeedbackStyle.Light);

    // Start wave animation
    waveScale.value = withRepeat(
      withTiming(1.3, { duration: 600 }),
      -1,
      true
    );

    timerRef.current = setInterval(() => {
      onTick?.(Date.now() - startTimeRef.current);
    }, 500);
  };

  const stopRecording = async (send: boolean) => {
    if (!isRecordingRef.current) return;
    isLocked.value = false;
    glowPulse.value = 1;
    waveScale.value = 1;
    onLockChange?.(false);

    try {
      if (send) {
        await recordingRef.current?.stopAndUnloadAsync();
        const uri = recordingRef.current?.getURI();
        if (uri) onSend(uri);
      } else {
        await recordingRef.current?.stopAndUnloadAsync();
        triggerVibration(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      console.warn(status, e);
    }

    recordingRef.current = null;
    isRecordingRef.current = false;
    runOnJS(setStatus)("idle");
    onRecordingStateChange?.(false);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(100)
    .onStart(() => {
      runOnJS(startRecording)();
    })
    .onUpdate((e) => {
      if (isLocked.value) return;

      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        translateX.value = Math.max(CANCEL_X, Math.min(0, e.translationX));
        translateY.value = withTiming(0);
        
        if (translateX.value <= CANCEL_X + 10) runOnJS(triggerVibration)();
      } else {
        translateY.value = Math.max(LOCK_Y, Math.min(0, e.translationY));
        translateX.value = withTiming(0);

        if (translateY.value <= LOCK_Y && !isLocked.value) {
          isLocked.value = true;
          runOnJS(triggerVibration)(Haptics.ImpactFeedbackStyle.Heavy);
          runOnJS(setStatus)("locked");
          onLockChange && runOnJS(onLockChange)(true);
          translateY.value = withSpring(0);
          glowPulse.value = withRepeat(withTiming(1.2, { duration: 800 }), -1, true);
          waveScale.value = 1; // Stop wave animation when locked
        }
      }
    })
    .onEnd(() => {
      if (translateX.value <= CANCEL_X + 30) {
        runOnJS(stopRecording)(false);
      } else if (isLocked.value) {
        // Handled by tap
      } else {
        runOnJS(stopRecording)(true);
      }
      
      if (!isLocked.value) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (isLocked.value) runOnJS(stopRecording)(true);
  });

  // Animated wave rings for recording state
  const waveStyle1 = useAnimatedStyle(() => ({
    opacity: status === "recording" && !isLocked.value 
      ? interpolate(waveScale.value, [1, 1.3], [0.6, 0], Extrapolate.CLAMP)
      : 0,
    transform: [{ scale: waveScale.value }],
  }));

  const waveStyle2 = useAnimatedStyle(() => ({
    opacity: status === "recording" && !isLocked.value
      ? interpolate(waveScale.value, [1, 1.3], [0.4, 0], Extrapolate.CLAMP)
      : 0,
    transform: [{ scale: waveScale.value * 1.15 }],
  }));

  const micStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: isLocked.value ? glowPulse.value : withSpring(status !== "idle" ? 1.15 : 1) },
    ],
  }));

  const trashStyle = useAnimatedStyle(() => ({
    opacity: withTiming(status === "recording" ? 1 : 0),
    transform: [{ 
      scale: interpolate(
        translateX.value, 
        [CANCEL_X, 0], 
        [1.3, 0.8], 
        Extrapolate.CLAMP
      ) 
    }],
  }));

  const lockPillarStyle = useAnimatedStyle(() => ({
    opacity: withTiming(status === "recording" ? 1 : 0),
    transform: [{ translateY: withSpring(status === "recording" ? 0 : 30) }],
  }));

  const lockIndicatorStyle = useAnimatedStyle(() => ({
    opacity: status === "recording" && !isLocked.value ? 1 : 0,
    transform: [
      { 
        translateY: interpolate(
          translateY.value,
          [LOCK_Y, 0],
          [0, 10],
          Extrapolate.CLAMP
        )
      }
    ],
  }));

  return (
    <View style={styles.container}>
      {/* Wave Rings - Recording Animation */}
      <Animated.View style={[styles.wave, waveStyle1]} />
      <Animated.View style={[styles.wave, waveStyle2]} />

      {/* Lock Track (Pillar) */}
      <Animated.View style={[styles.lockPillar, lockPillarStyle]}>
        <View style={styles.lockPillarInner}>
          <Ionicons name="lock-closed" size={18} color="#0284C7" />
          <Animated.View style={lockIndicatorStyle}>
            <Ionicons name="chevron-up" size={16} color="#0EA5E9" />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Trash Bin */}
      <Animated.View style={[styles.trashBin, trashStyle]}>
        <View style={styles.trashContainer}>
          <LinearGradient
            colors={["#fef2f2", "#fee2e2"]}
            style={styles.trashGradient}
          >
            <Ionicons name="trash-outline" size={26} color="#ef4444" />
          </LinearGradient>
        </View>
      </Animated.View>

      <GestureDetector gesture={Gesture.Simultaneous(panGesture, tapGesture)}>
        <Animated.View style={[styles.micContainer, micStyle]}>
          <LinearGradient
            colors={
              status === "locked" 
                ? ["#10b981", "#059669", "#047857"]
                : status === "recording"
                ? ["#ef4444", "#dc2626", "#b91c1c"]
                : ["#0EA5E9", "#0284C7", "#0369A1"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.mic}
          >
            <Ionicons 
              name={status === "locked" ? "send" : "mic"} 
              size={22} 
              color="#ffffff" 
            />
          </LinearGradient>
          
          {/* Glow effect for locked state */}
          {status === "locked" && (
            <Animated.View 
              style={[
                styles.lockedGlow,
                {
                  opacity: interpolate(glowPulse.value, [1, 1.2], [0.3, 0.6]),
                  transform: [{ scale: glowPulse.value }],
                }
              ]} 
            />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    alignItems: "center", 
    justifyContent: "center", 
    width: 50, 
    height: 50,
  },

  wave: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#ef4444",
    zIndex: 1,
  },

  micContainer: {
    zIndex: 10,
    position: "relative",
  },

  mic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  lockedGlow: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10b981",
    zIndex: -1,
  },

  lockPillar: {
    position: 'absolute',
    bottom: 65,
    width: 36,
    height: 70,
    zIndex: 5,
  },

  lockPillarInner: {
    width: "100%",
    height: "100%",
    backgroundColor: '#f1f5f9',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  trashBin: {
    position: 'absolute',
    left: CANCEL_X,
    zIndex: 5,
  },

  trashContainer: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },

  trashGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fecaca",
  },
});