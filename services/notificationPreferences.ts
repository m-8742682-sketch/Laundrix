/**
 * notificationPreferences.ts
 * 
 * Single source of truth for checking notification preferences before firing.
 * Reads from AsyncStorage (saved by notifications_settings.tsx).
 * 
 * Usage: 
 *   if (await shouldNotify('machineReady')) { showNotification... }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'notification_settings_v2';

interface NotificationSettings {
  allNotifications: boolean;
  machineReady: boolean;
  machineReadySound: boolean;
  queueReminder: boolean;
  queuePositionAlert: boolean;
  incomingCalls: boolean;
  callSound: boolean;
  missedCallAlert: boolean;
  chatMessages: boolean;
  chatPreview: boolean;
  chatSound: boolean;
  unauthorizedAlerts: boolean;
  unauthorizedVibrate: boolean;
  systemAlerts: boolean;
  doNotDisturb: boolean;
  dndFrom: string;
  dndTo: string;
  dndScheduleEnabled: boolean;
}

const DEFAULTS: NotificationSettings = {
  allNotifications: true,
  machineReady: true,
  machineReadySound: true,
  queueReminder: true,
  queuePositionAlert: true,
  incomingCalls: true,
  callSound: true,
  missedCallAlert: true,
  chatMessages: true,
  chatPreview: true,
  chatSound: true,
  unauthorizedAlerts: true,
  unauthorizedVibrate: true,
  systemAlerts: true,
  doNotDisturb: false,
  dndFrom: '22:00',
  dndTo: '07:00',
  dndScheduleEnabled: false,
};

let _cache: NotificationSettings | null = null;
let _cacheExpiry = 0;
const CACHE_TTL = 5000; // 5s cache

export async function getNotificationPreferences(): Promise<NotificationSettings> {
  const now = Date.now();
  if (_cache && now < _cacheExpiry) return _cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    _cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
    _cacheExpiry = now + CACHE_TTL;
    return _cache;
  } catch {
    return DEFAULTS;
  }
}

/** Invalidate cache (call after saving new settings) */
export function invalidatePrefsCache() {
  _cache = null;
  _cacheExpiry = 0;
}

/** Check if a specific notification type should be shown */
export async function shouldNotify(key: keyof NotificationSettings): Promise<boolean> {
  const prefs = await getNotificationPreferences();
  if (!prefs.allNotifications) return false;
  return prefs[key] as boolean;
}

/** Check if Do Not Disturb is currently active */
export async function isDndActive(): Promise<boolean> {
  const prefs = await getNotificationPreferences();
  if (!prefs.doNotDisturb) return false;
  if (!prefs.dndScheduleEnabled) return true; // manual DND always on

  const now = new Date();
  const [fromH, fromM] = prefs.dndFrom.split(':').map(Number);
  const [toH, toM] = prefs.dndTo.split(':').map(Number);
  const currentMins = now.getHours() * 60 + now.getMinutes();
  const fromMins = fromH * 60 + fromM;
  const toMins = toH * 60 + toM;

  if (fromMins <= toMins) {
    return currentMins >= fromMins && currentMins < toMins;
  } else {
    // Overnight (e.g., 22:00 to 07:00)
    return currentMins >= fromMins || currentMins < toMins;
  }
}
