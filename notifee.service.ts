/**
 * notifee.service.ts — In-App Sound + System Notifications
 *
 * Architecture (simplified — no USE_FULL_SCREEN_INTENT):
 *   - notifee handles LOCAL notification display with proper sound channels
 *   - FCM/backend sends push payload; notifee re-displays with custom sound
 *   - For calls/grace/incidents: plays audible system notification + in-app sounds
 *   - GlobalSoundController handles in-app sound playback
 *
 * Sound files in res/raw: calling.mp3, alarm.mp3, urgent.mp3, notify.mp3
 */

import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  EventType,
  type Notification,
  type AndroidChannel,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { shouldNotify } from './notificationPreferences';

export const NOTIFEE_CHANNELS = {
  CALLS:    'calls',
  CRITICAL: 'critical',
  URGENT:   'urgent',
  CHAT:     'chat',
  QUEUE:    'queue',
  DEFAULT:  'default',
} as const;

let channelsCreated = false;

export async function ensureNotifeeChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsCreated) return;
  channelsCreated = true;

  const channels: AndroidChannel[] = [
    {
      id: NOTIFEE_CHANNELS.CALLS,
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'calling',
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
      sound: 'alarm',
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
      sound: 'urgent',
      vibration: true,
      vibrationPattern: [0, 300, 150, 300],
      visibility: AndroidVisibility.PUBLIC,
    },
    {
      id: NOTIFEE_CHANNELS.CHAT,
      name: 'Chat Messages',
      importance: AndroidImportance.DEFAULT,
      sound: 'notify',
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

// ─── Core: Display notification ───────────────────────────────────────────────

interface NotifeePayload {
  title: string;
  body: string;
  channelId: string;
  data?: Record<string, string>;
  id?: string;
  ongoing?: boolean;
  category?: AndroidCategory;
}

export async function showNotifeeNotification(payload: NotifeePayload): Promise<string> {
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
      ...(payload.ongoing ? { ongoing: true, onlyAlertOnce: false } : {}),
      category: payload.category ?? AndroidCategory.MESSAGE,
      pressAction: { id: 'default', launchActivity: 'default' },
      actions: payload.channelId === NOTIFEE_CHANNELS.CALLS ? [
        { title: '📞 Accept', pressAction: { id: 'accept', launchActivity: 'default' } },
        { title: '✕ Decline', pressAction: { id: 'decline', launchActivity: 'default' } },
      ] : undefined,
      smallIcon: 'ic_notification',
      color: '#0EA5E9',
    },
    ios: {
      sound: payload.channelId === NOTIFEE_CHANNELS.CALLS ? 'calling.mp3'
           : payload.channelId === NOTIFEE_CHANNELS.CRITICAL ? 'alarm.mp3'
           : payload.channelId === NOTIFEE_CHANNELS.URGENT ? 'urgent.mp3'
           : 'default',
      critical: payload.channelId === NOTIFEE_CHANNELS.CALLS
             || payload.channelId === NOTIFEE_CHANNELS.CRITICAL,
      criticalVolume: 1.0,
      interruptionLevel: 'critical',
      foregroundPresentationOptions: { alert: true, sound: true, badge: true, banner: true, list: true },
    },
  };

  await notifee.displayNotification(notification);
  console.log(`[Notifee] Displayed "${payload.title}" (id=${notifId}, channel=${payload.channelId})`);
  return notifId;
}

export async function cancelNotifeeNotification(id: string): Promise<void> {
  try { await notifee.cancelNotification(id); } catch {}
}

export async function cancelAllCallNotifications(): Promise<void> {
  try {
    const displayed = await notifee.getDisplayedNotifications();
    await Promise.all(
      displayed
        .filter(n => n.notification?.android?.channelId === NOTIFEE_CHANNELS.CALLS)
        .map(n => notifee.cancelNotification(n.id!))
    );
  } catch {}
}

// ─── Convenience helpers ──────────────────────────────────────────────────────

export async function showIncomingCallNotification(
  callId: string,
  callerName: string,
  callerId: string,
  callerAvatar: string,
  isVideo: boolean
): Promise<string> {
  if (!await shouldNotify('incomingCalls')) return '';
  const icon = isVideo ? '📹' : '📞';
  const type = isVideo ? 'Incoming Video Call' : 'Incoming Call';
  return showNotifeeNotification({
    id: `call_${callId}`,
    title: `${icon} ${type}`,
    body: `${callerName} is ${isVideo ? 'video ' : ''}calling you`,
    channelId: NOTIFEE_CHANNELS.CALLS,
    data: { type: isVideo ? 'video_call' : 'voice_call', callId, callerId, callerName, callerAvatar },
    ongoing: true,
    category: AndroidCategory.CALL,
  });
}

export async function showGracePeriodNotification(machineId: string, minutesLeft = 5): Promise<string> {
  if (!await shouldNotify('machineReady')) return '';
  return showNotifeeNotification({
    id: `grace_${machineId}`,
    title: '🎉 Your Turn!',
    body: `Machine ${machineId} is ready! You have ${minutesLeft} minutes to scan in.`,
    channelId: NOTIFEE_CHANNELS.CRITICAL,
    data: { type: 'your_turn', machineId },
    category: AndroidCategory.ALARM,
  });
}

export async function showIncidentNotification(machineId: string, intruderName: string, incidentId: string): Promise<string> {
  if (!await shouldNotify('unauthorizedAlerts')) return '';
  return showNotifeeNotification({
    id: `incident_${incidentId}`,
    title: '🚨 Someone at Your Machine!',
    body: `${intruderName} is trying to use Machine ${machineId}. Is this you?`,
    channelId: NOTIFEE_CHANNELS.CRITICAL,
    data: { type: 'unauthorized_alert', machineId, incidentId, intruderName },
    category: AndroidCategory.ALARM,
  });
}

export async function showMissedCallNotification(callerName: string, isVideo: boolean): Promise<string> {
  if (!await shouldNotify('missedCallAlert')) return '';
  return showNotifeeNotification({
    title: `Missed ${isVideo ? 'Video ' : ''}Call`,
    body: `You missed a call from ${callerName}`,
    channelId: NOTIFEE_CHANNELS.CALLS,
    data: { type: isVideo ? 'missed_video' : 'missed_call', callerName },
  });
}

export async function showCallEndedNotification(callerName: string, duration: number, isVideo: boolean): Promise<string> {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  return showNotifeeNotification({
    title: `${isVideo ? 'Video ' : ''}Call Ended`,
    body: `Call with ${callerName} ended (${fmt(duration)})`,
    channelId: NOTIFEE_CHANNELS.DEFAULT,
    data: { type: isVideo ? 'ended_video' : 'ended_call', callerName },
  });
}

// ─── Navigation from notification press ──────────────────────────────────────

export function handleNotifeeEvent(
  type: EventType,
  detail: { notification?: Notification; pressAction?: { id: string } }
): void {
  const data = detail.notification?.data as Record<string, string> | undefined;
  if (!data) return;

  const notifType = data.type ?? '';
  const actionId  = detail.pressAction?.id ?? 'default';

  console.log('[Notifee] Event:', EventType[type], '| type:', notifType, '| action:', actionId);

  if (notifType === 'voice_call' || notifType === 'video_call') {
    const isVideo = notifType === 'video_call';

    if (actionId === 'decline') {
      import('@/services/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, updateDoc, serverTimestamp }) => {
          if (data.callId) updateDoc(doc(db, 'calls', data.callId), { status: 'rejected', endedAt: serverTimestamp() }).catch(() => {});
        });
      });
      cancelAllCallNotifications();
      return;
    }

    if (actionId === 'accept') {
      import('@/services/firebase').then(({ db }) => {
        import('firebase/firestore').then(({ doc, updateDoc, serverTimestamp }) => {
          if (data.callId) updateDoc(doc(db, 'calls', data.callId), { status: 'connected', connectedAt: serverTimestamp() }).catch(() => {});
        });
      });
      cancelAllCallNotifications();
      router.replace({
        pathname: isVideo ? '/call/video-call' : '/call/voice-call',
        params: { channel: data.callId ?? '', targetUserId: data.callerId ?? '', targetName: data.callerName ?? 'Unknown', targetAvatar: data.callerAvatar ?? '' },
      });
      return;
    }

    cancelAllCallNotifications();
    router.push({
      pathname: isVideo ? '/call/video-incoming' : '/call/voice-incoming',
      params: { channel: data.callId ?? '', name: data.callerName ?? 'Unknown', callerId: data.callerId ?? '', avatar: data.callerAvatar ?? '' },
    });
    return;
  }

  if (notifType === 'your_turn') { router.push('/(tabs)/queue'); return; }
  if (notifType === 'unauthorized_alert') { router.push('/(tabs)/queue'); return; }
  if (notifType === 'missed_call' || notifType === 'missed_video') { router.push('/(tabs)/conversations'); return; }
}

// ─── Register foreground event handler ───────────────────────────────────────

let foregroundUnsubscribe: (() => void) | null = null;

export function registerNotifeeForegroundHandler(): void {
  if (foregroundUnsubscribe) return;
  foregroundUnsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
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

export function registerNotifeeBackgroundHandler(): void {
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    console.log('[Notifee BG] Event:', EventType[type]);
    if (type === EventType.PRESS || type === EventType.ACTION_PRESS) {
      handleNotifeeEvent(type, detail);
    }
  });
  console.log('[Notifee] Background handler registered at module level ✓');
}
