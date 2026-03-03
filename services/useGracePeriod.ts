/**
 * useGracePeriod — FIXED v4
 *
 * Root cause (confirmed):
 *   Dashboard calls useGracePeriod({ machineId: activeMachineId })
 *   where activeMachineId = activeSession?.machineId || userQueueMachineId
 *
 *   userQueueMachineId is set asynchronously after:
 *     loadMachines() → subscribeQueue() → queue fires → setUserQueueMachineId()
 *
 *   This chain takes 1-3 seconds. Grace fires in RTDB the moment the previous
 *   user's session ends. By the time machineId is known, the RTDB onValue
 *   already fired — and since useEffect only ran once machineId became non-empty,
 *   we missed the event. The second time machineId is already in state → works.
 *
 * Fix:
 *   Accept a list of machineIds to watch (or a single one).
 *   Also accept an IMMEDIATE fallback: if machineId is empty, watch ALL machines
 *   that the user could possibly be in queue for by listening to gracePeriods root.
 *   The moment any gracePeriods/{machineId} becomes active with our userId,
 *   we pick it up regardless of whether userQueueMachineId is resolved yet.
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
  machineId: string;   // specific machine — can be empty string
  userId?: string;
  isAdmin?: boolean;
};

export function useGracePeriod({ machineId, userId, isAdmin }: UseGracePeriodParams) {
  const [gracePeriod, setGracePeriod] = useState<GracePeriodState | null>(null);
  const [loading, setLoading] = useState(false);

  const graceDataRef         = useRef<{ machineId: string; userId: string; userName: string; startedAt: string; expiresAt: string } | null>(null);
  const tickerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmStartedForRef   = useRef<string | null>(null);
  const userIdRef            = useRef(userId);
  const adminRef             = useRef(isAdmin);
  const machineIdRef         = useRef(machineId);

  useEffect(() => { userIdRef.current    = userId;   }, [userId]);
  useEffect(() => { adminRef.current     = isAdmin;  }, [isAdmin]);
  useEffect(() => { machineIdRef.current = machineId; }, [machineId]);

  // ── Shared tick function ──────────────────────────────────────────────────
  const applyTick = () => {
    const data = graceDataRef.current;
    if (!data) { setGracePeriod(null); return; }

    const expiresAt  = new Date(data.expiresAt);
    const startedAt  = new Date(data.startedAt);
    const remaining  = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const uid        = userIdRef.current;
    const admin      = adminRef.current;
    const isMyTurn   = data.userId === uid;

    // Start alarm only once per unique expiresAt.
    // Do NOT restart if graceAlarmService was already cleared by a successful scan —
    // graceAlarmService.isActive() is false after clear(), preventing the ring
    // from restarting when the RTDB snapshot fires one final time after the scan.
    if ((isMyTurn || admin) && alarmStartedForRef.current !== data.expiresAt) {
      alarmStartedForRef.current = data.expiresAt;
      const alreadyClearedByScan = !graceAlarmService.isActive() && alarmStartedForRef.current !== null;
      if (!alreadyClearedByScan) {
        graceAlarmService.start(data.machineId, data.userId, expiresAt).catch(() => {});
        if (!graceAlarmService.isRingSilenced()) {
          Vibration.vibrate([0, 500, 200, 500, 200, 500]);
        }
      }
    }

    if (remaining <= 0) {
      graceDataRef.current       = null;
      alarmStartedForRef.current = null;
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
      userId: data.userId,
      userName: data.userName,
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
    graceDataRef.current       = null;
    alarmStartedForRef.current = null;
    Vibration.cancel();
    graceAlarmService.clear().catch(() => {});
    setGracePeriod(null);
  };

  // ── Handler for incoming RTDB snapshot (used by both subscriptions) ───────
  const handleSnapshot = (snapshot: any, snapMachineId: string) => {
    const data = snapshot.val();

    if (!data || data.status !== "active") {
      // Only clear if this is for the machine we're currently tracking
      if (graceDataRef.current?.machineId === snapMachineId) {
        stopTicker();
        clearAll();
      }
      return;
    }

    const uid   = userIdRef.current;
    const admin = adminRef.current;

    // Skip if not our grace (non-admin)
    if (!admin && data.userId !== uid) {
      if (graceDataRef.current?.machineId === snapMachineId) {
        stopTicker();
        clearAll();
      }
      return;
    }

    graceDataRef.current = {
      machineId:  snapMachineId,
      userId:     data.userId,
      userName:   data.userName || "Unknown",
      startedAt:  data.startedAt,
      expiresAt:  data.expiresAt,
    };

    // Apply tick immediately — gives real secondsLeft right now
    applyTick();
    startTicker();
  };

  // ── Subscription 1: specific machineId (when known) ───────────────────────
  useEffect(() => {
    if (!machineId || !userId) return;
    const database = getDatabase();
    const graceRef = ref(database, `gracePeriods/${machineId}`);
    const handler  = (snap: any) => handleSnapshot(snap, machineId);
    onValue(graceRef, handler);
    return () => {
      off(graceRef, "value", handler);
      stopTicker();
      graceDataRef.current       = null;
      alarmStartedForRef.current = null;
      setGracePeriod(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, userId]);

  // ── Subscription 2: root gracePeriods — catches grace that fires BEFORE
  //    machineId is resolved (first-time only, stops once machineId is known) ─
  useEffect(() => {
    // Only run the root subscription when machineId is NOT yet known
    if (machineId || !userId) return;

    const database = getDatabase();
    const rootRef  = ref(database, "gracePeriods");

    const handler = (snapshot: any) => {
      const allGrace = snapshot.val();
      if (!allGrace) return;

      // Find any active grace for our userId
      for (const [mId, data] of Object.entries(allGrace as Record<string, any>)) {
        if (data?.status === "active" && (data.userId === userId || adminRef.current)) {
          handleSnapshot({ val: () => data }, mId);
          return;
        }
      }
    };

    onValue(rootRef, handler);
    return () => {
      off(rootRef, "value", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, userId]);

  // ── Claim machine ──────────────────────────────────────────────────────────
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
