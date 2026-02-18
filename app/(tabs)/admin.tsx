import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList, Animated, Switch, Alert, TextInput, Dimensions, ActivityIndicator, StatusBar, Keyboard,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/components/UserContext";
import { router } from "expo-router";
import { useAdminViewModel } from "@/viewmodels/tabs/AdminViewModel";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar, { resolveAvatar } from "@/components/Avatar";

const { width } = Dimensions.get("window");
const TABS = ["Analytics", "Records", "Incidents", "IoT Control", "Users"];

export default function AdminConsoleScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const vm = useAdminViewModel(user?.uid || "unknown");

  const [activeTab, setActiveTab] = useState("Analytics");
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 4000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => vm.setSearchQuery(localSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  const handleDeleteUser = useCallback((userId: string) => {
    Alert.alert("Delete User?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => vm.deleteUser(userId) },
    ]);
  }, [vm]);

  const handleExport = useCallback((format: "csv" | "txt" | "xlsx" | "pdf") => {
    Alert.alert("Export Data", `Export as ${format.toUpperCase()}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Export", onPress: () => router.push({ pathname: "/admin/export", params: { format } }) }
    ]);
  }, []);

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.headerLeft}>
        <Text style={styles.title}>Admin</Text>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={10} color="#059669" />
          <Text style={styles.adminBadgeText}>PRIVILEGED</Text>
        </View>
      </View>
      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <Ionicons name="close" size={24} color="#64748b" />
      </Pressable>
    </Animated.View>
  );

  const renderTabs = () => (
    <Animated.View style={[styles.tabContainer, { opacity: fadeAnim }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => { Keyboard.dismiss(); setActiveTab(tab); }}
            style={({ pressed }) => [styles.tabWrapper, pressed && { opacity: 0.7 }]}
          >
            {activeTab === tab && <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.activeTabBg} />}
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Animated.View>
  );

  // ============================================
  // 1. ANALYTICS
  // ============================================
  const renderAnalytics = () => {
    const totalSessions = vm.records.length;
    const totalUsers = vm.allUsers.length;
    const totalMachines = vm.machines.length;
    const activeUsers = vm.userEngagement;
    const averageSessionLength = totalSessions > 0 ? Math.round(vm.records.reduce((sum, r) => sum + (r.duration || 0), 0) / totalSessions) : 0;
    const last7Days = vm.dailyStats.slice(-7);
    const maxDaily = Math.max(...last7Days.map((d) => d.count), 1);
    const completionRate = totalSessions > 0 ? Math.round((vm.records.filter(r => r.status === "Normal").length / totalSessions) * 100) : 0;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.kpiGrid}>
          <KPICard label="Sessions" value={totalSessions} icon="bar-chart" colors={["#22D3EE", "#06B6D4"]} />
          <KPICard label="Users" value={totalUsers} icon="people" colors={["#6366F1", "#4F46E5"]} />
          <KPICard label="Active" value={activeUsers} icon="pulse" colors={["#10B981", "#059669"]} />
          <KPICard label="Avg Time" value={`${averageSessionLength}m`} icon="timer" colors={["#F59E0B", "#D97706"]} />
        </View>

        <View style={styles.chartCard}>
          <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.chartGradient}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Usage (7 Days)</Text>
              <View style={styles.chartBadge}><Text style={styles.chartBadgeText}>Live</Text></View>
            </View>
            {last7Days.length > 0 ? (
              <View style={styles.barChartContainer}>
                {last7Days.map((day, idx) => {
                  const barHeight = maxDaily > 0 ? (day.count / maxDaily) * 100 : 0;
                  return (
                    <View key={idx} style={styles.barColumn}>
                      <View style={styles.barWrapper}>
                        <View style={[styles.bar, { height: `${barHeight}%` }]}>
                          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.barFill} />
                        </View>
                      </View>
                      <Text style={styles.barLabel}>{new Date(day.date).toLocaleDateString('en', { weekday: 'short' }).charAt(0)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : <Text style={styles.noDataText}>No data</Text>}
          </LinearGradient>
        </View>

        <View style={styles.healthCard}>
           <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.healthGradient}>
              <Text style={styles.healthTitle}>System Health</Text>
              <View style={styles.healthMetric}>
                <View style={styles.healthRow}>
                  <Text style={styles.healthLabel}>Completion Rate</Text>
                  <Text style={[styles.healthValue, { color: "#10B981" }]}>{completionRate}%</Text>
                </View>
                <View style={styles.healthBarBg}>
                   <LinearGradient colors={["#10B981", "#059669"]} style={[styles.healthBarFill, { width: `${completionRate}%` }]} />
                </View>
              </View>
           </LinearGradient>
        </View>

        <View style={styles.exportRow}>
           {["csv", "txt", "xlsx", "pdf"].map((fmt) => (
             <Pressable key={fmt} style={styles.exportBtn} onPress={() => handleExport(fmt as any)}>
               <LinearGradient 
                 colors={fmt === 'csv' ? ["#22D3EE", "#06B6D4"] : fmt === 'txt' ? ["#8B5CF6", "#7C3AED"] : fmt === 'xlsx' ? ["#10B981", "#059669"] : ["#F59E0B", "#D97706"]} 
                 style={styles.exportGradient}
               >
                 <Ionicons name={fmt === 'pdf' ? 'document-text' : 'document'} size={14} color="#fff" />
                 <Text style={styles.exportBtnText}>{fmt.toUpperCase()}</Text>
               </LinearGradient>
             </Pressable>
           ))}
        </View>
      </ScrollView>
    );
  };

  // ============================================
  // 2. RECORDS
  // ============================================
  const renderRecords = () => (
    <FlatList
      data={vm.records}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="document-text-outline" title="No Records" />}
      renderItem={({ item }) => (
        <View style={styles.recordCard}>
          <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.cardInner}>
            <View style={styles.recordHeader}>
              <View style={styles.recordIconBox}>
                <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.iconGradient}>
                  <Ionicons name="hardware-chip" size={18} color="#fff" />
                </LinearGradient>
              </View>
              <View style={styles.recordInfo}>
                <Text style={styles.recordTitle}>{item.machineId}</Text>
                <Text style={styles.recordSub}>User: {item.user}</Text>
              </View>
              <View style={[styles.statusPill, getStatusStyle(item.status).bg]}>
                <Text style={[styles.statusPillText, getStatusStyle(item.status).text]}>{item.status}</Text>
              </View>
            </View>
            <View style={styles.recordDetails}>
              <View style={styles.recordDetailItem}>
                <Ionicons name="timer-outline" size={12} color="#64748b" />
                <Text style={styles.recordDetailText}>{item.duration}m</Text>
              </View>
              <View style={styles.recordDetailItem}>
                <Ionicons name="scale-outline" size={12} color="#64748b" />
                <Text style={styles.recordDetailText}>{item.load}kg</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    />
  );

  // ============================================
  // 3. INCIDENTS (REDESIGNED)
  // ============================================
  const renderIncidents = () => (
    <FlatList
      data={vm.incidents}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title="No Incidents" subtitle="All systems clear" />}
      renderItem={({ item }) => {
        const config = getIncidentConfig(item.type);
        return (
          <View style={styles.incidentCard}>
            <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.incidentCardInner}>
              <View style={styles.incidentHeaderRow}>
                 <View style={[styles.incidentIconCircle, { backgroundColor: config.bgColor }]}>
                    <Ionicons name={config.icon as any} size={20} color={config.color} />
                 </View>
                 <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.incidentTitleText}>{config.label}</Text>
                    <Text style={styles.incidentSubText}>Machine: {item.machine}</Text>
                 </View>
                 <View style={[styles.incidentBadge, { backgroundColor: config.bgColor }]}>
                    <Text style={[styles.incidentBadgeText, { color: config.color }]}>{item.type.toUpperCase()}</Text>
                 </View>
              </View>
              
              <View style={styles.incidentDivider} />

              <View style={styles.incidentFooter}>
                 <View style={styles.incidentFooterItem}>
                    <Ionicons name="person" size={12} color="#94a3b8" />
                    <Text style={styles.incidentFooterText}>User: {item.user}</Text>
                 </View>
                 <View style={styles.incidentFooterItem}>
                    <Ionicons name="time" size={12} color="#94a3b8" />
                    <Text style={styles.incidentFooterText}>{item.date}</Text>
                 </View>
              </View>
            </LinearGradient>
          </View>
        );
      }}
    />
  );

  // ============================================
  // 4. IOT CONTROL (FIXED FORMATS)
  // ============================================

  const renderIoT = () => (
    <FlatList
      data={vm.machines}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="hardware-chip-outline" title="No Machines" />}
      renderItem={({ item }) => (
        <View style={styles.iotCard}>
          <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.cardInner}>
            {/* Header with Live Status */}
            <View style={styles.iotHeader}>
              <View style={styles.iotTitleRow}>
                <View style={[styles.machineIconBox, { backgroundColor: item.isLive ? "#ECFDF5" : "#F1F5F9" }]}>
                  <Text style={styles.machineEmoji}>🧺</Text>
                </View>
                <View>
                  <Text style={styles.iotMachineName}>{item.name}</Text>
                  <Text style={styles.iotSubText}>{item.status}</Text>
                </View>
              </View>
              <View style={[styles.liveBadge, { backgroundColor: item.isLive ? "#D1FAE5" : "#F1F5F9" }]}>
                <View style={[styles.liveDot, { backgroundColor: item.isLive ? "#10B981" : "#94a3b8" }]} />
                <Text style={[styles.liveText, { color: item.isLive ? "#059669" : "#64748b" }]}>
                  {item.isLive ? "LIVE" : "OFF"}
                </Text>
              </View>
            </View>

            {/* Data Grid - Formatted correctly */}
            <View style={styles.dataGrid}>
              <View style={styles.dataItem}>
                <Ionicons name="scale-outline" size={18} color="#6366F1" />
                <Text style={styles.dataValue}>
                  {typeof item.load === 'number' ? item.load.toFixed(2) : "0.00"}
                </Text>
                <Text style={styles.dataLabel}>kg</Text>
              </View>
              <View style={styles.dataDivider} />
              <View style={styles.dataItem}>
                <Ionicons name="pulse" size={18} color="#22D3EE" />
                <Text style={styles.dataValue}>{item.vibration ?? 0}</Text>
                <Text style={styles.dataLabel}>%</Text>
              </View>
            </View>

            {/* Controls - Switches stay in position now */}
            <View style={styles.controlGrid}>
              <View style={styles.controlItem}>
                <Ionicons name={item.locked ? "lock-closed" : "lock-open"} size={16} color={item.locked ? "#EF4444" : "#10B981"} />
                <Text style={styles.controlLabel}>Lock</Text>
                <Switch 
                  value={item.locked} 
                  onValueChange={(val) => vm.toggleMachineControl(item.id, "locked", val)} 
                  trackColor={{ false: "#e2e8f0", true: "#EF4444" }} 
                  thumbColor="#fff" 
                />
              </View>
              <View style={styles.controlItem}>
                <Ionicons name={item.buzzer ? "volume-high" : "volume-mute"} size={16} color={item.buzzer ? "#8B5CF6" : "#94a3b8"} />
                <Text style={styles.controlLabel}>Buzzer</Text>
                <Switch 
                  value={item.buzzer} 
                  onValueChange={(val) => vm.toggleMachineControl(item.id, "buzzerState", val)} 
                  trackColor={{ false: "#e2e8f0", true: "#8B5CF6" }} 
                  thumbColor="#fff" 
                />
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    />
  );

  // ============================================
  // 5. USERS (FIXED FIELDS)
  // ============================================
  const renderUsers = () => (
    <FlatList
      data={vm.users}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#94a3b8"
              value={localSearchQuery}
              onChangeText={setLocalSearchQuery}
            />
            {localSearchQuery.length > 0 && (
              <Pressable onPress={() => setLocalSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </Pressable>
            )}
          </View>
        </View>
      }
      ListEmptyComponent={<EmptyState icon="people-outline" title="No Users" />}
      renderItem={({ item }) => (
        <View style={styles.userCard}>
          <LinearGradient colors={["#FFFFFF", "#F8FAFC"]} style={styles.cardInner}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Avatar {...resolveAvatar({ name: item.name, avatarUrl: item.avatarUrl })} size={48} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.isAdmin && (
                    <View style={styles.miniBadge}>
                      <Text style={styles.miniBadgeText}>ADMIN</Text>
                    </View>
                  )}
                </View>
                {/* FIX: Added Email, ID, Contact */}
                <Text style={styles.userSub}>{item.email}</Text>
                <Text style={styles.userSubSmall}>ID: {item.id}</Text>
                <Text style={styles.userSubSmall}>Contact: {item.contact}</Text>
              </View>
            </View>
            <View style={styles.userActions}>
              <Pressable style={styles.userActionBtn} onPress={() => vm.toggleAdmin(item.id, !item.isAdmin)}>
                <LinearGradient colors={item.isAdmin ? ["#F59E0B", "#D97706"] : ["#6366F1", "#4F46E5"]} style={styles.userActionGradient}>
                  <Text style={styles.userActionText}>{item.isAdmin ? "Demote" : "Promote"}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.deleteBtn} onPress={() => handleDeleteUser(item.id)}>
                <Ionicons name="trash" size={16} color="#EF4444" />
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      )}
    />
  );

  const renderContent = () => {
    if (vm.loading) {
      return (
        <View style={styles.center}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.loaderIcon}>
            <Ionicons name="shield-checkmark" size={32} color="#fff" />
          </LinearGradient>
          <Text style={styles.loadingText}>Loading Console...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case "Analytics": return renderAnalytics();
      case "Records": return renderRecords();
      case "Incidents": return renderIncidents();
      case "IoT Control": return renderIoT();
      case "Users": return renderUsers();
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      {/* Luxury Background */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorTriangle} />
      </View>

      {renderHeader()}
      {renderTabs()}
      
      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
        {renderContent()}
      </Animated.View>
    </View>
  );
}

// ============================================
// COMPONENTS & STYLES
// ============================================

const KPICard = ({ label, value, icon, colors }: any) => (
  <View style={styles.kpiCard}>
    <LinearGradient colors={colors} style={styles.kpiGradient}>
      <View style={styles.kpiIconBox}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </LinearGradient>
  </View>
);

const EmptyState = ({ icon, title, subtitle }: any) => (
  <View style={styles.emptyState}>
    <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.emptyIconCircle}>
      <Ionicons name={icon} size={36} color="#4F46E5" />
    </LinearGradient>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

const getStatusStyle = (status: string) => {
  switch (status) {
    case "Normal": return { bg: { backgroundColor: "#ECFDF5" }, text: { color: "#059669" } };
    case "Unauthorized": return { bg: { backgroundColor: "#FEF2F2" }, text: { color: "#DC2626" } };
    default: return { bg: { backgroundColor: "#FFFBEB" }, text: { color: "#D97706" } };
  }
};

const getIncidentConfig = (type: string) => {
  switch (type) {
    case "Unauthorized": 
      return { label: "Unauthorized Access", color: "#DC2626", bgColor: "#FEF2F2", icon: "warning" };
    case "Interrupted": 
      return { label: "Session Interrupted", color: "#D97706", bgColor: "#FFFBEB", icon: "pause-circle" };
    default: 
      return { label: "System Error", color: "#7C3AED", bgColor: "#F5F3FF", icon: "alert-circle" };
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Background
  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 350, height: 350, borderRadius: 175, backgroundColor: "#E0E7FF", opacity: 0.5, top: -100, right: -80 },
  decorCircle2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 100, left: -80 },
  decorTriangle: { position: "absolute", width: 180, height: 180, backgroundColor: "#ECFEFF", opacity: 0.3, top: "20%", right: -40, transform: [{ rotate: "45deg" }] },

  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 20 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 32, fontWeight: "800", color: "#0f172a", letterSpacing: -1 },
  adminBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#ECFDF5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  adminBadgeText: { fontSize: 9, fontWeight: "800", color: "#059669", letterSpacing: 0.5 },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },

  // Tabs
  tabContainer: { paddingVertical: 12, backgroundColor: "transparent" },
  tabScroll: { paddingHorizontal: 16, gap: 8 },
  tabWrapper: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, overflow: "hidden", backgroundColor: "#f1f5f9" },
  activeTabBg: { ...StyleSheet.absoluteFillObject },
  tabText: { fontWeight: "700", color: "#64748b", fontSize: 12 },
  tabTextActive: { color: "#fff" },

  // Content
  contentWrapper: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },

  // KPI
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  kpiCard: { width: (width / 2) - 26, height: 130, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 16, elevation: 8 },
  kpiGradient: { flex: 1, padding: 16, justifyContent: "space-between" },
  kpiIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  kpiValue: { fontSize: 28, fontWeight: "800", color: "#fff" },
  kpiLabel: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },

  // Chart
  chartCard: { borderRadius: 24, overflow: "hidden", marginBottom: 16, shadowColor: "#6366F1", shadowOpacity: 0.1, shadowRadius: 20, elevation: 8 },
  chartGradient: { padding: 20, borderWidth: 1, borderColor: "#f1f5f9" },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  chartTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  chartBadge: { backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  chartBadgeText: { fontSize: 10, fontWeight: "700", color: "#4F46E5" },
  barChartContainer: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: 100 },
  barColumn: { alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" },
  barWrapper: { width: "100%", height: 80, justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "50%", borderRadius: 6, overflow: "hidden" },
  barFill: { flex: 1 },
  barLabel: { fontSize: 10, fontWeight: "600", color: "#94a3b8", marginTop: 6 },
  noDataText: { textAlign: "center", color: "#94a3b8", paddingVertical: 20 },

  // Health
  healthCard: { borderRadius: 24, overflow: "hidden", marginBottom: 20 },
  healthGradient: { padding: 20 },
  healthTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 16 },
  healthMetric: { gap: 8 },
  healthRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  healthLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  healthValue: { fontSize: 14, fontWeight: "800" },
  healthBarBg: { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  healthBarFill: { height: "100%", borderRadius: 3 },

  // Export
  exportRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 20 },
  exportBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  exportGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6 },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },

  // Records
  recordCard: { marginBottom: 10, borderRadius: 20, overflow: "hidden", shadowColor: "#6366F1", shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  cardInner: { padding: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  recordHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  recordIconBox: { marginRight: 12, borderRadius: 12, overflow: "hidden" },
  iconGradient: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  recordInfo: { flex: 1 },
  recordTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  recordSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { fontSize: 10, fontWeight: "700" },
  recordDetails: { flexDirection: "row", gap: 12, marginTop: 8 },
  recordDetailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  recordDetailText: { fontSize: 11, color: "#64748b", fontWeight: "600" },

  // Incidents (New Design)
  incidentCard: { marginBottom: 12, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  incidentCardInner: { padding: 18, borderWidth: 1, borderColor: "#f1f5f9" },
  incidentHeaderRow: { flexDirection: "row", alignItems: "center" },
  incidentIconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  incidentTitleText: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  incidentSubText: { fontSize: 12, color: "#64748b", marginTop: 2 },
  incidentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  incidentBadgeText: { fontSize: 10, fontWeight: "700" },
  incidentDivider: { height: 1, backgroundColor: "#f1f5f9", marginVertical: 12 },
  incidentFooter: { flexDirection: "row", justifyContent: "space-between" },
  incidentFooterItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  incidentFooterText: { fontSize: 11, color: "#64748b", fontWeight: "600" },

  // IoT
  iotCard: { marginBottom: 12, borderRadius: 24, overflow: "hidden", shadowColor: "#6366F1", shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  iotHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  iotTitleRow: { flexDirection: "row", alignItems: "center" },
  machineIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  machineEmoji: { fontSize: 20 },
  iotMachineName: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  iotSubText: { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  dataGrid: { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, marginBottom: 14 },
  dataItem: { alignItems: "center" },
  dataDivider: { width: 1, backgroundColor: "#E2E8F0" },
  dataValue: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  dataLabel: { fontSize: 10, color: "#64748b", fontWeight: "600" },
  controlGrid: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#f1f5f9", paddingTop: 14 },
  controlItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 8 },
  controlLabel: { fontSize: 12, fontWeight: "700", color: "#334155", flex: 1 },

  // Users
  searchWrapper: { marginBottom: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" },
  userCard: { marginBottom: 10, borderRadius: 20, overflow: "hidden", shadowColor: "#6366F1", shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
  userInfo: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  userAvatar: { marginRight: 12 },
  userName: { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  userSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  userSubSmall: { fontSize: 10, color: "#94a3b8", marginTop: 1 },
  miniBadge: { backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 8, fontWeight: "800", color: "#4F46E5" },
  userActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  userActionBtn: { borderRadius: 10, overflow: "hidden" },
  userActionGradient: { paddingHorizontal: 12, paddingVertical: 8 },
  userActionText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  deleteBtn: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FECACA" },

  // Loading
  loaderIcon: { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  loadingText: { fontSize: 15, color: "#6366F1", fontWeight: "700" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 50 },
  emptyIconCircle: { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  emptySubtitle: { fontSize: 13, color: "#94a3b8", textAlign: "center" },
});