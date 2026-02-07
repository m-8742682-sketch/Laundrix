import { useUser } from "@/components/UserContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNotificationSettingsViewModel } from "@/viewmodels/settings/NotificationSettingsViewModel";

export default function NotificationSettings() {
  const { user, loading: userLoading } = useUser();

  const {
    loading,
    enabled,
    machineReady,
    reminders,
    toggleAll,
    toggleMachineReady,
    toggleReminders,
  } = useNotificationSettingsViewModel(user?.uid);

  if (loading || userLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.card}>
          <SettingToggle
            icon="notifications-outline"
            label="Enable notifications"
            value={enabled}
            onChange={toggleAll}
          />
        </View>

        <Text style={styles.sectionTitle}>Alerts</Text>
        <View style={styles.card}>
          <SettingToggle
            icon="checkmark-circle-outline"
            label="Machine ready"
            subLabel="When your laundry is done"
            value={machineReady}
            onChange={toggleMachineReady}
            disabled={!enabled}
          />
          <SettingToggle
            icon="time-outline"
            label="Queue reminders"
            subLabel="When it’s almost your turn"
            value={reminders}
            onChange={toggleReminders}
            disabled={!enabled}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- TOGGLE ---------- */
function SettingToggle({
  icon,
  label,
  subLabel,
  value,
  onChange,
  disabled,
}: any) {
  return (
    <View style={[styles.item, disabled && { opacity: 0.5 }]}>
      <View style={styles.itemLeft}>
        <Ionicons name={icon} size={20} color="#111827" />
        <View>
          <Text style={styles.itemText}>{label}</Text>
          {subLabel && <Text style={styles.subLabel}>{subLabel}</Text>}
        </View>
      </View>

      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 16,
    marginBottom: 20,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  subLabel: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
  info: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
  },
  infoText: {
    fontSize: 12,
    color: "#6b7280",
    flex: 1,
  },
});