/**
 * Queue Screen
 * 
 * Shows live queue status with join/leave functionality.
 * Displays user position and turn notifications.
 */

import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  FlatList,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { useUser } from "@/components/UserContext";
import { useQueueRing } from "@/services/useQueueRing";
import { useQueueViewModel } from "@/viewmodels/tabs/QueueViewModel";
import Avatar from "@/components/Avatar";

const MACHINE_ID = "M001";

export default function QueueScreen() {
  const { user, loading: userLoading } = useUser();
  const {
    queue,
    queueUsers,
    joined,
    isMyTurn,
    waitingCount,
    inUseCount,
    myPosition,
    loading,
    joinQueue,
    leaveQueue,
  } = useQueueViewModel(MACHINE_ID, user?.uid, user?.name);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Ring notification when it's user's turn
  useQueueRing({
    machineId: MACHINE_ID,
    currentUserId: queue?.currentUserId ?? null,
    nextUserId: queue?.nextUserId ?? null,
    myUserId: user?.uid ?? "",
  });

  const renderUser = ({ item, index }: { item: any; index: number }) => {
    const isMe = item.userId === user?.uid;

    return (
      <View style={[styles.queueItem, isMe && styles.myQueueItem]}>
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{index + 1}</Text>
        </View>

        <Avatar
          name={item.name}
          avatarUrl={item.avatarUrl ?? null}
          size={44}
        />

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.queueName}>
            {isMe ? "You" : item.name}
          </Text>
          <Text style={styles.queueMeta}>
            Joined{" "}
            {item.joinedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {!isMe && (
          <View style={styles.actions}>
            <Pressable
              style={styles.actionCircle}
              onPress={() =>
                router.push({
                  pathname: "/contact",
                  params: {
                    targetUserId: item.userId,
                    targetName: item.name,
                  },
                })
              }
            >
              <Text style={styles.actionEmoji}>💬</Text>
            </Pressable>
            <Pressable
              style={styles.actionCircle}
              onPress={() =>
                router.push({
                  pathname: "/call/voice-incoming",
                  params: { name: item.name },
                })
              }
            >
              <Text style={styles.actionEmoji}>📞</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  if (userLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#0284C7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View
          style={[
            styles.decorCircle1,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decorCircle2,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          <View style={styles.headerSection}>
            <Text style={styles.title}>Live Queue</Text>
            <View style={styles.machineBadge}>
              <Text style={styles.machineBadgeText}>{MACHINE_ID}</Text>
            </View>
          </View>

          {/* Turn Banner */}
          {isMyTurn && (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/iot/qrscan",
                  params: { machineId: MACHINE_ID },
                })
              }
              style={styles.turnBannerWrapper}
            >
              <LinearGradient
                colors={["#22c55e", "#16a34a"]}
                style={styles.turnBanner}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.turnText}>
                  🎉 It's your turn! Tap to Start
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Position Banner (if in queue but not turn yet) */}
          {joined && !isMyTurn && myPosition && (
            <View style={styles.positionBanner}>
              <Text style={styles.positionBannerText}>
                📍 Your position: <Text style={styles.positionNumber}>#{myPosition}</Text>
              </Text>
            </View>
          )}

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Waiting</Text>
              <Text style={styles.statValue}>{waitingCount}</Text>
            </View>
            <View
              style={[
                styles.statCard,
                { borderLeftWidth: 1, borderLeftColor: "#e2e8f0" },
              ]}
            >
              <Text style={styles.statLabel}>In Use</Text>
              <Text style={styles.statValue}>{inUseCount}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Waitlist</Text>

          <FlatList
            data={queueUsers}
            keyExtractor={(i) => i.queueToken}
            renderItem={renderUser}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🎉</Text>
                <Text style={styles.emptyText}>No one waiting!</Text>
                <Text style={styles.emptySubtext}>
                  Join the queue to get in line
                </Text>
              </View>
            }
          />

          {/* Action Buttons */}
          <View style={styles.footer}>
            {joined ? (
              <Pressable
                style={({ pressed }) => [
                  styles.leaveButton,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={leaveQueue}
                disabled={loading}
              >
                <Text style={styles.leaveButtonText}>
                  {loading ? "Leaving..." : "Leave Queue"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.joinButtonWrapper,
                  pressed && styles.joinButtonPressed,
                ]}
                onPress={joinQueue}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#38BDF8", "#0EA5E9", "#0284C7"]}
                  style={styles.joinButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.joinButtonText}>
                    {loading ? "Joining..." : "Join Live Queue"}
                  </Text>
                  {!loading && <Text style={styles.joinButtonIcon}>⚡</Text>}
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  // Background
  backgroundDecor: { position: "absolute", width: "100%", height: "100%" },
  decorCircle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 100,
    left: -40,
  },

  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  machineBadge: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  machineBadgeText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statCard: { flex: 1, alignItems: "center" },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
  },

  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  myQueueItem: {
    borderColor: "#0EA5E9",
    borderWidth: 2,
    backgroundColor: "#f0f9ff",
  },
  positionBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  positionText: { fontSize: 12, fontWeight: "800", color: "#64748b" },
  queueName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  queueMeta: { fontSize: 12, color: "#94a3b8", marginTop: 2 },

  actions: { flexDirection: "row", gap: 8 },
  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  actionEmoji: { fontSize: 16 },

  turnBannerWrapper: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
  },
  turnBanner: { padding: 16, alignItems: "center" },
  turnText: { color: "#fff", fontWeight: "800", fontSize: 15 },

  positionBanner: {
    marginBottom: 20,
    backgroundColor: "#f0f9ff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  positionBannerText: {
    color: "#0369a1",
    fontSize: 15,
    fontWeight: "600",
  },
  positionNumber: {
    fontWeight: "800",
    fontSize: 18,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#64748b",
  },

  footer: {
    paddingVertical: 24,
    backgroundColor: "transparent",
  },

  joinButtonWrapper: {
    borderRadius: 20,
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 15,
  },
  joinButtonPressed: {
    transform: [{ scale: 0.97 }],
    elevation: 4,
  },
  joinButton: {
    flexDirection: "row",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    gap: 10,
  },
  joinButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  joinButtonIcon: {
    fontSize: 18,
  },

  leaveButton: {
    paddingVertical: 16,
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#fee2e2",
    backgroundColor: "#fff",
  },
  leaveButtonText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 16,
  },
});
