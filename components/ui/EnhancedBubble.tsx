import React, { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";

interface EnhancedBubbleProps {
  delay?: number;
  size: number;
  color: string;
  position: { top?: number; left?: number; right?: number; bottom?: number };
  driftX?: number;
  floatY?: number;
}

const EnhancedBubble = React.memo(({
  delay = 0,
  size,
  color,
  position,
  driftX = 12,
  floatY = 28,
}: EnhancedBubbleProps) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacAnim  = useRef(new Animated.Value(0.28)).current;
  const driftAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimations = () => {
      const floatDur = 4200 + Math.random() * 2000;
      const scaleDur = 3600 + Math.random() * 1800;
      const opacDur  = scaleDur * 1.25;
      const driftDur = floatDur * 1.4;

      Animated.parallel([
        Animated.loop(
          Animated.sequence([
            Animated.timing(floatAnim, { toValue: 1, duration: floatDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(floatAnim, { toValue: 0, duration: floatDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.18, duration: scaleDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.90, duration: scaleDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(opacAnim, { toValue: 0.58, duration: opacDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(opacAnim, { toValue: 0.22, duration: opacDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(driftAnim, { toValue: 1, duration: driftDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(driftAnim, { toValue: 0, duration: driftDur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
      ]).start();
    };

    if (delay > 0) {
      const timer = setTimeout(startAnimations, delay);
      return () => clearTimeout(timer);
    } else {
      startAnimations();
    }
  }, []);

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -floatY] });
  const translateX = driftAnim.interpolate({ inputRange: [0, 1], outputRange: [0, driftX] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        ...position,
        opacity: opacAnim,
        transform: [{ translateY }, { translateX }, { scale: scaleAnim }],
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.18)",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: size / 2,
          backgroundColor: color,
        }}
      />
      {/* Inner convex glass sheen */}
      <View
        style={{
          position: "absolute",
          top: size * 0.05,
          left: size * 0.08,
          width: size * 0.38,
          height: size * 0.24,
          borderRadius: size * 0.12,
          backgroundColor: "rgba(255, 255, 255, 0.14)",
          transform: [{ rotate: "-20deg" }],
        }}
      />
    </Animated.View>
  );
});

EnhancedBubble.displayName = "EnhancedBubble";
export default EnhancedBubble;
