import { useEffect, useState } from "react";
import {
  getNotificationSettings,
  updateNotificationSettings,
} from "@/repositories/settings/NotificationSettingsRepository";

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
      setLoading(false);
    };

    load();
  }, [userId]);

  const toggleAll = async (value: boolean) => {
    if (!userId) return;

    setEnabled(value);
    setMachineReady(value);
    setReminders(value);

    await updateNotificationSettings(userId, {
      enabled: value,
      machineReady: value,
      reminders: value,
    });
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