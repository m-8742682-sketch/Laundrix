/**
 * Grace Period Hook
 * 
 * Handles the 5-minute grace period when a machine becomes available:
 * - At 0 min: User notified "Your turn!"
 * - At 2 min: Warning "Hurry! 3 min left"
 * - At 5 min: User removed from queue
 * 
 * Monitors RTDB gracePeriods/{machineId} for grace period state.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { graceTimeout, claimGrace } from "@/services/api";

export type GracePeriodState = {
  active: boolean;
  machineId: string;
  startedAt: Date;
  expiresAt: Date;
  secondsLeft: number;
  warned: boolean;
};

type UseGracePeriodParams = {
  machineId: string;
  userId?: string;
};

const GRACE_DURATION = 5 * 60 * 1000; // 5 minutes
const WARNING_TIME = 2 * 60 * 1000;   // 2 minutes

export function useGracePeriod({ machineId, userId }: UseGracePeriodParams) {
  const [gracePeriod, setGracePeriod] = useState<GracePeriodState | null>(null);
  const [loading, setLoading] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const warnedRef = useRef(false);

  // Subscribe to grace period state in RTDB
  useEffect(() => {
    if (!userId) return;

    const db = getDatabase();
    const graceRef = ref(db, `gracePeriods/${machineId}`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();

      if (!data || data.userId !== userId) {
        clearGracePeriod();
        return;
      }

      const startedAt = new Date(data.startedAt);
      const expiresAt = new Date(data.expiresAt);

      // Start countdown
      startCountdown(startedAt, expiresAt);
    };

    onValue(graceRef, handleValue);

    return () => {
      off(graceRef, "value", handleValue);
      clearGracePeriod();
    };
  }, [machineId, userId]);

  /**
   * Start countdown timer
   */
  const startCountdown = useCallback((startedAt: Date, expiresAt: Date) => {
    // Clear existing
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    warnedRef.current = false;

    const updateCountdown = async () => {
      const now = Date.now();
      const elapsed = now - startedAt.getTime();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));

      // Check if we need to send 2-minute warning
      if (elapsed >= WARNING_TIME && !warnedRef.current && userId) {
        warnedRef.current = true;
        try {
          await graceTimeout(machineId, userId, "warning");
        } catch (err) {
          console.error("Failed to send warning:", err);
        }
      }

      // Check if expired
      if (remaining <= 0) {
        clearGracePeriod();
        if (userId) {
          try {
            await graceTimeout(machineId, userId, "expired");
            Alert.alert(
              "Time's Up",
              "You've been removed from the queue. Please rejoin if you still want to use the machine."
            );
          } catch (err) {
            console.error("Failed to handle expiry:", err);
          }
        }
        return;
      }

      setGracePeriod({
        active: true,
        machineId,
        startedAt,
        expiresAt,
        secondsLeft: remaining,
        warned: warnedRef.current,
      });
    };

    // Initial update
    updateCountdown();

    // Update every second
    countdownRef.current = setInterval(updateCountdown, 1000);
  }, [machineId, userId]);

  /**
   * Clear grace period
   */
  const clearGracePeriod = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    warnedRef.current = false;
    setGracePeriod(null);
  }, []);

  /**
   * Claim machine during grace period
   */
  const claim = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      await claimGrace(machineId, userId);
      clearGracePeriod();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to claim");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format seconds as MM:SS
   */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return {
    gracePeriod,
    loading,
    claim,
    formatTime,
  };
}
