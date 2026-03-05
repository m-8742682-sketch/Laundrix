import React, { useRef, useState } from "react";
import { View, StyleSheet, Platform, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AudioRecorder, setAudioModeAsync, requestRecordingPermissionsAsync, RecordingPresets } from "expo-audio";
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
interface VoiceRecorderProps {
  onSend: (uri: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onTick?: (elapsedMs: number) => void;
  onLockChange?: (isLocked: boolean) => void;
}

export default function VoiceRecorder({ onSend, onRecordingStateChange, onTick, onLockChange }: VoiceRecorderProps) {
  const isRecordingRef = useRef(false);
  const recordingRef = useRef<AudioRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<any>(null);
  const isStoppingRef = useRef(false);

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
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      
      const rec = new AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await rec.prepareToRecordAsync();
      await rec.record();

      recordingRef.current = rec;
      isRecordingRef.current = true;
      runOnJS(setStatus)("recording");
      onRecordingStateChange?.(true);
      startTimeRef.current = Date.now();
      triggerVibration(Haptics.ImpactFeedbackStyle.Light);

      waveScale.value = withRepeat(withTiming(1.3, { duration: 600 }), -1, true);
      timerRef.current = setInterval(() => { onTick?.(Date.now() - startTimeRef.current); }, 500);
    } catch (e) {
      console.warn("[VoiceRecorder] Start error:", e);
      isRecordingRef.current = false;
      runOnJS(setStatus)("idle");
    }
  };

  const stopRecording = async (send: boolean) => {
    if (!isRecordingRef.current || isStoppingRef.current) return;
    isRecordingRef.current = false;
    isStoppingRef.current = true;

    isLocked.value = false;
    glowPulse.value = 1;
    waveScale.value = 1;
    onLockChange?.(false);

    try {
      if (send && recordingRef.current) {
        await recordingRef.current.stop();
        const uri = recordingRef.current.uri;
        if (uri) onSend(uri);
      } else if (recordingRef.current) {
        await recordingRef.current.stop();
        triggerVibration(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      console.warn("[VoiceRecorder] Stop error:", e);
    } finally {
      isStoppingRef.current = false;
    }

    recordingRef.current = null;
    runOnJS(setStatus)("idle");
    onRecordingStateChange?.(false);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const panGesture = Gesture.Pan()
    .activateAfterLongPress(100)
    .onStart(() => { runOnJS(startRecording)(); })
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
          waveScale.value = 1;
        }
      }
    })
    .onEnd(() => {
      if (translateX.value <= CANCEL_X + 30) {
        runOnJS(stopRecording)(false);
      } else if (!isLocked.value) {
        runOnJS(stopRecording)(true);
      }
      if (!isLocked.value) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  // FIX: Only enable tap gesture when locked - prevents capturing touches when idle
  const tapGesture = Gesture.Tap()
    .enabled(status === "locked") // Only active when locked
    .onEnd(() => {
      if (isLocked.value) runOnJS(stopRecording)(true);
    });

  const waveStyle1 = useAnimatedStyle(() => ({
    opacity: status === "recording" && !isLocked.value 
      ? interpolate(waveScale.value, [1, 1.3], [0.6, 0], Extrapolate.CLAMP) : 0,
    transform: [{ scale: waveScale.value }],
  }));

  const waveStyle2 = useAnimatedStyle(() => ({
    opacity: status === "recording" && !isLocked.value
      ? interpolate(waveScale.value, [1, 1.3], [0.4, 0], Extrapolate.CLAMP) : 0,
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
    transform: [{ scale: interpolate(translateX.value, [CANCEL_X, 0], [1.3, 0.8], Extrapolate.CLAMP) }],
  }));

  const lockPillarStyle = useAnimatedStyle(() => ({
    opacity: withTiming(status === "recording" ? 1 : 0),
    transform: [{ translateY: withSpring(status === "recording" ? 0 : 30) }],
  }));

  const lockIndicatorStyle = useAnimatedStyle(() => ({
    opacity: status === "recording" && !isLocked.value ? 1 : 0,
    transform: [{ translateY: interpolate(translateY.value, [LOCK_Y, 0], [0, 10], Extrapolate.CLAMP) }],
  }));

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Animated.View style={[styles.wave, waveStyle1]} pointerEvents="none" />
      <Animated.View style={[styles.wave, waveStyle2]} pointerEvents="none" />

      {/* Lock Pillar - Glassmorphism */}
      <Animated.View style={[styles.lockPillar, lockPillarStyle]} pointerEvents="none">
        <LinearGradient colors={["#ffffff", "#f1f5f9"]} style={styles.lockPillarInner}>
          <Ionicons name="lock-closed" size={18} color="#6366F1" />
          <Animated.View style={lockIndicatorStyle}>
            <Ionicons name="chevron-up" size={16} color="#6366F1" />
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* Trash Bin - Common Sense Red */}
      <Animated.View style={[styles.trashBin, trashStyle]} pointerEvents="none">
        <LinearGradient colors={["#FCA5A5", "#F87171"]} style={styles.trashGradient}>
          <Ionicons name="trash" size={26} color="#fff" />
        </LinearGradient>
      </Animated.View>

      <GestureDetector gesture={Gesture.Simultaneous(panGesture, tapGesture)}>
        <Animated.View style={[styles.micContainer, micStyle]}>
          <LinearGradient
            colors={
              status === "locked" 
                ? ["#10b981", "#059669"] // Green when locked
                : status === "recording"
                ? ["#F87171", "#EF4444"] // Red when recording
                : ["#8B5CF6", "#6366F1"] // Match send button indigo when idle
            }
            style={styles.mic}
          >
            <Ionicons name={status === "locked" ? "send" : "mic"} size={22} color="#ffffff" />
          </LinearGradient>
          
          {status === "locked" && (
            <View style={styles.glowContainer}>
              <Animated.View 
                style={[
                  styles.lockedGlow, 
                  { 
                    opacity: interpolate(glowPulse.value, [1, 1.2], [0.3, 0.6]), 
                    transform: [{ scale: glowPulse.value }] 
                  }
                ]} 
              />
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", width: 40, height: 40 },
  wave: { 
    position: "absolute", 
    width: 56, // Slightly larger than mic
    height: 56, 
    borderRadius: 28, 
    borderWidth: 2, 
    borderColor: "#EF4444", 
    zIndex: 1 
  },
  micContainer: { zIndex: 10, position: "relative" },
  mic: {
    width: 40, // Match sendButton width
    height: 40, // Match sendButton height
    borderRadius: 22, // Match sendButton borderRadius
    alignItems: "center", 
    justifyContent: "center",
    shadowColor: "#6366F1", // Match sendButton shadow
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 4, 
    elevation: 4
  },
  lockedGlow: { 
    width: 48,
    height: 48,
    borderRadius: 24, 
    backgroundColor: "#10B981",
  },
  lockPillar: { position: 'absolute', bottom: 65, width: 36, height: 70, zIndex: 5 },
  lockPillarInner: {
    width: "100%", height: "100%", borderRadius: 18, alignItems: 'center', justifyContent: 'space-evenly',
    paddingVertical: 8, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: "#6366F1", 
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
  },
  trashBin: { position: 'absolute', left: CANCEL_X, zIndex: 5 },
  trashGradient: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  glowContainer: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: -1,
    top: -4, // Center relative to 40px mic (48-40)/2 = 4px offset
    left: -4,
  },
});