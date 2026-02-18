import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  StatusBar,
  Animated,
  RefreshControl,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@/components/UserContext";
import { router } from "expo-router";
import { useDashboardViewModel } from "@/viewmodels/tabs/DashboardViewModel";
import { useI18n } from "@/i18n/i18n";

// Import redesigned components
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardStatusCard from "@/components/dashboard/DashboardStatusCard";
import DashboardStats from "@/components/dashboard/DashboardStats";
import DashboardSlideshow from "@/components/dashboard/DashboardSlideShow";
import DashboardQuickActions from "@/components/dashboard/DashboardQuickActions";
import DashboardFooter from "@/components/dashboard/DashboardFooter";

const { width } = Dimensions.get("window");

export default function Dashboard() {
  const { user } = useUser();
  const { t } = useI18n();
  const {
    machines,
    stats,
    m001Status,
    queueCount,
    userQueuePosition,
    isUserTurn,
    hasActiveSession,
    activeSession,
    loading,
    refreshing,
    refresh,
    onScanPress,
    onJoinQueue,
    onViewMachines,
    onViewQueue,
    onViewNotifications,
    onViewSettings,
    onViewHelp,
    onViewAI,
    onViewPolicies,
  } = useDashboardViewModel();

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 600, 
      useNativeDriver: true 
    }).start();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={styles.loaderGradient}>
          <Ionicons name="water" size={32} color="#fff" />
        </LinearGradient>
        <Text style={styles.loadingText}>{t.loadingLaundrix || "Loading..."}</Text>
      </View>
    );
  }

  // Determine status card type
  let statusCardType: "active" | "turn" | "queue" | "none" = "none";
  if (hasActiveSession && activeSession) {
    statusCardType = "active";
  } else if (isUserTurn) {
    statusCardType = "turn";
  } else if (userQueuePosition && userQueuePosition > 0) {
    statusCardType = "queue";
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Subtle Background Decorations - Like Login Page */}
      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={refresh} 
            tintColor="#0EA5E9"
            colors={["#0EA5E9", "#0284C7"]} 
          />
        }
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          
          {/* Header - Clean Layout */}
          <DashboardHeader
            userName={user?.name || t.user || "User"}
            userAvatarUrl={user?.avatarUrl ?? null}
            onScanPress={onScanPress}
            onNotificationsPress={onViewNotifications}
            onSettingsPress={onViewSettings}
          />

          {/* Status Card - Glassmorphism */}
          <DashboardStatusCard
            type={statusCardType}
            progress={activeSession?.progress || 0}
            timeRemaining={activeSession?.timeRemaining || ""}
            machineId={activeSession?.machineId || "M001"}
            queuePosition={userQueuePosition}
            estimatedWait={queueCount > 0 ? `~${queueCount * 5} min` : ""}
            onActionPress={() => {
              if (statusCardType === "active") {
                router.push(`/iot/${activeSession?.machineId || "M001"}`);
              } else if (statusCardType === "turn") {
                onScanPress();
              } else if (statusCardType === "queue") {
                onViewQueue();
              } else {
                onViewMachines();
              }
            }}
          />

          {/* Laundry Stats - Clean Grid */}
          <DashboardStats
            available={stats.available}
            inUse={stats.inUse}
            clothesInside={machines.filter(m => m.currentLoad > 0).length}
            queueCount={queueCount}
            totalMachines={machines.length}
            onViewAllPress={onViewMachines}
          />

          {/* Slideshow - Glass Cards */}
          <DashboardSlideshow />

          {/* Available Machines Preview */}
          {!hasActiveSession && !userQueuePosition && (
            <View style={styles.machinesSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Available Machines</Text>
                <Pressable onPress={onViewMachines} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>View All</Text>
                  <Ionicons name="chevron-forward" size={16} color="#0EA5E9" />
                </Pressable>
              </View>
              
              <View style={styles.machinesList}>
                {machines
                  .filter(m => m.status === "Available")
                  .slice(0, 2)
                  .map((machine) => (
                    <View key={machine.machineId} style={styles.machineCard}>
                      <LinearGradient 
                        colors={["rgba(255,255,255,0.9)", "rgba(248,250,252,0.9)"]} 
                        style={styles.machineGradient}
                      >
                        <View style={styles.machineLeft}>
                          <View style={styles.machineIconContainer}>
                            <LinearGradient 
                              colors={["#0EA5E9", "#0284C7"]} 
                              style={styles.machineIcon}
                            >
                              <Ionicons name="water" size={18} color="#fff" />
                            </LinearGradient>
                          </View>
                          <View>
                            <Text style={styles.machineId}>{machine.machineId}</Text>
                            <View style={styles.statusBadge}>
                              <View style={styles.statusDot} />
                              <Text style={styles.statusText}>Available</Text>
                            </View>
                          </View>
                        </View>
                        
                        <Pressable 
                          onPress={() => router.push("/(tabs)/queue")} 
                          style={styles.joinBtn}
                        >
                          <LinearGradient 
                            colors={["#0EA5E9", "#0284C7"]} 
                            style={styles.joinGradient}
                          >
                            <Text style={styles.joinText}>Join</Text>
                          </LinearGradient>
                        </Pressable>
                      </LinearGradient>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Quick Actions - Clean Grid */}
          <DashboardQuickActions
            onViewMachines={onViewMachines}
            onJoinQueue={onJoinQueue}
            onScan={onScanPress}
            onChat={() => router.push("/(tabs)/conversations")}
          />

          {/* Footer */}
          <DashboardFooter
            onHelpPress={onViewHelp}
            onAIPress={onViewAI}
            onPoliciesPress={onViewPolicies}
          />

          <View style={{ height: 30 }} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loaderGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    fontWeight: "600",
  },
  // Background - Subtle like login page
  backgroundDecor: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  decorCircle1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -100,
    right: -100,
  },
  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 100,
    left: -50,
  },
  decorCircle3: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#81D4FA",
    opacity: 0.2,
    top: "40%",
    right: -30,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  // Machines Section
  machinesSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0EA5E9",
  },
  machinesList: {
    gap: 12,
  },
  machineCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  machineGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  machineLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  machineIconContainer: {
    shadowColor: "#0EA5E9",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  machineIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  machineId: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#10B981",
  },
  joinBtn: {
    borderRadius: 10,
    overflow: "hidden",
  },
  joinGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  joinText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});