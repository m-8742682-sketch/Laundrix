/**
 * Root Layout
 *
 * Notification architecture:
 *   KILLED/BACKGROUND app:
 *     Firebase FCM → OS notification bar → user taps → app opens
 *     Background handler uses v22 modular API, lazily initialized after app boots.
 *
 *   FOREGROUND app:
 *     expo-notifications setNotificationHandler → banner
 *     + onMessage() → local notification (in initializeNotifications)
 */

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
import { warmupBackend } from '@/services/api';
import GraceAlarmModal from '@/components/GraceAlarmModal';
import CallAudioController from '@/components/CallAudioController';
import GlobalSoundController from '@/components/GlobalSoundController';
// Overlays are prefixed with _ so expo-router ignores them as routes
import ActiveCallOverlay from '@/app/call/_ActiveCallOverlay';
import IncomingCallOverlay from '@/app/call/_IncomingCallOverlay';
import OutgoingCallOverlay from '@/app/call/_OutgoingCallOverlay';
import NotificationPopup from '@/components/NotificationPopup';

// CRITICAL: registerGlobals must be called before any LiveKit room/track usage
registerGlobals();
SplashScreen.preventAutoHideAsync();

// ─────────────────────────────────────────────────────────────────────────────

function handleNotificationNavigation(data: Record<string, any> | undefined): void {
  if (!data) return;
  const type = data.type ?? '';

  if (['your_turn', 'grace_warning', 'removed_from_queue', 'queue_joined', 'queue_left'].includes(type)) {
    router.push('/(tabs)/queue');
  } else if (['session_started', 'session_ended', 'clothes_ready'].includes(type)) {
    router.push('/(tabs)/dashboard');
  } else if (['unauthorized_alert', 'unauthorized_warning', 'buzzer_triggered'].includes(type)) {
    router.push('/(tabs)/queue');
  } else if (type === 'chat_message') {
    router.push('/(tabs)/conversations');
  } else if (type === 'voice_call') {
    router.push({ pathname: '/call/voice-incoming', params: { channel: String(data.callId || ''), name: String(data.callerName || 'Unknown') } });
  } else if (type === 'video_call') {
    router.push({ pathname: '/call/video-incoming', params: { channel: String(data.callId || ''), name: String(data.callerName || 'Unknown') } });
  } else if (['missed_call', 'missedCall', 'missed_video', 'missedVideo'].includes(type)) {
    router.push('/(tabs)/conversations');
  }
}

export default function RootLayout() {
  const hasNavigated = useRef(false);

  useEffect(() => {
    warmupBackend();
    ensureNotificationChannels().catch(() => {});

    // ── Register Firebase background handler ────────────────────────────────
    // Done here (inside useEffect) so Firebase is fully initialized first.
    // This avoids the module-level getApp() deprecation warning.
    try {
      const { getMessaging, setBackgroundMessageHandler } = require('@react-native-firebase/messaging');
      const { getApp } = require('@react-native-firebase/app');
      setBackgroundMessageHandler(getMessaging(getApp()), async (remoteMessage: any) => {
        console.log('[FCM] Background message:', remoteMessage.notification?.title);
      });
    } catch (e) {
      console.warn('[FCM] Background handler setup failed:', e);
    }

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

  // ── expo-notifications tap/receive handlers ───────────────────────────────
  useEffect(() => {
    const responseSubscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[Notification] Tapped:', data?.type);
      handleNotificationNavigation(data as any);
    });

    const receivedSubscription = addNotificationReceivedListener((notification) => {
      console.log('[Notification] Received in foreground:', notification.request.content.title);
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, []);

  // ── FCM tap handlers (killed + background state) ──────────────────────────
  useEffect(() => {
    let unsubscribeOpen: (() => void) | null = null;
    try {
      const { getMessaging, getInitialNotification, onNotificationOpenedApp } = require('@react-native-firebase/messaging');
      const { getApp } = require('@react-native-firebase/app');
      const messaging = getMessaging(getApp());

      getInitialNotification(messaging).then((remoteMessage: any) => {
        if (remoteMessage?.data) {
          console.log('[FCM] Opened from killed state:', remoteMessage.notification?.title);
          setTimeout(() => handleNotificationNavigation(remoteMessage.data), 500);
        }
      });

      unsubscribeOpen = onNotificationOpenedApp(messaging, (remoteMessage: any) => {
        if (remoteMessage?.data) {
          console.log('[FCM] Opened from background:', remoteMessage.notification?.title);
          handleNotificationNavigation(remoteMessage.data);
        }
      });
    } catch (e) {
      console.warn('[FCM] Notification open handler setup failed:', e);
    }

    return () => { unsubscribeOpen?.(); };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <I18nProvider>
        <AuthProvider>
          <View style={styles.container}>
            <Stack
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                animation: 'none',
              }}
            >
              {/*
                Stack.Screen names must match the actual folder/file names as
                expo-router sees them. Folders with _layout.tsx are registered
                as groups and use the folder name (without /index).
              */}
              <Stack.Screen name="(tabs)"       options={{ animation: 'none',             gestureEnabled: false }} />
              <Stack.Screen name="(auth)"       options={{ animation: 'fade',             gestureEnabled: false }} />
              <Stack.Screen name="(onboarding)" options={{ animation: 'fade',             gestureEnabled: false }} />
              <Stack.Screen name="(settings)"   options={{ animation: 'slide_from_right', gestureEnabled: true, gestureDirection: 'horizontal' }} />
              {/* "call" is a group with _layout.tsx — individual screens defined inside call/_layout.tsx */}
              <Stack.Screen name="call"         options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="iot"          options={{ animation: 'slide_from_right', gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="qrscan"       options={{ animation: 'slide_from_right', gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="admin"        options={{ animation: 'slide_from_right', gestureEnabled: true, gestureDirection: 'horizontal' }} />
            </Stack>

            {/* ── Global overlays (above ALL screens) ─────────────────── */}
            <GlobalSoundController />
            <CallAudioController />
            <IncomingCallOverlay />
            <OutgoingCallOverlay />
            <ActiveCallOverlay />
            <GraceAlarmModal />
            <NotificationPopup />
          </View>
        </AuthProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
