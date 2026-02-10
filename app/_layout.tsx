import { AuthProvider } from "@/components/UserContext";
import { I18nProvider } from "@/i18n/i18n";
import * as SplashScreen from "expo-splash-screen";
import { auth } from "@/services/firebase";
import { Stack, router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { 
  initializeNotifications, 
  addNotificationResponseListener,
  addNotificationReceivedListener 
} from "@/services/notification.service";
import IncomingCallOverlay from "@/components/IncomingCallOverlay";
import NotificationPopup from "@/components/NotificationPopup";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hasNavigated = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
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
        // Initialize notifications when user logs in
        initializeNotifications(user.uid).catch(err => 
          console.warn("[Layout] Notification init failed:", err)
        );
        router.replace("/(tabs)/dashboard");
      } else {
        router.replace("/(auth)/login");
      }
    });

    return unsubscribe;
  }, []);

  // Set up notification listeners (runs once on mount)
  useEffect(() => {
    // Handle notification tap (when user taps notification)
    const responseSubscription = addNotificationResponseListener(response => {
      const data = response.notification.request.content.data;
      console.log("[Notification] Tapped:", data);

      // Navigate based on notification type
      if (data?.type === "queue" || data?.type === "laundry") {
        router.push("/(tabs)/queue");
      } else if (data?.type === "unauthorized") {
        router.push("/(tabs)/queue");
      } else if (data?.type === "chat") {
        router.push("/(tabs)/conversations");
      } else if (data?.callId) {
        // Incoming call notification - navigate to incoming call screen
        const isVideo = data?.type === "video_call" || data?.type === "missed_video";
        const callId = String(data.callId || "");
        const callerName = String(data.callerName || "Unknown");
        
        if (isVideo) {
          router.push({
            pathname: "/call/video-incoming",
            params: {
              channel: callId,
              name: callerName,
            },
          });
        } else {
          router.push({
            pathname: "/call/voice-incoming",
            params: {
              channel: callId,
              name: callerName,
            },
          });
        }
      } else if (data?.type === "call" || data?.type === "missedCall" || data?.type === "missedVideo") {
        router.push("/(tabs)/conversations");
      }
    });

    // Handle foreground notification (when notification arrives while app is open)
    const receivedSubscription = addNotificationReceivedListener(notification => {
      console.log("[Notification] Received in foreground:", notification.request.content.title);
      // For calls, the IncomingCallOverlay will handle showing the UI
      // Other notifications will show as banners via the notification system
    });

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
          <Stack screenOptions={{ headerShown: false }} />
          {/* Global incoming call overlay */}
          <IncomingCallOverlay />
          {/* Global notification popup */}
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
