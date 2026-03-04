/**
 * useGracePeriod
 *
 * Subscribes to gracePeriods root in RTDB and finds the grace period
 * for this user (or any active grace if admin).
 *
 * Returns countdown state for display in queue/dashboard cards.
 * The actual modal + alarm is handled globally by GraceAlarmModal in _layout.tsx.
 *
 * IMPORTANT: This hook does NOT call graceTimeout("expired") — expiry is
 * handled exclusively by the server-side cron job to prevent the
 * "remove from queue 5 times" bug.
 */

import { getDatabase, off, onValue, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';

export type GracePeriodState = {
  active: boolean;
  machineId: string;
  userId: string;
  userName: string;
  startedAt: Date;
  expiresAt: Date;
  secondsLeft: number;
  warned: boolean;  // true when < 3 minutes remaining (for UI colour)
};

type Params = {
  machineId?: string;  // optional hint to prefer this machine
  userId?: string;
  isAdmin?: boolean;
};

const WARNING_THRESHOLD_SECS = 3 * 60;  // 3 minutes — consistent across all pages

export function useGracePeriod({ machineId, userId, isAdmin }: Params) {
  const [gracePeriod, setGracePeriod] = useState<GracePeriodState | null>(null);
  const tickerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef    = useRef<{ machineId: string; userId: string; userName: string; startedAt: string; expiresAt: string } | null>(null);
  const isAdminRef = useRef(isAdmin);

  useEffect(() => { isAdminRef.current = isAdmin; }, [isAdmin]);

  const computeState = (): GracePeriodState | null => {
    const d = dataRef.current;
    if (!d) return null;
    const expiresAt   = new Date(d.expiresAt);
    const startedAt   = new Date(d.startedAt);
    const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    if (secondsLeft <= 0) return null;
    return {
      active: true,
      machineId: d.machineId,
      userId:    d.userId,
      userName:  d.userName,
      startedAt,
      expiresAt,
      secondsLeft,
      warned: secondsLeft <= WARNING_THRESHOLD_SECS,
    };
  };

  const startTicker = () => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(() => {
      const state = computeState();
      setGracePeriod(state);
      if (!state) stopTicker();
    }, 500);
  };

  const stopTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
  };

  useEffect(() => {
    if (!userId) return;

    const db      = getDatabase();
    const rootRef = ref(db, 'gracePeriods');

    const handler = (snapshot: any) => {
      const all = snapshot.val() as Record<string, any> | null;

      if (!all) {
        dataRef.current = null;
        setGracePeriod(null);
        stopTicker();
        return;
      }

      // Find relevant grace period
      let found: { machineId: string; data: any } | null = null;

      for (const [mId, data] of Object.entries(all)) {
        if (!data || data.status !== 'active') continue;
        // Regular user: only show their own grace
        if (!isAdminRef.current && data.userId !== userId) continue;
        // Prefer hinted machineId, otherwise first found
        if (!found || (machineId && mId === machineId)) {
          found = { machineId: mId, data };
        }
      }

      if (!found) {
        dataRef.current = null;
        setGracePeriod(null);
        stopTicker();
        return;
      }

      dataRef.current = {
        machineId: found.machineId,
        userId:    found.data.userId,
        userName:  found.data.userName || 'Unknown',
        startedAt: found.data.startedAt,
        expiresAt: found.data.expiresAt,
      };

      const state = computeState();
      setGracePeriod(state);
      if (state) startTicker();
    };

    onValue(rootRef, handler);

    return () => {
      off(rootRef, 'value', handler);
      stopTicker();
      dataRef.current = null;
      setGracePeriod(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return { gracePeriod, formatTime };
}
