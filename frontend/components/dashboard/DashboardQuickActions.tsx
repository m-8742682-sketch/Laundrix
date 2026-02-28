import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

interface Props {
  onViewMachines: () => void;
  onJoinQueue: () => void;
  onScan: () => void;
  onChat: () => void;
}

const ACTIONS = [
  { 
    icon: "scan-outline" as const, 
    label: "Scan", 
    colors: ["#0EA5E9", "#0284C7"] as const,
    shadowColor: "#0EA5E9",
    description: "Quick start"
  },
  { 
    icon: "list-outline" as const, 
    label: "Queue", 
    colors: ["#6366F1", "#4F46E5"] as const,
    shadowColor: "#6366F1",
    description: "Join waitlist"
  },
  { 
    icon: "grid-outline" as const, 
    label: "Machines", 
    colors: ["#8B5CF6", "#7C3AED"] as const,
    shadowColor: "#8B5CF6",
    description: "View all"
  },
  { 
    icon: "chatbubbles-outline" as const, 
    label: "Chat", 
    colors: ["#10B981", "#059669"] as const,
    shadowColor: "#10B981",
    description: "Support"
  },
];

export default function DashboardQuickActions({
  onViewMachines,
  onJoinQueue,
  onScan,
  onChat,
}: Props) {
  const handlers = [onScan, onJoinQueue, onViewMachines, onChat];
  const animations = useRef(ACTIONS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      100,
      animations.map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  return (
    <View style={styles.grid}>
      {ACTIONS.map((action, index) => {
        const scale = animations[index].interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        });

        return (
          <Animated.View 
            key={action.label}
            style={{ transform: [{ scale }] }}
          >
            <Pressable
              onPress={handlers[index]}
              style={({ pressed }) => [
                styles.btn, 
                pressed && styles.pressed
              ]}
            >
              {/* Glow Effect */}
              <View style={[styles.glow, { shadowColor: action.shadowColor }]} />

              {/* Gradient Orb - Smaller */}
              <LinearGradient
                colors={action.colors}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={action.icon} size={22} color="#fff" />

                {/* Shine Effect */}
                <View style={styles.shine} />
              </LinearGradient>

              {/* Label */}
              <Text style={styles.label}>{action.label}</Text>
              <Text style={styles.description}>{action.description}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    justifyContent: "space-between",
    // 🔽 ADDED PADDING to prevent touching edges
    paddingHorizontal: 8,
    gap: 4,
  },
  btn: {
    alignItems: "center",
    gap: 6,
    padding: 6,
  },
  pressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
  glow: {
    position: 'absolute',
    // 🔽 REDUCED SIZE
    width: 60,
    height: 60,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    top: 0,
  },
  gradient: {
    // 🔽 REDUCED SIZE
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: 'hidden',
    position: 'relative',
  },
  shine: {
    position: 'absolute',
    top: -15,
    left: -15,
    width: 35,
    height: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 18,
    transform: [{ rotate: '45deg' }],
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  description: {
    fontSize: 10,
    fontWeight: "500",
    color: "#94A3B8",
    letterSpacing: 0.3,
  },
});