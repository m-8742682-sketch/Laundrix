/**
 * useGracePeriod v5 — ROOT SUBSCRIPTION, no machineId dependency
 *
 * ROOT CAUSE of "first grace never shows":
 *   Previous version subscribed to gracePeriods/{machineId} where machineId
 *   was the user-selected machine in queue.tsx. But grace can fire on ANY
 *   machine the user is queued for. If the selected machineId != the machine
 *   where grace fires, the onValue never triggers.
 *
 * FIX:
 *   Subscribe to gracePeriods root ALWAYS. Find the grace that belongs to
 *   this user (or any grace if admin). MachineId param is now OPTIONAL and
 *   only used as a hint/filter, not a required subscription path.
 *
 * SYNC:


 */

import { claimGrace, graceTimeout } from "@/services/api";
import { graceAlarmService } from "@/services/graceAlarmService";
import { getDatabase, off, onValue, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import { Alert, Vibration } from "react-native";

export type GracePeriodState = {
  active: boolean;
  machineId: string;
  userId: string;
  userName: string;
  startedAt: Date;
  expiresAt: Date;
  secondsLeft: number;
  warned: boolean;
};

type UseGracePeriodParams = {
  machineId?: string;  // optional hint — we subscribe to root regardless
  userId?: string;
  isAdmin?: boolean;
};

export function useGracePeriod({ machineId, userId, isAdmin }: UseGracePeriodParams) {
  const [gracePeriod, setGracePeriod] = useState<GracePeriodState | null>(null);
  const [loading, setLoading]         = useState(false);

  const graceDataRef       = useRef<{
    machineId: string; userId: string; userName: string;
    startedAt: string; expiresAt: string;
  } | null>(null);
  const tickerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmKeyRef        = useRef<string | null>(null); // machineId+expiresAt = unique alarm key
  const userIdRef          = useRef(userId);
  const adminRef           = useRef(isAdmin);

  useEffect(() => { userIdRef.current = userId;  }, [userId]);
  useEffect(() => { adminRef.current  = isAdmin; }, [isAdmin]);

  const applyTick = () => {
    const data = graceDataRef.current;
    if (!data) { setGracePeriod(null); return; }

    const expiresAt  = new Date(data.expiresAt);
    const startedAt  = new Date(data.startedAt);
    const remaining  = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const uid        = userIdRef.current;
    const isMyTurn   = data.userId === uid;

    // Start graceAlarmService for sound + countdown on new grace
    // GraceAlarmModal reads dismissedBy/silencedBy directly from RTDB — no flag sync needed here
    const alarmKey = `${data.machineId}::${data.expiresAt}`;
    if (alarmKeyRef.current !== alarmKey) {
      alarmKeyRef.current = alarmKey;
      graceAlarmService.start(data.machineId, data.userId, expiresAt, {
        userName:  data.userName,
        startedAt: data.startedAt,
      }).catch(() => {});
    }

    if (remaining <= 0) {
      graceDataRef.current = null;
      alarmKeyRef.current  = null;
      setGracePeriod(null);
      if (uid && isMyTurn) {
        graceTimeout(data.machineId, uid, "expired").catch(() => {});
        graceAlarmService.clear().catch(() => {});
      }
      return;
    }

    setGracePeriod({
      active: true,
      machineId: data.machineId,
      userId:    data.userId,
      userName:  data.userName,
      startedAt,
      expiresAt,
      secondsLeft: remaining,
      warned: remaining <= 180,
    });
  };

  const startTicker = () => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(applyTick, 500);
  };

  const stopTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
  };

  const clearAll = () => {
    graceDataRef.current = null;
    alarmKeyRef.current  = null;
    Vibration.cancel();
    graceAlarmService.clear().catch(() => {});
    setGracePeriod(null);
  };

  // ── ROOT subscription — always subscribed, no machineId dependency ──────────
  useEffect(() => {
    if (!userId) return;

    const database  = getDatabase();
    const rootRef   = ref(database, "gracePeriods");

    const handler = (snapshot: any) => {
      const all = snapshot.val() as Record<string, any> | null;

      if (!all) {
        stopTicker();
        clearAll();
        return;
      }

      // Find the grace that belongs to this user (or any active grace if admin)
      let found: { machineId: string; data: any } | null = null;

      for (const [mId, data] of Object.entries(all)) {
        if (!data || data.status !== "active") continue;

        // User: must be their grace. Admin: show all (pick first/soonest).
        if (!adminRef.current && data.userId !== userId) continue;

        // If machineId hint provided, prefer that machine
        if (!found || (machineId && mId === machineId)) {
          found = { machineId: mId, data };
        }
      }

      if (!found) {
        stopTicker();
        clearAll();
        return;
      }

      const { machineId: mId, data } = found;
      graceDataRef.current = {
        machineId: mId,
        userId:    data.userId,
        userName:  data.userName || "Unknown",
        startedAt: data.startedAt,
        expiresAt: data.expiresAt,
      };

      applyTick();
      startTicker();
    };

    onValue(rootRef, handler);

    return () => {
      off(rootRef, "value", handler);
      stopTicker();
      graceDataRef.current = null;
      alarmKeyRef.current  = null;
      setGracePeriod(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);  // Only re-subscribe when userId changes

  // ── Claim ──────────────────────────────────────────────────────────────────
  const claim = async () => {
    const gp = gracePeriod;
    if (!userId || !gp) return;
    setLoading(true);
    try {
      await claimGrace(gp.machineId, userId);
      stopTicker();
      clearAll();
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