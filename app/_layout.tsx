/**
 * Root Layout — app/_layout.tsx
 *
 * CRITICAL: polyfills imported FIRST — patches global.Event / EventTarget / AbortController
 * for LiveKit SDK. Without this: ReferenceError: Property 'Event' doesn't exist
 */

// ── MUST BE ABSOLUTE FIRST IMPORT ────────────────────────────────────────────
import '@/polyfills';
// ─────────────────────────────────────────────────────────────────────────────

import { AuthProvider } from '@/components/UserContext';
import { I18nProvider } from '@/i18n/i18n';
import * as SplashScreen from 'expo-splash-screen';
import { auth } from '@/services/firebase';
import { Stack, router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerGlobals } from '@livekit/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  initializeNotifications,
  ensureNotificationChannels,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '@/services/notification.service';
import {
  registerNotifeeBackgroundHandler,
  registerNotifeeForegroundHandler,
  ensureNotifeeChannels,
  handleNotifeeEvent,
} from '@/services/notifee.service';
import { warmupBackend } from '@/services/api';
import GraceAlarmModal from '@/components/GraceAlarmModal';
import CallAudioController from '@/components/CallAudioController';
import GlobalSoundController from '@/components/GlobalSoundController';
import ActiveCallOverlay from '@/app/call/_ActiveCallOverlay';
import IncomingCallOverlay from '@/app/call/_IncomingCallOverlay';
import OutgoingCallOverlay from '@/app/call/_OutgoingCallOverlay';
import NotificationPopup from '@/components/NotificationPopup';
import GlobalIncidentModal from '@/components/incident/GlobalIncidentModal';

// Must be called before any LiveKit Room/Track usage
registerGlobals();
SplashScreen.preventAutoHideAsync();

// ─── CRITICAL: Notifee background handler — MUST be at module level ───────────
// When app is backgrounded or killed, React never mounts, so useEffect handlers
// are never registered. This module-level call guarantees the handler fires for
// all notifee background events (press, action, dismiss).
try {
  registerNotifeeBackgroundHandler();
} catch (e) {
  console.warn('[Notifee] Background handler module-level setup failed:', e);
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── CRITICAL: Background FCM handler — MUST be at module level ──────────────
// When app is killed or backgrounded, Firebase spawns a headless JS task.
// React never mounts, so useEffect-based handlers are NEVER registered.
// This module-level code runs immediately when the JS bundle loads.
try {
  const { getMessaging, setBackgroundMessageHandler } =
    require('@react-native-firebase/messaging');
  const { getApp } = require('@react-native-firebase/app');

  setBackgroundMessageHandler(getMessaging(getApp()), async (msg: any) => {
    const type    = msg.data?.type ?? '';
    const isCall  = type === 'voice_call' || type === 'video_call';
    const isGrace = type === 'your_turn';
    const isAlert = type === 'unauthorized_alert';
    const isCritical = isCall || isGrace || isAlert;
    console.log('[FCM BG] Received:', type, '| critical:', isCritical);

    if (!isCritical) return;

    try {
      const { Platform } = require('react-native');

      // ── Use notifee for critical alerts — it supports fullScreenAction ───
      // This is what actually wakes the screen and shows UI over the lock screen.
      // expo-notifications cannot do this; notifee can via USE_FULL_SCREEN_INTENT.
      const notifeeService = require('@/services/notifee.service');

      // Ensure channels exist (notifee channels must be created before displaying)
      if (Platform.OS === 'android') {
        await notifeeService.ensureNotifeeChannels();
      }

      const d = msg.data ?? {};
      const title = d.title || msg.notification?.title || '🔔 Laundrix';
      const body  = d.body  || msg.notification?.body  || '';

      if (isCall) {
        // Full-screen call notification — wakes screen, shows Accept/Decline buttons
        await notifeeService.showIncomingCallNotification(
          d.callId       ?? '',
          d.callerName   ?? 'Unknown',
          d.callerId     ?? '',
          d.callerAvatar ?? '',
          type === 'video_call'
        );
      } else if (isGrace) {
        // Full-screen grace period alert — wakes screen
        await notifeeService.showGracePeriodNotification(d.machineId ?? '', 5);
      } else if (isAlert) {
        // Full-screen incident alert — wakes screen
        await notifeeService.showIncidentNotification(
          d.machineId    ?? '',
          d.intruderName ?? 'Someone',
          d.incidentId   ?? ''
        );
      }

      console.log('[FCM BG] Notifee full-screen notification displayed for:', type);
    } catch (e) {
      console.warn('[FCM BG] Notifee notification failed, falling back to expo-notifications:', e);

      // Fallback: expo-notifications (no full-screen, but still shows a banner)
      try {
        const Notifications = require('expo-notifications');
        const { Platform } = require('react-native');
        const channelId = isCall ? 'calls' : 'critical';
        const sound     = isCall ? 'calling.mp3' : 'alarm.mp3';
        const title = msg.data?.title || msg.notification?.title || '🔔 Laundrix';
        const body  = msg.data?.body  || msg.notification?.body  || '';

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync(channelId, {
            name: channelId, importance: 5, sound,
            vibrationPattern: [0, 500, 200, 500], lockscreenVisibility: 1, bypassDnd: true,
          });
        }

        await Notifications.scheduleNotificationAsync({
          content: { title, body, data: msg.data, sound, ...(Platform.OS === 'ios' ? { sound } : {}) },
          trigger: null,
          ...(Platform.OS === 'android' ? { android: { channelId, sticky: isCall } } as any : {}),
        });
      } catch (fallbackErr) {
        console.warn('[FCM BG] Fallback notification also failed:', fallbackErr);
      }
    }
  });
  console.log('[FCM] Background handler registered at module level ✓');
} catch (e) {
  console.warn('[FCM] Background handler module-level setup failed:', e);
}
// ─────────────────────────────────────────────────────────────────────────────

function handleNotificationNavigation(data: Record<string, any> | undefined): void {
  if (!data) return;
  const type = data.type ?? '';

  if (['your_turn', 'grace_warning', 'removed_from_queue', 'queue_joined',
       'queue_left', 'queue_reminder'].includes(type)) {
    router.push('/(tabs)/queue');
  } else if (['session_started', 'session_ended', 'clothes_ready'].includes(type)) {
    router.push('/(tabs)/dashboard');
  } else if (['unauthorized_alert', 'unauthorized_warning', 'buzzer_triggered'].includes(type)) {
    router.push('/(tabs)/queue');
  } else if (type === 'chat_message') {
    router.push('/(tabs)/conversations');
  } else if (type === 'voice_call') {
    router.push({
      pathname: '/call/voice-incoming',
      params: {
        channel:  String(data.callId     || ''),
        name:     String(data.callerName  || 'Unknown'),
        callerId: String(data.callerId    || ''),
        avatar:   String(data.callerAvatar || ''),  // FIX: was missing — avatar blank in all notification-triggered calls
      },
    });
  } else if (type === 'video_call') {
    router.push({
      pathname: '/call/video-incoming',
      params: {
        channel:  String(data.callId     || ''),
        name:     String(data.callerName  || 'Unknown'),
        callerId: String(data.callerId    || ''),
        avatar:   String(data.callerAvatar || ''),  // FIX: was missing
      },
    });
  } else if (['missed_call', 'missedCall', 'missed_video', 'missedVideo'].includes(type)) {
    router.push('/(tabs)/conversations');
  }
}

export default function RootLayout() {
  const hasNavigated = useRef(false);

  useEffect(() => {
    warmupBackend();
    ensureNotificationChannels().catch(() => {});

    // ── Notifee: register foreground handler + create channels ──────────
    // registerNotifeeForegroundHandler is idempotent — safe to call on every mount.
    registerNotifeeForegroundHandler();
    ensureNotifeeChannels().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      const hasLaunched = await AsyncStorage.getItem('hasLaunched');

      if (!hasLaunched) {
        await SplashScreen.hideAsync();
        router.replace('/(onboarding)');
        return;
      }

      await SplashScreen.hideAsync();

      if (user) {
        initializeNotifications(user.uid).catch((err) =>
          console.warn('[Layout] Notification init failed:', err)
        );
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    });

    return unsubscribe;
  }, []);

  // expo-notifications tap & receive handlers
  useEffect(() => {
    const responseSub = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Notification] Tapped:', data?.type);
      handleNotificationNavigation(data as any);
    });
    const receivedSub = addNotificationReceivedListener((notification) => {
      console.log('[Notification] Foreground:', notification.request.content.title);
    });
    return () => { responseSub.remove(); receivedSub.remove(); };
  }, []);

  // FCM killed / background state tap handlers
  useEffect(() => {
    let unsubOpen: (() => void) | null = null;
    try {
      const {
        getMessaging, getInitialNotification, onNotificationOpenedApp,
      } = require('@react-native-firebase/messaging');
      const { getApp } = require('@react-native-firebase/app');
      const messaging = getMessaging(getApp());

      getInitialNotification(messaging).then((msg: any) => {
        if (msg?.data) {
          console.log('[FCM] Opened from killed state:', msg.notification?.title);
          setTimeout(() => handleNotificationNavigation(msg.data), 500);
        }
      });

      unsubOpen = onNotificationOpenedApp(messaging, (msg: any) => {
        if (msg?.data) {
          console.log('[FCM] Opened from background:', msg.notification?.title);
          handleNotificationNavigation(msg.data);
        }
      });
    } catch (e) {
      console.warn('[FCM] Notification open handler setup failed:', e);
    }
    return () => { unsubOpen?.(); };
  }, []);

  return (
    <GestureHandlerRootView style={s.container}>
      <I18nProvider>
        <AuthProvider>
          <View style={s.container}>
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(tabs)"       options={{ animation: 'fade',              gestureEnabled: false }} />
              <Stack.Screen name="(auth)"       options={{ animation: 'fade',              gestureEnabled: false }} />
              <Stack.Screen name="(onboarding)" options={{ animation: 'fade',              gestureEnabled: false }} />
              <Stack.Screen name="(settings)"   options={{ animation: 'fade',              gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="call"         options={{ animation: 'fade',              gestureEnabled: false }} />
              <Stack.Screen name="iot"          options={{ animation: 'fade',              gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="qrscan"       options={{ animation: 'fade',              gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="admin"        options={{ animation: 'fade',              gestureEnabled: true, gestureDirection: 'horizontal' }} />
            </Stack>

            {/* ── Global overlays (render above ALL screens) ──────────── */}
            <GlobalSoundController />
            <CallAudioController />
            <IncomingCallOverlay />
            <OutgoingCallOverlay />
            <ActiveCallOverlay />
            <GraceAlarmModal />
            <GlobalIncidentModal />
            <NotificationPopup />
          </View>
        </AuthProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
});
