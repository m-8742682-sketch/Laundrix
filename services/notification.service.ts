/**
 * Notification Service
 *
 * Architecture:
 *   - expo-notifications  → channels, permissions, local notifications
 *   - @react-native-firebase/messaging (modular v22 API) → FCM token, background handling
 *
 * Flow for push notifications when app is killed/background:
 *   Backend (fcm.ts) → Firebase FCM → Firebase Messaging SDK → OS notification bar ✓
 *
 * Flow for in-app notifications (foreground):
 *   expo-notifications setNotificationHandler → shouldShowAlert: true → banner ✓
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking, Alert } from 'react-native';
// v22 modular API — no more messaging() namespace calls
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { getApp } from '@react-native-firebase/app';
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

type NotificationType =
  | 'queue'
  | 'unauthorized'
  | 'laundry'
  | 'system'
  | 'chat'
  | 'auth'
  | 'verification'
  | 'missedCall'
  | 'missedVideo'
  | 'incomingCall'
  | 'incomingVideo';

export type { NotificationType };

// ─── iOS sound map ────────────────────────────────────────────────────────────

const IOS_SOUND_MAP: Record<string, string | boolean> = {
  critical: 'alarm.mp3',
  calls:    'calling.mp3',
  urgent:   'urgent.mp3',
  chat:     'notify.mp3',
  queue:    true,
  default:  true,
};

// ─── Foreground notification handler ─────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound:  true,
    shouldSetBadge:   true,
    shouldShowBanner: true,
    shouldShowList:   true,
    priority: 'max' as any,
  }),
});

// ─── Permissions & Channels ───────────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    const { status: final } =
      existing !== 'granted'
        ? await Notifications.requestPermissionsAsync({
            ios: {
              // Request all iOS permission flags including critical alerts
              alert: true,
              badge: true,
              sound: true,
              criticalAlert: true,      // Bypasses Do Not Disturb (requires entitlement)
              provisional: true,        // Silent delivery while waiting for explicit grant
            },
          })
        : { status: existing };

    if (final !== 'granted') {
      console.warn('[Notifications] Permission denied');
      return false;
    }

    // v22 modular: requestPermission(messaging)
    const messaging   = getMessaging(getApp());
    const authStatus  = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('[Notifications] Firebase messaging permission denied');
    }

    if (Platform.OS === 'android') {
      await createNotificationChannels();
      // Android 14+ (API 34+): USE_FULL_SCREEN_INTENT must be granted by the user.
      // Without it, calls/grace/incident alerts can't display over the lock screen.
      await checkAndRequestFullScreenIntent();
    }
    return true;
  } catch (err) {
    console.error('[Notifications] requestPermissions failed:', err);
    return false;
  }
}

export async function ensureNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') await createNotificationChannels();
}

/**
 * Android 14+ (API 34+): USE_FULL_SCREEN_INTENT permission must be explicitly
 * granted by the user in Settings. Without it, incoming calls, grace alerts, and
 * incident notifications cannot display as a full-screen overlay on the lock screen.
 *
 * On Android < 14, the permission is auto-granted — nothing to do.
 * On Android ≥ 14, we check and prompt the user to go to Settings if needed.
 */
async function checkAndRequestFullScreenIntent(): Promise<void> {
  try {
    // Only Android 14+ (API 34+) needs manual grant
    const sdkInt = Device.platformApiLevel ?? 0;
    if (Platform.OS !== 'android' || sdkInt < 34) return;

    // Use NativeModules to check if USE_FULL_SCREEN_INTENT is granted
    // (expo-notifications doesn't expose this yet, so we use the Android Settings intent)
    const { NativeModules } = require('react-native');
    const NotificationManager = NativeModules?.ExpoNotifications;

    // If we can't check, prompt anyway on first run
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const key = 'laundrix:fullScreenIntentPrompted';
    const alreadyPrompted = await AsyncStorage.getItem(key);
    if (alreadyPrompted) return;

    await AsyncStorage.setItem(key, 'true');
    Alert.alert(
      '⚠️ Enable Full-Screen Alerts',
      'To show incoming calls and alarms over your lock screen, Laundrix needs the "Display over other apps" / "Full-screen intent" permission.\n\nTap OK to open Settings.',
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            // Android 14+ Settings page for USE_FULL_SCREEN_INTENT
            Linking.openSettings();
          },
        },
      ]
    );
  } catch (err) {
    console.warn('[Notifications] Full-screen intent check failed:', err);
  }
}

async function createNotificationChannels() {
  type ChannelConfig = Parameters<typeof Notifications.setNotificationChannelAsync>[1];
  const channels: Array<[string, ChannelConfig]> = [
    ['critical', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'alarm',
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    }],
    ['calls', {
      name: 'Incoming Calls',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'calling',
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    }],
    ['urgent', {
      name: 'Urgent Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'urgent',
      vibrationPattern: [0, 300, 150, 300],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
    ['chat', {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'notify',
      vibrationPattern: [0, 200, 100, 200],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
    ['queue', {
      name: 'Queue Updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }],
    ['default', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
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
      console.log('[Notifications] Skipping — not a physical device');
      return false;
    }

    const granted = await requestPermissions();
    if (!granted) return false;

    await saveFCMToken(userId);
    setupForegroundMessageHandler();

    console.log('[Notifications] Initialized successfully');
    return true;
  } catch (err) {
    console.error('[Notifications] Init failed:', err);
    return false;
  }
}

export async function saveFCMToken(userId: string): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[FCM] Permissions not granted');
      return null;
    }

    let token: string | null = null;

    // v22 modular: getToken(messaging)
    try {
      const messaging = getMessaging(getApp());
      token = await getToken(messaging);
      console.log('[Notifications] Native FCM token obtained');
    } catch (fcmErr) {
      console.warn('[Notifications] Native FCM token failed, falling back to Expo token:', fcmErr);
    }

    // Fallback to Expo push token
    if (!token) {
      try {
        const expoPushToken = await Notifications.getExpoPushTokenAsync({
          projectId: '9cf0bd07-6af7-49ef-a948-35b7e3140a8a',
        });
        token = expoPushToken.data;
        console.log('[Notifications] Expo push token obtained');
      } catch (expoErr) {
        console.error('[Notifications] Both token methods failed:', expoErr);
        return null;
      }
    }

    if (!token) return null;

    await setDoc(
      doc(getFirestore(), 'users', userId),
      {
        fcmToken:       token,
        fcmTokenType:   token.startsWith('ExponentPushToken') ? 'expo' : 'native',
        tokenUpdatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    console.log('[Notifications] Token saved:', token.substring(0, 30) + '...');
    return token;
  } catch (err) {
    console.error('[Notifications] Failed to save token:', err);
    return null;
  }
}

// v22 modular: onMessage(messaging, handler)
function setupForegroundMessageHandler(): void {
  const messaging = getMessaging(getApp());
  onMessage(messaging, async (remoteMessage) => {
    console.log('[FCM] Foreground message:', remoteMessage.notification?.title);
    const title = remoteMessage.notification?.title ?? '';
    const body  = remoteMessage.notification?.body  ?? '';
    const data  = remoteMessage.data ?? {};
    if (title) {
      await showLocalNotification(title, body, data as any, resolveChannelFromData(data));
    }
  });
}

function resolveChannelFromData(data: Record<string, any>): string {
  const type = data?.type ?? '';
  if (['your_turn', 'unauthorized_alert', 'clothes_ready'].includes(type)) return 'critical';
  if (['voice_call', 'video_call'].includes(type)) return 'calls';
  if (['grace_warning', 'unauthorized_warning', 'removed_from_queue'].includes(type)) return 'urgent';
  if (type === 'chat_message') return 'chat';
  if (['queue_joined', 'queue_left', 'session_started', 'session_ended'].includes(type)) return 'queue';
  return 'default';
}

// ─── Core: show local notification ───────────────────────────────────────────

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId = 'default'
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      ...(Platform.OS === 'ios' ? { sound: IOS_SOUND_MAP[channelId] ?? true } : {}),
    },
    ...(Platform.OS === 'android' ? { android: { channelId } } as any : {}),
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
    await addDoc(collection(getFirestore(), 'notifications'), {
      userId,
      title,
      body,
      type,
      read:      false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('[Notifications] Failed to store notification:', err);
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
    const body  = `${machineName} is ready for you. Scan the QR code to start.`;
    await storeNotification(userId, title, body, 'queue');
    // Use notifee full-screen for grace period — wakes screen even when locked
    try {
      const { showGracePeriodNotification } = await import('@/services/notifee.service');
      await showGracePeriodNotification(machineName, 5);
    } catch {
      await showLocalNotification(title, body, { type: 'your_turn', alarm: true, machineId: machineName }, 'critical');
    }
  },
  async graceWarning(userId: string, machineName: string) {
    const title = 'Hurry Up!';
    const body  = `Only 3 minutes left to claim ${machineName}!`;
    await storeNotification(userId, title, body, 'queue');
    await showLocalNotification(title, body, { type: 'queue', machineId: machineName }, 'urgent');
  },
  async graceExpired(userId: string, machineName: string) {
    const title = "Time's Up!";
    const body  = `You've been removed from the queue for ${machineName}`;
    await storeNotification(userId, title, body, 'queue');
    await showLocalNotification(title, body, { type: 'queue', machineId: machineName }, 'urgent');
  },
  async queueJoined(userId: string, machineName: string, position: number) {
    const title = 'Joined Queue';
    const body  = `You're #${position} in line for ${machineName}`;
    await storeNotification(userId, title, body, 'queue');
    await showLocalNotification(title, body, { type: 'queue', machineId: machineName, position }, 'queue');
  },
  async queueLeft(userId: string, machineName: string) {
    const title = 'Left Queue';
    const body  = `You've left the queue for ${machineName}`;
    await storeNotification(userId, title, body, 'queue');
    await showLocalNotification(title, body, { type: 'queue', machineId: machineName }, 'default');
  },
};

export const laundryNotifications = {
  async sessionStarted(userId: string, machineName: string) {
    const title = 'Session Started';
    const body  = `Your session on ${machineName} has begun`;
    await storeNotification(userId, title, body, 'laundry');
    await showLocalNotification(title, body, { type: 'laundry', machineId: machineName }, 'queue');
  },
  async sessionEnded(userId: string, machineName: string) {
    const title = 'Session Ended';
    const body  = `Your session on ${machineName} has ended`;
    await storeNotification(userId, title, body, 'laundry');
    await showLocalNotification(title, body, { type: 'laundry', machineId: machineName }, 'default');
  },
  async clothesReady(userId: string, machineName: string) {
    const title = 'Clothes Ready!';
    const body  = `Your laundry on ${machineName} is done. Please collect your clothes.`;
    await storeNotification(userId, title, body, 'laundry');
    await showLocalNotification(title, body, { type: 'laundry', alarm: true, machineId: machineName }, 'critical');
  },
  async laundryConfirmed(userId: string, machineName: string) {
    const title = 'Laundry Started!';
    const body  = `Your laundry is now running on ${machineName}`;
    await storeNotification(userId, title, body, 'laundry');
    await showLocalNotification(title, body, { type: 'laundry', machineId: machineName }, 'default');
  },
};

export const unauthorizedNotifications = {
  async unauthorizedAlert(userId: string, machineName: string, intruderName: string) {
    const title = 'Someone at Your Machine!';
    const body  = `${intruderName} is trying to use ${machineName}. Is this you?`;
    await storeNotification(userId, title, body, 'unauthorized');
    // Use notifee full-screen — wakes screen so owner can respond quickly
    try {
      const { showIncidentNotification } = await import('@/services/notifee.service');
      await showIncidentNotification(machineName, intruderName, `incident_${machineName}_${Date.now()}`);
    } catch {
      await showLocalNotification(title, body, { type: 'unauthorized', alarm: true, machineId: machineName, intruderName }, 'critical');
    }
  },
  async notYourTurn(userId: string, machineName: string, rightfulUserName: string) {
    const title = 'Not Your Turn!';
    const body  = `${machineName} is reserved for ${rightfulUserName}. Please wait for your turn.`;
    await storeNotification(userId, title, body, 'unauthorized');
    await showLocalNotification(title, body, { type: 'unauthorized', machineId: machineName }, 'urgent');
  },
};

export const chatNotifications = {
  async messageReceived(userId: string, senderName: string, preview: string, machineId: string) {
    const title = senderName;
    const body  = preview.length > 50 ? preview.substring(0, 50) + '...' : preview;
    await storeNotification(userId, title, body, 'chat');
    await showLocalNotification(title, body, { type: 'chat', senderName, machineId, preview }, 'chat');
  },
};

export const callNotifications = {
  async incomingVoice(callerName: string, callId: string, callerId: string = '', callerAvatar: string = '') {
    // Use notifee for full-screen overlay — works in foreground AND background
    try {
      const { showIncomingCallNotification } = await import('@/services/notifee.service');
      await showIncomingCallNotification(callId, callerName, callerId, callerAvatar, false);
    } catch {
      // Fallback to expo-notifications if notifee unavailable
      await showLocalNotification('Incoming Call', `${callerName} is calling you`,
        { type: 'incomingCall', callType: 'voice', callId, callerId, callerAvatar }, 'calls');
    }
  },
  async incomingVideo(callerName: string, callId: string, callerId: string = '', callerAvatar: string = '') {
    try {
      const { showIncomingCallNotification } = await import('@/services/notifee.service');
      await showIncomingCallNotification(callId, callerName, callerId, callerAvatar, true);
    } catch {
      await showLocalNotification('Incoming Video Call', `${callerName} is video calling you`,
        { type: 'incomingVideo', callType: 'video', callId, callerId, callerAvatar }, 'calls');
    }
  },
  async missedVoice(userId: string, callerName: string) {
    const title = 'Missed Call';
    const body  = `You missed a call from ${callerName}`;
    await storeNotification(userId, title, body, 'missedCall');
    await showLocalNotification(title, body, { type: 'missedCall', callType: 'voice' }, 'default');
  },
  async missedVideo(userId: string, callerName: string) {
    const title = 'Missed Video Call';
    const body  = `You missed a video call from ${callerName}`;
    await storeNotification(userId, title, body, 'missedVideo');
    await showLocalNotification(title, body, { type: 'missedVideo', callType: 'video' }, 'default');
  },
};
