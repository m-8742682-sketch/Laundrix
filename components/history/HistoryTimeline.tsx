import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { LP } from "@/constants/LaundrixColors";
import type { UsageRecord } from "@/repositories/tabs/HistoryRepository";

function getStatusConfig(status: string) {
  switch (status) {
    case "Normal":
      return { label: "Normal", nodeColor: "#10B981", glowColor: "rgba(16,185,129,0.45)", badgeBg: "rgba(16,185,129,0.12)", badgeColor: "#059669", gradient: ["#10B981","#059669"] as [string,string], icon: "checkmark-circle" };
    case "Unauthorized":
      return { label: "Flagged", nodeColor: "#EF4444", glowColor: "rgba(239,68,68,0.45)", badgeBg: "rgba(239,68,68,0.10)", badgeColor: "#DC2626", gradient: ["#F87171","#EF4444"] as [string,string], icon: "warning" };
    case "Interrupted":
      return { label: "Interrupted", nodeColor: "#F59E0B", glowColor: "rgba(245,158,11,0.45)", badgeBg: "rgba(245,158,11,0.12)", badgeColor: "#D97706", gradient: ["#FBBF24","#F59E0B"] as [string,string], icon: "pause-circle" };
    default:
      return { label: "Completed", nodeColor: LP.TechBlue.solid, glowColor: LP.Glow.pulse, badgeBg: LP.TechBlue[100], badgeColor: LP.TechBlue.deep, gradient: [LP.TechBlue.solid, LP.TechBlue.deep] as [string,string], icon: "time" };
  }
}

function formatTimeStr(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDuration(seconds?: number): string {
  if (!seconds && seconds !== 0) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${seconds % 60}s`;
  const h = Math.floor(m / 60);
  return m % 60 > 0 ? `${h}h ${m % 60}m` : `${h}h`;
}

// ── Date section header ────────────────────────────────────────────
export function TimelineDateHeader({ title }: { title: string }) {
  return (
    <View style={tlStyles.dateHeader}>
      <View style={tlStyles.dateHeaderSpine} />
      <View style={tlStyles.dateHeaderLine} />
      <Text style={tlStyles.dateHeaderText}>{title}</Text>
      <View style={tlStyles.dateHeaderLine} />
    </View>
  );
}

// ── Single timeline item ───────────────────────────────────────────
interface TimelineItemProps {
  record: UsageRecord;
  fadeAnim: Animated.Value;
  isLast?: boolean;
}

export function TimelineItem({ record, fadeAnim, isLast = false }: TimelineItemProps) {
  const sc       = getStatusConfig(record.resultStatus);
  const nodeGlow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (record.resultStatus !== "Normal") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(nodeGlow, { toValue: 1,    duration: 1200, useNativeDriver: true }),
          Animated.timing(nodeGlow, { toValue: 0.35, duration: 1400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  return (
    <Animated.View
      style={[
        tlStyles.row,
        {
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0,1], outputRange: [16,0] }) }],
        },
      ]}
    >
      {/* Spine + node column */}
      <View style={tlStyles.spineCol}>
        <View style={tlStyles.spineTop} />
        <View style={tlStyles.nodeWrapper}>
          <Animated.View style={[tlStyles.nodeGlow, { backgroundColor: sc.glowColor, opacity: nodeGlow }]} />
          <View style={[tlStyles.node, { backgroundColor: sc.nodeColor }]} />
        </View>
        {!isLast && <View style={tlStyles.spineBottom} />}
      </View>

      {/* Card */}
      <View style={tlStyles.cardArea}>
        <View style={tlStyles.card}>
          <View style={tlStyles.cardMidBorder} pointerEvents="none" />
          <View style={tlStyles.cardMain}>
            {/* Row 1: machine + badge */}
            <View style={tlStyles.cardHeader}>
              <View style={tlStyles.machineRow}>
                <LinearGradient colors={sc.gradient} style={tlStyles.machineIconBg}>
                  <Ionicons name="hardware-chip" size={13} color="#fff" />
                </LinearGradient>
                <View>
                  <Text style={tlStyles.machineName}>{record.machineId}</Text>
                  {record.userName && record.userName !== "Unknown" && (
                    <Text style={tlStyles.machineUser}>{record.userName}</Text>
                  )}
                </View>
              </View>
              <View style={[tlStyles.statusBadge, { backgroundColor: sc.badgeBg, borderColor: sc.badgeColor + "28" }]}>
                <Ionicons name={sc.icon as any} size={11} color={sc.badgeColor} />
                <Text style={[tlStyles.statusText, { color: sc.badgeColor }]}>{sc.label}</Text>
              </View>
            </View>

            {/* Row 2: time range */}
            <View style={tlStyles.timeRow}>
              <Ionicons name="time-outline" size={12} color={LP.Text.soft} />
              <Text style={tlStyles.timeText}>
                {formatTimeStr(record.startTime)}
                {record.endTime && record.endTime.getTime() !== record.startTime.getTime()
                  ? ` → ${formatTimeStr(record.endTime)}`
                  : ""}
              </Text>
            </View>

            {/* Row 3: chips */}
            <View style={tlStyles.chipsRow}>
              {record.duration > 0 && (
                <View style={tlStyles.chip}>
                  <Ionicons name="timer-outline" size={11} color={LP.TechBlue.solid} />
                  <Text style={tlStyles.chipTxt}>{formatDuration(record.duration)}</Text>
                </View>
              )}
              {record.resultStatus === "Unauthorized" && (
                <View style={[tlStyles.chip, { backgroundColor: "rgba(239,68,68,0.09)" }]}>
                  <Ionicons name="warning-outline" size={11} color="#EF4444" />
                  <Text style={[tlStyles.chipTxt, { color: "#EF4444" }]}>Unauthorized</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const tlStyles = StyleSheet.create({
  dateHeader: {
    flexDirection: "row", alignItems: "center",
    marginVertical: 16, gap: 8,
  },
  dateHeaderSpine: { width: 28 },
  dateHeaderLine:  { flex: 1, height: 1, backgroundColor: LP.TechBlue[200], opacity: 0.55 },
  dateHeaderText:  {
    fontSize: 11, fontWeight: "800", color: LP.TechBlue.deep,
    textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.75, paddingHorizontal: 4,
  },

  row:      { flexDirection: "row", marginBottom: 4 },
  spineCol: { width: 28, alignItems: "center" },
  spineTop: { width: 1, height: 12, borderLeftWidth: 1, borderLeftColor: LP.TechBlue[200], borderStyle: "dashed", opacity: 0.55 },
  spineBottom: { flex: 1, width: 1, minHeight: 20, borderLeftWidth: 1, borderLeftColor: LP.TechBlue[200], borderStyle: "dashed", opacity: 0.55 },
  nodeWrapper: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  nodeGlow: {
    position: "absolute",
    width: 20, height: 20, borderRadius: 10,
    top: -4, left: -4,
  },
  node: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3,
    elevation: 3, zIndex: 1,
  },

  cardArea: { flex: 1, paddingLeft: 12, paddingBottom: 12 },
  card: {
    backgroundColor: LP.Surface.glass,
    borderRadius: 20, overflow: "hidden", position: "relative",
    borderWidth: 1, borderColor: LP.LayeredGlass.outer,
    shadowColor: LP.Glow.shadow,
    shadowOffset: { width: 0, height: 5 }, shadowOpacity: 1, shadowRadius: 14,
    elevation: 3,
  },
  cardMidBorder: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 19, borderWidth: 1, borderColor: LP.LayeredGlass.mid,
  },
  cardMain:   { padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  machineRow: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1 },
  machineIconBg: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  machineName: { fontSize: 16, fontWeight: "900", color: LP.Text.primary, letterSpacing: -0.5 },
  machineUser: { fontSize: 11, color: LP.Text.soft, fontWeight: "600", marginTop: 1 },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, gap: 4, borderWidth: 1 },
  statusText:  { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  timeRow:     { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 },
  timeText:    { fontSize: 12, color: LP.Text.muted, fontWeight: "600", lineHeight: 18 },
  chipsRow:    { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  chip:        { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: LP.TechBlue[100], paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  chipTxt:     { fontSize: 11, fontWeight: "700", color: LP.TechBlue.solid },
});
