import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  available: number;
  inUse: number;
  clothesInside: number;
  queueCount: number;
}

interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  color: string;
  bgColor: string;
  gradientColors: readonly [string, string];
  delay: number;
  index: number;
}

function StatItem({ icon, value, label, color, bgColor, gradientColors, delay, index }: StatItemProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { 
          toValue: 1, 
          duration: 500, 
          useNativeDriver: true 
        }),
        Animated.spring(scaleAnim, { 
          toValue: 1, 
          tension: 100,
          friction: 8,
          useNativeDriver: true 
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        })
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.View 
      style={[
        styles.card, 
        { 
          opacity: fadeAnim,
          transform: [
            { scale: scaleAnim },
            { translateY }
          ]
        }
      ]}
    >
      {/* Glass Background */}
      <View style={[styles.glassBg, { backgroundColor: bgColor }]} />

      {/* Icon Container - Smaller */}
      <View style={[styles.iconBox, { backgroundColor: gradientColors[0] + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      {/* Value */}
      <Text style={[styles.value, { color }]}>{value}</Text>

      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Decorative Corner */}
      <View style={[styles.cornerAccent, { backgroundColor: gradientColors[0] + '15' }]} />
    </Animated.View>
  );
}

export default function DashboardStats({ available, inUse, clothesInside, queueCount }: Props) {
  const stats: Omit<StatItemProps, "delay" | "index">[] = [
    { 
      icon: "checkmark-circle", 
      value: available, 
      label: "Available", 
      color: "#06B6D4", 
      bgColor: "rgba(236, 254, 255, 0.8)",
      gradientColors: ["#06B6D4", "#22D3EE"] as const,
    },
    { 
      icon: "time", 
      value: inUse, 
      label: "In Use", 
      color: "#6366F1", 
      bgColor: "rgba(238, 242, 255, 0.8)",
      gradientColors: ["#6366F1", "#818CF8"] as const,
    },
    { 
      icon: "shirt", 
      value: clothesInside, 
      label: "Loads", 
      color: "#8B5CF6", 
      bgColor: "rgba(245, 243, 255, 0.8)",
      gradientColors: ["#8B5CF6", "#A78BFA"] as const,
    },
    { 
      icon: "people", 
      value: queueCount, 
      label: "Queue", 
      color: "#0067c1", 
      bgColor: "rgba(235, 242, 255, 0.8)",
      gradientColors: ["#10cdee", "#0d9dbd"] as const,
    },
  ];

  return (
    <View style={styles.grid}>
      {stats.map((stat, index) => (
        <StatItem 
          key={stat.label} 
          {...stat} 
          delay={index * 120} 
          index={index}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  card: {
    width: "47%",
    // 🔽 REDUCED HEIGHT
    minHeight: 120, // Added fixed minimum height
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: 20, // Slightly smaller radius
    padding: 14, // Reduced from 18
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  glassBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  iconBox: {
    width: 35, // Reduced from 48
    height: 35, // Reduced from 48
    borderRadius: 12, // Reduced from 16
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8, // Reduced from 12
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  value: {
    fontSize: 24, // Reduced from 28
    fontWeight: "800",
    marginBottom: 2, // Reduced from 4
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 11, // Reduced from 12
    fontWeight: "700",
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cornerAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40, // Reduced from 60
    height: 40, // Reduced from 60
    borderBottomLeftRadius: 50,
  },
});