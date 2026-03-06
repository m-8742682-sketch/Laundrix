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
import { warmupBackend } from '@/services/api';
import notifee, { EventType } from '@notifee/react-native';
import GraceAlarmModal from '@/components/GraceAlarmModal';
import CallAudioController from '@/components/CallAudioController';
import GlobalSoundController from '@/components/GlobalSoundController';
import ActiveCallOverlay from '@/app/call/_ActiveCallOverlay';
import IncomingCallOverlay from '@/app/call/_IncomingCallOverlay';
import OutgoingCallOverlay from '@/app/call/_OutgoingCallOverlay';
import NotificationPopup from '@/components/NotificationPopup';
import { activeCallData$, isActiveCallScreenOpen$ } from '@/services/callState';

// Must be called before any LiveKit Room/Track usage
registerGlobals();
SplashScreen.preventAutoHideAsync();

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
        channel:  String(data.callId    || ''),
        name:     String(data.callerName || 'Unknown'),
        callerId: String(data.callerId  || ''),
      },
    });
  } else if (type === 'video_call') {
    router.push({
      pathname: '/call/video-incoming',
      params: {
        channel:  String(data.callId    || ''),
        name:     String(data.callerName || 'Unknown'),
        callerId: String(data.callerId  || ''),
      },
    });
  } else if (['missed_call', 'missedCall', 'missed_video', 'missedVideo'].includes(type)) {
    router.push('/(tabs)/conversations');
  }
}

export default function RootLayout() {
  const hasNavigated = useRef(false);

  // Auto-navigation for connected calls
  useEffect(() => {
    const sub = activeCallData$.subscribe((data) => {
      if (data?.status === 'connected' && !isActiveCallScreenOpen$.value) {
        console.log('[Layout] Call connected, auto-navigating to full screen');
        const route = data.type === 'video' ? '/call/video-call' : '/call/voice-call';
        router.push({
          pathname: route,
          params: {
            channel: data.callId,
            targetUserId: data.targetUserId,
            targetName: data.targetName,
            targetAvatar: data.targetAvatar || '',
          }
        });
      }
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    warmupBackend();
    ensureNotificationChannels().catch(() => {});

    // Firebase background message handler — registered inside useEffect so Firebase is ready
    try {
      const { getMessaging, setBackgroundMessageHandler } =
        require('@react-native-firebase/messaging');
      const { getApp } = require('@react-native-firebase/app');
      setBackgroundMessageHandler(getMessaging(getApp()), async (msg: any) => {
        console.log('[FCM] Background:', msg.notification?.title);
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

  // Notifee Foreground & Background Event Listeners
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('[Notifee] Foreground Press:', detail.notification?.data?.type);
        handleNotificationNavigation(detail.notification?.data as any);
      }
    });

    // Handle background events (when app is in background but not killed)
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('[Notifee] Background Press:', detail.notification?.data?.type);
        // Navigation might need special handling in background depending on Expo Router
      }
    });

    return unsubscribe;
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
                animation: 'none',
              }}
            >
              <Stack.Screen name="(tabs)"       options={{ animation: 'none',              gestureEnabled: false }} />
              <Stack.Screen name="(auth)"       options={{ animation: 'fade',              gestureEnabled: false }} />
              <Stack.Screen name="(onboarding)" options={{ animation: 'fade',              gestureEnabled: false }} />
              <Stack.Screen name="(settings)"   options={{ animation: 'slide_from_right',  gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="call"         options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
              <Stack.Screen name="iot"          options={{ animation: 'slide_from_right',  gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="qrscan"       options={{ animation: 'slide_from_right',  gestureEnabled: true, gestureDirection: 'horizontal' }} />
              <Stack.Screen name="admin"        options={{ animation: 'slide_from_right',  gestureEnabled: true, gestureDirection: 'horizontal' }} />
            </Stack>

            {/* ── Global overlays (render above ALL screens) ──────────── */}
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

const s = StyleSheet.create({
  container: { flex: 1 },
});
