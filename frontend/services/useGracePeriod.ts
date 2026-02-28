/**
 * useGracePeriod — FIXED
 *
 * #1: Exposes secondsLeft for countdown display on dashboard + queue
 * #3: Delegates ALL alarm logic to graceAlarmService (global, persistent)
 *     Removed duplicate warnSound / urgent.mp3 logic — graceAlarmService owns all sounds
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import { getDatabase, ref, onValue, off } from "firebase/database";
import { graceTimeout, claimGrace } from "@/services/api";
import { graceAlarmService } from "@/services/graceAlarmService";

export type GracePeriodState = {
  active: boolean;
  machineId: string;
  userId: string;
  startedAt: Date;
  expiresAt: Date;
  secondsLeft: number;
  warned: boolean;
};

type UseGracePeriodParams = {
  machineId: string;
  userId?: string;
  isAdmin?: boolean;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGracePeriod({ machineId, userId, isAdmin }: UseGracePeriodParams) {
  const [gracePeriod, setGracePeriod] = useState<GracePeriodState | null>(null);
  const [loading, setLoading] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track if alarm was started for this session (avoid re-starting on re-renders)
  const alarmStartedRef = useRef(false);

  const clearGracePeriod = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    alarmStartedRef.current = false;
    Vibration.cancel();
    setGracePeriod(null);
  }, []);

  const startCountdown = useCallback(
    (data: { machineId: string; userId: string; startedAt: string; expiresAt: string }) => {
      if (countdownRef.current) clearInterval(countdownRef.current);

      const startedAt = new Date(data.startedAt);
      const expiresAt = new Date(data.expiresAt);

      // Delegate alarm to global graceAlarmService — it handles all sounds, persistence, looping
      // Only start alarm once per session (graceAlarmService.start is idempotent but we track)
      const isMyTurn = data.userId === userId;
      if ((isMyTurn || isAdmin) && !alarmStartedRef.current) {
        alarmStartedRef.current = true;
        graceAlarmService.start(data.machineId, data.userId, expiresAt).catch(() => {});
        Vibration.vibrate([0, 500, 200, 500, 200, 500]);
      }

      const tick = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));

        if (remaining <= 0) {
          clearGracePeriod();
          if (userId && isMyTurn) {
            graceTimeout(data.machineId, userId, "expired").catch(() => {});
            graceAlarmService.clear().catch(() => {});
          }
          return;
        }

        setGracePeriod({
          active: true,
          machineId: data.machineId,
          userId: data.userId,
          startedAt,
          expiresAt,
          secondsLeft: remaining,
          warned: remaining <= 180, // < 3 min = warning state (used for color)
        });
      };

      tick();
      countdownRef.current = setInterval(tick, 1000);
    },
    [userId, isAdmin, clearGracePeriod]
  );

  // ── Subscribe to RTDB ────────────────────────────────────────────────────

  useEffect(() => {
    if (!machineId || machineId === "NONE") return;

    const database = getDatabase();
    const graceRef = ref(database, `gracePeriods/${machineId}`);

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (!data || data.status !== "active") {
        clearGracePeriod();
        return;
      }
      if (!isAdmin && data.userId !== userId) {
        clearGracePeriod();
        return;
      }
      startCountdown({
        machineId,
        userId: data.userId,
        startedAt: data.startedAt,
        expiresAt: data.expiresAt,
      });
    };

    onValue(graceRef, handleValue);

    return () => {
      off(graceRef, "value", handleValue);
      clearGracePeriod();
    };
  }, [machineId, userId, isAdmin, startCountdown, clearGracePeriod]);

  // ── Claim machine ─────────────────────────────────────────────────────────

  const claim = async () => {
    if (!userId || !gracePeriod) return;
    setLoading(true);
    try {
      await claimGrace(gracePeriod.machineId, userId);
      clearGracePeriod();
      graceAlarmService.clear().catch(() => {});
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to claim");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return { gracePeriod, loading, claim, formatTime };
}
