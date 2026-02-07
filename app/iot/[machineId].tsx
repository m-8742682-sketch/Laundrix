/**
 * Machine Control Screen
 * 
 * Shows real-time machine status and allows user to release when done.
 * Displays sensor data, status, and action buttons.
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { useUser } from "@/components/UserContext";
import { releaseMachine, dismissAlarm } from "@/services/api";

type MachineState = {
  load: number;
  vibration: number;
  state: string;
  locked: boolean;
  buzzerState: boolean;
  lastPing: number;
};

export default function MachineControlScreen() {
  const { machineId } = useLocalSearchParams<{ machineId: string }>();
  const { user } = useUser();

  const [machine, setMachine] = useState<MachineState | null>(null);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Subscribe to machine state from RTDB
  useEffect(() => {
    if (!machineId) return;

    const db = getDatabase();
    const machineRef = ref(db, `iot/${machineId}`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        setMachine(data);
      }
      setLoading(false);
    };

    onValue(machineRef, handleValue);

    return () => {
      off(machineRef, "value", handleValue);
    };
  }, [machineId]);

  /**
   * Release machine when done
   */
  const handleRelease = async () => {
    if (!machineId || !user?.uid) return;

    Alert.alert(
      "Release Machine",
      "Are you done with the laundry? The next person in queue will be notified.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Release",
          style: "destructive",
          onPress: async () => {
            setReleasing(true);
            try {
              const result = await releaseMachine(machineId, user.uid);
              if (result.success) {
                Alert.alert("Released!", result.message, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } else {
                Alert.alert("Error", result.message);
              }
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to release");
            } finally {
              setReleasing(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Dismiss buzzer alarm
   */
  const handleDismissAlarm = async () => {
    if (!machineId || !user?.uid) return;

    setDismissing(true);
    try {
      await dismissAlarm(machineId, user.uid);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to dismiss alarm");
    } finally {
      setDismissing(false);
    }
  };

  /**
   * Get status color based on state
   */
  const getStatusColor = (state: string) => {
    switch (state) {
      case "Available":
        return "#22c55e";
      case "In Use":
        return "#3b82f6";
      case "Clothes Inside":
        return "#f97316";
      case "Unauthorized Use":
        return "#ef4444";
      default:
        return "#64748b";
    }
  };

  /**
   * Get status icon based on state
   */
  const getStatusIcon = (state: string) => {
    switch (state) {
      case "Available":
        return "✅";
      case "In Use":
        return "🔄";
      case "Clothes Inside":
        return "👕";
      case "Unauthorized Use":
        return "🚨";
      default:
        return "❓";
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Connecting to machine...</Text>
      </View>
    );
  }

  if (!machine) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Machine not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const statusColor = getStatusColor(machine.state);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backArrow}>
            <Text style={styles.backArrowText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{machineId}</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Status Card */}
        <View style={[styles.statusCard, { borderColor: statusColor }]}>
          <Text style={styles.statusIcon}>{getStatusIcon(machine.state)}</Text>
          <Text style={[styles.statusText, { color: statusColor }]}>
            {machine.state}
          </Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>

        {/* Sensor Data */}
        <View style={styles.sensorRow}>
          <View style={styles.sensorCard}>
            <Text style={styles.sensorLabel}>Load</Text>
            <Text style={styles.sensorValue}>
              {machine.load?.toFixed(1) ?? "0"} kg
            </Text>
            <View style={styles.sensorBar}>
              <View
                style={[
                  styles.sensorBarFill,
                  {
                    width: `${Math.min(100, (machine.load / 10) * 100)}%`,
                    backgroundColor: "#3b82f6",
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.sensorCard}>
            <Text style={styles.sensorLabel}>Vibration</Text>
            <Text style={styles.sensorValue}>{machine.vibration ?? 0}%</Text>
            <View style={styles.sensorBar}>
              <View
                style={[
                  styles.sensorBarFill,
                  {
                    width: `${Math.min(100, machine.vibration)}%`,
                    backgroundColor:
                      machine.vibration > 30 ? "#22c55e" : "#94a3b8",
                  },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Lock Status */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Door Lock</Text>
          <View
            style={[
              styles.lockBadge,
              { backgroundColor: machine.locked ? "#ef4444" : "#22c55e" },
            ]}
          >
            <Text style={styles.lockText}>
              {machine.locked ? "🔒 Locked" : "🔓 Unlocked"}
            </Text>
          </View>
        </View>

        {/* Buzzer Status */}
        {machine.buzzerState && (
          <View style={styles.buzzerAlert}>
            <Text style={styles.buzzerText}>🔔 Buzzer Active</Text>
            <Pressable
              style={styles.dismissButton}
              onPress={handleDismissAlarm}
              disabled={dismissing}
            >
              <Text style={styles.dismissButtonText}>
                {dismissing ? "..." : "Dismiss"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Last Update */}
        <Text style={styles.lastUpdate}>
          Last update:{" "}
          {machine.lastPing
            ? new Date(machine.lastPing).toLocaleTimeString()
            : "Unknown"}
        </Text>

        {/* Release Button */}
        <Pressable
          style={({ pressed }) => [
            styles.releaseButtonWrapper,
            pressed && { opacity: 0.8 },
          ]}
          onPress={handleRelease}
          disabled={releasing}
        >
          <LinearGradient
            colors={["#f97316", "#ea580c"]}
            style={styles.releaseButton}
          >
            <Text style={styles.releaseButtonText}>
              {releasing ? "Releasing..." : "🏁 Done - Release Machine"}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Help Text */}
        <Text style={styles.helpText}>
          Tap "Release" when your laundry is done to notify the next person
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    color: "#ef4444",
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#334155",
    fontWeight: "600",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  backArrowText: {
    fontSize: 20,
    color: "#334155",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerPlaceholder: {
    width: 40,
  },

  // Status
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 24,
    fontWeight: "800",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 12,
  },

  // Sensors
  sensorRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  sensorCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sensorLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  sensorBar: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  sensorBarFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: "#334155",
    fontWeight: "600",
  },
  lockBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  lockText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  // Buzzer
  buzzerAlert: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  buzzerText: {
    fontSize: 16,
    color: "#dc2626",
    fontWeight: "700",
  },
  dismissButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dismissButtonText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Last update
  lastUpdate: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 24,
  },

  // Release button
  releaseButtonWrapper: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 12,
  },
  releaseButton: {
    paddingVertical: 18,
    alignItems: "center",
  },
  releaseButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },

  helpText: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },
});
