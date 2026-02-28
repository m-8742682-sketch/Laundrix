/**
 * AdminIncidentModal
 *
 * Shown ONLY to admins, AFTER the 60s incident countdown has expired (timeout).
 * This is NOT the same as IncidentModal (which is for the machine owner).
 *
 * Gives admin ability to:
 * - Stop the buzzer
 * - Navigate to Records tab to review the incident
 */

import React, { useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, Modal, Animated, Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export interface AdminIncidentInfo {
  incidentId: string;
  machineId: string;
  intruderName: string;
  resolvedAt?: Date;
}

interface AdminIncidentModalProps {
  visible: boolean;
  incident: AdminIncidentInfo | null;
  onStopBuzzer: () => void;
  onDismiss: () => void;
  loading?: boolean;
}

export default function AdminIncidentModal({
  visible,
  incident,
  onStopBuzzer,
  onDismiss,
  loading = false,
}: AdminIncidentModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 8, useNativeDriver: true }),
      ]).start();
      Vibration.vibrate([0, 400, 200, 400, 200, 400]);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  const handleViewRecords = () => {
    onDismiss();
    // Navigate to admin console with records tab active
    router.push("/(tabs)/admin");
  };

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
          {/* Header */}
          <LinearGradient colors={["#7C3AED", "#4F46E5"]} style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="shield-outline" size={32} color="#fff" />
            </View>
            <Text style={styles.adminBadge}>ADMIN ALERT</Text>
            <Text style={styles.title}>Unauthorized Access Resolved</Text>
            <Text style={styles.subtitle}>
              Incident on Machine {incident?.machineId ?? "–"} has timed out
            </Text>
          </LinearGradient>

          {/* Content */}
          <View style={styles.content}>
            {/* Who was it */}
            <View style={styles.infoCard}>
              <Ionicons name="person-circle-outline" size={36} color="#6366F1" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Intruder detected</Text>
                <Text style={styles.infoName}>{incident?.intruderName ?? "Unknown"}</Text>
              </View>
              <View style={styles.badgeTimeout}>
                <Text style={styles.badgeTimeoutText}>TIMEOUT</Text>
              </View>
            </View>

            <Text style={styles.description}>
              The 60-second response window has ended. The buzzer may still be active on the machine.
              Review the usage records for full details.
            </Text>

            {/* Action buttons */}
            <View style={styles.actions}>
              {/* Stop Buzzer */}
              <Pressable
                onPress={onStopBuzzer}
                disabled={loading}
                style={({ pressed }) => [styles.btn, pressed && styles.btnPressed, loading && styles.btnDisabled]}
              >
                <LinearGradient colors={["#EF4444", "#DC2626"]} style={styles.btnGradient}>
                  <Ionicons name="volume-mute" size={18} color="#fff" />
                  <Text style={styles.btnText}>Stop Buzzer</Text>
                </LinearGradient>
              </Pressable>

              {/* View Records */}
              <Pressable
                onPress={handleViewRecords}
                style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              >
                <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.btnGradient}>
                  <Ionicons name="document-text" size={18} color="#fff" />
                  <Text style={styles.btnText}>View Records</Text>
                </LinearGradient>
              </Pressable>

              {/* Dismiss */}
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [styles.btnOutline, pressed && styles.btnPressed]}
              >
                <Text style={styles.btnOutlineText}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
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
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  adminBadge: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
    textAlign: "center",
  },
  content: {
    padding: 24,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  infoText: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 2,
  },
  badgeTimeout: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  badgeTimeoutText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#DC2626",
    letterSpacing: 1,
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 20,
  },
  actions: {
    gap: 10,
  },
  btn: {
    borderRadius: 14,
    overflow: "hidden",
  },
  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    gap: 8,
  },
  btnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  btnOutline: {
    padding: 14,
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
  },
});
