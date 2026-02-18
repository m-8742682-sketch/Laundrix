import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Animated,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";
import { subscribeMachines, fetchMachines, Machine } from "@/services/machine.service";

const STATUS_COLORS: Record<string, [string, string]> = {
  "Available": ["#22D3EE", "#06B6D4"],
  "In Use": ["#6366F1", "#4F46E5"],
  "Clothes Inside": ["#8B5CF6", "#7C3AED"],
  "Unauthorized Use": ["#F59E0B", "#D97706"],
};

export default function MachinesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  // Real-time subscription via machine.service
  useEffect(() => {
    const unsubscribe = subscribeMachines((machinesData) => {
      setMachines(machinesData);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Manual refresh - re-fetch via service
    const machinesData = await fetchMachines();
    setMachines(machinesData);
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status] || ["#64748b", "#475569"];
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading machines...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background */}
      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.backBtnGradient}>
              <Ionicons name="chevron-back" size={24} color="#4F46E5" />
            </LinearGradient>
          </Pressable>
          <Text style={styles.headerTitle}>All Machines</Text>
          <View style={styles.backBtnPlaceholder} />
        </Animated.View>

        {/* Stats Summary */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.statChip}>
            <LinearGradient colors={["#F0FDFA", "#FFFFFF"]} style={styles.statGradient}>
              <Text style={styles.statNumber}>{machines.filter(m => m.status === "Available").length}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </LinearGradient>
          </View>
          <View style={styles.statChip}>
            <LinearGradient colors={["#EEF2FF", "#FFFFFF"]} style={styles.statGradient}>
              <Text style={styles.statNumber}>{machines.filter(m => m.status === "In Use").length}</Text>
              <Text style={styles.statLabel}>In Use</Text>
            </LinearGradient>
          </View>
          <View style={styles.statChip}>
            <LinearGradient colors={["#FEF3C7", "#FFFFFF"]} style={styles.statGradient}>
              <Text style={styles.statNumber}>{machines.filter(m => m.isLive).length}</Text>
              <Text style={styles.statLabel}>Online</Text>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Machines List */}
        <View style={styles.list}>
          {machines.map((machine, index) => {
            const statusColor = getStatusColor(machine.status);
            const isOnline = machine.isLive;
            
            return (
              <Animated.View
                key={machine.machineId}
                style={[
                  styles.machineCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <Pressable
                  onPress={() => router.push(`/iot/${machine.machineId}`)}
                  style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.9 }]}
                >
                  <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.cardGradient}>
                    {/* Header: ID + Status */}
                    <View style={styles.cardHeader}>
                      <View style={styles.machineIdBlock}>
                        <LinearGradient colors={statusColor} style={styles.machineIcon}>
                          <Ionicons name="water" size={20} color="#fff" />
                        </LinearGradient>
                        <View>
                          <Text style={styles.machineId}>{machine.machineId}</Text>
                          <Text style={styles.machineLocation}>{machine.location || "No location"}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: isOnline ? "#D1FAE5" : "#FEE2E2" }]}>
                        <View style={[styles.statusDot, { backgroundColor: isOnline ? "#10B981" : "#EF4444" }]} />
                        <Text style={[styles.statusText, { color: isOnline ? "#059669" : "#DC2626" }]}>
                          {isOnline ? "ONLINE" : "OFFLINE"}
                        </Text>
                      </View>
                    </View>

                    {/* Sensor Data */}
                    <View style={styles.sensorRow}>
                      <View style={styles.sensorItem}>
                        <Ionicons name="scale-outline" size={16} color="#64748b" />
                        <Text style={styles.sensorValue}>{(machine.currentLoad ?? 0).toFixed(2)} kg</Text>
                      </View>
                      <View style={styles.sensorItem}>
                        <Ionicons name="pulse-outline" size={16} color="#64748b" />
                        <Text style={styles.sensorValue}>{machine.vibrationLevel ?? 0}%</Text>
                      </View>
                      <View style={styles.sensorItem}>
                        <Ionicons 
                          name={machine.status === "Available" ? "checkmark-circle" : "time"} 
                          size={16} 
                          color="#64748b" 
                        />
                        <Text style={styles.sensorValue}>{machine.status}</Text>
                      </View>
                    </View>

                    {/* Live Indicator */}
                    {machine.status === "In Use" && (
                      <View style={styles.liveIndicator}>
                        <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.liveBadge}>
                          <Ionicons name="pulse" size={12} color="#fff" />
                          <Text style={styles.liveText}>ACTIVE</Text>
                        </LinearGradient>
                      </View>
                    )}
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#64748b", fontWeight: "600" },

  // Background
  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#E0E7FF", opacity: 0.4, top: -100, right: -80 },
  decorCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#CFFAFE", opacity: 0.3, bottom: 100, left: -60 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 20 },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  backBtn: { borderRadius: 16, overflow: "hidden" },
  backBtnGradient: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  backBtnPlaceholder: { width: 48 },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#0f172a" },

  // Stats
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statChip: { flex: 1, borderRadius: 16, overflow: "hidden", elevation: 3, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  statGradient: { padding: 16, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 12, color: "#64748b", fontWeight: "600", marginTop: 4 },

  // List
  list: { gap: 16 },
  machineCard: { borderRadius: 24, overflow: "hidden", elevation: 4, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12 },
  cardPressable: { borderRadius: 24 },
  cardGradient: { padding: 20 },

  // Card Header
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  machineIdBlock: { flexDirection: "row", alignItems: "center", gap: 12 },
  machineIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  machineId: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  machineLocation: { fontSize: 13, color: "#64748b", fontWeight: "500", marginTop: 2 },

  // Status Badge
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "800" },

  // Sensors
  sensorRow: { flexDirection: "row", gap: 16 },
  sensorItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  sensorValue: { fontSize: 14, color: "#64748b", fontWeight: "600" },

  // Live Indicator
  liveIndicator: { position: "absolute", top: 16, right: 16 },
  liveBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  liveText: { fontSize: 9, color: "#fff", fontWeight: "800" },
});