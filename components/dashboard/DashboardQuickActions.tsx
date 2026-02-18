import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onViewMachines: () => void;
  onJoinQueue: () => void;
  onScan: () => void;
  onChat: () => void;
}

export default function DashboardQuickActions({
  onViewMachines,
  onJoinQueue,
  onScan,
  onChat,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Actions</Text>
      
      <View style={styles.grid}>
        <ActionButton
          icon="eye"
          label="View All Machines"
          colors={["#22D3EE", "#06B6D4"]}
          onPress={onViewMachines}
        />
        <ActionButton
          icon="list"
          label="Join Queue"
          colors={["#8B5CF6", "#7C3AED"]}
          onPress={onJoinQueue}
        />
        <ActionButton
          icon="scan"
          label="Scan to Use"
          colors={["#10B981", "#059669"]}
          onPress={onScan}
        />
        <ActionButton
          icon="chatbubbles"
          label="Chat with Users"
          colors={["#0EA5E9", "#0284C7"]}
          onPress={onChat}
        />
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: [string, string];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <LinearGradient colors={colors} style={styles.gradient}>
        <Ionicons name={icon} size={24} color="#fff" />
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  button: {
    flex: 1,
    minWidth: "45%",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  gradient: {
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
});