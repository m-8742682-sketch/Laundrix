/**
 * Queue Ring Hook
 * 
 * Handles continuous ringing when it's the user's turn.
 * Rings until user acknowledges (scans QR or dismisses notification).
 */

import { useEffect, useRef } from "react";
import { AppState, Vibration } from "react-native";
import * as Notifications from "expo-notifications";

type UseQueueRingParams = {
  machineId: string;
  currentUserId: string | null;
  nextUserId?: string | null;
  myUserId: string;
};

export function useQueueRing({
  machineId,
  currentUserId,
  nextUserId,
  myUserId,
}: UseQueueRingParams) {
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasMyTurnRef = useRef(false);

  // Check if it's my turn (I'm either currentUserId or nextUserId)
  const isMyTurn = myUserId && (currentUserId === myUserId || nextUserId === myUserId);

  useEffect(() => {
    // Became my turn
    if (isMyTurn && !wasMyTurnRef.current) {
      wasMyTurnRef.current = true;
      startRinging();
    }

    // No longer my turn
    if (!isMyTurn && wasMyTurnRef.current) {
      wasMyTurnRef.current = false;
      stopRinging();
    }

    return () => {
      stopRinging();
    };
  }, [isMyTurn]);

  // Stop ringing when app goes to background (user likely acknowledged)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && wasMyTurnRef.current) {
        // User opened notification or went to app - stop ringing
        stopRinging();
      }
    });

    return () => subscription.remove();
  }, []);

  /**
   * Start continuous ringing with repeated notifications
   */
  const startRinging = async () => {
    // Initial notification
    await showTurnNotification();
    
    // Vibrate pattern
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);

    // Repeat notification every 30 seconds until acknowledged
    ringIntervalRef.current = setInterval(async () => {
      if (wasMyTurnRef.current) {
        await showTurnNotification();
        Vibration.vibrate([0, 500, 200, 500]);
      } else {
        stopRinging();
      }
    }, 30000); // 30 seconds
  };

  /**
   * Stop ringing
   */
  const stopRinging = () => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    Vibration.cancel();
  };

  /**
   * Show "Your Turn" notification
   */
  const showTurnNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎉 It's Your Turn!",
        body: `Machine ${machineId} is ready for you. Tap to start!`,
        data: {
          type: "queue",
          machineId,
          alarm: true,
          priority: "critical",
        },
        sound: "alarm.mp3",
      },
      trigger: null,
    });
  };
}
