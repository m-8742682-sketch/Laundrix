import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "@/components/Avatar";

interface Props {
  userName: string;
  userAvatarUrl: string | null;
  onScanPress: () => void;
  onNotificationsPress: () => void;
  onSettingsPress: () => void;
  onProfilePress: () => void;
}

export default function DashboardHeader({
  userName,
  userAvatarUrl,
  onScanPress,
  onNotificationsPress,
  onSettingsPress,
  onProfilePress,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Top Row: Icons Right */}
      <View style={styles.topRow}>
        <View style={{ flex: 1 }} />
        <View style={styles.actionsRow}>
          <Pressable onPress={onScanPress} style={styles.iconBtn}>
            <Ionicons name="scan-outline" size={22} color="#64748B" />
          </Pressable>
          <Pressable onPress={onNotificationsPress} style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={22} color="#64748B" />
          </Pressable>
          <Pressable onPress={onSettingsPress} style={styles.iconBtn}>
            <Ionicons name="settings-outline" size={22} color="#64748B" />
          </Pressable>
        </View>
      </View>

      {/* Bottom Row: Greeting Left, Avatar Right */}
      <View style={styles.bottomRow}>
        <View style={styles.greetingSection}>
          <Text style={styles.greetingLabel}>Good Morning,</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
        
        <Pressable onPress={onProfilePress} style={styles.avatarButton}>
          <LinearGradient colors={["#06B6D4", "#0891B2"]} style={styles.avatarGradient}>
            <Avatar name={userName} avatarUrl={userAvatarUrl} size={40} />
          </LinearGradient>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greetingSection: {
    flex: 1,
  },
  greetingLabel: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "500",
    marginBottom: 4,
  },
  userName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  avatarButton: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#06B6D4",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarGradient: {
    padding: 2,
    borderRadius: 16,
  },
});