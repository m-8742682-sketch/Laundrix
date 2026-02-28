import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/repositories/settings/NotificationSettingsRepository";

// Key for AsyncStorage - used by NotificationPopup component
const NOTIFICATIONS_ENABLED_KEY = "notifications_enabled";

export function useNotificationSettingsViewModel(userId?: string) {
  const [loading, setLoading] = useState(true);

  const [enabled, setEnabled] = useState(true);
  const [machineReady, setMachineReady] = useState(true);
  const [reminders, setReminders] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      const data = await getNotificationSettings(userId);
      setEnabled(data.enabled);
      setMachineReady(data.machineReady);
      setReminders(data.reminders);
      
      // Sync to AsyncStorage for NotificationPopup
      await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(data.enabled));
      
      setLoading(false);
    };

    load();
  }, [userId]);

  const toggleAll = async (value: boolean) => {
    if (!userId) return;

    setEnabled(value);
    setMachineReady(value);
    setReminders(value);

    // Update Firestore
    await updateNotificationSettings(userId, {
      enabled: value,
      machineReady: value,
      reminders: value,
    });
    
    // Update AsyncStorage for NotificationPopup
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, String(value));
  };

  const toggleMachineReady = async (value: boolean) => {
    if (!userId) return;
    setMachineReady(value);
    await updateNotificationSettings(userId, {
      machineReady: value,
    });
  };

  const toggleReminders = async (value: boolean) => {
    if (!userId) return;
    setReminders(value);
    await updateNotificationSettings(userId, {
      reminders: value,
    });
  };

  return {
    loading,
    enabled,
    machineReady,
    reminders,
    toggleAll,
    toggleMachineReady,
    toggleReminders,
  };
}
