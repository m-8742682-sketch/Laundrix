import { Stack } from "expo-router";

export default function CallLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_bottom",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="voice-incoming" options={{ gestureEnabled: true,  gestureDirection: "vertical" }} />
      <Stack.Screen name="video-incoming" options={{ gestureEnabled: true,  gestureDirection: "vertical" }} />
      <Stack.Screen name="voice-outgoing" options={{ gestureEnabled: false }} />
      <Stack.Screen name="video-outgoing" options={{ gestureEnabled: false }} />
      <Stack.Screen name="voice-call"     options={{ gestureEnabled: false }} />
      <Stack.Screen name="video-call"     options={{ gestureEnabled: false }} />
    </Stack>
  );
}
