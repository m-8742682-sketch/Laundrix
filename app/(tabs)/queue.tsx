import Avatar from "@/components/Avatar";
import { MachineSelectorModal } from "@/components/queue/MachineSelector";
import { GraceProgressRing } from "@/components/queue/GraceProgressRing";
import EnhancedBubble from "@/components/ui/EnhancedBubble";
import { useUser } from "@/components/UserContext";
import { LP } from "@/constants/LaundrixColors";
import { haptic } from "@/utils/haptics";
import { useI18n } from "@/i18n/i18n";
import { fetchMachines, subscribeMachinesRTDB } from "@/services/machine.service";
import { useGracePeriod } from "@/services/useGracePeriod";
import { useClothesGrace } from "@/services/useClothesGrace";
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

  // 🔔 GRACE PERIOD: 5-minute countdown when it's user's turn
  const { gracePeriod, formatTime: formatGraceTime } =
    useGracePeriod({ machineId, userId: user?.uid, isAdmin: user?.role === "admin" });

  // 👕 CLOTHES GRACE: watch clothesGrace for this machine
  // Used to change the "Currently In Use" label to "Preparing to collect" / "Collecting"
  const { clothesGrace } = useClothesGrace({
    machineId,
    userId: user?.uid,
    isAdmin: user?.role === "admin",
  });

  // 🔊 Haptic: fire success when it becomes user's turn
  const prevIsMyTurn = useRef(false);
  useEffect(() => {
    if (isMyTurn && !prevIsMyTurn.current) haptic.success();
    prevIsMyTurn.current = isMyTurn;
  }, [isMyTurn]);

  // 🔊 Haptic: warning pulse when grace period enters critical zone
  const didWarnRef = useRef(false);
  useEffect(() => {
    if (gracePeriod && gracePeriod.secondsLeft <= 60 && !didWarnRef.current) {
      haptic.warning();
      didWarnRef.current = true;
    }
    if (!gracePeriod) didWarnRef.current = false;
  }, [gracePeriod?.secondsLeft]);

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
            colors={["#0EA5E9", "#0284C7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.meGlow}
          />
        )}

        <View style={styles.positionBadge}>
          <LinearGradient
            colors={isMe ? ["#0EA5E9", "#0369A1"] : ["#F8FAFC", "#F1F5F9"]}
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
              <Ionicons name="chatbubble" size={18} color="#0EA5E9" />
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
          colors={["#FAFAFF", "#F0F4FF", "#E0E7FF", "#DBEAFE"]}
          locations={[0, 0.3, 0.7, 1]}
          style={styles.gradientBackground}
        />
        {/* Enhanced floating bubbles — 4-axis parallel animation */}
        <EnhancedBubble delay={0}    size={270} color="rgba(14, 165, 233, 0.07)" position={{ top: -85,   right: -65 }}  driftX={16} floatY={28} />
        <EnhancedBubble delay={800}  size={190} color="rgba(14, 165, 233, 0.05)" position={{ top:  75,   left:  -45 }}  driftX={10} floatY={20} />
        <EnhancedBubble delay={1600} size={150} color="rgba(2,  132, 199, 0.06)" position={{ top:  260,  right: -35 }}  driftX={12} floatY={18} />
        <EnhancedBubble delay={2400} size={110} color="rgba(16, 185, 129, 0.04)" position={{ bottom: 160, left: 18 }}   driftX={8}  floatY={14} />
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
              tintColor="#0EA5E9"
              colors={["#0EA5E9", "#0284C7", "#0EA5E9"]}
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
                      colors={["#0EA5E9", "#0284C7"]} 
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
                  <View style={[styles.statIconBox, { backgroundColor: "rgba(14, 165, 233, 0.15)" }]}>
                    <Ionicons name="flash" size={20} color="#0EA5E9" />
                  </View>
                  <Text style={[styles.statNumber, { color: "#0EA5E9" }]}>{inUseCount}</Text>
                  <Text style={styles.statLabel}>{t.inUse}</Text>
                  <View style={[styles.cornerAccent, { backgroundColor: "rgba(14, 165, 233, 0.1)" }]} />
                </View>
              </View>

              {/* My Position Card - Premium Glass Gradient */}
              {/* Hide when grace is active for this user — graceCard below handles that state */}
              {joined && myPosition && !isMyTurn && !(gracePeriod && gracePeriod.userId === user?.uid) && (
                <View style={styles.myPositionCard}>
                  <LinearGradient
                    colors={isMyTurn ? ["#10B981", "#059669", "#047857"] : ["#0EA5E9", "#0369A1", "#3730A3"]}
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
                    {/* Row: circular ring + text side by side */}
                    <View style={styles.graceContent}>
                      <GraceProgressRing
                        secondsLeft={gracePeriod.secondsLeft}
                        totalSeconds={300}
                        size={72}
                        warningThreshold={60}
                        showLabel={true}
                      />
                      <View style={styles.graceTextBlock}>
                        <Text style={styles.graceTitle}>{t.gracePeriodHurry}</Text>
                        <Text style={styles.graceSubtitle}>
                          {`${formatGraceTime(gracePeriod.secondsLeft)} ${t.graceScanBeforeExpires}`}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={() => { haptic.heavy(); router.push({ pathname: "/iot/qrscan", params: { machineId } }); }}
                      style={styles.graceScanBtn}
                    >
                      <Ionicons name="qr-code" size={16} color="#D97706" />
                      <Text style={styles.graceScanBtnText}>{t.scanNow}</Text>
                    </Pressable>
                  </LinearGradient>
                </View>
              )}

              {/* Currently In Use card — label changes based on clothes grace status */}
              {currentUser && (() => {
                // Determine label + colours based on clothesGrace state for this machine
                const isClothesActive     = clothesGrace?.status === "active";
                const isClothesCollecting = clothesGrace?.status === "collecting";
                const isClothesOwner      = clothesGrace?.userId === currentUser.userId;

                let statusLabel   = t.currentlyUsingMachine;
                let gradientStart = "#0EA5E9";
                let gradientEnd   = "#0369A1";
                let iconName      = "flash" as const;

                if (isClothesOwner && isClothesActive) {
                  statusLabel   = "Preparing to collect clothes";
                  gradientStart = "#F59E0B";
                  gradientEnd   = "#D97706";
                  iconName      = "shirt" as any;
                } else if (isClothesOwner && isClothesCollecting) {
                  statusLabel   = "Collecting clothes";
                  gradientStart = "#10B981";
                  gradientEnd   = "#059669";
                  iconName      = "walk" as any;
                }

                return (
                  <View style={styles.inUseSection}>
                    <View style={styles.sectionLabelRow}>
                      <Text style={styles.sectionLabel}>
                        {isClothesOwner && (isClothesActive || isClothesCollecting)
                          ? "Clothes Status"
                          : t.currentlyInUse}
                      </Text>
                      <View style={[styles.countBadge, { backgroundColor: LP.TechBlue[100] }]}>
                        <Text style={[styles.countText, { color: LP.TechBlue.deeper }]}>1</Text>
                      </View>
                    </View>
                    <View style={[styles.queueItem, styles.inUseItem,
                      isClothesOwner && isClothesActive     && { borderColor: "rgba(245,158,11,0.5)" },
                      isClothesOwner && isClothesCollecting && { borderColor: "rgba(16,185,129,0.5)" },
                    ]}>
                      <LinearGradient
                        colors={[gradientStart, gradientEnd]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.inUseGlow}
                      />
                      <View style={styles.inUseBadge}>
                        <LinearGradient colors={[gradientStart, gradientEnd]} style={styles.positionGradient}>
                          <Ionicons name={iconName} size={14} color="#fff" />
                        </LinearGradient>
                      </View>
                      <View style={styles.avatarWrapper}>
                        <View style={[styles.avatarGlow, styles.avatarGlowMe]}>
                          <Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} size={48} />
                        </View>
                      </View>
                      <View style={styles.queueUserInfo}>
                        <Text style={[styles.queueUserName, styles.queueUserNameMe]}>
                          {currentUser.userId === user?.uid ? t.youInUse : currentUser.name}
                        </Text>
                        <Text style={[styles.queueUserTime, { color: gradientStart }]}>
                          {statusLabel}
                        </Text>
                        {/* Timer chip shown when clothes grace is active */}
                        {isClothesOwner && isClothesActive && clothesGrace && (
                          <View style={styles.clothesTimerChip}>
                            <Ionicons name="timer-outline" size={11} color="#D97706" />
                            <Text style={styles.clothesTimerText}>
                              {`${Math.floor(clothesGrace.secondsLeft / 60)}:${String(clothesGrace.secondsLeft % 60).padStart(2, "0")} to collect`}
                            </Text>
                          </View>
                        )}
                      </View>
                      {currentUser.userId !== user?.uid && (
                        <Pressable
                          style={({ pressed }) => [styles.chatButton, pressed && styles.chatButtonPressed]}
                          onPress={() => navigateToContact(currentUser)}
                        >
                          <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={styles.chatButtonGradient}>
                            <Ionicons name="chatbubble" size={18} color="#0EA5E9" />
                          </LinearGradient>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })()}

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
                  <Ionicons name="arrow-forward" size={14} color="#0EA5E9" />
                </Pressable>
              </View>
            </Animated.View>
          }
          ListEmptyComponent={
            <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={48} color="#0EA5E9" />
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
              onPress={() => { haptic.medium(); leaveQueue(); }}
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
              onPress={() => { haptic.medium(); joinQueue(); }}
              disabled={loading}
            >
              <LinearGradient
                colors={["#06B6D4", "#0EA5E9", "#0EA5E9"]}
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
    backgroundColor: LP.Surface.base,
  },

  // Background
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

  // Content Spacing
  listContent: { 
    paddingHorizontal: 20, 
    paddingTop: 10,
    paddingBottom: 20,
  },

  header: { marginBottom: 24 },

  // Header Title
  titleRow: { 
    flexDirection: "row", 
    alignItems: "flex-end", 
    justifyContent: "space-between", 
    marginBottom: 24,
    marginTop: 8,
  },
  overline: {
    fontSize: 25,
    fontWeight: "800",
    color: LP.Text.heading,
    textTransform: "uppercase",
    letterSpacing: -0.5,
    marginBottom: 4,
  },

  // Machine Selector Button
  machineBadge: { 
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: LP.Glow.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 7,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.30)",
  },
  machineBadgePressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  machineBadgeGradient: {
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    gap: 8,
  },
  machineBadgeText: { 
    color: LP.Text.onDark, 
    fontWeight: "800", 
    fontSize: 14,
    letterSpacing: 0.4,
  },
  dropdownIcon: {
    marginLeft: 4,
  },

  // Stats - Layered Glass Cards
  statsRow: { 
    flexDirection: "row", 
    gap: 12, 
    marginBottom: 24,
  },
  statCard: { 
    flex: 1,
    minHeight: 122,
    backgroundColor: LP.Surface.glass,
    borderRadius: 22,
    padding: 14,
    alignItems: "center",
    // Layer 1 — outer rim
    borderWidth: 1,
    borderColor: LP.LayeredGlass.outer,
    shadowColor: LP.Glow.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 4,
    position: "relative",
    overflow: "hidden",
  },
  glassBg: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 21,
    // Layer 2 — mid sheen
    borderWidth: 1,
    borderColor: LP.LayeredGlass.mid,
  },
  statIconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: LP.Border.glass,
  },
  statNumber: { 
    fontSize: 30, 
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -0.8,
  },
  statLabel: { 
    fontSize: 10, 
    fontWeight: "700", 
    color: LP.Text.muted,
    textTransform: "uppercase",
    letterSpacing: 1.0,
    opacity: 0.75,
  },
  cornerAccent: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomLeftRadius: 40,
  },

  // My Position Card
  myPositionCard: { 
    borderRadius: 28, 
    overflow: "hidden", 
    marginBottom: 24,
    shadowColor: LP.Glow.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  myPositionGradient: { 
    padding: 24, 
    position: "relative", 
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  cardGlassOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardDecorCircle: {
    position: "absolute",
    width: 160, height: 160,
    borderRadius: 80,
    top: -55, right: -35,
  },
  cardDecorRing: {
    position: "absolute",
    width: 130, height: 130,
    borderRadius: 65,
    borderWidth: 2,
    bottom: -44, left: -22,
  },
  myPositionContent: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    zIndex: 1,
  },
  positionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  myPositionLabel: { 
    color: LP.Text.onDarkMuted, 
    fontSize: 13, 
    fontWeight: "700", 
    letterSpacing: 0.4,
    lineHeight: 19,
  },
  myPositionNumber: { 
    color: LP.Text.onDark, 
    fontSize: 38, 
    fontWeight: "800",
    letterSpacing: -1.0,
    lineHeight: 44,
  },
  cardAccentLine: {
    position: "absolute",
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    borderRadius: 2,
    opacity: 0.65,
  },
  scanNowButton: { 
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  scanNowButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  scanNowGradient: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    paddingHorizontal: 20, 
    paddingVertical: 14,
  },
  scanNowText: { 
    color: "#059669", 
    fontWeight: "800", 
    fontSize: 15,
    letterSpacing: -0.2,
  },

  // Queue List Header
  queueListHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionLabel: { 
    fontSize: 11, 
    fontWeight: "800", 
    color: LP.Text.muted,
    textTransform: "uppercase", 
    letterSpacing: 1.8,
    opacity: 0.75,
  },
  countBadge: { 
    backgroundColor: LP.TechBlue[100],
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: LP.Border.subtle,
  },
  countText: { 
    fontSize: 12, 
    fontWeight: "800", 
    color: LP.TechBlue.deeper,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: LP.TechBlue[100],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LP.Border.glow,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: LP.Text.accent,
    letterSpacing: 0.2,
  },

  // Queue Item — Layered Glass
  queueItem: {
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: LP.Surface.glass,
    padding: 16, 
    marginBottom: 12, 
    borderRadius: 22,
    borderWidth: 1,
    borderColor: LP.LayeredGlass.outer,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 10,
    elevation: 2,
    overflow: "hidden",
    position: "relative",
  },
  queueItemMe: { 
    backgroundColor: "rgba(238, 242, 255, 1.0)",
    borderColor: LP.Border.active,
    borderWidth: 1.5,
    shadowColor: LP.Glow.primary,
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 5,
  },
  meGlow: { 
    position: "absolute", 
    left: 0, 
    top: 0, 
    bottom: 0, 
    width: 4,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },

  positionBadge: { 
    marginRight: 14, 
    borderRadius: 13, 
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  positionGradient: { 
    width: 36, 
    height: 36, 
    alignItems: "center", 
    justifyContent: "center",
  },
  positionText: { 
    fontSize: 14, 
    fontWeight: "800", 
    color: LP.Text.muted,
    letterSpacing: -0.3,
  },
  positionTextMe: { color: LP.Text.onDark },

  avatarWrapper: { 
    position: "relative",
    marginRight: 14,
  },
  avatarGlow: { 
    borderWidth: 2, 
    borderColor: LP.Border.glass, 
    borderRadius: 26,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  avatarGlowMe: {
    borderColor: LP.Border.active,
    shadowColor: LP.Glow.primary,
    shadowOpacity: 0.22,
  },
  youTag: { 
    position: "absolute", 
    bottom: -7, 
    left: "50%",
    transform: [{ translateX: -22 }],
    backgroundColor: LP.TechBlue.solid, 
    paddingHorizontal: 8,
    paddingVertical: 2, 
    borderRadius: 7,
    shadowColor: LP.Glow.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  youTagText: { 
    color: LP.Text.onDark, 
    fontSize: 8, 
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  queueUserInfo: { flex: 1 },
  queueUserName: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: LP.Text.primary,
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  queueUserNameMe: { color: LP.TechBlue.deeper },
  queueUserTime: { 
    fontSize: 12, 
    color: LP.Text.soft, 
    fontWeight: "600",
    lineHeight: 18,
  },

  chatButton: { 
    borderRadius: 15, 
    overflow: "hidden",
    shadowColor: LP.Glow.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
    elevation: 3,
  },
  chatButtonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.88,
  },
  chatButtonGradient: { 
    width: 44, 
    height: 44, 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LP.Border.glass,
  },

  // Empty State
  emptyState: { 
    alignItems: "center", 
    paddingVertical: 64,
    marginTop: 20,
  },
  emptyIconCircle: { 
    width: 100, 
    height: 100, 
    borderRadius: 32, 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 24,
    backgroundColor: LP.TechBlue[100],
    borderWidth: 1,
    borderColor: LP.Border.glass,
    shadowColor: LP.Glow.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  emptyTitle: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: LP.Text.primary, 
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  emptySubtitle: { 
    fontSize: 15, 
    color: LP.Text.soft, 
    fontWeight: "600",
    lineHeight: 22,
  },

  // FAB
  fabContainer: { 
    position: "absolute", 
    bottom: 120, 
    left: 20, 
    right: 20,
  },
  fab: { 
    borderRadius: 22, 
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  fabPressed: {
    transform: [{ scale: 0.975 }],
    opacity: 0.93,
  },
  fabGradient: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingVertical: 17,
    paddingHorizontal: 20,
  },
  fabIconBox: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  fabText: { 
    color: LP.Text.onDark, 
    fontSize: 17, 
    fontWeight: "800", 
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12,
  },

  // Currently In Use section
  inUseSection: { marginBottom: 12 },
  inUseItem: {
    borderWidth: 1.5,
    borderColor: LP.Border.glow,
  },
  inUseGlow: {
    position: "absolute",
    left: 0, top: 0, bottom: 0,
    width: 4,
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  inUseBadge: {
    width: 36, height: 36,
    borderRadius: 12, overflow: "hidden",
    marginRight: 4,
    alignItems: "center", justifyContent: "center",
  },

  // Grace Period Card — redesigned with GraceProgressRing
  graceCard: {
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.38,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.28)",
  },
  graceGradient: {
    padding: 18,
    borderRadius: 24,
  },
  // Ring + text side by side
  graceContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  graceTextBlock: {
    flex: 1,
  },
  graceTitle: {
    color: LP.Text.onDark,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  graceSubtitle: {
    color: LP.Text.onDarkMuted,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  graceTimer: {
    color: LP.Text.onDark,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  graceScanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  graceScanBtnText: {
    color: "#D97706",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.2,
  },
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
  // Clothes grace timer chip shown inside the Currently In Use card
  clothesTimerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(245,158,11,0.12)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.25)",
  },
  clothesTimerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#D97706",
  },
});
