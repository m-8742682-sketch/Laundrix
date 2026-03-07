/**
 * notifee.service.ts — Full-Screen Overlay Notifications
 *
 * Why notifee over expo-notifications for critical alerts:
 *   expo-notifications cannot trigger a full-screen Activity over a locked screen.
 *   @notifee/react-native supports `android.fullScreenAction` which invokes
 *   USE_FULL_SCREEN_INTENT — this forces the phone to wake, bypass the lock
 *   screen, and show our UI immediately, exactly like incoming phone calls do.
 *
 * This covers three critical scenarios:
 *   1. Incoming voice/video calls  → wakes phone, shows call UI over lock screen
 *   2. Grace period (your turn!)   → wakes phone, opens app to queue tab
 *   3. Unauthorized incident alert → wakes phone, opens app to queue tab
 *
 * Architecture:
 *   - notifee handles the LOCAL notification display (full-screen, channels, sound)
 *   - FCM/backend still sends the push payload to wake the device
 *   - Background FCM handler intercepts and re-displays via notifee (not expo-notifications)
 *   - Foreground: notifee.onForegroundEvent handles in-app routing
 *   - Background/killed: notifee.onBackgroundEvent handles routing
 *
 * Channel IDs must match Android res/raw sound file names.
 *
 * iOS Note:
 *   CallKit is the iOS equivalent for call full-screen UX.
 *   It requires Apple entitlements + VoIP push certificates that are
 *   outside the scope of this Expo managed workflow. For iOS, the existing
 *   expo-notifications critical alert path is the best available option.
 *   notifee on iOS still improves alert prominence but cannot match CallKit.
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  EventType,
  type Notification,
  type AndroidChannel,
  type NotificationFullScreenAction,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';

// ─── Channel IDs ──────────────────────────────────────────────────────────────

export const NOTIFEE_CHANNELS = {
  CALLS:    'calls',
  CRITICAL: 'critical',
  URGENT:   'urgent',
  CHAT:     'chat',
  QUEUE:    'queue',
  DEFAULT:  'default',
} as const;

// ─── Channel Setup ────────────────────────────────────────────────────────────

let channelsCreated = false;

export async function ensureNotifeeChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsCreated) return;
  channelsCreated = true;

  const channels: AndroidChannel[] = [
    {
      id: NOTIFEE_CHANNELS.CALLS,
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'calling',         // maps to res/raw/calling.mp3
      vibration: true,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      lights: true,
      lightColor: '#0EA5E9',
    },
    {
      id: NOTIFEE_CHANNELS.CRITICAL,
      name: 'Critical Alerts',
      importance: AndroidImportance.HIGH,
      sound: 'alarm',           // maps to res/raw/alarm.mp3
      vibration: true,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      lights: true,
      lightColor: '#EF4444',
    },
    {
      id: NOTIFEE_CHANNELS.URGENT,
      name: 'Urgent Alerts',
      importance: AndroidImportance.HIGH,
      sound: 'urgent',          // maps to res/raw/urgent.mp3
      vibration: true,
      vibrationPattern: [0, 300, 150, 300],
      visibility: AndroidVisibility.PUBLIC,
    },
    {
      id: NOTIFEE_CHANNELS.CHAT,
      name: 'Chat Messages',
      importance: AndroidImportance.DEFAULT,
      sound: 'notify',          // maps to res/raw/notify.mp3
      vibration: true,
    },
    {
      id: NOTIFEE_CHANNELS.QUEUE,
      name: 'Queue Updates',
      importance: AndroidImportance.DEFAULT,
      sound: 'default',
      vibration: true,
    },
    {
      id: NOTIFEE_CHANNELS.DEFAULT,
      name: 'General',
      importance: AndroidImportance.DEFAULT,
    },
  ];

  await notifee.createChannels(channels);
  console.log('[Notifee] Channels created ✓');
}

// ─── Full-screen action helper ────────────────────────────────────────────────

/**
 * Builds the fullScreenAction that wakes the screen and opens the app.
 * The launchActivity 'default' maps to MainActivity.
 * Android will call this action even if the phone is locked — this is the
 * key difference from expo-notifications.
 */
function buildFullScreenAction(id: string): NotificationFullScreenAction {
  return {
    id,
    launchActivity: 'default',
    launchActivityFlags: [
      // FLAG_ACTIVITY_NEW_TASK: required when starting from non-Activity context
      // FLAG_ACTIVITY_SINGLE_TOP: don't create a new Activity if one already exists
    ],
  };
}

// ─── Core: Display full-screen notification ───────────────────────────────────

interface NotifeeFullScreenPayload {
  title: string;
  body: string;
  channelId: string;
  data?: Record<string, string>;
  /** Unique notification ID — used to cancel stale call notifications */
  id?: string;
  /** Show as full-screen intent (Android) — set true for calls, grace, incidents */
  fullScreen?: boolean;
  /** Keep notification alive until user acts (use for calls) */
  ongoing?: boolean;
  /** Category hint for Android */
  category?: AndroidCategory;
}

export async function showNotifeeNotification(
  payload: NotifeeFullScreenPayload
): Promise<string> {
  // Ensure channels exist (idempotent)
  await ensureNotifeeChannels();

  const notifId = payload.id ?? `laundrix_${Date.now()}`;

  const notification: Notification = {
    id: notifId,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    android: {
      channelId: payload.channelId,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      // ── KEY: fullScreenAction wakes the phone even when screen is off ──
      // This is the notifee superpower that expo-notifications lacks.
      // Android will fire USE_FULL_SCREEN_INTENT and launch MainActivity
      // (which then reads the data and navigates to the right screen).
      ...(payload.fullScreen ? { fullScreenAction: buildFullScreenAction(notifId) } : {}),
      // ongoing: true prevents the user from swiping away a call notification
      ...(payload.ongoing ? { ongoing: true, onlyAlertOnce: false } : {}),
      // category helps Android optimise delivery
      category: payload.category ?? AndroidCategory.MESSAGE,
      // pressAction: opens the app when notification is tapped
      pressAction: { id: 'default', launchActivity: 'default' },
      // actions: inline action buttons on the notification
      actions: payload.channelId === NOTIFEE_CHANNELS.CALLS ? [
        {
          title: '📞 Accept',
          pressAction: { id: 'accept', launchActivity: 'default' },
        },
        {
          title: '✕ Decline',
          pressAction: { id: 'decline', launchActivity: 'default' },
        },
      ] : undefined,
      smallIcon: 'ic_notification',  // must exist in res/drawable
      color: '#0EA5E9',
    },
    // iOS: use critical alert (requires entitlement — best we can do without CallKit)
    ios: {
      sound: payload.channelId === NOTIFEE_CHANNELS.CALLS ? 'calling.mp3'
           : payload.channelId === NOTIFEE_CHANNELS.CRITICAL ? 'alarm.mp3'
           : payload.channelId === NOTIFEE_CHANNELS.URGENT ? 'urgent.mp3'
           : 'default',
      critical: payload.channelId === NOTIFEE_CHANNELS.CALLS
             || payload.channelId === NOTIFEE_CHANNELS.CRITICAL,
      criticalVolume: 1.0,
      interruptionLevel: 'critical',
      foregroundPresentationOptions: {
        alert: true,
        sound: true,
        badge: true,
        banner: true,
        list: true,
      },
    },
  };

  await notifee.displayNotification(notification);
  console.log(`[Notifee] Displayed "${payload.title}" (id=${notifId}, channel=${payload.channelId}, fullScreen=${payload.fullScreen})`);
  return notifId;
}

// ─── Cancel a specific notification (e.g., dismiss ringing call) ──────────────

export async function cancelNotifeeNotification(id: string): Promise<void> {
  try {
    await notifee.cancelNotification(id);
  } catch { /* non-critical */ }
}

// ─── Cancel all notifications for a category ─────────────────────────────────

export async function cancelAllCallNotifications(): Promise<void> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      displayed
        .filter(n => n.notification?.android?.channelId === NOTIFEE_CHANNELS.CALLS)
        .map(n => notifee.cancelNotification(n.id!))
    );
  } catch { /* non-critical */ }
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

/**
 * Show a full-screen incoming CALL notification.
 *
 * This will:
 *   • Wake the screen even if locked (Android USE_FULL_SCREEN_INTENT)
 *   • Play calling.mp3 on the 'calls' channel (bypasses DND)
 *   • Show inline Accept / Decline action buttons
 *   • Keep the notification alive until user acts (ongoing)
 */
export async function showIncomingCallNotification(
  callId: string,
  callerName: string,
  callerId: string,
  callerAvatar: string,
  isVideo: boolean
): Promise<string> {
  const icon = isVideo ? '📹' : '📞';
  const type = isVideo ? 'Incoming Video Call' : 'Incoming Call';
  return showNotifeeNotification({
    id: `call_${callId}`,
    title: `${icon} ${type}`,
    body: `${callerName} is ${isVideo ? 'video ' : ''}calling you`,
    channelId: NOTIFEE_CHANNELS.CALLS,
    data: {
      type:         isVideo ? 'video_call' : 'voice_call',
      callId,
      callerId,
      callerName,
      callerAvatar,
    },
    fullScreen: true,    // wake screen + lock screen overlay
    ongoing:    true,    // can't swipe away
    category:   AndroidCategory.CALL,
  });
}

/**
 * Show a full-screen GRACE PERIOD notification.
 * Wakes the phone and navigates to the queue tab.
 */
export async function showGracePeriodNotification(
  machineId: string,
  minutesLeft: number = 5
): Promise<string> {
  return showNotifeeNotification({
    id: `grace_${machineId}`,
    title: '🎉 Your Turn!',
    body: `Machine ${machineId} is ready! You have ${minutesLeft} minutes to scan in.`,
    channelId: NOTIFEE_CHANNELS.CRITICAL,
    data: {
      type:      'your_turn',
      machineId,
    },
    fullScreen: true,    // wake screen
    ongoing:    false,   // user can dismiss
    category:   AndroidCategory.ALARM,
  });
}

/**
 * Show a full-screen INCIDENT notification.
 * Wakes the phone for the machine owner.
 */
export async function showIncidentNotification(
  machineId: string,
  intruderName: string,
  incidentId: string
): Promise<string> {
  return showNotifeeNotification({
    id: `incident_${incidentId}`,
    title: '🚨 Someone at Your Machine!',
    body: `${intruderName} is trying to use Machine ${machineId}. Is this you?`,
    channelId: NOTIFEE_CHANNELS.CRITICAL,
    data: {
      type:        'unauthorized_alert',
      machineId,
      incidentId,
      intruderName,
    },
    fullScreen: true,
    ongoing:    false,
    category:   AndroidCategory.ALARM,
  });
}

// ─── Navigation from notification press ──────────────────────────────────────

/**
 * Handle a notifee notification press or action button press.
 * Called from both foreground and background event handlers.
 */
export function handleNotifeeEvent(
  type: EventType,
  detail: { notification?: Notification; pressAction?: { id: string } }
): void {
  const data = detail.notification?.data as Record<string, string> | undefined;
  if (!data) return;

  const notifType = data.type ?? '';
  const actionId  = detail.pressAction?.id ?? 'default';

  console.log('[Notifee] Event:', EventType[type], '| type:', notifType, '| action:', actionId);

  // ── Incoming call ──
  if (notifType === 'voice_call' || notifType === 'video_call') {
    const isVideo = notifType === 'video_call';

    if (actionId === 'decline') {
      // Inline decline: update Firestore + cancel notification
      import('@/services/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, updateDoc, serverTimestamp }) => {
          if (data.callId) {
            updateDoc(doc(db, 'calls', data.callId), {
              status: 'rejected',
              endedAt: serverTimestamp(),
            }).catch(() => {});
          }
        });
      });
      cancelAllCallNotifications();
      return;
    }

    if (actionId === 'accept') {
      // Inline accept button — navigate to active call screen directly
      import('@/services/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, updateDoc, serverTimestamp }) => {
          if (data.callId) {
            updateDoc(doc(db, 'calls', data.callId), {
              status: 'connected',
              connectedAt: serverTimestamp(),
            }).catch(() => {});
          }
        });
      });
      cancelAllCallNotifications();
      router.replace({
        pathname: isVideo ? '/call/video-call' : '/call/voice-call',
        params: {
          channel:       data.callId    ?? '',
          targetUserId:  data.callerId  ?? '',
          targetName:    data.callerName ?? 'Unknown',
          targetAvatar:  data.callerAvatar ?? '',
        },
      });
      return;
    }

    // Default tap — go to incoming call screen (full UI with ring + accept/decline)
    cancelAllCallNotifications();
    router.push({
      pathname: isVideo ? '/call/video-incoming' : '/call/voice-incoming',
      params: {
        channel:  data.callId    ?? '',
        name:     data.callerName ?? 'Unknown',
        callerId: data.callerId   ?? '',
        avatar:   data.callerAvatar ?? '',
      },
    });
    return;
  }

  // ── Grace period ──
  if (notifType === 'your_turn') {
    router.push('/(tabs)/queue');
    return;
  }

  // ── Incident ──
  if (notifType === 'unauthorized_alert') {
    router.push('/(tabs)/queue');
    return;
  }
}

// ─── Register foreground event handler ───────────────────────────────────────

let foregroundUnsubscribe: (() => void) | null = null;

export function registerNotifeeForegroundHandler(): void {
  if (foregroundUnsubscribe) return; // already registered

  foregroundUnsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
    // In foreground, only handle press/action events — not DELIVERED
    // (DELIVERED fires every time notification appears, we don't need to re-navigate)
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handleNotifeeEvent(type, detail);
    }
  });

  console.log('[Notifee] Foreground handler registered ✓');
}

export function unregisterNotifeeForegroundHandler(): void {
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = null;
}

// ─── Register background event handler ───────────────────────────────────────
//
// CRITICAL: Must be called at module level (not inside useEffect).
// When the app is backgrounded or killed, React doesn't mount components,
// so hooks/effects never run. Module-level registration fires when the
// headless JS bundle loads — guaranteed to execute for background events.

export function registerNotifeeBackgroundHandler(): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    console.log('[Notifee BG] Event:', EventType[type]);
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handleNotifeeEvent(type, detail);
    }
  });
  console.log('[Notifee] Background handler registered at module level ✓');
}
