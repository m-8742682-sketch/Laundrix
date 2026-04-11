import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, ViewStyle } from "react-native";

interface PulseCardProps {
  active?: boolean;
  activeColor?: string;
  borderRadius?: number;
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * PulseCard — wraps any card with a native-driver glow pulse when active.
 * Animates opacity of an absolute border overlay (not borderColor),
 * so useNativeDriver:true works throughout.
 */
export function PulseCard({
  active = false,
  activeColor = "#0EA5E9",
  borderRadius = 28,
  children,
  style,
}: PulseCardProps) {
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      glowAnim.setValue(0);
      scaleAnim.setValue(1);
      return;
    }

    const opLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1,    duration: 900,  easing: Easing.out(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.22, duration: 1100, easing: Easing.in(Easing.sin),  useNativeDriver: true }),
      ])
    );
    const scLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.025, duration: 950,  easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1.0,   duration: 1050, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    opLoop.start();
    scLoop.start();
    return () => { opLoop.stop(); scLoop.stop(); };
  }, [active]);

  return (
    <View style={[{ position: "relative", borderRadius }, style]}>
      {/* Outer glow ring */}
      {active && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -5, left: -5, right: -5, bottom: -5,
            borderRadius: borderRadius + 5,
            borderWidth: 2,
            borderColor: activeColor,
            opacity: glowAnim,
            transform: [{ scale: scaleAnim }],
            shadowColor: activeColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 14,
          }}
        />
      )}
      {/* Inner static border when active */}
      {active && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0, bottom: 0,
            borderRadius,
            borderWidth: 1.5,
            borderColor: activeColor + "55",
          }}
        />
      )}
      {children}
    </View>
  );
}
