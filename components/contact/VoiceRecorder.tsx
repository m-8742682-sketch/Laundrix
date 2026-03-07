/**
 * VoiceRecorder — WhatsApp-style smooth voice recording
 *
 * Fixes vs previous version:
 * 1. No red border ring visible at idle — border opacity driven by animation
 * 2. No crash on lock gesture — replaced Gesture.Simultaneous(pan, tap) with
 *    a single unified PanResponder-free approach: pan handles everything,
 *    locked-state send is a separate plain TouchableOpacity (no gesture conflict)
 * 3. Smooth WhatsApp-feel: spring physics on release, proper velocity-based snap
 * 4. useAudioRecorder (expo-audio 0.4.x hook) — no "prototype undefined" error
 * 5. No Reanimated .value read in render — all in useAnimatedStyle worklets
 */

import React, { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import * as Haptics from "expo-haptics";
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
  cancelAnimation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// How far left before auto-cancel
const CANCEL_THRESHOLD = width * 0.45;
// How far up before auto-lock
const LOCK_THRESHOLD = 80;
// Spring config for snapping back — mimics WhatsApp's feel
const SNAP_SPRING = { damping: 18, stiffness: 200, mass: 0.6 };

interface VoiceRecorderProps {
  onSend: (uri: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onTick?: (elapsedMs: number) => void;
  onLockChange?: (isLocked: boolean) => void;
}

export default function VoiceRecorder({
  onSend,
  onRecordingStateChange,
  onTick,
  onLockChange,
}: VoiceRecorderProps) {
  // ── expo-audio 0.4.x: hook, not class constructor ─────────────────────────
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const isRecordingRef = useRef(false);
  const isStoppingRef  = useRef(false);
  const startTimeRef   = useRef(0);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // Shared values — only read inside useAnimatedStyle or gesture worklets
  const dragX      = useSharedValue(0);  // negative = sliding left
  const dragY      = useSharedValue(0);  // negative = sliding up
  const isLockedSV = useSharedValue(false);
  const waveScale  = useSharedValue(1);
  const waveOpacity = useSharedValue(0); // starts invisible — no idle red ring
  const glowPulse  = useSharedValue(1);

  // React state — drives conditional rendering safely
  const [status, setStatus] = useState<"idle" | "recording" | "locked">("idle");

  // ── Helpers ────────────────────────────────────────────────────────────────
  const haptic = (style = Haptics.ImpactFeedbackStyle.Medium) => {
    if (Platform.OS !== "web") Haptics.impactAsync(style);
  };

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const resetPosition = (animated = true) => {
    if (animated) {
      dragX.value = withSpring(0, SNAP_SPRING);
      dragY.value = withSpring(0, SNAP_SPRING);
    } else {
      dragX.value = 0;
      dragY.value = 0;
    }
  };

  // ── Start recording ────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();

      isRecordingRef.current = true;
      setStatus("recording");
      onRecordingStateChange?.(true);
      startTimeRef.current = Date.now();
      haptic(Haptics.ImpactFeedbackStyle.Light);

      // Animate wave ring in
      waveOpacity.value = withTiming(1, { duration: 150 });
      waveScale.value   = withRepeat(withSpring(1.35, { damping: 8, stiffness: 120 }), -1, true);

      timerRef.current = setInterval(() => {
        onTick?.(Date.now() - startTimeRef.current);
      }, 200);
    } catch (e) {
      console.warn("[VoiceRecorder] Start error:", e);
      isRecordingRef.current = false;
      setStatus("idle");
    }
  }, [audioRecorder]);

  // ── Stop recording ─────────────────────────────────────────────────────────
  const stopRecording = useCallback(async (send: boolean) => {
    if (!isRecordingRef.current || isStoppingRef.current) return;
    isRecordingRef.current = false;
    isStoppingRef.current  = true;

    // Reset all animations immediately
    cancelAnimation(waveScale);
    cancelAnimation(glowPulse);
    waveScale.value   = withTiming(1,   { duration: 100 });
    waveOpacity.value = withTiming(0,   { duration: 150 });
    glowPulse.value   = withTiming(1,   { duration: 100 });
    isLockedSV.value  = false;
    resetPosition();
    clearTimer();

    onLockChange?.(false);

    try {
      await audioRecorder.stop();
      if (send) {
        const uri = audioRecorder.uri;
        if (uri) onSend(uri);
      } else {
        haptic(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (e) {
      console.warn("[VoiceRecorder] Stop error:", e);
    } finally {
      isStoppingRef.current = false;
    }

    setStatus("idle");
    onRecordingStateChange?.(false);
  }, [audioRecorder]);

  const setLocked = useCallback(() => {
    isLockedSV.value = true;
    setStatus("locked");
    onLockChange?.(true);
    haptic(Haptics.ImpactFeedbackStyle.Heavy);
    // Stop wave, start glow pulse
    cancelAnimation(waveScale);
    waveOpacity.value = withTiming(0, { duration: 100 });
    glowPulse.value   = withRepeat(withTiming(1.2, { duration: 700 }), -1, true);
  }, []);

  // ── Gesture — single pan that handles slide-cancel, slide-lock, release-send
  const panGesture = Gesture.Pan()
    .minDistance(0)
    .activateAfterLongPress(250) // slightly longer = less accidental triggers
    .onStart(() => {
      runOnJS(startRecording)();
    })
    .onUpdate((e) => {
      if (isLockedSV.value) return; // locked state: ignore drag

      const tx = e.translationX;
      const ty = e.translationY;
      const absX = Math.abs(tx);
      const absY = Math.abs(ty);

      if (absX > absY) {
        // Horizontal — slide to cancel (only left drag)
        dragX.value = Math.max(-CANCEL_THRESHOLD - 20, Math.min(0, tx));
        dragY.value = withSpring(0, SNAP_SPRING);
      } else {
        // Vertical — slide to lock (only upward drag)
        dragY.value = Math.max(-LOCK_THRESHOLD - 20, Math.min(0, ty));
        dragX.value = withSpring(0, SNAP_SPRING);

        // Trigger lock when crossed threshold
        if (ty < -LOCK_THRESHOLD && !isLockedSV.value) {
          runOnJS(setLocked)();
          dragY.value = withSpring(0, SNAP_SPRING);
        }
      }

      // Haptic feedback when near cancel edge
      if (dragX.value < -CANCEL_THRESHOLD + 15) {
        runOnJS(haptic)(Haptics.ImpactFeedbackStyle.Medium);
      }
    })
    .onEnd((e) => {
      if (isLockedSV.value) return; // locked: don't end on release

      const cancelled = dragX.value < -CANCEL_THRESHOLD + 20 ||
                        e.translationX < -CANCEL_THRESHOLD;
      runOnJS(stopRecording)(!cancelled);
    });

  // ── Animated styles — ALL shared value reads confined here ─────────────────

  // Cancel zone red highlight — fades in as user drags toward the cancel threshold
  const cancelZoneStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.abs(dragX.value) / (CANCEL_THRESHOLD * 0.9));
    return {
      opacity: interpolate(dragX.value, [-30, 0], [progress, 0], Extrapolate.CLAMP),
      // Scale the background to fill behind the cancel arrow
      transform: [{ scaleX: interpolate(dragX.value, [-CANCEL_THRESHOLD, -30, 0], [1, 0.7, 0], Extrapolate.CLAMP) }],
    };
  });

  // Cancel label that appears when near threshold
  const cancelLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [-CANCEL_THRESHOLD + 20, -CANCEL_THRESHOLD * 0.5], [1, 0], Extrapolate.CLAMP),
  }));

  // Mic button moves with drag
  const micContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      {
        scale: isLockedSV.value
          ? glowPulse.value
          : withSpring(1, SNAP_SPRING), // smooth scale-back on release
      },
    ],
  }));

  // Wave ring — only visible while recording (not locked)
  const waveStyle1 = useAnimatedStyle(() => ({
    opacity: isLockedSV.value ? 0 : waveOpacity.value * 0.7,
    transform: [{ scale: waveScale.value }],
  }));

  const waveStyle2 = useAnimatedStyle(() => ({
    opacity: isLockedSV.value ? 0 : waveOpacity.value * 0.4,
    transform: [{ scale: waveScale.value * 1.18 }],
  }));

  // Glow ring (locked state)
  const glowStyle = useAnimatedStyle(() => ({
    opacity: isLockedSV.value
      ? interpolate(glowPulse.value, [1, 1.2], [0.25, 0.55])
      : 0,
    transform: [{ scale: isLockedSV.value ? glowPulse.value : 1 }],
  }));

  // Slide-to-cancel arrow indicator
  const cancelArrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dragX.value, [-30, 0], [1, 0], Extrapolate.CLAMP),
    transform: [
      {
        translateX: interpolate(
          dragX.value,
          [-CANCEL_THRESHOLD, 0],
          [-10, 20],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  // Lock pillar — appears when dragging up
  const lockPillarStyle = useAnimatedStyle(() => ({
    opacity: isLockedSV.value
      ? 1
      : interpolate(dragY.value, [-LOCK_THRESHOLD, -20, 0], [1, 1, 0], Extrapolate.CLAMP),
    transform: [
      {
        translateY: withSpring(
          isLockedSV.value ? 0 : dragY.value < -20 ? 0 : 30,
          SNAP_SPRING
        ),
      },
    ],
  }));

  const lockChevronStyle = useAnimatedStyle(() => ({
    opacity: isLockedSV.value ? 0 : 1,
    transform: [
      {
        translateY: interpolate(
          dragY.value,
          [-LOCK_THRESHOLD, 0],
          [0, 8],
          Extrapolate.CLAMP
        ),
      },
    ],
  }));

  // Mic gradient colors: React state drives this safely in render
  const micColors: [string, string] =
    status === "locked"
      ? ["#10b981", "#059669"]
      : status === "recording"
      ? ["#EF4444", "#DC2626"]
      : ["#0284C7", "#0EA5E9"];

  return (
    <View style={styles.outerContainer} pointerEvents="box-none">
      {/* ── Cancel zone red flash background ──────────────────────────────── */}
      {/* Shows a red pill behind the cancel arrows to make the cancel action obvious */}
      <Animated.View style={[styles.cancelZone, cancelZoneStyle]} pointerEvents="none" />

      {/* Slide-to-cancel hint arrow */}
      <Animated.View style={[styles.cancelArrow, cancelArrowStyle]} pointerEvents="none">
        <Ionicons name="chevron-back" size={16} color="#EF4444" />
        <Ionicons name="chevron-back" size={16} color="#F87171" style={{ marginLeft: -8 }} />
        {/* "Release to cancel" label — only shows near threshold */}
        <Animated.Text style={[styles.cancelLabel, cancelLabelStyle]}>Release to cancel</Animated.Text>
      </Animated.View>

      {/* Lock pillar — appears when sliding up */}
      <Animated.View style={[styles.lockPillar, lockPillarStyle]} pointerEvents="none">
        <LinearGradient colors={["#f8fafc", "#e2e8f0"]} style={styles.lockPillarInner}>
          <Ionicons name="lock-closed" size={16} color="#0EA5E9" />
          <Animated.View style={lockChevronStyle}>
            <Ionicons name="chevron-up" size={14} color="#0EA5E9" />
          </Animated.View>
        </LinearGradient>
      </Animated.View>

      {/* Wave rings — only visible during recording */}
      <Animated.View style={[styles.waveRing, styles.waveRingOuter, waveStyle2]} pointerEvents="none" />
      <Animated.View style={[styles.waveRing, styles.waveRingInner, waveStyle1]} pointerEvents="none" />

      {/* Glow ring (locked) */}
      <Animated.View style={[styles.glowRing, glowStyle]} pointerEvents="none" />

      {/* Mic button — draggable during recording, tap when locked */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.micWrapper, micContainerStyle]}>
          {status === "locked" ? (
            // When locked, use a plain TouchableOpacity to send — no gesture conflict
            <TouchableOpacity
              onPress={() => stopRecording(true)}
              activeOpacity={0.8}
              style={styles.micTouchable}
            >
              <LinearGradient colors={micColors} style={styles.micButton}>
                <Ionicons name="send" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <LinearGradient colors={micColors} style={styles.micButton}>
              <Ionicons name="mic" size={22} color="#fff" />
            </LinearGradient>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const BTN = 44; // button size — slightly larger than before for easier grip
const WAVE1 = BTN + 16;
const WAVE2 = BTN + 30;
const GLOW  = BTN + 20;

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: BTN,
    height: BTN,
  },
  micWrapper: {
    zIndex: 10,
    position: "relative",
  },
  micTouchable: {
    borderRadius: BTN / 2,
    overflow: "hidden",
  },
  micButton: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  waveRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
    zIndex: 1,
  },
  waveRingInner: {
    width: WAVE1,
    height: WAVE1,
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  waveRingOuter: {
    width: WAVE2,
    height: WAVE2,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  glowRing: {
    position: "absolute",
    width: GLOW,
    height: GLOW,
    borderRadius: GLOW / 2,
    backgroundColor: "#10B981",
    zIndex: 0,
  },
  lockPillar: {
    position: "absolute",
    bottom: BTN + 16,
    width: 34,
    height: 66,
    zIndex: 5,
  },
  lockPillarInner: {
    flex: 1,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelArrow: {
    position: "absolute",
    right: BTN + 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    zIndex: 4,
  },
  cancelLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
    marginLeft: 4,
  },
  cancelZone: {
    position: "absolute",
    right: BTN + 4,
    height: BTN - 4,
    width: 180,
    borderRadius: (BTN - 4) / 2,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
    zIndex: 3,
    transformOrigin: "right center",
  },
});