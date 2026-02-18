import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

interface Props {
  type: "active" | "turn" | "queue" | "none";
  progress?: number;
  timeRemaining?: string;
  machineId?: string;
  queuePosition?: number | null;
  estimatedWait?: string;
  onActionPress: () => void;
}

export default function DashboardStatusCard({
  type,
  progress = 0,
  timeRemaining = "",
  machineId = "M001",
  queuePosition = null,
  estimatedWait = "",
  onActionPress,
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();

    if (type === "active") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.02, duration: 2000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [type]);

  // Active Session - Cyan Gradient
  if (type === "active") {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={["#0EA5E9", "#0284C7", "#0369A1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Glass Effect Overlay */}
            <View style={styles.glassOverlay} />
            
            {/* Top Section */}
            <View style={styles.topSection}>
              <View style={styles.iconContainer}>
                <Ionicons name="water" size={24} color="#0EA5E9" />
              </View>
              
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>

            {/* Content */}
            <Text style={styles.title}>Washing in Progress</Text>
            <Text style={styles.subtitle}>Machine {machineId}</Text>

            {/* Progress Section */}
            <View style={styles.progressSection}>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>
              <View style={styles.timeRow}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={styles.timeText}>{timeRemaining} remaining</Text>
              </View>
            </View>

            {/* Action Button */}
            <Pressable onPress={onActionPress} style={styles.actionButton}>
              <View style={styles.actionBtnInner}>
                <Text style={styles.actionText}>View Control</Text>
                <Ionicons name="arrow-forward" size={16} color="#0EA5E9" />
              </View>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    );
  }

  // User's Turn - Green Gradient
  if (type === "turn") {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={["#10B981", "#059669", "#047857"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.glassOverlay} />
          
          <View style={styles.celebrationIcon}>
            <Text style={styles.celebrationEmoji}>🎉</Text>
          </View>
          
          <Text style={styles.title}>It's Your Turn!</Text>
          <Text style={styles.subtitle}>
            Machine {machineId} is ready for you
          </Text>

          <Pressable onPress={onActionPress} style={styles.actionButton}>
            <View style={styles.actionBtnInner}>
              <Ionicons name="scan" size={18} color="#059669" />
              <Text style={[styles.actionText, { color: "#059669" }]}>Scan to Start</Text>
            </View>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    );
  }

  // In Queue - Amber Gradient
  if (type === "queue" && queuePosition) {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={["#F59E0B", "#D97706", "#B45309"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.glassOverlay} />
          
          <View style={styles.queueHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="time" size={22} color="#D97706" />
            </View>
            <Text style={styles.title}>Queue Position</Text>
          </View>

          <View style={styles.positionDisplay}>
            <Text style={styles.positionNumber}>#{queuePosition}</Text>
            <Text style={styles.positionLabel}>in line</Text>
          </View>

          {estimatedWait && (
            <View style={styles.waitTimeBadge}>
              <Ionicons name="hourglass-outline" size={14} color="#FEF3C7" />
              <Text style={styles.waitTimeText}>Est. wait: {estimatedWait}</Text>
            </View>
          )}

          <Pressable onPress={onActionPress} style={styles.actionButton}>
            <View style={styles.actionBtnInner}>
              <Text style={[styles.actionText, { color: "#D97706" }]}>View Queue</Text>
              <Ionicons name="arrow-forward" size={16} color="#D97706" />
            </View>
          </Pressable>
        </LinearGradient>
      </Animated.View>
    );
  }

  // Default: No active session - Glassmorphism
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={["rgba(255,255,255,0.9)", "rgba(241,245,249,0.9)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, styles.emptyGradient]}
      >
        <View style={styles.emptyIconContainer}>
          <LinearGradient colors={["#94A3B8", "#64748B"]} style={styles.emptyIcon}>
            <Ionicons name="water-outline" size={28} color="#fff" />
          </LinearGradient>
        </View>
        
        <Text style={[styles.title, { color: "#475569" }]}>No Active Session</Text>
        <Text style={[styles.subtitle, { color: "#94A3B8" }]}>
          Join a queue or scan to start
        </Text>

        <Pressable onPress={onActionPress} style={styles.actionButton}>
          <LinearGradient
            colors={["#0EA5E9", "#0284C7"]}
            style={styles.actionGradient}
          >
            <Ionicons name="scan" size={18} color="#fff" />
            <Text style={styles.actionText}>Start Laundry</Text>
          </LinearGradient>
        </Pressable>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  cardWrapper: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  gradient: {
    padding: 24,
    borderRadius: 24,
    position: "relative",
    overflow: "hidden",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 24,
  },
  topSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
    marginBottom: 20,
  },
  progressSection: {
    marginBottom: 20,
  },
  progressBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    minWidth: 40,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
  },
  actionButton: {
    alignSelf: "center",
  },
  actionBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "rgba(255,255,255,0.95)",
    letterSpacing: 0.3,
  },
  // Turn styles
  celebrationIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  celebrationEmoji: {
    fontSize: 32,
  },
  // Queue styles
  queueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  positionDisplay: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 12,
  },
  positionNumber: {
    fontSize: 48,
    fontWeight: "900",
    color: "#fff",
  },
  positionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  waitTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  waitTimeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  // Empty styles
  emptyGradient: {
    alignItems: "center",
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});