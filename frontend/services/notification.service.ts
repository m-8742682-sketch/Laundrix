/**
 * Notification Service
 * 
 * Handles LOCAL notification creation and FCM token management.
 * For BACKEND notifications (sending to other users), use api.ts
 * 
 * Supports alarm-style notifications with continuous ringing.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { getFirestore, doc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";

// Notification types matching backend expectations
export type NotificationType =
  | "queue"           // Queue-related (your turn, grace period)
  | "unauthorized"    // Unauthorized access alerts
  | "laundry"         // Laundry status (clothes ready)
  | "system"          // System messages
  | "chat"            // Chat messages
  | "auth"            // Authentication
  | "verification"    // Verification
  | "missedCall"      // Missed calls
  | "missedVideo"     // Missed video calls
  | "incomingCall"    // Incoming calls
  | "incomingVideo";  // Incoming video calls

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Notification permissions not granted");
    return false;
  }

  // Create Android notification channels
  if (Platform.OS === "android") {
    await createNotificationChannels();
  }

  return true;
}

/**
 * Create Android notification channels for different alert types
 */
async function createNotificationChannels() {
  // Critical alerts channel (alarm sound, bypass DND)
  await Notifications.setNotificationChannelAsync("critical", {
    name: "Critical Alerts",
    importance: Notifications.AndroidImportance.MAX,
    sound: "alarm.mp3",
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  // Queue updates channel
  await Notifications.setNotificationChannelAsync("queue", {
    name: "Queue Updates",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Urgent channel (for warnings)
  await Notifications.setNotificationChannelAsync("urgent", {
    name: "Urgent Alerts",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "urgent.mp3",
    vibrationPattern: [0, 300, 150, 300],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Chat channel
  await Notifications.setNotificationChannelAsync("chat", {
    name: "Chat Messages",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 200, 100, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Calls channel
  await Notifications.setNotificationChannelAsync("calls", {
    name: "Incoming Calls",
    importance: Notifications.AndroidImportance.MAX,
    sound: "alarm.mp3",
    vibrationPattern: [0, 500, 200, 500, 200, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  // General channel
  await Notifications.setNotificationChannelAsync("default", {
    name: "General",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: "default",
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Initialize notifications - call on app start/login
 */
export async function initializeNotifications(userId: string): Promise<boolean> {
  try {
    if (!Device.isDevice) {
      console.log("[Notifications] Skipping - not a physical device");
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

/**
 * Get and save FCM token to user's Firestore document
 */
export async function saveFCMToken(userId: string): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus !== 'granted') {
      console.warn("[FCM] Permissions not granted");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '9cf0bd07-6af7-49ef-a948-35b7e3140a8a'
    })).data;

    const db = getFirestore();
    await setDoc(
      doc(db, "users", userId),
      { 
        fcmToken: token,
        fcmTokenType: 'expo',
        tokenUpdatedAt: serverTimestamp() 
      },
      { merge: true }
    );

    console.log("[Notifications] Expo token saved:", token.substring(0, 30) + "...");
    return token;
  } catch (err) {
    console.error("[Notifications] Failed to save token:", err);
    return null;
  }
}

/**
 * Store notification in Firestore for history
 */
async function storeNotification(
  userId: string,
  title: string,
  body: string,
  type: NotificationType
) {
  try {
    const db = getFirestore();
    await addDoc(collection(db, "notifications"), {
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

/**
 * Show local notification immediately
 */
export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId: string = "default"
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: channelId === "critical" || channelId === "calls" ? "alarm.mp3" : 
             channelId === "urgent" ? "urgent.mp3" : "default",
    },
    trigger: null,
  });
}

/**
 * Add notification response listener (for tap handling)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (for foreground handling)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

// ============================================
// Convenience methods organized by category
// ============================================

/**
 * Queue notifications
 */
export const queueNotifications = {
  async yourTurn(userId: string, machineName: string) {
    const title = "🎉 It's Your Turn!";
    const body = `${machineName} is ready for you. Scan the QR code to start.`;
    
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(
      title, body,
      { type: "queue", alarm: true, priority: "critical", machineId: machineName },
      "critical"
    );
  },

  async graceWarning(userId: string, machineName: string) {
    const title = "⚠️ Hurry Up!";
    const body = `Only 3 minutes left to claim ${machineName}!`;
    
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(
      title, body,
      { type: "queue", priority: "high", machineId: machineName },
      "urgent"
    );
  },

  async graceExpired(userId: string, machineName: string) {
    const title = "⏰ Time's Up!";
    const body = `You've been removed from the queue for ${machineName}`;
    
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName }, "urgent");
  },

  async queueJoined(userId: string, machineName: string, position: number) {
    const title = "📋 Joined Queue";
    const body = `You're #${position} in line for ${machineName}`;
    
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName, position }, "queue");
  },

  async queueLeft(userId: string, machineName: string) {
    const title = "👋 Left Queue";
    const body = `You've left the queue for ${machineName}`;
    
    await storeNotification(userId, title, body, "queue");
    await showLocalNotification(title, body, { type: "queue", machineId: machineName }, "default");
  },
};

/**
 * Laundry/session notifications
 */
export const laundryNotifications = {
  async sessionStarted(userId: string, machineName: string) {
    const title = "✅ Session Started";
    const body = `Your session on ${machineName} has begun`;
    
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", machineId: machineName }, "queue");
  },

  async sessionEnded(userId: string, machineName: string) {
    const title = "🏁 Session Ended";
    const body = `Your session on ${machineName} has ended`;
    
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", machineId: machineName }, "default");
  },

  async clothesReady(userId: string, machineName: string) {
    const title = "✅ Clothes Ready!";
    const body = `Your laundry on ${machineName} is done. Please collect your clothes.`;
    
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(
      title, body,
      { type: "laundry", alarm: true, machineId: machineName },
      "critical"
    );
  },

  async laundryConfirmed(userId: string, machineName: string) {
    const title = "🧺 Laundry Started!";
    const body = `Your laundry is now running on ${machineName}`;
    
    await storeNotification(userId, title, body, "laundry");
    await showLocalNotification(title, body, { type: "laundry", machineId: machineName });
  },
};

/**
 * Unauthorized access notifications
 */
export const unauthorizedNotifications = {
  async unauthorizedAlert(userId: string, machineName: string, intruderName: string) {
    const title = "🚨 Someone at Your Machine!";
    const body = `${intruderName} is trying to use ${machineName}. Is this you?`;
    
    await storeNotification(userId, title, body, "unauthorized");
    await showLocalNotification(
      title, body,
      { type: "unauthorized", alarm: true, priority: "critical", machineId: machineName, intruderName },
      "critical"
    );
  },

  async notYourTurn(userId: string, machineName: string, rightfulUserName: string) {
    const title = "⛔ Not Your Turn!";
    const body = `${machineName} is reserved for ${rightfulUserName}. Please wait for your turn.`;
    
    await storeNotification(userId, title, body, "unauthorized");
    await showLocalNotification(title, body, { type: "unauthorized", machineId: machineName }, "queue");
  },
};

/**
 * Chat notifications
 */
export const chatNotifications = {
  async messageReceived(userId: string, senderName: string, preview: string, machineId: string) {
    const title = `💬 ${senderName}`;
    const body = preview.length > 50 ? preview.substring(0, 50) + "..." : preview;
    
    await storeNotification(userId, title, body, "chat");
    await showLocalNotification(
      title, body,
      { type: "chat", senderName, machineId, preview },
      "chat"
    );
  },
};

/**
 * Call notifications (LOCAL only - for incoming calls on this device)
 * For SENDING call notifications to OTHER users, use api.ts:
 * - notifyIncomingCall()
 * - notifyMissedCall()
 */
export const callNotifications = {
  async incomingVoice(callerName: string, callId: string) {
    await showLocalNotification(
      "📞 Incoming Call",
      `${callerName} is calling you`,
      { type: "incomingCall", callType: "voice", callId },
      "calls"
    );
  },

  async incomingVideo(callerName: string, callId: string) {
    await showLocalNotification(
      "📹 Incoming Video Call",
      `${callerName} is video calling you`,
      { type: "incomingVideo", callType: "video", callId },
      "calls"
    );
  },

  async missedVoice(userId: string, callerName: string) {
    const title = "📵 Missed Call";
    const body = `You missed a call from ${callerName}`;
    
    await storeNotification(userId, title, body, "missedCall");
    await showLocalNotification(title, body, { type: "missedCall", callType: "voice" }, "default");
  },

  async missedVideo(userId: string, callerName: string) {
    const title = "📵 Missed Video Call";
    const body = `You missed a video call from ${callerName}`;
    
    await storeNotification(userId, title, body, "missedVideo");
    await showLocalNotification(title, body, { type: "missedVideo", callType: "video" }, "default");
  },
};

// Backward compatibility - single export object
export const notificationService = {
  ...queueNotifications,
  ...laundryNotifications,
  ...unauthorizedNotifications,
  ...chatNotifications,
  ...callNotifications,
  
  // Legacy method names for backward compatibility
  yourTurn: queueNotifications.yourTurn,
  graceWarning: queueNotifications.graceWarning,
  graceExpired: queueNotifications.graceExpired,
  queueJoined: queueNotifications.queueJoined,
  queueLeft: queueNotifications.queueLeft,
  sessionStarted: laundryNotifications.sessionStarted,
  sessionEnded: laundryNotifications.sessionEnded,
  clothesReady: laundryNotifications.clothesReady,
  laundryConfirmed: laundryNotifications.laundryConfirmed,
  unauthorizedAlert: unauthorizedNotifications.unauthorizedAlert,
  notYourTurn: unauthorizedNotifications.notYourTurn,
  chatMessage: chatNotifications.messageReceived,
  incomingVoiceCall: callNotifications.incomingVoice,
  incomingVideoCall: callNotifications.incomingVideo,
  missedVoiceCall: callNotifications.missedVoice,
  missedVideoCall: callNotifications.missedVideo,
};