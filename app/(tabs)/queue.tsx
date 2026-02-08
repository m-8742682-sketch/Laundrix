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

const { width } = Dimensions.get("window");

export default function QueueScreen() {
  const { user } = useUser();
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
    refreshing,
    refresh,
    joinQueue,
    leaveQueue,
  } = useQueueViewModel(machineId, user?.uid, user?.name);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

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
      <Animated.View
        style={[
          styles.queueItem,
          isMe && styles.queueItemMe,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{item.position}</Text>
        </View>
        
        <Avatar name={item.name} avatarUrl={item.avatarUrl} size={44} />
        
        <View style={styles.queueUserInfo}>
          <Text style={[styles.queueUserName, isMe && styles.queueUserNameMe]}>
            {isMe ? "You" : item.name}
          </Text>
          <Text style={styles.queueUserTime}>
            Joined {formatTime(item.joinedAt)}
          </Text>
        </View>

        {!isMe && (
          <Pressable 
            style={styles.chatButton}
            onPress={() => navigateToContact(item)}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#0EA5E9" />
          </Pressable>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
      </View>

      <FlatList
        data={queueUsers}
        keyExtractor={(item) => item.userId}
        renderItem={renderQueueUser}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#0EA5E9"
            colors={["#0EA5E9"]}
          />
        }
        ListHeaderComponent={
          <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* Header Title */}
            <View style={styles.titleRow}>
              <Text style={styles.title}>Queue</Text>
              <View style={styles.machineBadge}>
                <Text style={styles.machineBadgeText}>{machineId}</Text>
              </View>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: "#fef3c7" }]}>
                  <Ionicons name="time" size={20} color="#f59e0b" />
                </View>
                <Text style={styles.statNumber}>{waitingCount}</Text>
                <Text style={styles.statLabel}>In Queue</Text>
              </View>
              
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: "#fee2e2" }]}>
                  <Ionicons name="flash" size={20} color="#ef4444" />
                </View>
                <Text style={styles.statNumber}>{inUseCount}</Text>
                <Text style={styles.statLabel}>In Use</Text>
              </View>
            </View>

            {/* My Position Card */}
            {joined && myPosition && (
              <View style={styles.myPositionCard}>
                <LinearGradient
                  colors={isMyTurn ? ["#22c55e", "#16a34a"] : ["#8b5cf6", "#7c3aed"]}
                  style={styles.myPositionGradient}
                >
                  <View style={styles.myPositionContent}>
                    <View>
                      <Text style={styles.myPositionLabel}>
                        {isMyTurn ? "🎉 It's Your Turn!" : "Your Position"}
                      </Text>
                      <Text style={styles.myPositionNumber}>
                        {isMyTurn ? "Go ahead!" : `#${myPosition}`}
                      </Text>
                    </View>
                    {isMyTurn && (
                      <Pressable 
                        style={styles.scanNowButton}
                        onPress={() => router.push({
                          pathname: "/iot/qrscan",
                          params: { machineId },
                        })}
                      >
                        <Text style={styles.scanNowText}>Scan Now</Text>
                        <Ionicons name="scan" size={16} color="#22c55e" />
                      </Pressable>
                    )}
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Queue List Header */}
            <View style={styles.queueListHeader}>
              <Text style={styles.queueListTitle}>
                {queueUsers.length > 0 ? "People Waiting" : "Queue is Empty"}
              </Text>
            </View>
          </Animated.View>
        }
        ListEmptyComponent={
          <Animated.View style={[styles.emptyState, { opacity: fadeAnim }]}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="people-outline" size={48} color="#cbd5e1" />
            </View>
            <Text style={styles.emptyTitle}>No one in queue</Text>
            <Text style={styles.emptySubtitle}>Be the first to join!</Text>
          </Animated.View>
        }
        ListFooterComponent={<View style={{ height: 120 }} />}
      />

      {/* Floating Action Button */}
      <Animated.View style={[styles.fabContainer, { opacity: fadeAnim }]}>
        {joined ? (
          <Pressable
            style={({ pressed }) => [styles.fab, styles.fabLeave, pressed && { opacity: 0.9 }]}
            onPress={leaveQueue}
            disabled={loading}
          >
            <Ionicons name="exit-outline" size={22} color="#fff" />
            <Text style={styles.fabText}>{loading ? "Leaving..." : "Leave Queue"}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.fab, styles.fabJoin, pressed && { opacity: 0.9 }]}
            onPress={joinQueue}
            disabled={loading}
          >
            <Ionicons name="add" size={22} color="#fff" />
            <Text style={styles.fabText}>{loading ? "Joining..." : "Join Queue"}</Text>
          </Pressable>
        )}
      </Animated.View>
    </View>
  );
}

// Format time helper
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
    backgroundColor: "#fff",
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
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  machineBadge: {
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  machineBadgeText: {
    color: "#0284C7",
    fontWeight: "700",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 2,
  },
  myPositionCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    elevation: 6,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  myPositionGradient: {
    padding: 20,
  },
  myPositionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  myPositionLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  myPositionNumber: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 4,
  },
  scanNowButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  scanNowText: {
    color: "#22c55e",
    fontWeight: "700",
    fontSize: 14,
  },
  queueListHeader: {
    marginBottom: 12,
  },
  queueListTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748b",
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  queueItemMe: {
    backgroundColor: "#f0f9ff",
    borderColor: "#bae6fd",
  },
  positionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  positionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  queueUserInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queueUserName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  queueUserNameMe: {
    color: "#0284C7",
  },
  queueUserTime: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  chatButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f0f9ff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#94a3b8",
  },
  fabContainer: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  fabJoin: {
    backgroundColor: "#22c55e",
  },
  fabLeave: {
    backgroundColor: "#ef4444",
  },
  fabText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
