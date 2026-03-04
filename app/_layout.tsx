import { AuthProvider } from "@/components/UserContext";
import { I18nProvider } from "@/i18n/i18n";
import * as SplashScreen from "expo-splash-screen";
import { auth } from "@/services/firebase";
import { Stack, router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerGlobals } from "@livekit/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
  initializeNotifications,
  ensureNotificationChannels,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from "@/services/notification.service";
import { warmupBackend } from "@/services/api";
import { graceAlarmService } from "@/services/graceAlarmService";
import GraceAlarmModal from "@/components/GraceAlarmModal";
import CallAudioController from "@/components/CallAudioController"; // no-op shim
import GlobalSoundController from "@/components/GlobalSoundController"; // ← THE ONE SOUND MANAGER
import ActiveCallOverlay from "@/app/call/ActiveCallOverlay";
import IncomingCallOverlay from "@/app/call/IncomingCallOverlay";
import OutgoingCallOverlay from "@/app/call/OutgoingCallOverlay";
import NotificationPopup from "@/components/NotificationPopup";

// CRITICAL: registerGlobals must be called before any LiveKit room/track usage
// It installs the WebRTC globals (Event, etc.) that livekit-client needs
registerGlobals();
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hasNavigated = useRef(false);

  useEffect(() => {
    warmupBackend();
    graceAlarmService.restore();
    ensureNotificationChannels().catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      const hasLaunched = await AsyncStorage.getItem("hasLaunched");

      if (!hasLaunched) {
        await SplashScreen.hideAsync();
        router.replace("/(onboarding)");
        return;
      }

      await SplashScreen.hideAsync();

      if (user) {
        initializeNotifications(user.uid).catch((err) =>
          console.warn("[Layout] Notification init failed:", err)
        );
        router.replace("/(tabs)/dashboard");
      } else {
        router.replace("/(auth)/login");
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const responseSubscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log("[Notification] Tapped:", data);

      if (data?.type === "queue" || data?.type === "laundry") {
        router.push("/(tabs)/queue");
      } else if (data?.type === "unauthorized") {
        router.push("/(tabs)/queue");
      } else if (data?.type === "chat") {
        router.push("/(tabs)/conversations");
      } else if (data?.callId) {
        const isVideo =
          data?.type === "video_call" || data?.type === "missed_video";
        const callId = String(data.callId || "");
        const callerName = String(data.callerName || "Unknown");
        if (isVideo) {
          router.push({
            pathname: "/call/video-incoming",
            params: { channel: callId, name: callerName },
          });
        } else {
          router.push({
            pathname: "/call/voice-incoming",
            params: { channel: callId, name: callerName },
          });
        }
      } else if (
        data?.type === "call" ||
        data?.type === "missedCall" ||
        data?.type === "missedVideo"
      ) {
        router.push("/(tabs)/conversations");
      }
    });

    const receivedSubscription = addNotificationReceivedListener(
      (notification) => {
        console.log(
          "[Notification] Received in foreground:",
          notification.request.content.title
        );
      }
    );

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <I18nProvider>
        <AuthProvider>
          <View style={styles.container}>
            <Stack
              screenOptions={{
                headerShown: false,
                // ─── Navigation animation & gesture rules ───────────────
                // Tab groups use "none" so switching tabs doesn't slide.
                // Individual screens that push on top of tabs get
                // "slide_from_right" via per-screen options below.
                // Android hardware back + iOS swipe-back are both enabled.
                gestureEnabled: true,
                gestureDirection: "horizontal",
                animation: "none", // default: no animation (tabs feel instant)
              }}
            >
              {/* Tab group — no animation when switching tabs */}
              <Stack.Screen
                name="(tabs)"
                options={{
                  animation: "none",
                  gestureEnabled: false, // tabs don't slide-back
                }}
              />
              {/* Auth group — fade in */}
              <Stack.Screen
                name="(auth)"
                options={{
                  animation: "fade",
                  gestureEnabled: false,
                }}
              />
              {/* Onboarding — fade */}
              <Stack.Screen
                name="(onboarding)"
                options={{
                  animation: "fade",
                  gestureEnabled: false,
                }}
              />
              {/* Settings stack — slides from right, back gesture enabled */}
              <Stack.Screen
                name="(settings)"
                options={{
                  animation: "slide_from_right",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              {/* Call screens — slide up like a modal */}
              <Stack.Screen
                name="call/voice-incoming"
                options={{
                  animation: "slide_from_bottom",
                  gestureEnabled: true,
                  gestureDirection: "vertical",
                }}
              />
              <Stack.Screen
                name="call/video-incoming"
                options={{
                  animation: "slide_from_bottom",
                  gestureEnabled: true,
                  gestureDirection: "vertical",
                }}
              />
              <Stack.Screen
                name="call/voice-outgoing"
                options={{
                  animation: "slide_from_bottom",
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="call/video-outgoing"
                options={{
                  animation: "slide_from_bottom",
                  gestureEnabled: false,
                }}
              />
              <Stack.Screen
                name="call/voice-call"
                options={{
                  animation: "slide_from_bottom",
                  gestureEnabled: false, // must use minimize button
                }}
              />
              <Stack.Screen
                name="call/video-call"
                options={{
                  animation: "slide_from_bottom",
                  gestureEnabled: false,
                }}
              />
              {/* IoT/QR scan screens — slide from right */}
              <Stack.Screen
                name="iot"
                options={{
                  animation: "slide_from_right",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              <Stack.Screen
                name="qrscan"
                options={{
                  animation: "slide_from_right",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
              {/* Admin pages */}
              <Stack.Screen
                name="admin"
                options={{
                  animation: "slide_from_right",
                  gestureEnabled: true,
                  gestureDirection: "horizontal",
                }}
              />
            </Stack>

            {/* ── Global overlays (above ALL screens) ─────────────────── */}

            {/* THE ONE sound manager for the entire app */}
            <GlobalSoundController />

            {/* Legacy no-op shim — safe to keep */}
            <CallAudioController />

            {/* Call UI overlays */}
            <IncomingCallOverlay />
            <OutgoingCallOverlay />
            <ActiveCallOverlay />

            {/* Grace period alarm */}
            <GraceAlarmModal />

            {/* In-app notification banner */}
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