import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getRingColor(secondsLeft: number, warningThreshold: number) {
  if (secondsLeft <= warningThreshold * 0.4) return "#EF4444";
  if (secondsLeft <= warningThreshold)       return "#F59E0B";
  return "#38BDF8";
}

interface GraceProgressRingProps {
  secondsLeft: number;
  totalSeconds: number;
  size?: number;
  warningThreshold?: number;
  showLabel?: boolean;
}

export function GraceProgressRing({
  secondsLeft,
  totalSeconds,
  size = 72,
  warningThreshold = 60,
  showLabel = true,
}: GraceProgressRingProps) {
  const strokeWidth  = size * 0.072;
  const radius       = (size - strokeWidth) / 2;
  const cx           = size / 2;
  const cy           = size / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction   = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  const ringColor  = getRingColor(secondsLeft, warningThreshold);
  const isCritical = secondsLeft <= warningThreshold * 0.4;

  // SVG strokeDashoffset — JS driver only (SVG props can't use native driver)
  const progressAnim = useRef(new Animated.Value(1 - fraction)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const glowAnim     = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 1 - fraction,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fraction]);

  useEffect(() => {
    if (isCritical) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.35, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      glowAnim.setValue(0.5);
    }
  }, [isCritical]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, circumference],
  });

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <Animated.View style={[styles.container, { width: size, height: size }, { transform: [{ scale: pulseAnim }] }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* Track */}
        <Circle
          cx={cx} cy={cy} r={radius}
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress arc */}
        <AnimatedCircle
          cx={cx} cy={cy} r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
      </Svg>

      {/* Critical glow halo */}
      {isCritical && (
        <Animated.View
          style={{
            position: "absolute",
            width: size * 0.64,
            height: size * 0.64,
            borderRadius: size * 0.32,
            backgroundColor: "rgba(239, 68, 68, 0.25)",
            opacity: glowAnim,
            alignSelf: "center",
            top: size * 0.18,
          }}
        />
      )}

      <View style={styles.content}>
        {showLabel ? (
          <Text style={[styles.countdownText, { fontSize: size * 0.22, color: ringColor }]}>
            {formatCountdown(secondsLeft)}
          </Text>
        ) : (
          <Ionicons name="timer-outline" size={size * 0.38} color="rgba(255,255,255,0.95)" />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center" },
  content:   { alignItems: "center", justifyContent: "center" },
  countdownText: { fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
});
