/**
 * Machines Screen — REDESIGNED #9
 * Premium dark-glass aesthetic matching the app style.
 */

import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  StatusBar, Animated, RefreshControl, Easing, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";
import { useUser } from "@/components/UserContext";
import { subscribeMachinesRTDB, fetchMachines, Machine } from "@/services/machine.service";

const { width } = Dimensions.get("window");

const STATUS: Record<string, { colors: [string, string]; icon: string; dot: string; textColor: string }> = {
  "Available":        { colors: ["#10B981", "#059669"], icon: "checkmark-circle",  dot: "#10B981", textColor: "#059669" },
  "In Use":           { colors: ["#0EA5E9", "#0369A1"], icon: "sync",              dot: "#0EA5E9", textColor: "#0EA5E9" },
  "Clothes Inside":   { colors: ["#0284C7", "#7C3AED"], icon: "shirt",             dot: "#0284C7", textColor: "#7C3AED" },
  "Unauthorized Use": { colors: ["#F59E0B", "#D97706"], icon: "warning",           dot: "#F59E0B", textColor: "#D97706" },
};

const Bubble = React.memo(({ size, color, pos }: { size: number; color: string; pos: any }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 4500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  return (
    <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color, ...pos, transform: [{ translateY }] }]} />
  );
});

export default function MachinesScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { user } = useUser();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();
    const unsub = subscribeMachinesRTDB((data) => { setMachines(data); setLoading(false); });
    return unsub;
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const data = await fetchMachines();
    setMachines(data);
    setRefreshing(false);
  };

  const available = machines.filter(m => m.status === "Available").length;
  const inUse = machines.filter(m => m.status === "In Use").length;
  const online = machines.filter(m => m.isLive).length;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "Available": return t.available;
      case "In Use": return t.inUse;
      case "Unauthorized Use": return t.unauthorized;
      default: return status;
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <LinearGradient colors={["#fafaff", "#f0f4ff", "#e8edff"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Bubble size={300} color="rgba(99,102,241,0.07)" pos={{ top: -80, right: -80 }} />
      <Bubble size={200} color="rgba(14,165,233,0.05)" pos={{ top: 200, left: -60 }} />
      <Bubble size={150} color="rgba(139,92,246,0.06)" pos={{ bottom: 100, right: -40 }} />

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0EA5E9" />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Pressable onPress={() => router.back()} style={s.backBtn}>
            <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={s.backGrad}>
              <Ionicons name="chevron-back" size={22} color="#0369A1" />
            </LinearGradient>
          </Pressable>
          <View>
            <Text style={s.headerOverline}>LAUNDRIX</Text>
            <Text style={s.headerTitle}>{t.allMachines}</Text>
          </View>
          <View style={s.onlineDot}>
            <View style={[s.dot, { backgroundColor: online > 0 ? "#10B981" : "#94a3b8" }]} />
            <Text style={s.onlineText}>{online} {t.live.toLowerCase()}</Text>
          </View>
        </Animated.View>

        <Animated.View style={[s.statsRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {[
            { num: available, label: t.available, colors: ["#10B981", "#059669"] as [string,string] },
            { num: inUse,     label: t.inUse,     colors: ["#0EA5E9", "#0369A1"] as [string,string] },
            { num: online,    label: t.online,    colors: ["#0EA5E9", "#0284C7"] as [string,string] },
          ].map(stat => (
            <View key={stat.label} style={s.statCard}>
              <View style={s.statGlass} />
              <LinearGradient colors={stat.colors} style={s.statBar} />
              <Text style={s.statNum}>{stat.num}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>

        {loading ? (
          <View style={s.loadingWrap}>
            {[1, 2, 3].map(i => (
              <View key={i} style={s.skeleton} />
            ))}
          </View>
        ) : machines.map((machine, idx) => {
          const cfg = STATUS[machine.status] || STATUS["Available"];
          const isOnline = machine.isLive;
          const isCurrentUser = machine.currentUserId === user?.uid;

          return (
            <Animated.View key={machine.machineId} style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
              <View style={s.cardGlass} />
              <LinearGradient colors={cfg.colors} style={s.cardAccent} />

              <View style={s.cardBody}>
                <View style={s.cardTop}>
                  <LinearGradient colors={cfg.colors} style={s.machineIcon}>
                    <Ionicons name={cfg.icon as any} size={22} color="#fff" />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={s.machineId}>{machine.machineId}</Text>
                    <Text style={s.machineLocation}>{machine.location || t.noLocationSet}</Text>
                  </View>
                  <View style={[s.onlineBadge, { backgroundColor: isOnline ? "#D1FAE5" : "#FEE2E2" }]}>
                    <View style={[s.dot, { backgroundColor: isOnline ? "#10B981" : "#EF4444", width: 6, height: 6, borderRadius: 3 }]} />
                    <Text style={[s.onlineBadgeText, { color: isOnline ? "#059669" : "#DC2626" }]}>
                      {isOnline ? t.online : t.offline}
                    </Text>
                  </View>
                </View>

                <View style={[s.statusChip, { backgroundColor: cfg.textColor + "18" }]}>
                  <View style={[s.dot, { backgroundColor: cfg.dot, width: 8, height: 8, borderRadius: 4 }]} />
                  <Text style={[s.statusChipText, { color: cfg.textColor }]}>{getStatusLabel(machine.status)}</Text>
                </View>

                <View style={s.sensors}>
                  <View style={s.sensorBox}>
                    <Ionicons name="scale-outline" size={14} color="#0EA5E9" />
                    <Text style={s.sensorVal}>{(machine.currentLoad ?? 0).toFixed(1)} {t.kg}</Text>
                  </View>
                  <View style={s.sensorDivider} />
                  <View style={s.sensorBox}>
                    <Ionicons name="pulse-outline" size={14} color="#0EA5E9" />
                    <Text style={s.sensorVal}>{machine.vibrationLevel ?? 0}% {t.vibration}</Text>
                  </View>
                  <View style={s.sensorDivider} />
                  <View style={s.sensorBox}>
                    <Ionicons name={machine.locked ? "lock-closed" : "lock-open"} size={14} color={machine.locked ? "#0EA5E9" : "#10B981"} />
                    <Text style={[s.sensorVal, { color: machine.locked ? "#0EA5E9" : "#10B981" }]}>
                      {machine.locked ? t.locked : t.unlocked}
                    </Text>
                  </View>
                </View>

                <View style={s.actions}>
                  <Pressable
                    style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push({ pathname: "/iot/qrscan", params: { machineId: machine.machineId } })}
                  >
                    <LinearGradient colors={["#10B981", "#059669"]} style={s.actionGrad}>
                      <Ionicons name="qr-code-outline" size={15} color="#fff" />
                      <Text style={s.actionText}>{t.scanLabel}</Text>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [s.actionBtn, pressed && { opacity: 0.8 }]}
                    onPress={() => router.push({ pathname: "/(tabs)/queue", params: { machineId: machine.machineId } })}
                  >
                    <LinearGradient colors={["#0EA5E9", "#0369A1"]} style={s.actionGrad}>
                      <Ionicons name="people-outline" size={15} color="#fff" />
                      <Text style={s.actionText}>{t.queueLabel}</Text>
                    </LinearGradient>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      s.actionBtn,
                      !isCurrentUser && s.actionBtnDisabled,
                      pressed && isCurrentUser && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      if (isCurrentUser) {
                        router.push({ pathname: "/iot/[machineId]", params: { machineId: machine.machineId } });
                      }
                    }}
                    disabled={!isCurrentUser}
                  >
                    <LinearGradient
                      colors={isCurrentUser ? ["#0EA5E9", "#0284C7"] : ["#CBD5E1", "#94A3B8"]}
                      style={s.actionGrad}
                    >
                      <Ionicons name="settings-outline" size={15} color="#fff" />
                      <Text style={s.actionText}>{t.controlLabel}</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          );
        })}

        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 14 },
  backBtn: { borderRadius: 16, overflow: "hidden" },
  backGrad: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  headerOverline: { fontSize: 10, fontWeight: "800", color: "#0EA5E9", letterSpacing: 2, textTransform: "uppercase" },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  onlineDot: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: "700", color: "#0f172a" },

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 20, overflow: "hidden", padding: 16, alignItems: "center", shadowColor: "#0EA5E9", shadowOpacity: 0.08, shadowRadius: 12, elevation: 4, backgroundColor: "#fff" },
  statGlass: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.7)" },
  statBar: { width: 32, height: 4, borderRadius: 2, marginBottom: 10 },
  statNum: { fontSize: 26, fontWeight: "900", color: "#0f172a" },
  statLabel: { fontSize: 11, color: "#94a3b8", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 },

  loadingWrap: { gap: 16 },
  skeleton: { height: 200, borderRadius: 24, backgroundColor: "#E2E8F0" },

  card: {
    borderRadius: 24, marginBottom: 16, overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#0EA5E9", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 6,
  },
  cardGlass: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.85)" },
  cardAccent: { height: 4, width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  cardBody: { padding: 20 },

  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  machineIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  machineId: { fontSize: 20, fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 },
  machineLocation: { fontSize: 12, color: "#94a3b8", fontWeight: "600", marginTop: 2 },
  onlineBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  onlineBadgeText: { fontSize: 10, fontWeight: "800" },

  statusChip: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, marginBottom: 16 },
  statusChipText: { fontSize: 13, fontWeight: "700" },

  sensors: { flexDirection: "row", alignItems: "center", marginBottom: 16, backgroundColor: "#F8FAFC", borderRadius: 14, padding: 12 },
  sensorBox: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  sensorDivider: { width: 1, height: 16, backgroundColor: "#E2E8F0" },
  sensorVal: { fontSize: 12, fontWeight: "700", color: "#475569" },

  actions: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  actionBtnDisabled: { opacity: 0.45 },
  actionGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 12 },
  actionText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});