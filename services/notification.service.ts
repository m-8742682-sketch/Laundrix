/**
 * Notification Service
 *
 * Sound mapping:
 *   notify.mp3  → chat messages
 *   calling.mp3 → incoming voice/video calls
 *   alarm.mp3   → grace period, unauthorized alert, clothes ready
 *   urgent.mp3  → unauthorized warning, grace expiry warning
 *   default     → queue updates, session start/end, missed call
 *
 * Android: channel sound names are raw resource names WITHOUT extension ("alarm" not "alarm.mp3").
 *          channelId belongs at top level of scheduleNotificationAsync, not inside content.
 * iOS:     sound uses full filename with extension ("alarm.mp3").
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
// NotificationType is defined locally — avoids resolving "@/types" as types.d.ts in some TS configs
type NotificationType =
  | "queue"
  | "unauthorized"
  | "laundry"
  | "system"
  | "chat"
  | "auth"
  | "verification"
  | "missedCall"
  | "missedVideo"
  | "incomingCall"
  | "incomingVideo";

export type { NotificationType };

// ─── iOS sound map ────────────────────────────────────────────────────────────

const IOS_SOUND_MAP: Record<string, string | boolean> = {
  critical: "alarm.mp3",
  calls: "calling.mp3",
  urgent: "urgent.mp3",
  chat: "notify.mp3",
  queue: true,
  default: true,
};

// ─── Foreground handler ───────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: "max" as any,
  }),
});

// ─── Permissions & Channels ───────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status: final } =
    existing !== "granted"
      ? await Notifications.requestPermissionsAsync()
      : { status: existing };

  if (final !== "granted") {
    console.warn("Notification permissions not granted");
    return false;
  }

  if (Platform.OS === "android") await createNotificationChannels();
  return true;
}

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS === "android") await createNotificationChannels();
}

async function createNotificationChannels() {
  type ChannelConfig = Parameters<typeof Notifications.setNotificationChannelAsync>[1];
  const channels: Array<[string, ChannelConfig]> = [
    ["critical", {
      name: "Critical Alerts",
      importance: Notifications.AndroidImportance.MAX,
      sound: "alarm",
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    }],
    ["calls", {
      name: "Incoming Calls",
      importance: Notifications.AndroidImportance.MAX,
      sound: "calling",
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    }],
    ["urgent", {
      name: "Urgent Alerts",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "urgent",
      vibrationPattern: [0, 300, 150, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
    ["chat", {
      name: "Chat Messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "notify",
      vibrationPattern: [0, 200, 100, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
    ["queue", {
      name: "Queue Updates",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
    ["default", {
      name: "General",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
  ];

  for (const [channelId, config] of channels) {
    await Notifications.setNotificationChannelAsync(channelId, config);
  }
}

// ─── Init & Token ─────────────────────────────────────────────────────────────

export async function initializeNotifications(userId: string): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log("[Notifications] Skipping — not a physical device");
      return false;
    }
    const granted = await requestPermissions();
    if (!granted) return false;
    await saveFCMToken(userId);
    console.log("[Notifications] Initialized successfully");
    return true;
  } catch (err) {
    console.error("[Notifications] Init failed:", err);
    return false;
  }
}

export async function saveFCMToken(userId: string): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      console.warn("[FCM] Permissions not granted");
      return null;
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: "9cf0bd07-6af7-49ef-a948-35b7e3140a8a",
      })
    ).data;

    await setDoc(
      doc(getFirestore(), "users", userId),
      { fcmToken: token, fcmTokenType: "expo", tokenUpdatedAt: serverTimestamp() },
      { merge: true }
    );

    console.log("[Notifications] Expo token saved:", token.substring(0, 30) + "...");
    return token;
  } catch (err) {
    console.error("[Notifications] Failed to save token:", err);
    return null;
  }
}

// ─── Core: show local notification ───────────────────────────────────────────

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId = "default"
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === "ios" ? { sound: IOS_SOUND_MAP[channelId] ?? true } : {}),
    },
    // Android: channelId at top level, NOT inside content
    ...(Platform.OS === "android" ? { android: { channelId } } as any : {}),
    trigger: null,
  });
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function storeNotification(
  userId: string,
  title: string,
  body: string,
  type: NotificationType
) {
  try {
    await addDoc(collection(getFirestore(), "notifications"), {
      userId,
      title,
      body,
      type,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("[Notifications] Failed to store notification:", err);
  }
}

// ─── Listener helpers ─────────────────────────────────────────────────────────

export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => Notifications.addNotificationResponseReceivedListener(callback);

export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => Notifications.addNotificationReceivedListener(callback);

// ─── Notification helpers ─────────────────────────────────────────────────────

export const queueNotifications = {
  async yourTurn(userId: string, machineName: string) {
    const title = "It's Your Turn!";
    const body = `${machineName} is ready for you. Scan the QR code to start.`;
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", alarm: true, machineId: machineName }, "critical");
  },
  async graceWarning(userId: string, machineName: string) {
    const title = "Hurry Up!";
    const body = `Only 3 minutes left to claim ${machineName}!`;
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName }, "urgent");
  },
  async graceExpired(userId: string, machineName: string) {
    const title = "Time's Up!";
    const body = `You've been removed from the queue for ${machineName}`;
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName }, "urgent");
  },
  async queueJoined(userId: string, machineName: string, position: number) {
    const title = "Joined Queue";
    const body = `You're #${position} in line for ${machineName}`;
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName, position }, "queue");
  },
  async queueLeft(userId: string, machineName: string) {
    const title = "Left Queue";
    const body = `You've left the queue for ${machineName}`;
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName }, "default");
  },
};

export const laundryNotifications = {
  async sessionStarted(userId: string, machineName: string) {
    const title = "Session Started";
    const body = `Your session on ${machineName} has begun`;
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", machineId: machineName }, "queue");
  },
  async sessionEnded(userId: string, machineName: string) {
    const title = "Session Ended";
    const body = `Your session on ${machineName} has ended`;
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", machineId: machineName }, "default");
  },
  async clothesReady(userId: string, machineName: string) {
    const title = "Clothes Ready!";
    const body = `Your laundry on ${machineName} is done. Please collect your clothes.`;
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", alarm: true, machineId: machineName }, "critical");
  },
  async laundryConfirmed(userId: string, machineName: string) {
    const title = "Laundry Started!";
    const body = `Your laundry is now running on ${machineName}`;
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", machineId: machineName }, "default");
  },
};

export const unauthorizedNotifications = {
  async unauthorizedAlert(userId: string, machineName: string, intruderName: string) {
    const title = "Someone at Your Machine!";
    const body = `${intruderName} is trying to use ${machineName}. Is this you?`;
    await storeNotification(userId, title, body, "unauthorized");
    await showLocalNotification(title, body, { type: "unauthorized", alarm: true, machineId: machineName, intruderName }, "critical");
  },
  async notYourTurn(userId: string, machineName: string, rightfulUserName: string) {
    const title = "Not Your Turn!";
    const body = `${machineName} is reserved for ${rightfulUserName}. Please wait for your turn.`;
    await storeNotification(userId, title, body, "unauthorized");
    await showLocalNotification(title, body, { type: "unauthorized", machineId: machineName }, "urgent");
  },
};

export const chatNotifications = {
  async messageReceived(userId: string, senderName: string, preview: string, machineId: string) {
    const title = senderName;
    const body = preview.length > 50 ? preview.substring(0, 50) + "..." : preview;
    await storeNotification(userId, title, body, "chat");
    await showLocalNotification(title, body, { type: "chat", senderName, machineId, preview }, "chat");
  },
};

export const callNotifications = {
  async incomingVoice(callerName: string, callId: string) {
    await showLocalNotification(
      "Incoming Call",
      `${callerName} is calling you`,
      { type: "incomingCall", callType: "voice", callId },
      "calls"
    );
  },
  async incomingVideo(callerName: string, callId: string) {
    await showLocalNotification(
      "Incoming Video Call",
      `${callerName} is video calling you`,
      { type: "incomingVideo", callType: "video", callId },
      "calls"
    );
  },
  async missedVoice(userId: string, callerName: string) {
    const title = "Missed Call";
    const body = `You missed a call from ${callerName}`;
    await storeNotification(userId, title, body, "missedCall");
    await showLocalNotification(title, body, { type: "missedCall", callType: "voice" }, "default");
  },
  async missedVideo(userId: string, callerName: string) {
    const title = "Missed Video Call";
    const body = `You missed a video call from ${callerName}`;
    await storeNotification(userId, title, body, "missedVideo");
    await showLocalNotification(title, body, { type: "missedVideo", callType: "video" }, "default");
  },
};
