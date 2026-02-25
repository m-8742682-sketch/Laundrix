/**
 * Queue Ring Hook (FIXED + ENHANCED)
 *
 * What's fixed vs original:
 * 1. Actually plays alarm.mp3 via expo-av (original only used expo-notifications)
 * 2. Loops the alarm sound every 30s until user acknowledges
 * 3. Properly unloads sound on cleanup
 */

import { useEffect, useRef } from "react";
import { AppState, Vibration } from "react-native";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";

type UseQueueRingParams = {
  machineId: string;
  currentUserId: string | null;
  nextUserId?: string | null;
  myUserId: string;
};

let alarmSound: Audio.Sound | null = null;

async function startAlarm() {
  try {
    if (alarmSound) return; // already playing
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require("@/assets/sounds/alarm.mp3"),
      { isLooping: true, volume: 1.0 }
    );
    alarmSound = sound;
    await sound.playAsync();
  } catch (err) {
    console.warn("[QueueRing] Alarm sound error:", err);
  }
}

async function stopAlarm() {
  try {
    if (alarmSound) {
      await alarmSound.stopAsync();
      await alarmSound.unloadAsync();
      alarmSound = null;
    }
  } catch {}
}

export function useQueueRing({
  machineId,
  currentUserId,
  nextUserId,
  myUserId,
}: UseQueueRingParams) {
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wasMyTurnRef = useRef(false);

  const isMyTurn =
    !!myUserId &&
    (currentUserId === myUserId || nextUserId === myUserId);

  useEffect(() => {
    if (isMyTurn && !wasMyTurnRef.current) {
      wasMyTurnRef.current = true;
      startRinging();
    }

    if (!isMyTurn && wasMyTurnRef.current) {
      wasMyTurnRef.current = false;
      stopRinging();
    }

    return () => stopRinging();
  }, [isMyTurn]);

  // Stop when app goes to background (user acknowledged)
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" && wasMyTurnRef.current) {
        stopAlarm();
      }
    });
    return () => sub.remove();
  }, []);

  const startRinging = async () => {
    await startAlarm();
    await showTurnNotification();
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    // Re-ring every 30 seconds until acknowledged
    ringIntervalRef.current = setInterval(async () => {
      if (wasMyTurnRef.current) {
        await showTurnNotification();
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        stopRinging();
      }
    }, 30000);
  };

  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    stopAlarm();
    Vibration.cancel();
  };

  const showTurnNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎉 It's Your Turn!",
        body: `Machine ${machineId} is ready for you. Tap to start!`,
        data: { type: "queue", machineId, alarm: true, priority: "critical" },
        sound: "alarm.mp3",
      },
      trigger: null,
    });
  };
}
