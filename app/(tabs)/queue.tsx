import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Animated,
  StatusBar,
  RefreshControl,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { useUser } from "@/components/UserContext";
import Avatar from "@/components/Avatar";
import { useQueueViewModel } from "@/viewmodels/tabs/QueueViewModel";
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");

export default function QueueScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const params = useLocalSearchParams();
  const machineId = (params.machineId as string) || "M001";

  const {
    queueUsers,
    joined,
    isMyTurn,
    waitingCount,
    inUseCount,
    myPosition,
    loading,
    pendingAction,
    refreshing,
    refresh,
    joinQueue,
    leaveQueue,
  } = useQueueViewModel(machineId, user?.uid, user?.name);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

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

    if (joined) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [joined]);

  const navigateToContact = (targetUser: any) => {
    if (targetUser.userId === user?.uid) return;
    router.push({
      pathname: "/(tabs)/contact",
      params: {
        targetUserId: targetUser.userId,
        targetName: targetUser.name,
        targetAvatar: targetUser.avatarUrl || undefined,
      },
    });
  };

  const renderQueueUser = ({ item, index }: { item: any; index: number }) => {
    const isMe = item.userId === user?.uid;

    return (
      <Animated.View style={[styles.queueItem, isMe && styles.queueItemMe, { opacity: fadeAnim }]}>
        {isMe && <Animated.View style={[styles.meGlow, { opacity: glowAnim }]} />}
        
        <View style={styles.positionBadge}>
          <LinearGradient
            colors={isMe ? ["#6366F1", "#4F46E5"] : ["#F1F5F9", "#E2E8F0"]}
            style={styles.positionGradient}
          >
            <Text style={[styles.positionText, isMe && styles.positionTextMe]}>{item.position}</Text>
          </LinearGradient>
        </View>

        <View style={styles.avatarWrapper}>
          <Avatar name={item.name} avatarUrl={item.avatarUrl} size={52} />
          {isMe && <View style={styles.youTag}><Text style={styles.youTagText}>YOU</Text></View>}
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
            style={({ pressed }) => [styles.chatButton, pressed && { transform: [{ scale: 0.9 }] }]}
            onPress={() => navigateToContact(item)}
          >
            <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.chatButtonGradient}>
              <Ionicons name="chatbubble" size={16} color="#6366F1" />
            </LinearGradient>
          </Pressable>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Exaggerated Background */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorTriangle} />
      </View>

      <FlatList
        data={queueUsers}
        keyExtractor={(item) => item.userId}
        renderItem={renderQueueUser}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#6366F1" colors={["#6366F1"]} />}
        ListHeaderComponent={
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header Title */}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{t.queue}</Text>
              <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.machineBadge}>
                <Ionicons name="hardware-chip" size={14} color="#fff" />
                <Text style={styles.machineBadgeText}>{machineId}</Text>
              </LinearGradient>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
              {/* Waiting - Cyan */}
              <View style={styles.statCard}>
                <LinearGradient colors={["#ECFEFF", "#CFFAFE"]} style={styles.statGradient}>
                  <LinearGradient colors={["#22D3EE", "#06B6D4"]} style={styles.statIconCircle}>
                    <Ionicons name="time" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.statNumber}>{waitingCount}</Text>
                  <Text style={styles.statLabel}>{t.inQueue}</Text>
                </LinearGradient>
              </View>

              {/* In-Use - Indigo */}
              <View style={styles.statCard}>
                <LinearGradient colors={["#EEF2FF", "#E0E7FF"]} style={styles.statGradient}>
                  <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.statIconCircle}>
                    <Ionicons name="flash" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.statNumber}>{inUseCount}</Text>
                  <Text style={styles.statLabel}>{t.inUse}</Text>
                </LinearGradient>
              </View>
            </View>

            {/* My Position Card */}
            {joined && myPosition && (
              <View style={styles.myPositionCard}>
                <LinearGradient
                  colors={isMyTurn ? ["#10B981", "#059669"] : ["#6366F1", "#4F46E5", "#3730A3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.myPositionGradient}
                >
                  <View style={styles.myPositionContent}>
                    <View>
                      <Text style={styles.myPositionLabel}>
                        {isMyTurn ? `🎉 ${t.yourTurn}` : t.yourPosition}
                      </Text>
                      <Text style={styles.myPositionNumber}>
                        {isMyTurn ? t.goAhead : `#${myPosition}`}
                      </Text>
                    </View>
                    {isMyTurn && (
                      <Pressable
                        style={styles.scanNowButton}
                        onPress={() => router.push({ pathname: "/iot/qrscan", params: { machineId } })}
                      >
                        <Text style={styles.scanNowText}>{t.scanNow}</Text>
                        <Ionicons name="qr-code" size={18} color="#059669" />
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.cardDecor1} />
                  <View style={styles.cardDecor2} />
                </LinearGradient>
              </View>
            )}

            {/* Queue List Header */}
            <View style={styles.queueListHeader}>
              <Text style={styles.queueListTitle}>
                {queueUsers.length > 0 ? t.peopleWaiting : t.queueEmpty}
              </Text>
              {queueUsers.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{queueUsers.length}</Text>
                </View>
              )}
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <LinearGradient colors={["#E0E7FF", "#C7D2FE"]} style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={48} color="#4F46E5" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>{t.emptyQueue}</Text>
            <Text style={styles.emptySubtitle}>{t.beFirstToJoin}</Text>
          </Animated.View>
        }
        ListFooterComponent={<View style={{ height: 140 }} />}
      />

      {/* Floating Action Button */}
      <Animated.View style={[styles.fabContainer, { opacity: fadeAnim }]}>
        {pendingAction === "leave" || (!pendingAction && joined) ? (
          // RED for Leave - Common Sense
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={leaveQueue}
            disabled={loading}
          >
            <LinearGradient
              colors={["#F87171", "#EF4444", "#DC2626"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fabGradient}
            >
              <Ionicons name="exit-outline" size={22} color="#fff" />
              <Text style={styles.fabText}>{pendingAction === "leave" ? t.leaving : t.leaveQueue}</Text>
            </LinearGradient>
          </Pressable>
        ) : (
          // Cyan/Indigo for Join
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && { transform: [{ scale: 0.96 }] }]}
            onPress={joinQueue}
            disabled={loading}
          >
            <LinearGradient
              colors={["#22D3EE", "#06B6D4", "#0891B2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fabGradient}
            >
              <Ionicons name="add" size={22} color="#fff" />
              <Text style={styles.fabText}>{pendingAction === "join" ? t.joining : t.joinQueue}</Text>
            </LinearGradient>
          </Pressable>
        )}
      </Animated.View>
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
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  // Background
  backgroundDecor: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  decorCircle1: { position: "absolute", width: 350, height: 350, borderRadius: 175, backgroundColor: "#E0E7FF", opacity: 0.5, top: -100, right: -80 },
  decorCircle2: { position: "absolute", width: 250, height: 250, borderRadius: 125, backgroundColor: "#CFFAFE", opacity: 0.4, bottom: 100, left: -80 },
  decorTriangle: { position: "absolute", width: 180, height: 180, backgroundColor: "#ECFEFF", opacity: 0.3, top: "20%", right: -40, transform: [{ rotate: "45deg" }] },

  listContent: { paddingHorizontal: 20, paddingTop: 60 },
  header: { marginBottom: 16 },

  // Title
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  title: { fontSize: 32, fontWeight: "800", color: "#0f172a", letterSpacing: -1 },
  machineBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, gap: 8, shadowColor: "#6366F1", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  machineBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  // Stats
  statsRow: { flexDirection: "row", gap: 14, marginBottom: 24 },
  statCard: { flex: 1, borderRadius: 24, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, elevation: 4 },
  statGradient: { padding: 20, alignItems: "center" },
  statIconCircle: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8 },
  statNumber: { fontSize: 32, fontWeight: "800", color: "#0f172a" },
  statLabel: { fontSize: 13, color: "#64748b", fontWeight: "700", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },

  // My Position Card
  myPositionCard: { borderRadius: 28, overflow: "hidden", marginBottom: 24, shadowColor: "#6366F1", shadowOpacity: 0.35, shadowRadius: 20, elevation: 10 },
  myPositionGradient: { padding: 28, position: "relative", overflow: "hidden" },
  myPositionContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", zIndex: 1 },
  myPositionLabel: { color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  myPositionNumber: { color: "#fff", fontSize: 40, fontWeight: "800", marginTop: 4, letterSpacing: -1 },
  cardDecor1: { position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.1)", top: -40, right: -40 },
  cardDecor2: { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(255,255,255,0.08)", bottom: -30, left: 50 },
  scanNowButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", paddingHorizontal: 22, paddingVertical: 14, borderRadius: 16, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  scanNowText: { color: "#059669", fontWeight: "800", fontSize: 15 },

  // Queue List Header
  queueListHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  queueListTitle: { fontSize: 16, fontWeight: "800", color: "#64748b", letterSpacing: 0.3 },
  countBadge: { backgroundColor: "#F1F5F9", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  countText: { fontSize: 13, fontWeight: "800", color: "#64748b" },

  // Queue Item
  queueItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 16, marginBottom: 12, borderRadius: 24,
    shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: "#f1f5f9", overflow: 'hidden',
  },
  queueItemMe: { backgroundColor: "#F5F3FF", borderColor: "#C7D2FE", borderWidth: 2 },
  meGlow: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: "#6366F1" },

  positionBadge: { marginRight: 14, borderRadius: 14, overflow: "hidden" },
  positionGradient: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  positionText: { fontSize: 14, fontWeight: "800", color: "#94a3b8" },
  positionTextMe: { color: "#fff" },

  avatarWrapper: { position: 'relative' },
  youTag: { position: 'absolute', bottom: -4, left: 0, right: 0, backgroundColor: "#6366F1", paddingVertical: 2, borderRadius: 4 },
  youTagText: { color: "#fff", fontSize: 8, fontWeight: "800", textAlign: 'center' },

  queueUserInfo: { flex: 1, marginLeft: 14 },
  queueUserName: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  queueUserNameMe: { color: "#4F46E5" },
  queueUserTime: { fontSize: 12, color: "#94a3b8", marginTop: 2, fontWeight: "600" },

  chatButton: { borderRadius: 14, overflow: "hidden" },
  chatButtonGradient: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 60 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 24, shadowColor: "#6366F1", shadowOpacity: 0.2, shadowRadius: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: "#94a3b8", fontWeight: "600" },

  // FAB
  fabContainer: { position: "absolute", bottom: 28, left: 20, right: 20 },
  fab: { borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  fabGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 20 },
  fabText: { color: "#fff", fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
});