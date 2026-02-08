/**
 * History Screen
 * 
 * High-end UI showing laundry usage history
 */

import React, { useEffect, useRef, useMemo } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useUser } from "@/components/UserContext";
import { useHistoryViewModel } from "@/viewmodels/tabs/HistoryViewModel";
import { UsageRecord } from "@/repositories/tabs/HistoryRepository";

const { width } = Dimensions.get("window");

// Format date for section headers
function formatDateHeader(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) return "Today";
  if (dateOnly.getTime() === yesterday.getTime()) return "Yesterday";
  
  return date.toLocaleDateString(undefined, { 
    weekday: "long",
    month: "short", 
    day: "numeric" 
  });
}

// Format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { 
    hour: "2-digit", 
    minute: "2-digit",
    hour12: true 
  });
}

// Format duration
function formatDuration(minutes?: number): string {
  if (!minutes) return "--";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: userLoading } = useUser();
  const { history, loading, refreshing, refresh } = useHistoryViewModel(user?.uid);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups: { title: string; data: UsageRecord[] }[] = [];
    const dateMap = new Map<string, UsageRecord[]>();

    history.forEach((item) => {
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

    // Sort groups by date (most recent first)
    groups.sort((a, b) => {
      const dateA = a.data[0]?.startTime.getTime() || 0;
      const dateB = b.data[0]?.startTime.getTime() || 0;
      return dateB - dateA;
    });

    return groups;
  }, [history]);

  // Flatten for FlatList
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Normal": return { bg: ["#22c55e", "#16a34a"], icon: "checkmark-circle" };
      case "Unauthorized": return { bg: ["#ef4444", "#dc2626"], icon: "warning" };
      case "Interrupted": return { bg: ["#f59e0b", "#d97706"], icon: "pause-circle" };
      default: return { bg: ["#64748b", "#475569"], icon: "time" };
    }
  };

  const renderItem = ({ item, index }: { item: typeof flatData[0]; index: number }) => {
    if (item.type === "header") {
      return (
        <Animated.View style={[styles.sectionHeader, { opacity: fadeAnim }]}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </Animated.View>
      );
    }

    const record = item.item;
    const statusConfig = getStatusColor(record.resultStatus);

    return (
      <Animated.View
        style={[
          styles.card,
          {
            opacity: fadeAnim,
            transform: [{
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            }],
          },
        ]}
      >
        {/* Status indicator */}
        <LinearGradient
          colors={statusConfig.bg as [string, string]}
          style={styles.statusIndicator}
        >
          <Ionicons name={statusConfig.icon as any} size={20} color="#fff" />
        </LinearGradient>

        {/* Content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <Text style={styles.machineName}>{record.machineId}</Text>
            <View style={styles.statusBadge}>
              <Text style={[
                styles.statusText,
                { color: statusConfig.bg[0] }
              ]}>
                {record.resultStatus || "Completed"}
              </Text>
            </View>
          </View>

          <View style={styles.cardDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color="#64748b" />
              <Text style={styles.detailText}>
                {formatTime(record.startTime)} - {formatTime(record.endTime)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="hourglass-outline" size={16} color="#64748b" />
              <Text style={styles.detailText}>{formatDuration(record.duration)}</Text>
            </View>
            {record.load > 0 && (
              <View style={styles.detailItem}>
                <Ionicons name="scale-outline" size={16} color="#64748b" />
                <Text style={styles.detailText}>{record.load} kg</Text>
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
        <ActivityIndicator size="large" color="#0EA5E9" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.title}>History</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBadge}>
            <Text style={styles.statNumber}>{history.length}</Text>
            <Text style={styles.statLabel}>sessions</Text>
          </View>
        </View>
      </Animated.View>

      {/* List */}
      <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
        <FlatList
          data={flatData}
          keyExtractor={(item, index) => 
            item.type === "header" ? `header-${item.title}` : `item-${item.item.id}`
          }
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            flatData.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#0EA5E9"
              colors={["#0EA5E9"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LinearGradient
                colors={["#f0f9ff", "#e0f2fe"]}
                style={styles.emptyIconCircle}
              >
                <Ionicons name="time-outline" size={56} color="#0EA5E9" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySubtitle}>
                Your laundry sessions will appear here
              </Text>
            </View>
          }
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    fontSize: 14,
    fontWeight: "500",
  },
  backgroundDecor: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  decorCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -60,
    right: -60,
  },
  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 150,
    left: -40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  statsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0EA5E9",
  },
  statLabel: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    paddingVertical: 12,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusIndicator: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  machineName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 22,
  },
});
