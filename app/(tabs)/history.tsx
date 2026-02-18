import React, { useEffect, useRef, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  Animated,
  StatusBar,
  RefreshControl,
  Dimensions,
  Pressable,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useUser } from "@/components/UserContext";
import { useHistoryViewModel } from "@/viewmodels/tabs/HistoryViewModel";
import { UsageRecord } from "@/repositories/tabs/HistoryRepository";
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");

type FilterType = "all" | "Normal" | "Unauthorized" | "Interrupted";

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: userLoading } = useUser();
  const { history, loading, refreshing, refresh } = useHistoryViewModel(user?.uid);
  const { t } = useI18n();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(fadeAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const formatDateHeader = (date: Date): string => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date); dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) return t.today;
    if (dateOnly.getTime() === yesterday.getTime()) return t.yesterday;
    return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatDuration = (minutes?: number): string => {
    if (!minutes) return "--";
    if (minutes < 60) return `${minutes} ${t.min}`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}${t.min}` : `${hours}h`;
  };

  // Filter Logic
  const filteredHistory = useMemo(() => {
    if (activeFilter === "all") return history;
    return history.filter(item => item.resultStatus === activeFilter);
  }, [history, activeFilter]);

  const groupedHistory = useMemo(() => {
    const groups: { title: string; data: UsageRecord[] }[] = [];
    const dateMap = new Map<string, UsageRecord[]>();

    filteredHistory.forEach((item) => {
      const dateKey = item.startTime.toDateString();
      const existing = dateMap.get(dateKey) || [];
      existing.push(item);
      dateMap.set(dateKey, existing);
    });

    dateMap.forEach((items, dateKey) => {
      groups.push({
        title: formatDateHeader(new Date(dateKey)),
        data: items.sort((a, b) => b.startTime.getTime() - a.startTime.getTime()),
      });
    });

    groups.sort((a, b) => {
      const dateA = a.data[0]?.startTime.getTime() || 0;
      const dateB = b.data[0]?.startTime.getTime() || 0;
      return dateB - dateA;
    });

    return groups;
  }, [filteredHistory, t]);

  const flatData = useMemo(() => {
    const result: ({ type: "header"; title: string } | { type: "item"; item: UsageRecord })[] = [];
    groupedHistory.forEach((group) => {
      result.push({ type: "header", title: group.title });
      group.data.forEach((item) => {
        result.push({ type: "item", item });
      });
    });
    return result;
  }, [groupedHistory]);

  // Status Config with Common Sense Colors
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Normal": 
        return { 
          label: t.normal, 
          gradient: ["#10B981", "#059669"], // Green for Success
          bg: "#ECFDF5",
          color: "#059669",
          icon: "checkmark-circle" 
        };
      case "Unauthorized": 
        return { 
          label: t.unauthorized, 
          gradient: ["#F87171", "#EF4444"], // Red for Danger
          bg: "#FEF2F2",
          color: "#DC2626",
          icon: "warning" 
        };
      case "Interrupted": 
        return { 
          label: t.interrupted, 
          gradient: ["#FBBF24", "#F59E0B"], // Orange/Yellow for Warning
          bg: "#FFFBEB",
          color: "#D97706",
          icon: "pause-circle" 
        };
      default: 
        return { 
          label: t.completed, 
          gradient: ["#A78BFA", "#8B5CF6"], // Violet for Default
          bg: "#F5F3FF",
          color: "#7C3AED",
          icon: "time" 
        };
    }
  };

  const renderFilterChip = (label: string, type: FilterType) => {
    const isActive = activeFilter === type;
    return (
      <Pressable key={type} onPress={() => setActiveFilter(type)}>
        <Animated.View style={styles.chipContainer}>
          {isActive ? (
            <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.chipGradient}>
              <Text style={styles.chipTextActive}>{label}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.chipInactive}>
              <Text style={styles.chipText}>{label}</Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    );
  };

  const renderItem = ({ item, index }: { item: typeof flatData[0]; index: number }) => {
    if (item.type === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }

    const record = item.item;
    const statusConfig = getStatusConfig(record.resultStatus);

    return (
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
            }],
          },
        ]}
      >
        {/* Status Stripe */}
        <LinearGradient colors={statusConfig.gradient as [string, string]} style={styles.statusStripe} />
        
        <View style={styles.cardMain}>
          <View style={styles.cardHeader}>
            <View style={styles.machineIdWrapper}>
              <Ionicons name="hardware-chip" size={16} color="#6366F1" />
              <Text style={styles.machineName}>{record.machineId}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name={statusConfig.icon as any} size={12} color={statusConfig.color} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="timer-outline" size={15} color="#64748b" />
              <Text style={styles.detailText}>{formatDuration(record.duration)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={15} color="#64748b" />
              <Text style={styles.detailText}>{formatTime(record.startTime)}</Text>
            </View>
            {record.load > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="scale-outline" size={15} color="#64748b" />
                <Text style={styles.detailText}>{record.load} {t.kg}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  if (userLoading || (loading && history.length === 0)) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>{t.loadingHistory}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorTriangle} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>{t.history}</Text>
        <View style={styles.statBadge}>
          <Text style={styles.statNumber}>{history.length}</Text>
          <Text style={styles.statLabel}>{t.sessions}</Text>
        </View>
      </Animated.View>

      {/* Filter Options */}
      <View style={{ height: 40, marginBottom: 12 }}> 
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterContent}
        >
          {renderFilterChip(t.all, "all")}
          {renderFilterChip(t.normal, "Normal")}
          {renderFilterChip(t.unauthorized, "Unauthorized")}
          {renderFilterChip(t.interrupted, "Interrupted")}
        </ScrollView>
      </View>

      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        <FlatList
          data={flatData}
          keyExtractor={(item, index) => item.type === "header" ? `header-${item.title}` : `item-${item.item.id}`}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, flatData.length === 0 && styles.emptyListContent]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#6366F1" colors={["#6366F1"]} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.emptyIconCircle}>
                <Ionicons name="archive-outline" size={42} color="#4F46E5" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>{t.noHistoryYet}</Text>
              <Text style={styles.emptySubtitle}>{t.historyWillAppearHint}</Text>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  loadingText: { marginTop: 16, color: "#6366F1", fontSize: 16, fontWeight: "600" },

  // Background
  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "#E0E7FF", opacity: 0.5, top: -100, right: -80 },
  decorCircle2: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 150, left: -60 },
  decorTriangle: { position: "absolute", width: 180, height: 180, backgroundColor: "#ECFEFF", opacity: 0.3, top: "25%", right: -40, transform: [{ rotate: "45deg" }] },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 20 },
  title: { fontSize: 32, fontWeight: "800", color: "#0f172a", letterSpacing: -1 },
  statBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F3FF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6, borderWidth: 1, borderColor: "#E0E7FF" },
  statNumber: { fontSize: 18, fontWeight: "800", color: "#6366F1" },
  statLabel: { fontSize: 14, color: "#6366F1", fontWeight: "600" },

  // Filters
  filterScrollView: {
    flexGrow: 0, // Prevents ScrollView from taking up extra vertical space
    width: "100%",
  },
  filterContent: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center', // Ensures chips stay centered vertically
    paddingRight: 40, // Extra padding at the end for scrolling
  },
  chipContainer: { borderRadius: 14, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2 },
  chipGradient: { paddingVertical: 10, paddingHorizontal: 18 },
  chipInactive: { paddingVertical: 10, paddingHorizontal: 18, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0" },
  chipText: { color: "#64748b", fontWeight: "700", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // List
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyListContent: { flex: 1, justifyContent: "center" },

  // Sections
  sectionHeader: { paddingVertical: 12, marginTop: 8 },
  sectionHeaderText: { fontSize: 14, fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: 1 },

  // Card
  card: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 24, marginBottom: 12,
    shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: "#f1f5f9", overflow: "hidden",
  },
  statusStripe: { width: 6, height: "100%" },
  cardMain: { flex: 1, padding: 16 },
  
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  machineIdWrapper: { flexDirection: "row", alignItems: "center", gap: 8 },
  machineName: { fontSize: 17, fontWeight: "800", color: "#0f172a" },

  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },

  cardDetails: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 13, color: "#64748b", fontWeight: "600" },

  // Empty State
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#94a3b8", textAlign: "center", lineHeight: 22 },
});