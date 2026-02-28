import { db } from "@/services/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export async function getNotificationSettings(userId: string) {
  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) throw new Error("User not found");

  const d = snap.data();

  return {
    enabled: d.notificationEnabled ?? true,
    machineReady: d.machineReadyNotifications ?? true,
    reminders: d.queueReminderNotifications ?? true,
  };
}

export async function updateNotificationSettings(
  userId: string,
  data: Partial<{
    enabled: boolean;
    machineReady: boolean;
    reminders: boolean;
  }>
) {
  await updateDoc(doc(db, "users", userId), {
    ...(data.enabled !== undefined && {
      notificationEnabled: data.enabled,
    }),
    ...(data.machineReady !== undefined && {
      machineReadyNotifications: data.machineReady,
    }),
    ...(data.reminders !== undefined && {
      queueReminderNotifications: data.reminders,
    }),
  });
}