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
  Pressable,
  ScrollView,
  Easing,
} from "react-native";
  import { SafeAreaView } from "react-native-safe-area-context";
  import { Ionicons } from "@expo/vector-icons";
  import { LinearGradient } from "expo-linear-gradient";

  import { useUser } from "@/components/UserContext";
  import { useHistoryViewModel } from "@/viewmodels/tabs/HistoryViewModel";
  import { UsageRecord } from "@/repositories/tabs/HistoryRepository";
  import { useI18n } from "@/i18n/i18n";
  import EnhancedBubble from "@/components/ui/EnhancedBubble";
  import { TimelineItem, TimelineDateHeader } from "@/components/history/HistoryTimeline";
  import { haptic } from "@/utils/haptics";
  import { LP } from "@/constants/LaundrixColors";

  type FilterType = "all" | "Normal" | "Unauthorized" | "Interrupted";

  export default function HistoryScreen() {
    const { user, loading: userLoading } = useUser();
    const { history, loading, refreshing, refresh } = useHistoryViewModel(user?.uid, user?.role === "admin");
    const { t } = useI18n();

    const [activeFilter, setActiveFilter] = useState<FilterType>("all");
    const fadeAnim  = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      ]).start();
    }, []);

    const formatDateHeader = (date: Date): string => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const dateOnly = new Date(date); dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly.getTime() === today.getTime()) return t.today;
      if (dateOnly.getTime() === yesterday.getTime()) return t.yesterday;
      return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
    };

    const formatTime = (date: Date): string =>
      date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: true });

    const formatDuration = (seconds?: number): string => {
      // FIX #4: duration stored in SECONDS, not minutes
      if (!seconds && seconds !== 0) return "--";
      if (seconds < 60) return `${seconds}s`;
      const totalMins = Math.floor(seconds / 60);
      if (totalMins < 60) return `${totalMins}m ${seconds % 60}s`;
      const h = Math.floor(totalMins / 60), m = totalMins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    };

    const getStatusConfig = (status: string) => {
      switch (status) {
        case "Normal":       return { label: t.normal,       gradient: ["#10B981","#059669"] as [string,string], bg: "#ECFDF5", color: "#059669", icon: "checkmark-circle" };
        case "Unauthorized": return { label: t.unauthorized, gradient: ["#F87171","#EF4444"] as [string,string], bg: "#FEF2F2", color: "#DC2626", icon: "warning" };
        case "Interrupted":  return { label: t.interrupted,  gradient: ["#FBBF24","#F59E0B"] as [string,string], bg: "#FFFBEB", color: "#D97706", icon: "pause-circle" };
        default:             return { label: t.completed,    gradient: ["#A78BFA","#0284C7"] as [string,string], bg: "#F5F3FF", color: "#0284C7", icon: "time" };
      }
    };

    const filteredHistory = useMemo(() =>
      activeFilter === "all" ? history : history.filter(i => i.resultStatus === activeFilter),
      [history, activeFilter]);

    const groupedHistory = useMemo(() => {
      const groups: { title: string; data: UsageRecord[] }[] = [];
      const dateMap = new Map<string, UsageRecord[]>();
      filteredHistory.forEach((item) => {
        const key = item.startTime.toDateString();
        dateMap.set(key, [...(dateMap.get(key) || []), item]);
      });
      dateMap.forEach((items, key) =>
        groups.push({ title: formatDateHeader(new Date(key)), data: items.sort((a,b) => b.startTime.getTime() - a.startTime.getTime()) })
      );
      return groups.sort((a,b) => (b.data[0]?.startTime.getTime()||0) - (a.data[0]?.startTime.getTime()||0));
    }, [filteredHistory, t]);

    const flatData = useMemo(() => {
      const result: ({ type: "header"; title: string } | { type: "item"; item: UsageRecord })[] = [];
      groupedHistory.forEach(g => {
        result.push({ type: "header", title: g.title });
        g.data.forEach(item => result.push({ type: "item", item }));
      });
      return result;
    }, [groupedHistory]);

    const FILTERS: { label: string; type: FilterType }[] = [
      { label: t.all, type: "all" },
      { label: t.normal, type: "Normal" },
      { label: t.unauthorized, type: "Unauthorized" },
      { label: t.interrupted, type: "Interrupted" },
    ];

    const renderItem = ({ item }: { item: typeof flatData[0] }) => {
      if (item.type === "header") {
        return <TimelineDateHeader title={item.title} />;
      }
      return (
        <TimelineItem
          record={item.item}
          fadeAnim={fadeAnim}
          isLast={false}
        />
      );
    };

    if (userLoading || (loading && history.length === 0)) {
      return (
        <View style={styles.center}>
          <StatusBar barStyle="dark-content" />
          <ActivityIndicator size="large" color="#0EA5E9" />
          <Text style={styles.loadingText}>{t.loadingHistory}</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Background — identical to queue/conversations */}
        <View style={styles.backgroundContainer}>
          <LinearGradient colors={["#fafaff","#f0f4ff","#e0e7ff","#dbeafe"]} locations={[0,0.3,0.7,1]} style={styles.gradientBackground} />
          <EnhancedBubble delay={0}    size={260} color="rgba(14, 165, 233, 0.07)" position={{ top: -80,    right: -60 }} driftX={14} floatY={26} />
          <EnhancedBubble delay={800}  size={180} color="rgba(14, 165, 233, 0.05)" position={{ top: 80,     left:  -40 }} driftX={9}  floatY={20} />
          <EnhancedBubble delay={1600} size={140} color="rgba(2,  132, 199, 0.06)" position={{ top: 350,    right: -30 }} driftX={11} floatY={16} />
          <EnhancedBubble delay={2400} size={100} color="rgba(16, 185, 129, 0.04)" position={{ bottom: 200, left:  20  }} driftX={7}  floatY={14} />
        </View>

        <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
          {/* Header */}
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <Text style={styles.overline}>{t.history}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{history.length}</Text>
              <Text style={styles.countLabel}>{t.sessions}</Text>
            </View>
          </Animated.View>

          {/* FIX #7: Stats summary row */}
          {history.length > 0 && (
            <Animated.View style={[{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 12 }, { opacity: fadeAnim }]}>
              {[
                { num: history.length, label: "Total", colors: ["#0EA5E9","#0369A1"] as [string,string] },
                { num: history.filter(h => h.resultStatus === "Normal").length, label: "Normal", colors: ["#10B981","#059669"] as [string,string] },
                { num: history.filter(h => h.resultStatus === "Unauthorized").length, label: "Flagged", colors: ["#EF4444","#DC2626"] as [string,string] },
              ].map(s => (
                <View key={s.label} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 14, alignItems: "center", shadowColor: "#0EA5E9", shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}>
                  <LinearGradient colors={s.colors} style={{ width: 28, height: 3, borderRadius: 2, marginBottom: 8 }} />
                  <Text style={{ fontSize: 22, fontWeight: "900", color: "#0f172a", letterSpacing: -1 }}>{s.num}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          {/* Filter chips — same pill style as queue viewAllBtn */}
          <View style={styles.filterRow}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={styles.filterContent}
            >
              {FILTERS.map(({ label, type }) => {
                const isActive = activeFilter === type;
                return (
                  <Pressable key={type} onPress={() => { haptic.selection(); setActiveFilter(type); }} style={styles.chipWrapper}>
                    {isActive ? (
                      <LinearGradient colors={["#0EA5E9","#0369A1"]} style={[styles.chipActive, { borderWidth: 0.5, borderColor: "rgba(14, 165, 233, 0.3)" }]}>
                        <Text style={styles.chipTextActive}>{label}</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.chipInactive, { borderWidth: 0.5, borderColor: "rgba(14, 165, 233, 0.3)" }]}>
                        <Text style={styles.chipText}>{label}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
            <FlatList
              data={flatData}
              keyExtractor={(item, i) => item.type === "header" ? `hdr-${item.title}` : `itm-${item.item.id}`}
              renderItem={renderItem}
              contentContainerStyle={[styles.listContent, flatData.length === 0 && styles.emptyListContent]}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0EA5E9" colors={["#0EA5E9"]} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <LinearGradient colors={["#E0E7FF","#C7D2FE"]} style={styles.emptyIconCircle}>
                    <Ionicons name="archive-outline" size={42} color="#0369A1" />
                  </LinearGradient>
                  <Text style={styles.emptyTitle}>{t.noHistoryYet}</Text>
                  <Text style={styles.emptySubtitle}>{t.historyWillAppearHint}</Text>
                </View>
              }
            />
          </Animated.View>
        </SafeAreaView>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LP.Surface.base },
    center:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: LP.Surface.base },
    loadingText: { marginTop: 16, color: LP.Text.accent, fontSize: 16, fontWeight: "600" },

    backgroundContainer: { position: "absolute", width: "100%", height: "100%", overflow: "hidden" },
    gradientBackground:  { position: "absolute", width: "100%", height: "100%" },
    bubble:              { position: "absolute", opacity: 0.4 },

    header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
    overline:   { fontSize: 25, fontWeight: "800", color: LP.Text.heading, textTransform: "uppercase", letterSpacing: -0.5, lineHeight: 30 },
    countBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: LP.TechBlue[100], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: LP.Border.glow },
    countText:  { fontSize: 16, fontWeight: "800", color: LP.Text.accent },
    countLabel: { fontSize: 13, fontWeight: "600", color: LP.Text.accent },

    filterRow:     { height: 44, marginBottom: 4 },
    filterContent: { paddingLeft: 20, paddingRight: 20, gap: 0, alignItems: "center" },
    chipWrapper:   {},
    chipActive:    { width: 85, paddingVertical: 8, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    chipInactive:  { width: 85, paddingVertical: 8, borderRadius: 20, backgroundColor: LP.Surface.glass, borderWidth: 1, borderColor: LP.LayeredGlass.outer, alignItems: "center", justifyContent: "center" },
    chipText:      { color: LP.Text.muted, fontWeight: "700", fontSize: 12, textAlign: "center" },
    chipTextActive:{ color: LP.Text.onDark, fontWeight: "700", fontSize: 12, textAlign: "center" },

    listContainer:   { flex: 1 },
    listContent:     { paddingLeft: 20, paddingRight: 20, paddingBottom: 100 },
    emptyListContent:{ flex: 1, justifyContent: "center" },

    sectionTitle:  { fontSize: 11, fontWeight: "800", color: LP.TechBlue.deep, textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.75 },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 8, marginLeft: 2 },
    sectionLine:   { flex: 1, height: 1, backgroundColor: LP.TechBlue[200], opacity: 0.55 },

    card: {
      backgroundColor: LP.Surface.glass,
      borderRadius: 22, marginBottom: 14,
      shadowColor: LP.Glow.shadow, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4,
      borderWidth: 1, borderColor: LP.LayeredGlass.outer,
      overflow: "hidden",
    },
    cardTopBar: { height: 4 },
    cardMain:   { padding: 16 },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
    machineRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    machineIconBg: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    machineName:{ fontSize: 17, fontWeight: "900", color: LP.Text.primary, letterSpacing: -0.5 },
    machineUser:{ fontSize: 11, color: LP.Text.soft, fontWeight: "600", marginTop: 1 },
    statusBadge:{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 4 },
    statusText: { fontSize: 11, fontWeight: "700" },
    timeRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    timeText:   { fontSize: 13, color: LP.Text.muted, fontWeight: "600", lineHeight: 18 },
    statsChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip:       { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: LP.TechBlue[100], paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    chipTxt:    { fontSize: 12, fontWeight: "700", color: LP.Text.accent },

    emptyState:      { alignItems: "center", paddingVertical: 60, paddingHorizontal: 40 },
    emptyIconCircle: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 24, backgroundColor: LP.TechBlue[100], borderWidth: 1, borderColor: LP.Border.glass },
    emptyTitle:      { fontSize: 22, fontWeight: "800", color: LP.Text.primary, marginBottom: 8, letterSpacing: -0.5 },
    emptySubtitle:   { fontSize: 15, color: LP.Text.soft, textAlign: "center", lineHeight: 22 },
  });