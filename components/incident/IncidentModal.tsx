/**
 * IncidentModal Component
 * 
 * Shows when someone tries to use a machine that's reserved for the current user.
 * 60-second countdown with "That's Me" / "Not Me" actions.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface IncidentModalProps {
  visible: boolean;
  machineId: string;
  intruderName: string;
  secondsLeft: number;
  onThatsMe: () => void;
  onNotMe: () => void;
  loading?: boolean;
}

export default function IncidentModal({
  visible,
  machineId,
  intruderName,
  secondsLeft,
  onThatsMe,
  onNotMe,
  loading = false,
}: IncidentModalProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Entrance animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Urgent pulse when < 10 seconds
      if (secondsLeft <= 10) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
          ])
        ).start();
        Vibration.vibrate([0, 500, 200, 500]);
      }
    } else {
      // Exit animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, secondsLeft]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isUrgent = secondsLeft <= 10;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            {
              transform: [
                { translateY: slideAnim },
                { scale: isUrgent ? pulseAnim : 1 },
              ],
            },
          ]}
        >
          {/* Alert Header */}
          <LinearGradient
            colors={isUrgent ? ["#DC2626", "#B91C1C"] : ["#F59E0B", "#D97706"]}
            style={styles.header}
          >
            <View style={styles.alertIconContainer}>
              <Ionicons name="warning" size={32} color="#fff" />
            </View>
            <Text style={styles.alertTitle}>🚨 Unauthorized Access!</Text>
            <Text style={styles.alertSubtitle}>
              Someone is at Machine {machineId}
            </Text>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.intruderCard}>
              <Ionicons name="person-circle" size={48} color="#6366F1" />
              <View style={styles.intruderInfo}>
                <Text style={styles.intruderLabel}>Person at machine:</Text>
                <Text style={styles.intruderName}>{intruderName}</Text>
              </View>
            </View>

            {/* Countdown */}
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownLabel}>Time to respond:</Text>
              <Text
                style={[
                  styles.countdownValue,
                  isUrgent && styles.countdownUrgent,
                ]}
              >
                {formatTime(secondsLeft)}
              </Text>
              {isUrgent && (
                <Text style={styles.urgentText}>
                  ⚠️ Auto-alert will trigger soon!
                </Text>
              )}
            </View>

            {/* Question */}
            <Text style={styles.question}>Is this you?</Text>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                onPress={onThatsMe}
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  styles.thatsMeButton,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
              >
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Yes, That's Me</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={onNotMe}
                disabled={loading}
                style={({ pressed }) => [
                  styles.button,
                  styles.notMeButton,
                  pressed && styles.buttonPressed,
                  loading && styles.buttonDisabled,
                ]}
              >
                <LinearGradient
                  colors={["#EF4444", "#DC2626"]}
                  style={styles.buttonGradient}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.buttonText}>No, Not Me!</Text>
                </LinearGradient>
              </Pressable>
            </View>

            {loading && (
              <Text style={styles.loadingText}>Processing...</Text>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 28,
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 20,
  },
  header: {
    padding: 24,
    alignItems: "center",
  },
  alertIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  alertSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginTop: 4,
  },
  content: {
    padding: 24,
  },
  intruderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  intruderInfo: {
    marginLeft: 12,
    flex: 1,
  },
  intruderLabel: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  intruderName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  countdownContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  countdownLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
  },
  countdownValue: {
    fontSize: 48,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -1,
    marginVertical: 8,
  },
  countdownUrgent: {
    color: "#DC2626",
  },
  urgentText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  question: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 16,
  },
  actions: {
    gap: 12,
  },
  button: {
    borderRadius: 16,
    overflow: "hidden",
  },
  thatsMeButton: {
    // "That's Me" button — green gradient applied via LinearGradient
  },
  notMeButton: {
    // "Not Me" button — red gradient applied via LinearGradient
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  loadingText: {
    textAlign: "center",
    marginTop: 12,
    color: "#64748B",
    fontWeight: "600",
  },
});