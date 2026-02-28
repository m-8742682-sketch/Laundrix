import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, FlatList,
  Animated, Switch, Alert, TextInput, Dimensions,
  ActivityIndicator, StatusBar, Keyboard, Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/components/UserContext";
import { router } from "expo-router";
import { useI18n } from "@/i18n/i18n";
import { useAdminViewModel } from "@/viewmodels/tabs/AdminViewModel";
import { SafeAreaView } from "react-native-safe-area-context";
import Avatar, { resolveAvatar } from "@/components/Avatar";
import { useIncidentHandler } from "@/services/useIncidentHandler";
import { useAdminGracePeriods } from "@/services/useAdminGracePeriods";
import IncidentModal from "@/components/incident/IncidentModal";

const { width } = Dimensions.get("window");

// Floating bubble — identical to queue.tsx & conversations.tsx
const Bubble = ({ delay, size, color, position }: {
  delay: number; size: number; color: string;
  position: { top?: number; left?: number; right?: number; bottom?: number };
}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 4000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 4000 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.2, duration: 3000 + Math.random() * 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,   duration: 3000 + Math.random() * 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])).start();
  }, []);
  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  return (
    <Animated.View style={[styles.bubble, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, ...position,
      transform: [{ translateY }, { scale: scaleAnim }],
    }]} />
  );
};

export default function AdminConsoleScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const vm = useAdminViewModel(user?.uid || "unknown");
  const [activeTab, setActiveTab] = useState<string>("");
  const tabs = [t.adminTabAnalytics, t.adminTabRecords, t.adminTabIncidents, t.adminTabIoT, t.adminTabUsers];
  useEffect(() => { if (!activeTab) setActiveTab(t.adminTabAnalytics); }, [t.adminTabAnalytics]);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // 🔥 ADMIN: See ALL pending incidents across all machines
  const {
    incident,
    loading: incidentLoading,
    handleNotMe,
    handleThatsMe,
  } = useIncidentHandler({ userId: user?.uid, isAdmin: true });

  // 🔔 ADMIN: Watch ALL active grace periods across every machine (no ringing, just banner)
  const adminGracePeriods = useAdminGracePeriods(user?.uid);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [user]);

  useEffect(() => {
    const timer = setTimeout(() => vm.setSearchQuery(localSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [localSearchQuery]);

  const handleDeleteUser = useCallback((userId: string) => {
    Alert.alert(t.adminDeleteUserTitle, t.adminDeleteUserBody, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => vm.deleteUser(userId) },
    ]);
  }, [vm]);

  const handleExport = useCallback((format: "csv" | "txt" | "xlsx" | "pdf") => {
    Alert.alert(t.adminExportTitle, `${t.adminExportBody} ${format.toUpperCase()}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Export", onPress: () => router.push({ pathname: "/admin/export", params: { format } }) },
    ]);
  }, []);

  // ── Grace Banners (admin only, no ringing) ────────────────────────────────
  const formatGraceTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const renderGraceBanners = () => {
    if (!adminGracePeriods.length) return null;
    return (
      <View style={styles.graceBannerContainer}>
        {adminGracePeriods.map((gp) => {
          const isUrgent = gp.secondsLeft <= 60;
          const isWarning = gp.secondsLeft <= 180;
          const colors: [string, string] = isUrgent
            ? ["#EF4444", "#DC2626"]
            : isWarning
            ? ["#F59E0B", "#D97706"]
            : ["#10B981", "#059669"];
          return (
            <Pressable
              key={gp.machineId}
              onPress={() => router.push({ pathname: "/(tabs)/queue", params: { machineId: gp.machineId } })}
            >
              <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.graceBannerRow}
              >
                <Ionicons name="timer-outline" size={18} color="#fff" />
                <View style={styles.graceBannerInfo}>
                  <Text style={styles.graceBannerTitle}>
                    {isUrgent ? "⚠️ Urgent — " : "⏳ Grace Active — "}
                    <Text style={styles.graceBannerName}>{gp.userName}</Text>
                  </Text>
                  <Text style={styles.graceBannerSub}>
                    {`Machine ${gp.machineId} · ${formatGraceTime(gp.secondsLeft)} remaining`}
                  </Text>
                </View>
                <Text style={styles.graceBannerTimer}>{formatGraceTime(gp.secondsLeft)}</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            </Pressable>
          );
        })}
      </View>
    );
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.headerLeft}>
        <Text style={styles.overline}>Admin</Text>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={10} color="#059669" />
          <Text style={styles.adminBadgeText}>PRIVILEGED</Text>
        </View>
      </View>
      <Pressable onPress={() => router.back()} style={styles.closeBtn}>
        <Ionicons name="close" size={22} color="#64748b" />
      </Pressable>
    </Animated.View>
  );

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const renderTabs = () => (
    <Animated.View style={[styles.tabContainer, { opacity: fadeAnim }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <Pressable key={tab} onPress={() => { Keyboard.dismiss(); setActiveTab(tab); }}>
              {isActive ? (
                <LinearGradient colors={["#6366F1","#4F46E5"]} style={styles.tabActive}>
                  <Text style={styles.tabTextActive}>{tab}</Text>
                </LinearGradient>
              ) : (
                <View style={styles.tabInactive}>
                  <Text style={styles.tabText}>{tab}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  // ── Analytics ─────────────────────────────────────────────────────────────
  const renderAnalytics = () => {
    const totalSessions = vm.records.length;
    const totalUsers    = vm.allUsers.length;
    const totalMachines = vm.machines.length;
    const activeUsers   = vm.userEngagement;
    const avgSession    = totalSessions > 0 ? Math.round(vm.records.reduce((s,r) => s + (r.duration||0), 0) / totalSessions) : 0;
    const last7Days     = vm.dailyStats.slice(-7);
    const maxDaily      = Math.max(...last7Days.map(d => d.count), 1);
    const completionRate= totalSessions > 0 ? Math.round((vm.records.filter(r => r.status==="Normal").length / totalSessions) * 100) : 0;

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.kpiGrid}>
          <KPICard label={t.adminSessions} value={totalSessions}    icon="bar-chart" colors={["#22D3EE","#06B6D4"]} />
          <KPICard label={t.adminUsers}    value={totalUsers}       icon="people"    colors={["#6366F1","#4F46E5"]} />
          <KPICard label={t.adminActive}   value={activeUsers}      icon="pulse"     colors={["#10B981","#059669"]} />
          <KPICard label={t.adminAvgTime} value={`${avgSession}m`} icon="timer"     colors={["#F59E0B","#D97706"]} />
        </View>

        {/* Chart card — glass style */}
        <View style={styles.glassCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.cardSectionTitle}>Usage (7 Days)</Text>
            <View style={styles.liveBadge}><Text style={styles.liveBadgeText}>Live</Text></View>
          </View>
          {last7Days.length > 0 ? (
            <View style={styles.barChartContainer}>
              {last7Days.map((day, idx) => {
                const barHeight = maxDaily > 0 ? (day.count / maxDaily) * 100 : 0;
                return (
                  <View key={idx} style={styles.barColumn}>
                    <View style={styles.barWrapper}>
                      <View style={[styles.bar, { height: `${barHeight}%` as any }]}>
                        <LinearGradient colors={["#6366F1","#4F46E5"]} style={styles.barFill} />
                      </View>
                    </View>
                    <Text style={styles.barLabel}>{new Date(day.date).toLocaleDateString("en",{weekday:"short"}).charAt(0)}</Text>
                  </View>
                );
              })}
            </View>
          ) : <Text style={styles.noDataText}>No data</Text>}
        </View>

        {/* Health card */}
        <View style={styles.glassCard}>
          <Text style={styles.cardSectionTitle}>System Health</Text>
          <View style={{ marginTop: 12 }}>
            <View style={styles.healthRow}>
              <Text style={styles.healthLabel}>Completion Rate</Text>
              <Text style={[styles.healthValue, { color: "#10B981" }]}>{completionRate}%</Text>
            </View>
            <View style={styles.healthBarBg}>
              <LinearGradient colors={["#10B981","#059669"]} style={[styles.healthBarFill, { width: `${completionRate}%` as any }]} />
            </View>
          </View>
        </View>

        <View style={styles.exportRow}>
          {(["csv","txt","xlsx","pdf"] as const).map((fmt) => (
            <Pressable key={fmt} style={styles.exportBtn} onPress={() => handleExport(fmt)}>
              <LinearGradient
                colors={fmt==="csv"?["#22D3EE","#06B6D4"]:fmt==="txt"?["#8B5CF6","#7C3AED"]:fmt==="xlsx"?["#10B981","#059669"]:["#F59E0B","#D97706"]}
                style={styles.exportGradient}
              >
                <Ionicons name={fmt==="pdf"?"document-text":"document"} size={14} color="#fff" />
                <Text style={styles.exportBtnText}>{fmt.toUpperCase()}</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  };

  // ── Records ───────────────────────────────────────────────────────────────
  const renderRecords = () => (
    <FlatList
      data={vm.records}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="document-text-outline" title={t.adminNoRecords} />}
      renderItem={({ item }) => (
        <View style={styles.glassCard}>
          <View style={styles.recordHeader}>
            <View style={styles.iconBox}>
              <LinearGradient colors={["#6366F1","#4F46E5"]} style={styles.iconGradient}>
                <Ionicons name="hardware-chip" size={18} color="#fff" />
              </LinearGradient>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.recordTitle}>{item.machineId}</Text>
              <Text style={styles.recordSub}>User: {item.user}</Text>
            </View>
            <View style={[styles.statusPill, getStatusStyle(item.status).bg]}>
              <Text style={[styles.statusPillText, getStatusStyle(item.status).text]}>{item.status}</Text>
            </View>
          </View>
          <View style={styles.recordDetails}>
            <View style={styles.detailChip}><Ionicons name="timer-outline" size={12} color="#64748b" /><Text style={styles.detailChipText}>{item.duration}m</Text></View>
            <View style={styles.detailChip}><Ionicons name="scale-outline" size={12} color="#64748b" /><Text style={styles.detailChipText}>{item.load}kg</Text></View>
          </View>
        </View>
      )}
    />
  );

  // ── Incidents ─────────────────────────────────────────────────────────────
  const renderIncidents = () => (
    <FlatList
      data={vm.incidents}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="shield-checkmark-outline" title={t.adminNoIncidents} subtitle={t.adminAllSystemsClear} />}
      renderItem={({ item }) => {
        const cfg = getIncidentConfig(item.type);
        return (
          <View style={styles.glassCard}>
            <View style={styles.recordHeader}>
              <View style={[styles.incidentIconCircle, { backgroundColor: cfg.bgColor }]}>
                <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.recordTitle}>{cfg.label}</Text>
                <Text style={styles.recordSub}>Machine: {item.machine}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: cfg.bgColor }]}>
                <Text style={[styles.statusPillText, { color: cfg.color }]}>{item.type.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.incidentDivider} />
            <View style={styles.incidentFooter}>
              <View style={styles.detailChip}><Ionicons name="person" size={12} color="#94a3b8" /><Text style={styles.detailChipText}>{item.user}</Text></View>
              <View style={styles.detailChip}><Ionicons name="time"   size={12} color="#94a3b8" /><Text style={styles.detailChipText}>{item.date}</Text></View>
            </View>
          </View>
        );
      }}
    />
  );

  // ── IoT Control ───────────────────────────────────────────────────────────
  const renderIoT = () => (
    <FlatList
      data={vm.machines}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState icon="hardware-chip-outline" title={t.adminNoMachines} />}
      renderItem={({ item }) => (
        <View style={styles.glassCard}>
          <View style={styles.iotHeader}>
            <View style={styles.iotTitleRow}>
              <View style={[styles.machineIconBox, { backgroundColor: item.isLive ? "#ECFDF5" : "#F1F5F9" }]}>
                <Text style={{ fontSize: 20 }}>🧺</Text>
              </View>
              <View>
                <Text style={styles.recordTitle}>{item.name}</Text>
                <Text style={styles.recordSub}>{item.status}</Text>
              </View>
            </View>
            <View style={[styles.liveTag, { backgroundColor: item.isLive ? "#D1FAE5" : "#F1F5F9" }]}>
              <View style={[styles.liveDot, { backgroundColor: item.isLive ? "#10B981" : "#94a3b8" }]} />
              <Text style={[styles.liveTagText, { color: item.isLive ? "#059669" : "#64748b" }]}>{item.isLive ? "LIVE" : "OFF"}</Text>
            </View>
          </View>
          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <Ionicons name="scale-outline" size={18} color="#6366F1" />
              <Text style={styles.dataValue}>{typeof item.load==="number" ? item.load.toFixed(2) : "0.00"}</Text>
              <Text style={styles.dataUnit}>kg</Text>
            </View>
            <View style={styles.dataDivider} />
            <View style={styles.dataItem}>
              <Ionicons name="pulse" size={18} color="#22D3EE" />
              <Text style={styles.dataValue}>{item.vibration ?? 0}</Text>
              <Text style={styles.dataUnit}>%</Text>
            </View>
          </View>
          <View style={styles.controlGrid}>
            <View style={styles.controlItem}>
              <Ionicons name={item.locked ? "lock-closed" : "lock-open"} size={16} color={item.locked ? "#EF4444" : "#10B981"} />
              <Text style={styles.controlLabel}>Lock</Text>
              <Switch value={item.locked} onValueChange={val => vm.toggleMachineControl(item.id,"locked",val)} trackColor={{ false:"#e2e8f0", true:"#EF4444" }} thumbColor="#fff" />
            </View>
            <View style={styles.controlItem}>
              <Ionicons name={item.buzzer ? "volume-high" : "volume-mute"} size={16} color={item.buzzer ? "#8B5CF6" : "#94a3b8"} />
              <Text style={styles.controlLabel}>Buzzer</Text>
              <Switch value={item.buzzer} onValueChange={val => vm.toggleMachineControl(item.id,"buzzerState",val)} trackColor={{ false:"#e2e8f0", true:"#8B5CF6" }} thumbColor="#fff" />
            </View>
          </View>
        </View>
      )}
    />
  );

  // ── Users ─────────────────────────────────────────────────────────────────
  const renderUsers = () => (
    <FlatList
      data={vm.users}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View style={styles.searchWrapper}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#94a3b8" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.adminSearchUsersPlaceholder}
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
      ListEmptyComponent={<EmptyState icon="people-outline" title={t.adminNoUsers} />}
      renderItem={({ item }) => (
        <View style={styles.glassCard}>
          <View style={styles.userInfo}>
            <View style={{ marginRight: 12 }}>
              <Avatar {...resolveAvatar({ name: item.name, avatarUrl: item.avatarUrl })} size={48} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.userName}>{item.name}</Text>
                {item.isAdmin && <View style={styles.miniBadge}><Text style={styles.miniBadgeText}>ADMIN</Text></View>}
              </View>
              <Text style={styles.recordSub}>{item.email}</Text>
              <Text style={styles.userSubSmall}>ID: {item.id}</Text>
              <Text style={styles.userSubSmall}>Contact: {item.contact}</Text>
            </View>
          </View>
          <View style={styles.userActions}>
            <Pressable style={styles.userActionBtn} onPress={() => vm.toggleAdmin(item.id, !item.isAdmin)}>
              <LinearGradient colors={item.isAdmin?["#F59E0B","#D97706"]:["#6366F1","#4F46E5"]} style={styles.userActionGradient}>
                <Text style={styles.userActionText}>{item.isAdmin ? "Demote" : "Promote"}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.deleteBtn} onPress={() => handleDeleteUser(item.id)}>
              <Ionicons name="trash" size={16} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      )}
    />
  );

  const renderContent = () => {
    if (vm.loading) return (
      <View style={styles.center}>
        <LinearGradient colors={["#6366F1","#4F46E5"]} style={styles.loaderIcon}>
          <Ionicons name="shield-checkmark" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>Loading Console...</Text>
      </View>
    );
    if (activeTab === t.adminTabAnalytics) return renderAnalytics();
    if (activeTab === t.adminTabRecords)    return renderRecords();
    if (activeTab === t.adminTabIncidents)  return renderIncidents();
    if (activeTab === t.adminTabIoT)        return renderIoT();
    if (activeTab === t.adminTabUsers)      return renderUsers();
    return null;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Background — identical to queue/conversations */}
      <View style={styles.backgroundContainer}>
        <LinearGradient colors={["#fafaff","#f0f4ff","#e0e7ff","#dbeafe"]} locations={[0,0.3,0.7,1]} style={styles.gradientBackground} />
        <Bubble delay={0}    size={260} color="rgba(99,102,241,0.08)"  position={{ top: -80,    right: -60 }} />
        <Bubble delay={1000} size={180} color="rgba(14,165,233,0.06)"  position={{ top: 80,     left: -40  }} />
        <Bubble delay={2000} size={140} color="rgba(139,92,246,0.07)"  position={{ top: 350,    right: -30 }} />
        <Bubble delay={1500} size={100} color="rgba(16,185,129,0.05)"  position={{ bottom: 200, left: 20   }} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {renderHeader()}
        {renderTabs()}
        {renderGraceBanners()}
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
          {renderContent()}
        </Animated.View>
      </SafeAreaView>

      {/* 🔥 ADMIN INCIDENT MODAL: shows ALL unauthorized access incidents */}
      <IncidentModal
        visible={!!incident}
        machineId={incident?.machineId || ""}
        intruderName={incident?.intruderName || "Someone"}
        secondsLeft={incident?.secondsLeft || 0}
        onThatsMe={handleThatsMe}
        onNotMe={handleNotMe}
        loading={incidentLoading}
      />
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const KPICard = ({ label, value, icon, colors }: any) => (
  <View style={styles.kpiCard}>
    <LinearGradient colors={colors} style={styles.kpiGradient}>
      <View style={styles.kpiIconBox}><Ionicons name={icon} size={16} color="#fff" /></View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </LinearGradient>
  </View>
);

const EmptyState = ({ icon, title, subtitle }: any) => (
  <View style={styles.emptyState}>
    <LinearGradient colors={["#E0E7FF","#C7D2FE"]} style={styles.emptyIconCircle}>
      <Ionicons name={icon} size={36} color="#4F46E5" />
    </LinearGradient>
    <Text style={styles.emptyTitle}>{title}</Text>
    {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
  </View>
);

const getStatusStyle = (status: string) => {
  switch (status) {
    case "Normal":       return { bg: { backgroundColor: "#ECFDF5" }, text: { color: "#059669" } };
    case "Unauthorized": return { bg: { backgroundColor: "#FEF2F2" }, text: { color: "#DC2626" } };
    default:             return { bg: { backgroundColor: "#FFFBEB" }, text: { color: "#D97706" } };
  }
};

const getIncidentConfig = (type: string) => {
  switch (type) {
    case "Unauthorized": return { label: "Unauthorized Access", icon: "warning",     color: "#DC2626", bgColor: "#FEF2F2" };
    case "Overload":     return { label: "Machine Overload",    icon: "alert-circle", color: "#D97706", bgColor: "#FFFBEB" };
    default:             return { label: "System Incident",     icon: "information-circle", color: "#6366F1", bgColor: "#EEF2FF" };
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaff" },
  // Grace banner styles
  graceBannerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  graceBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  graceBannerInfo: { flex: 1 },
  graceBannerTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  graceBannerName: {
    fontWeight: "900",
  },
  graceBannerSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  graceBannerTimer: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { fontSize: 15, color: "#6366F1", fontWeight: "700", marginTop: 12 },

  backgroundContainer: { position: "absolute", width: "100%", height: "100%", overflow: "hidden" },
  gradientBackground:  { position: "absolute", width: "100%", height: "100%" },
  bubble:              { position: "absolute", opacity: 0.4 },

  // Header
  header:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  headerLeft:     { flexDirection: "row", alignItems: "center", gap: 12 },
  overline:       { fontSize: 25, fontWeight: "800", color: "#0b0b0b", textTransform: "uppercase", letterSpacing: 1 },
  adminBadge:     { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(16,185,129,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: "rgba(16,185,129,0.2)" },
  adminBadgeText: { fontSize: 9, fontWeight: "800", color: "#059669", letterSpacing: 0.5 },
  closeBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(241,245,249,1)", alignItems: "center", justifyContent: "center" },

  // Tabs — same pill style as queue/conversations filter chips
  tabContainer: { paddingVertical: 8 },
  tabScroll:    { paddingHorizontal: 20, gap: 8 },
  tabActive:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  tabInactive:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.8)" },
  tabText:      { fontWeight: "700", color: "#64748b", fontSize: 13 },
  tabTextActive:{ fontWeight: "700", color: "#fff",    fontSize: 13 },

  contentWrapper: { flex: 1 },
  scrollContent:  { paddingHorizontal: 20, paddingBottom: 100 },
  listContent:    { paddingHorizontal: 20, paddingBottom: 100 },

  // KPI
  kpiGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  kpiCard:    { width: (width/2)-26, height: 120, borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 },
  kpiGradient:{ flex: 1, padding: 16, justifyContent: "space-between" },
  kpiIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  kpiValue:   { fontSize: 26, fontWeight: "800", color: "#fff" },
  kpiLabel:   { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.8)", textTransform: "uppercase" },

  // Glass card — matches queue/conversations item style
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20, marginBottom: 12, padding: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.8)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },

  // Card section title
  cardSectionTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },

  // Chart
  chartHeader:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  liveBadge:        { backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  liveBadgeText:    { fontSize: 10, fontWeight: "700", color: "#4F46E5" },
  barChartContainer:{ flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end", height: 100 },
  barColumn:        { alignItems: "center", flex: 1, height: "100%", justifyContent: "flex-end" },
  barWrapper:       { width: "100%", height: 80, justifyContent: "flex-end", alignItems: "center" },
  bar:              { width: "50%", borderRadius: 6, overflow: "hidden" },
  barFill:          { flex: 1 },
  barLabel:         { fontSize: 10, fontWeight: "600", color: "#94a3b8", marginTop: 6 },
  noDataText:       { textAlign: "center", color: "#94a3b8", paddingVertical: 20 },

  // Health
  healthRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  healthLabel:  { fontSize: 13, fontWeight: "600", color: "#334155" },
  healthValue:  { fontSize: 14, fontWeight: "800" },
  healthBarBg:  { height: 6, backgroundColor: "#E2E8F0", borderRadius: 3, overflow: "hidden" },
  healthBarFill:{ height: "100%", borderRadius: 3 },

  // Export
  exportRow:     { flexDirection: "row", gap: 8, marginBottom: 20 },
  exportBtn:     { flex: 1, borderRadius: 12, overflow: "hidden" },
  exportGradient:{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 6 },
  exportBtnText: { color: "#fff", fontWeight: "700", fontSize: 11 },

  // Shared row parts
  recordHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  iconBox:      { borderRadius: 12, overflow: "hidden" },
  iconGradient: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  recordTitle:  { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  recordSub:    { fontSize: 12, color: "#64748b", marginTop: 2 },
  recordDetails:{ flexDirection: "row", gap: 10, flexWrap: "wrap" },
  detailChip:   { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F8FAFC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  detailChipText:{ fontSize: 12, color: "#64748b", fontWeight: "600" },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText:{ fontSize: 11, fontWeight: "700" },

  // Incidents
  incidentIconCircle:{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  incidentDivider:   { height: 1, backgroundColor: "rgba(241,245,249,1)", marginVertical: 10 },
  incidentFooter:    { flexDirection: "row", justifyContent: "space-between" },

  // IoT
  iotHeader:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  iotTitleRow:   { flexDirection: "row", alignItems: "center" },
  machineIconBox:{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  liveTag:       { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveDot:       { width: 8, height: 8, borderRadius: 4 },
  liveTagText:   { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  dataGrid:      { flexDirection: "row", justifyContent: "space-around", backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, marginBottom: 14 },
  dataItem:      { alignItems: "center" },
  dataDivider:   { width: 1, backgroundColor: "#E2E8F0" },
  dataValue:     { fontSize: 18, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  dataUnit:      { fontSize: 10, color: "#64748b", fontWeight: "600" },
  controlGrid:   { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "rgba(241,245,249,1)", paddingTop: 12 },
  controlItem:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 8 },
  controlLabel:  { fontSize: 12, fontWeight: "700", color: "#334155", flex: 1 },

  // Users
  searchWrapper: { marginBottom: 16 },
  searchBar:     { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)" },
  searchInput:   { flex: 1, fontSize: 15, fontWeight: "600", color: "#0f172a" },
  userInfo:      { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  userName:      { fontWeight: "700", fontSize: 15, color: "#0f172a" },
  userSubSmall:  { fontSize: 11, color: "#94a3b8", marginTop: 1 },
  miniBadge:     { backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  miniBadgeText: { fontSize: 8, fontWeight: "800", color: "#4F46E5" },
  userActions:   { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  userActionBtn: { borderRadius: 10, overflow: "hidden" },
  userActionGradient: { paddingHorizontal: 12, paddingVertical: 8 },
  userActionText:{ fontSize: 11, fontWeight: "700", color: "#fff" },
  deleteBtn:     { padding: 8, backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(254,202,202,1)" },

  // Empty
  emptyState:      { alignItems: "center", paddingVertical: 50 },
  emptyIconCircle: { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle:      { fontSize: 18, fontWeight: "800", color: "#0f172a", marginBottom: 4 },
  emptySubtitle:   { fontSize: 13, color: "#94a3b8", textAlign: "center" },

  // Loader
  loaderIcon: { width: 70, height: 70, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 12 },
});