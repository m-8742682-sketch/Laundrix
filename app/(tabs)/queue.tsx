import Avatar from "@/components/Avatar";
import IncidentModal from "@/components/incident/IncidentModal";
import { MachineSelectorModal } from "@/components/queue/MachineSelector";
import { useUser } from "@/components/UserContext";
import { useI18n } from "@/i18n/i18n";
import { fetchMachines, subscribeMachinesRTDB } from "@/services/machine.service";
import { useGracePeriod } from "@/services/useGracePeriod";
import { useIncidentHandler } from "@/services/useIncidentHandler";
import { ActiveSessionInfo, useQueueViewModel } from "@/viewmodels/tabs/QueueViewModel";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const WARNING_SECS = 1 * 60;

// Memoised floating bubble — stable animations, no re-render on parent state changes
const Bubble = React.memo(({ delay, size, color, position }: {
  delay: number; size: number; color: string;
  position: { top?: number; left?: number; right?: number; bottom?: number };
}) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 4500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -25],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          ...position,
          transform: [{ translateY }],
        },
      ]}
    />
  );
});

export default function QueueScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const params = useLocalSearchParams();
  const initialMachineId = (params.machineId as string) || "M001";
  
  const [machineId, setMachineId] = useState(initialMachineId);
  const [showMachineModal, setShowMachineModal] = useState(false);
  const [availableMachines, setAvailableMachines] = useState<string[]>(["M001", "M002", "M003", "M004", "M005"]);

  // FIX #5: Track active session across all machines to prevent one user one session
  const [activeSession, setActiveSession] = useState<ActiveSessionInfo>(null);

  useEffect(() => {
    const unsubscribe = subscribeMachinesRTDB((machines) => {
      const myMachine = machines.find(m => m.currentUserId === user?.uid);
      if (myMachine) {
        setActiveSession({
          machineId: myMachine.machineId,
          machineLocation: myMachine.location ?? undefined,
        });
      } else {
        setActiveSession(null);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const {
    queueUsers,
    joined,
    isMyTurn,
    waitingCount,
    inUseCount,
    myPosition,
    currentUser,      // FIX #4: user currently using the machine
    currentUserId: machineCurrentUserId,
    loading,
    pendingAction,
    refreshing,
    refresh,
    joinQueue,
    leaveQueue,
  } = useQueueViewModel(machineId, user?.uid, user?.name, activeSession);

  // 🔥 INCIDENT HANDLER: 60s countdown for unauthorized access
  const { 
    incident, 
    loading: incidentLoading, 
    handleNotMe, 
    handleThatsMe 
  } = useIncidentHandler({ userId: user?.uid, isAdmin: user?.role === "admin" });

  // 🔔 GRACE PERIOD: 5-minute countdown when it's user's turn
  const { gracePeriod, formatTime: formatGraceTime } =
    useGracePeriod({ machineId, userId: user?.uid, isAdmin: user?.role === "admin" });

  // 🔊 QUEUE RING: plays alarm.mp3 when it's user's turn (FIX: pass grace period status)

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const headerY = useRef(new Animated.Value(-20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Load available machines from API
  useEffect(() => {
    const loadMachines = async () => {
      try {
        const machines = await fetchMachines();
        const machineIds = machines.map(m => m.machineId).sort();
        if (machineIds.length > 0) {
          setAvailableMachines(machineIds);
        }
      } catch (err) {
        console.error("Failed to load machines:", err);
        // Fallback to default list
      }
    };
    loadMachines();
  }, []);

  // Entrance animation
  useEffect(() => {
    const entranceAnimation = Animated.stagger(100, [
      Animated.timing(headerY, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 900, 
        useNativeDriver: true 
      }),
      Animated.spring(slideAnim, { 
        toValue: 0, 
        tension: 50, 
        friction: 8,
        useNativeDriver: true 
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true
      })
    ]);

    entranceAnimation.start();
  }, [machineId]); // Re-animate when machine changes

  // Handler for machine selection from modal
  const handleMachineSelect = (selectedMachineId: string) => {
    if (selectedMachineId === machineId) return;
    
    setMachineId(selectedMachineId);
    // Update URL params without navigation
    router.setParams({ machineId: selectedMachineId });
  };

  // Open machine selector modal
  const openMachineSelector = () => {
    setShowMachineModal(true);
  };

  const navigateToContact = useCallback((targetUser: any) => {
    if (targetUser.userId === user?.uid) return;
    router.push({
      pathname: "/(tabs)/contact",
      params: {
        targetUserId: targetUser.userId,
        targetName: targetUser.name,
        targetAvatar: targetUser.avatarUrl || undefined,
      },
    });
  }, [user?.uid]);

  const renderQueueUser = useCallback(({ item, index }: { item: any; index: number }) => {
    const isMe = item.userId === user?.uid;

    return (
      <View style={[styles.queueItem, isMe && styles.queueItemMe]}>
        {isMe && (
          <LinearGradient
            colors={["#6366F1", "#8B5CF6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.meGlow}
          />
        )}

        <View style={styles.positionBadge}>
          <LinearGradient
            colors={isMe ? ["#6366F1", "#4F46E5"] : ["#F8FAFC", "#F1F5F9"]}
            style={styles.positionGradient}
          >
            <Text style={[styles.positionText, isMe && styles.positionTextMe]}>
              {item.position}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.avatarWrapper}>
          <View style={[styles.avatarGlow, isMe && styles.avatarGlowMe]}>
            <Avatar name={item.name} avatarUrl={item.avatarUrl} size={48} />
          </View>
          {isMe && (
            <View style={styles.youTag}>
              <Text style={styles.youTagText}>YOU</Text>
            </View>
          )}
        </View>

        <View style={styles.queueUserInfo}>
          <Text style={[styles.queueUserName, isMe && styles.queueUserNameMe]}>
            {isMe ? t.you : item.name}
          </Text>
          <Text style={styles.queueUserTime}>
            {t.joined} {formatTime(item.joinedAt)}
          </Text>
        </View>

        {!isMe && (
          <Pressable
            style={({ pressed }) => [
              styles.chatButton, 
              pressed && styles.chatButtonPressed
            ]}
            onPress={() => navigateToContact(item)}
          >
            <LinearGradient 
              colors={["#EEF2FF", "#E0E7FF"]} 
              style={styles.chatButtonGradient}
            >
              <Ionicons name="chatbubble" size={18} color="#6366F1" />
            </LinearGradient>
          </Pressable>
        )}
      </View>
    );
  }, [user?.uid, t, navigateToContact]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Premium Animated Background - Matches Dashboard */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#fafaff", "#f0f4ff", "#e0e7ff", "#dbeafe"]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradientBackground}
        />

        {/* Floating Glass Bubbles */}
        <Bubble delay={0} size={260} color="rgba(99, 102, 241, 0.08)" position={{ top: -80, right: -60 }} />
        <Bubble delay={1000} size={180} color="rgba(14, 165, 233, 0.06)" position={{ top: 80, left: -40 }} />
        <Bubble delay={2000} size={140} color="rgba(139, 92, 246, 0.07)" position={{ top: 250, right: -30 }} />
        <Bubble delay={1500} size={100} color="rgba(16, 185, 129, 0.05)" position={{ bottom: 150, left: 20 }} />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <FlatList
          data={queueUsers}
          keyExtractor={(item) => item.userId}
          renderItem={renderQueueUser}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          windowSize={5}
          initialNumToRender={5}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={refresh} 
              tintColor="#6366F1"
              colors={["#6366F1", "#8B5CF6", "#0EA5E9"]}
              progressBackgroundColor="#fff"
            />
          }
          ListHeaderComponent={
            <Animated.View 
              style={[
                styles.header, 
                { 
                  opacity: fadeAnim, 
                  transform: [{ translateY: slideAnim }] 
                }
              ]}
            >
              {/* Header Title with Machine Selector Button */}
              <Animated.View style={{ transform: [{ translateY: headerY }] }}>
                <View style={styles.titleRow}>
                  <View>
                    <Text style={styles.overline}>{t.machineQueueTitle}</Text>
                  </View>
                  
                  {/* Machine Selector Button - Opens Modal */}
                  <Pressable
                    onPress={openMachineSelector}
                    style={({ pressed }) => [
                      styles.machineBadge,
                      pressed && styles.machineBadgePressed
                    ]}
                  >
                    <LinearGradient 
                      colors={["#6366F1", "#8B5CF6"]} 
                      style={styles.machineBadgeGradient}
                    >
                      <Ionicons name="hardware-chip" size={14} color="#fff" />
                      <Text style={styles.machineBadgeText}>{machineId}</Text>
                      <Ionicons 
                        name="chevron-down" 
                        size={14} 
                        color="#fff" 
                        style={styles.dropdownIcon}
                      />
                    </LinearGradient>
                  </Pressable>
                </View>
              </Animated.View>

              {/* Stats Cards - Glassmorphism Grid */}
              <View style={styles.statsRow}>
                {/* Waiting - Cyan Glass Card */}
                <View style={styles.statCard}>
                  <View style={styles.glassBg} />
                  <View style={[styles.statIconBox, { backgroundColor: "rgba(6, 182, 212, 0.15)" }]}>
                    <Ionicons name="time" size={20} color="#06B6D4" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#06B6D4" }]}>{waitingCount}</Text>
                  <Text style={styles.statLabel}>{t.inQueue}</Text>
                  <View style={[styles.cornerAccent, { backgroundColor: "rgba(6, 182, 212, 0.1)" }]} />
                </View>

                {/* In-Use - Indigo Glass Card */}
                <View style={styles.statCard}>
                  <View style={styles.glassBg} />
                  <View style={[styles.statIconBox, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                    <Ionicons name="flash" size={20} color="#6366F1" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#6366F1" }]}>{inUseCount}</Text>
                  <Text style={styles.statLabel}>{t.inUse}</Text>
                  <View style={[styles.cornerAccent, { backgroundColor: "rgba(99, 102, 241, 0.1)" }]} />
                </View>
              </View>

              {/* My Position Card - Premium Glass Gradient */}
              {/* Hide when grace is active for this user — graceCard below handles that state */}
              {joined && myPosition && !isMyTurn && !(gracePeriod && gracePeriod.userId === user?.uid) && (
                <View style={styles.myPositionCard}>
                  <LinearGradient
                    colors={isMyTurn ? ["#10B981", "#059669", "#047857"] : ["#6366F1", "#4F46E5", "#3730A3"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.myPositionGradient}
                  >
                    {/* Glass Overlay */}
                    <View style={styles.cardGlassOverlay} />

                    {/* Decorative Elements */}
                    <View style={[styles.cardDecorCircle, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
                    <View style={[styles.cardDecorRing, { borderColor: "rgba(255,255,255,0.1)" }]} />

                    <View style={styles.myPositionContent}>
                      <View>
                        <View style={styles.positionLabelRow}>
                          {isMyTurn && <Ionicons name="checkmark-circle" size={18} color="#fff" />}
                          <Text style={styles.myPositionLabel}>
                            {isMyTurn ? t.yourTurn : t.yourPosition}
                          </Text>
                        </View>
                        <Text style={styles.myPositionNumber}>
                          {isMyTurn ? t.goAhead : `#${myPosition}`}
                        </Text>
                        {/* Grace period countdown is shown in the dedicated graceCard below */}
                      </View>

                      {isMyTurn && (
                        <Pressable
                          style={({ pressed }) => [
                            styles.scanNowButton,
                            pressed && styles.scanNowButtonPressed
                          ]}
                          onPress={() => router.push({ pathname: "/iot/qrscan", params: { machineId } })}
                        >
                          <LinearGradient
                            colors={["rgba(255,255,255,0.95)", "#fff"]}
                            style={styles.scanNowGradient}
                          >
                            <Text style={styles.scanNowText}>{t.scanNow}</Text>
                            <Ionicons name="qr-code" size={18} color="#059669" />
                          </LinearGradient>
                        </Pressable>
                      )}
                    </View>

                    {/* Bottom Accent Line */}
                    <View style={[styles.cardAccentLine, { backgroundColor: isMyTurn ? "#34D399" : "#818CF8" }]} />
                  </LinearGradient>
                </View>
              )}

              {/* 🔔 GRACE PERIOD CARD — shown ONLY to the user whose turn it is (first position) */}
              {gracePeriod && gracePeriod.userId === user?.uid && (
                <View style={styles.graceCard}>
                  <LinearGradient
                    colors={gracePeriod.secondsLeft <= WARNING_SECS ? ["#EF4444", "#DC2626"] : ["#F59E0B", "#D97706"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.graceGradient}
                  >
                    <View style={styles.graceContent}>
                      <Ionicons name="timer-outline" size={28} color="#fff" style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.graceTitle}>{t.gracePeriodHurry}</Text>
                        <Text style={styles.graceSubtitle}>
                          {`${formatGraceTime(gracePeriod.secondsLeft)} ${t.graceScanBeforeExpires}`}
                        </Text>
                      </View>
                      <Text style={styles.graceTimer}>
                        {formatGraceTime(gracePeriod.secondsLeft)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push({ pathname: "/iot/qrscan", params: { machineId } })}
                      style={styles.graceScanBtn}
                    >
                      <Ionicons name="qr-code" size={16} color="#D97706" />
                      <Text style={styles.graceScanBtnText}>{t.scanNow}</Text>
                    </Pressable>
                  </LinearGradient>
                </View>
              )}

              {/* FIX #4: Currently In Use card ─────────────────────── */}
              {currentUser && (
                <View style={styles.inUseSection}>
                  <View style={styles.sectionLabelRow}>
                    <Text style={styles.sectionLabel}>{t.currentlyInUse}</Text>
                    <View style={[styles.countBadge, { backgroundColor: "#EEF2FF" }]}>
                      <Text style={[styles.countText, { color: "#6366F1" }]}>1</Text>
                    </View>
                  </View>
                  <View style={[styles.queueItem, styles.inUseItem]}>
                    <LinearGradient colors={["#6366F1", "#4F46E5"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.inUseGlow} />
                    <View style={styles.inUseBadge}>
                      <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.positionGradient}>
                        <Ionicons name="flash" size={14} color="#fff" />
                      </LinearGradient>
                    </View>
                    <View style={[styles.avatarWrapper]}>
                      <View style={[styles.avatarGlow, styles.avatarGlowMe]}>
                        <Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size={48} />
                      </View>
                    </View>
                    <View style={styles.queueUserInfo}>
                      <Text style={[styles.queueUserName, styles.queueUserNameMe]}>
                        {currentUser.userId === user?.uid ? t.youInUse : currentUser.name}
                      </Text>
                      <Text style={[styles.queueUserTime, { color: "#6366F1" }]}>{t.currentlyUsingMachine}</Text>
                    </View>
                    {currentUser.userId !== user?.uid && (
                      <Pressable
                        style={({ pressed }) => [styles.chatButton, pressed && styles.chatButtonPressed]}
                        onPress={() => navigateToContact(currentUser)}
                      >
                        <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={styles.chatButtonGradient}>
                          <Ionicons name="chatbubble" size={18} color="#6366F1" />
                        </LinearGradient>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {/* Queue List Header - Section Label Style */}
              <View style={styles.queueListHeader}>
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>{t.waitingList}</Text>
                  {queueUsers.length > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{queueUsers.length}</Text>
                    </View>
                  )}
                </View>
                <Pressable 
                  style={styles.viewAllBtn}
                  onPress={() => router.push("/(tabs)/history")}
                >
                  <Text style={styles.viewAllText}>{t.viewHistory}</Text>
                  <Ionicons name="arrow-forward" size={14} color="#6366F1" />
                </Pressable>
              </View>
            </Animated.View>
          }
          ListEmptyComponent={
            <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={48} color="#6366F1" />
              </View>
              <Text style={styles.emptyTitle}>{t.emptyQueue}</Text>
              <Text style={styles.emptySubtitle}>{t.beFirstToJoin}</Text>
            </Animated.View>
          }
          ListFooterComponent={<View style={{ height: 180 }} />}
        />

        {/* Floating Action Button - Glassmorphism Style */}
        <Animated.View 
          style={[
            styles.fabContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          {pendingAction === "leave" || (!pendingAction && joined) ? (
            // Leave Button - Red Gradient
            <Pressable
              style={({ pressed }) => [
                styles.fab, 
                pressed && styles.fabPressed
              ]}
              onPress={leaveQueue}
              disabled={loading}
            >
              <LinearGradient
                colors={["#F87171", "#EF4444", "#DC2626"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fabGradient}
              >
                <View style={styles.fabIconBox}>
                  <Ionicons name="exit-outline" size={22} color="#EF4444" />
                </View>
                <Text style={styles.fabText}>
                  {pendingAction === "leave" ? t.leaving : t.leaveQueue}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </Pressable>
          ) : (
            // Join Button - Cyan/Indigo Gradient
            <Pressable
              style={({ pressed }) => [
                styles.fab, 
                pressed && styles.fabPressed
              ]}
              onPress={joinQueue}
              disabled={loading}
            >
              <LinearGradient
                colors={["#06B6D4", "#0EA5E9", "#6366F1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.fabGradient}
              >
                <View style={styles.fabIconBox}>
                  <Ionicons name="add" size={24} color="#0EA5E9" />
                </View>
                <Text style={styles.fabText}>
                  {pendingAction === "join" ? t.joining : t.joinQueue}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
            </Pressable>
          )}
        </Animated.View>
      </SafeAreaView>

      {/* 🔥 MACHINE SELECTOR MODAL */}
      <MachineSelectorModal
        visible={showMachineModal}
        onClose={() => setShowMachineModal(false)}
        machines={availableMachines}
        selectedMachineId={machineId}
        onSelectMachine={handleMachineSelect}
      />

      {/* 🔥 INCIDENT MODAL: 60s countdown for unauthorized access */}

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

function formatTime(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#fafaff" 
  },

  // Background - Matches Dashboard
  backgroundContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  gradientBackground: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  bubble: {
    position: "absolute",
    opacity: 0.4,
  },

  // Content Spacing - Unified with Dashboard
  listContent: { 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 20 
  },

  header: { 
    marginBottom: 24 
  },

  // Header Title - Dashboard Style
  titleRow: { 
    flexDirection: "row", 
    alignItems: "flex-end", 
    justifyContent: "space-between", 
    marginBottom: 24,
    marginTop: 8
  },
  overline: {
    fontSize: 25,
    fontWeight: "800",
    color: "#0b0b0b",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },

  // Machine Selector Button (simplified - no dropdown)
  machineBadge: { 
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  machineBadgePressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95
  },
  machineBadgeGradient: {
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    gap: 8,
  },
  machineBadgeText: { 
    color: "#fff", 
    fontWeight: "800", 
    fontSize: 14 
  },
  dropdownIcon: {
    marginLeft: 4,
  },

  // Stats - Glass Cards (Matches DashboardStats)
  statsRow: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 24 
  },
  statCard: { 
    flex: 1,
    minHeight: 120,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.8)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    position: "relative",
    overflow: "hidden"
  },
  glassBg: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: "transparent"
  },
  statIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)"
  },
  statNumber: { 
    fontSize: 28, 
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -0.5
  },
  statLabel: { 
    fontSize: 11, 
    fontWeight: "700", 
    color: "#000000",
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  cornerAccent: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomLeftRadius: 40
  },

  // My Position Card - Premium Glass (Matches DashboardStatusCard)
  myPositionCard: { 
    borderRadius: 28, 
    overflow: "hidden", 
    marginBottom: 24,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  myPositionGradient: { 
    padding: 24, 
    position: "relative", 
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)"
  },
  cardGlassOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  cardDecorCircle: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -50,
    right: -30
  },
  cardDecorRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    bottom: -40,
    left: -20
  },
  myPositionContent: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    zIndex: 1
  },
  positionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4
  },
  myPositionLabel: { 
    color: "rgba(255,255,255,0.9)", 
    fontSize: 14, 
    fontWeight: "700", 
    letterSpacing: 0.3 
  },
  myPositionNumber: { 
    color: "#fff", 
    fontSize: 36, 
    fontWeight: "800",
    letterSpacing: -1
  },
  cardAccentLine: {
    position: "absolute",
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    borderRadius: 2,
    opacity: 0.6
  },
  scanNowButton: { 
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6
  },
  scanNowButtonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95
  },
  scanNowGradient: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    paddingHorizontal: 20, 
    paddingVertical: 14
  },
  scanNowText: { 
    color: "#059669", 
    fontWeight: "800", 
    fontSize: 15 
  },

  // Queue List Header - Section Style
  queueListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginLeft: 4
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  sectionLabel: { 
    fontSize: 13, 
    fontWeight: "800", 
    color: "#0F172A", 
    textTransform: "uppercase", 
    letterSpacing: 1.2
  },
  countBadge: { 
    backgroundColor: "#F1F5F9", 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 10
  },
  countText: { 
    fontSize: 12, 
    fontWeight: "800", 
    color: "#64748B" 
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)"
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6366F1",
    letterSpacing: 0.3
  },

  // Queue Item - Glass Card Style
  queueItem: {
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "rgba(255, 255, 255, 0.9)", 
    padding: 16, 
    marginBottom: 12, 
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
    position: "relative"
  },
  queueItemMe: { 
    backgroundColor: "rgba(238, 242, 255, 1)", 
    borderColor: "#C7D2FE",
    borderWidth: 2,
    shadowColor: "#6366F1",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  meGlow: { 
    position: "absolute", 
    left: 0, 
    top: 0, 
    bottom: 0, 
    width: 4
  },

  positionBadge: { 
    marginRight: 14, 
    borderRadius: 12, 
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  positionGradient: { 
    width: 36, 
    height: 36, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  positionText: { 
    fontSize: 14, 
    fontWeight: "800", 
    color: "#64748B" 
  },
  positionTextMe: { 
    color: "#fff" 
  },

  avatarWrapper: { 
    position: "relative",
    marginRight: 14
  },
  avatarGlow: { 
    borderWidth: 2, 
    borderColor: "rgba(255,255,255,0.8)", 
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3
  },
  avatarGlowMe: {
    borderColor: "#C7D2FE",
    shadowColor: "#6366F1",
    shadowOpacity: 0.2
  },
  youTag: { 
    position: "absolute", 
    bottom: -6, 
    left: "50%",
    transform: [{ translateX: -20 }],
    backgroundColor: "#6366F1", 
    paddingHorizontal: 8,
    paddingVertical: 2, 
    borderRadius: 6,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3
  },
  youTagText: { 
    color: "#fff", 
    fontSize: 8, 
    fontWeight: "900",
    letterSpacing: 0.5
  },

  queueUserInfo: { 
    flex: 1 
  },
  queueUserName: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#0f172a",
    marginBottom: 2
  },
  queueUserNameMe: { 
    color: "#4F46E5" 
  },
  queueUserTime: { 
    fontSize: 12, 
    color: "#94a3b8", 
    fontWeight: "600" 
  },

  chatButton: { 
    borderRadius: 14, 
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  chatButtonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9
  },
  chatButtonGradient: { 
    width: 44, 
    height: 44, 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)"
  },

  // Empty State
  emptyState: { 
    alignItems: "center", 
    paddingVertical: 60,
    marginTop: 20
  },
  emptyIconCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 32, 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 24,
    backgroundColor: "rgba(238, 242, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5
  },
  emptyTitle: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#0f172a", 
    marginBottom: 8 
  },
  emptySubtitle: { 
    fontSize: 15, 
    color: "#94a3b8", 
    fontWeight: "600" 
  },

  // FAB - Premium Glass (Matches Dashboard Buttons)
  fabContainer: { 
    position: "absolute", 
    bottom: 120, 
    left: 20, 
    right: 20 
  },
  fab: { 
    borderRadius: 20, 
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10
  },
  fabPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95
  },
  fabGradient: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 20
  },
  fabIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  fabText: { 
    color: "#fff", 
    fontSize: 17, 
    fontWeight: "800", 
    letterSpacing: 0.3,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12
  },

  // Currently In Use section (FIX #4)
  inUseSection: {
    marginBottom: 12,
  },
  inUseItem: {
    borderWidth: 2,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  inUseGlow: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  inUseBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // Grace Period Banner
  graceCountdownInCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "rgba(0,0,0,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  graceCountdownInCardText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
  },
  graceCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  graceGradient: {
    padding: 16,
    borderRadius: 20,
  },
  graceContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  graceTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  graceSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  graceTimer: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  graceScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  graceScanBtnText: {
    color: "#D97706",
    fontWeight: "800",
    fontSize: 14,
  },
});