import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");

export type StatusCardType = "active" | "turn" | "queue" | "none";

interface DashboardStatusCardProps {
  type: StatusCardType;
  progress?: number;
  timeRemaining?: string;
  machineId?: string;
  machineLocation?: string;
  queuePosition?: number | null;
  estimatedWait?: string;
  graceSecondsLeft?: number | null;  // FIX #1: countdown for grace period
  onActionPress: () => void;
}

export default function DashboardStatusCard({
  type,
  progress = 0,
  timeRemaining = "",
  machineId = "",
  machineLocation = "",
  queuePosition = null,
  estimatedWait = "~5 min",
  graceSecondsLeft = null,
  onActionPress,
}: DashboardStatusCardProps) {
  const { t } = useI18n();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress bar animation
    if (type === "active") {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    }

    // Breathing pulse for active states
    if (type === "active" || type === "turn") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { 
            toValue: 1.02, 
            duration: 2000, 
            useNativeDriver: true 
          }),
          Animated.timing(pulseAnim, { 
            toValue: 1, 
            duration: 2000, 
            useNativeDriver: true 
          }),
        ])
      ).start();
    }
  }, [type, progress]);

  // Update progress animation when progress changes
  useEffect(() => {
    if (type === "active") {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [progress, type]);

  const getTheme = () => {
    type IconName = keyof typeof Ionicons.glyphMap;
    switch (type) {
      case "active":
        return {
          colors: ["#0EA5E9", "#0284C7", "#0369A1"] as const,
          secondaryColors: ["#38BDF8", "#0EA5E9"] as const,
          icon: "water" as IconName,
          title: t.laundryInProgress ?? "Laundry in Progress",
          subtitle: machineLocation 
            ? `Machine ${machineId} • ${machineLocation}`
            : `Machine ${machineId}`,
          actionText: t.viewDetails ?? "View Details",
          accentColor: "#0EA5E9",
          glowColor: "rgba(14, 165, 233, 0.5)",
        };
      case "turn":
        return {
          colors: ["#10B981", "#059669", "#047857"] as const,
          secondaryColors: ["#34D399", "#10B981"] as const,
          icon: "checkmark-circle" as IconName,
          title: t.graceYourTurn ?? "It's Your Turn!",
          subtitle: machineId 
            ? `Machine ${machineId} is ready`
            : "A machine is ready for you",
          actionText: t.scanToStart ?? "Scan to Start",
          accentColor: "#10B981",
          glowColor: "rgba(16, 185, 129, 0.5)",
        };
      case "queue":
        return {
          colors: ["#F59E0B", "#D97706", "#B45309"] as const,
          secondaryColors: ["#FBBF24", "#F59E0B"] as const,
          icon: "people" as IconName,
          title: queuePosition ? `#${queuePosition} ${t.inQueueTitle ?? "In Queue"}` : (t.inQueueTitle ?? "In Queue"),
          subtitle: machineId 
            ? `Waiting for Machine ${machineId}`
            : "Waiting in line",
          actionText: t.joinQueue ?? "View Queue",
          accentColor: "#F59E0B",
          glowColor: "rgba(245, 158, 11, 0.5)",
        };
      default:
        return {
          colors: ["#6366F1", "#4F46E5", "#3730A3"] as const,
          secondaryColors: ["#818CF8", "#6366F1"] as const,
          icon: "scan" as IconName,
          title: t.readyToStart ?? "Ready to Start",
          subtitle: t.freshAndCleanStartsHere ?? "Find a machine to begin",
          actionText: t.findMachine ?? "Find Machine",
          accentColor: "#6366F1",
          glowColor: "rgba(99, 102, 241, 0.5)",
        };
    }
  };

  const theme = getTheme();
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: type === "active" || type === "turn" ? pulseAnim : 1 }
          ] 
        }
      ]}
    >
      {/* Glow Effect */}
      <View style={[styles.glow, { shadowColor: theme.glowColor }]} />
      
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Liquid Glass Overlay */}
        <View style={styles.glassOverlay} />
        
        {/* Animated Background Shapes */}
        <View style={[styles.decorCircle1, { backgroundColor: 'rgba(255,255,255,0.15)' }]} />
        <View style={[styles.decorCircle2, { backgroundColor: 'rgba(255,255,255,0.08)' }]} />
        <View style={[styles.decorCircle3, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
        
        {/* Content */}
        <View style={styles.content}>
          {/* Header with Icon */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={theme.secondaryColors}
                style={styles.iconGradient}
              >
                <Ionicons name={theme.icon} size={32} color="#fff" />
              </LinearGradient>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>{theme.title}</Text>
              <Text style={styles.subtitle}>{theme.subtitle}</Text>
            </View>
          </View>

          {/* Progress Section for Active */}
          {type === "active" && (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <View style={styles.progressLabelContainer}>
                  <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.progressLabel}>{t.progressLabel ?? "Progress"}</Text>
                </View>
                <View style={styles.timeBadge}>
                  <Text style={styles.timeRemaining}>{timeRemaining || "In progress..."}</Text>
                </View>
              </View>
              
              {/* Animated Progress Bar */}
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
                  <View style={styles.progressShine} />
                </Animated.View>
              </View>
              
              <View style={styles.progressFooter}>
                <Text style={styles.progressPercent}>{Math.round(progress)}% Complete</Text>
                <View style={styles.pulseDot} />
              </View>
            </View>
          )}

          {/* Queue Info */}
          {type === "queue" && (
            <View style={styles.queueSection}>
              <View style={styles.queueCard}>
                <Ionicons name="time-outline" size={20} color="#fff" />
                <View style={styles.queueTextContainer}>
                  <Text style={styles.queueLabel}>Estimated Wait</Text>
                  <Text style={styles.queueTime}>{estimatedWait}</Text>
                </View>
              </View>
              
              {/* Queue Position Visual */}
              <View style={styles.queueVisual}>
                {[...Array(Math.min(5, queuePosition || 1))].map((_, i) => (
                  <View 
                    key={i} 
                    style={[
                      styles.queueDot,
                      i === 0 ? styles.queueDotActive : styles.queueDotInactive
                    ]} 
                  />
                ))}
                {(queuePosition || 1) > 5 && (
                  <Text style={styles.queueMore}>+{(queuePosition || 1) - 5}</Text>
                )}
              </View>
            </View>
          )}

          {/* Turn Notification */}
          {type === "turn" && (() => {
            const m = graceSecondsLeft != null ? Math.floor(graceSecondsLeft / 60) : null;
            const s = graceSecondsLeft != null ? graceSecondsLeft % 60 : null;
            const graceStr = m != null && s != null
              ? `${m}:${s.toString().padStart(2, "0")}`
              : null;
            const isUrgent = (graceSecondsLeft ?? 300) <= 60;
            return (
              <View style={styles.turnSection}>
                {graceStr != null ? (
                  <View style={[styles.turnBadge, isUrgent && { backgroundColor: "rgba(239,68,68,0.3)" }]}>
                    <Ionicons name="timer-outline" size={16} color="#fff" />
                    <Text style={styles.turnText}>{graceStr} remaining — hurry!</Text>
                  </View>
                ) : (
                  <View style={styles.turnBadge}>
                    <Ionicons name="alert" size={16} color="#fff" />
                    <Text style={styles.turnText}>Hurry! Your slot expires in 5 mins</Text>
                  </View>
                )}
                <View style={styles.turnInstructions}>
                  <Ionicons name="qr-code" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.turnInstructionsText}>
                    Scan the machine QR code to start
                  </Text>
                </View>
              </View>
            );
          })()}

          {/* Welcome Message */}
          {type === "none" && (
            <View style={styles.welcomeSection}>
              <View style={styles.featureRow}>
                <Ionicons name="scan" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.featureText}>Scan QR to start instantly</Text>
              </View>
              <View style={styles.featureRow}>
                <Ionicons name="people" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.featureText}>Or join a queue to reserve</Text>
              </View>
            </View>
          )}

          {/* Glass Action Button */}
          <Pressable 
            onPress={onActionPress} 
            style={({ pressed }) => [
              styles.actionBtn,
              pressed && styles.actionBtnPressed
            ]}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', '#fff']}
              style={styles.actionBtnGradient}
            >
              <Text style={[styles.actionBtnText, { color: theme.accentColor }]}>
                {theme.actionText}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.accentColor} />
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 32,
    overflow: "hidden",
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    bottom: 0,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  card: {
    padding: 28,
    minHeight: 240,
    position: 'relative',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  // Decorative Circles
  decorCircle1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    top: -80,
    right: -60,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: -30,
    left: -30,
  },
  decorCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: 40,
    right: 40,
  },
  content: {
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginBottom: 24,
  },
  iconContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  
  // Progress Section
  progressSection: {
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  timeBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  timeRemaining: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressShine: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.4)',
    transform: [{ skewX: '-20deg' }],
    marginLeft: '50%',
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPercent: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },

  // Queue Section
  queueSection: {
    marginBottom: 24,
  },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  queueTextContainer: {
    flex: 1,
  },
  queueLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 2,
  },
  queueTime: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '800',
  },
  queueVisual: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  queueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  queueDotActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  queueDotInactive: {
    backgroundColor: 'transparent',
  },
  queueMore: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 4,
  },

  // Turn Section
  turnSection: {
    marginBottom: 24,
    gap: 12,
  },
  turnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  turnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  turnInstructions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  turnInstructionsText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
  },

  // Welcome Section
  welcomeSection: {
    marginBottom: 24,
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  // Action Button
  actionBtn: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  actionBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  actionBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 8,
  },
  actionBtnText: {
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});