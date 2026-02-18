import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  available: number;
  inUse: number;
  clothesInside: number;
  queueCount: number;
  totalMachines: number;
  onViewAllPress: () => void;
}

interface StatItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  borderColor: string;
  iconColor: string;
  bgColor: string;
  delay: number;
}

function StatItem({ icon, value, label, borderColor, iconColor, bgColor, delay }: StatItemProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
      ]).start();
    }, delay);
  }, []);

  return (
    <Animated.View 
      style={[
        styles.statCard,
        { 
          opacity: fadeAnim, 
          transform: [{ translateY: slideAnim }],
          borderLeftColor: borderColor,
        }
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function DashboardStats({
  available,
  inUse,
  clothesInside,
  queueCount,
  totalMachines,
  onViewAllPress,
}: Props) {
  const headerFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(headerFadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: headerFadeAnim }]}>
        <Text style={styles.title}>Laundry Status</Text>
        <Pressable onPress={onViewAllPress} style={styles.viewAllButton}>
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color="#06B6D4" />
        </Pressable>
      </Animated.View>

      {/* 2x2 Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.row}>
          <StatItem
            icon="checkmark-circle"
            value={available}
            label="Available"
            borderColor="#06B6D4"
            iconColor="#06B6D4"
            bgColor="#ECFEFF"
            delay={0}
          />
          <StatItem
            icon="time"
            value={inUse}
            label="In Use"
            borderColor="#3B82F6"
            iconColor="#3B82F6"
            bgColor="#EFF6FF"
            delay={100}
          />
        </View>
        <View style={styles.row}>
          <StatItem
            icon="shirt"
            value={clothesInside}
            label="Clothes"
            borderColor="#8B5CF6"
            iconColor="#8B5CF6"
            bgColor="#F5F3FF"
            delay={200}
          />
          <StatItem
            icon="people"
            value={queueCount}
            label="In Queue"
            borderColor="#6366F1"
            iconColor="#6366F1"
            bgColor="#EEF2FF"
            delay={300}
          />
        </View>
      </View>

      <View style={styles.totalContainer}>
        <View style={styles.totalBadge}>
          <Ionicons name="hardware-chip" size={14} color="#94A3B8" />
          <Text style={styles.totalText}>{totalMachines} machines total</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#06B6D4",
  },
  statsGrid: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  totalContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  totalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  totalText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
});