import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  Animated,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useUser } from "@/components/UserContext";
import { useHistoryViewModel } from "@/viewmodels/tabs/HistoryViewModel";

export default function HistoryScreen() {
  const { user, loading: userLoading } = useUser();
  const { history, loading } = useHistoryViewModel(user?.uid);

  /* Animations (same feel as Dashboard) */
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
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
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  if (loading || userLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0284C7" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Decorative background */}
      <View style={styles.backgroundDecor} pointerEvents="none">
        <Animated.View
          style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]}
        />
        <Animated.View
          style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]}
        />
      </View>

      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Header */}
        <Text style={styles.title}>Usage History</Text>
        <Text style={styles.subtitle}>
          Your past laundry sessions
        </Text>

        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyText}>
              No usage records yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.machine}>
                    Machine {item.machineId}
                  </Text>

                  <View
                    style={[
                      styles.statusBadge,
                      item.resultStatus === "Normal"
                        ? styles.ok
                        : styles.warn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        item.resultStatus === "Normal"
                          ? styles.okText
                          : styles.warnText,
                      ]}
                    >
                      {item.resultStatus || "Normal"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.meta}>
                  {item.startTime.toLocaleDateString()} •{" "}
                  {item.startTime.toLocaleTimeString()} –{" "}
                  {item.endTime.toLocaleTimeString()}
                </Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detail}>
                    Load: {item.load} kg
                  </Text>
                  <Text style={styles.detail}>
                    Duration: {item.duration} min
                  </Text>
                </View>
              </View>
            )}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* Background decor */
  backgroundDecor: {
    ...StyleSheet.absoluteFillObject,
  },

  decorCircle1: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#E0F2FE",
    opacity: 0.6,
    top: -80,
    right: -80,
  },

  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#BAE6FD",
    opacity: 0.45,
    bottom: 80,
    left: -60,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },

  emptyState: {
    alignItems: "center",
    marginTop: 60,
  },

  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },

  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  machine: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },

  ok: {
    backgroundColor: "#dcfce7",
  },

  okText: {
    color: "#166534",
  },

  warn: {
    backgroundColor: "#fee2e2",
  },

  warnText: {
    color: "#991b1b",
  },

  meta: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 10,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  detail: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
});