/**
 * Incident Alert Component
 * 
 * Global modal that appears when someone tries to use the user's reserved machine.
 * Shows countdown and action buttons (That's Me / Not Me).
 * 
 * Place this component in your root layout to handle incidents anywhere in the app.
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useUser } from "@/components/UserContext";
import { useIncidentHandler } from "@/services/useIncidentHandler";

export default function IncidentAlert() {
  const { user } = useUser();
  const { incident, loading, handleNotMe, handleThatsMe } = useIncidentHandler({
    userId: user?.uid,
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation
  useEffect(() => {
    if (!incident) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => pulse.stop();
  }, [incident]);

  // Shake when time is low
  useEffect(() => {
    if (incident && incident.secondsLeft <= 10 && incident.secondsLeft > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 15,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -15,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 15,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [incident?.secondsLeft]);

  if (!incident) return null;

  const urgencyColor =
    incident.secondsLeft <= 15
      ? "#ef4444"
      : incident.secondsLeft <= 30
      ? "#f97316"
      : "#eab308";

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateX: shakeAnim }] },
          ]}
        >
          {/* Alert Icon */}
          <Animated.View
            style={[
              styles.iconCircle,
              { backgroundColor: urgencyColor, transform: [{ scale: pulseAnim }] },
            ]}
          >
            <Text style={styles.icon}>🚨</Text>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>Someone at Your Machine!</Text>

          {/* Countdown */}
          <Text style={[styles.countdown, { color: urgencyColor }]}>
            {incident.secondsLeft}
          </Text>
          <Text style={styles.countdownLabel}>seconds to respond</Text>

          {/* Message */}
          <Text style={styles.message}>
            <Text style={styles.userName}>{incident.intruderName}</Text>
            {"\n"}is trying to use{" "}
            <Text style={styles.machineName}>{incident.machineId}</Text>
          </Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            {/* That's Me button */}
            <Pressable
              style={({ pressed }) => [
                styles.thatsmeButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleThatsMe}
              disabled={loading}
            >
              <LinearGradient
                colors={["#22c55e", "#16a34a"]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {loading ? "..." : "That's Me ✓"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Not Me button */}
            <Pressable
              style={({ pressed }) => [
                styles.notmeButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={handleNotMe}
              disabled={loading}
            >
              <LinearGradient
                colors={["#ef4444", "#dc2626"]}
                style={styles.buttonGradient}
              >
                <Text style={styles.buttonText}>
                  {loading ? "..." : "Not Me ✗"}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Help text */}
          <Text style={styles.helpText}>
            Tap "Not Me" to trigger the machine buzzer
          </Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 20,
    textAlign: "center",
  },
  countdown: {
    fontSize: 80,
    fontWeight: "900",
    lineHeight: 88,
  },
  countdownLabel: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: "#334155",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 24,
  },
  userName: {
    fontWeight: "800",
    color: "#0f172a",
    fontSize: 18,
  },
  machineName: {
    fontWeight: "700",
    color: "#0284c7",
  },
  buttons: {
    width: "100%",
    gap: 12,
  },
  thatsmeButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  notmeButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  helpText: {
    marginTop: 16,
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
  },
});
