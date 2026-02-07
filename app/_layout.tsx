import { AuthProvider } from "@/components/UserContext";
import * as SplashScreen from "expo-splash-screen";
import { auth } from "@/services/firebase";
import { Stack, router } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { 
  initializeNotifications, 
  addNotificationResponseListener,
  addNotificationReceivedListener 
} from "@/services/notification.service";

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
        router.push("/(tabs)/contact");
      } else if (data?.type === "call" || data?.type === "missedCall" || data?.type === "missedVideo") {
        router.push("/(tabs)/contact");
      }
    });

    // Handle foreground notification (when notification arrives while app is open)
    const receivedSubscription = addNotificationReceivedListener(notification => {
      console.log("[Notification] Received in foreground:", notification.request.content.title);
      // Notification will show as configured - no additional action needed
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
