/**
 * useAdminGracePeriods
 *
 * Subscribes to ALL grace periods (root) for admin dashboard display.
 * Returns array of active grace periods sorted by time remaining (soonest first).
 *
 * The modal + alarm for admins is handled globally by GraceAlarmModal (_layout.tsx).
 * This hook only provides data for the admin page's banner/list display.
 */

import { getDatabase, off, onValue, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';

export type AdminGracePeriod = {
  machineId: string;
  userId: string;
  userName: string;
  secondsLeft: number;
  expiresAt: Date;
  startedAt: Date;
};

const WARNING_THRESHOLD_SECS = 3 * 60;

export function useAdminGracePeriods(adminUserId?: string) {
  const [periods, setPeriods] = useState<AdminGracePeriod[]>([]);
  const rawDataRef = useRef<Map<string, { data: any }>>(new Map());

  const recompute = () => {
    const now    = Date.now();
    const active: AdminGracePeriod[] = [];
    rawDataRef.current.forEach(({ data }, machineId) => {
      const expiresAt   = new Date(data.expiresAt);
      const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
      if (secondsLeft <= 0) return;
      active.push({
        machineId,
        userId:    data.userId,
        userName:  data.userName || 'Unknown',
        secondsLeft,
        expiresAt,
        startedAt: new Date(data.startedAt),
      });
    });
    active.sort((a, b) => a.secondsLeft - b.secondsLeft);
    setPeriods(active);
  };

  useEffect(() => {
    if (!adminUserId) return;

    const db       = getDatabase();
    const rootRef  = ref(db, 'gracePeriods');

    const handler = (snapshot: any) => {
      const raw = snapshot.val() as Record<string, any> | null;
      rawDataRef.current.clear();

      if (raw) {
        for (const [machineId, data] of Object.entries(raw)) {
          if (!data || data.status !== 'active') continue;
          rawDataRef.current.set(machineId, { data });
        }
      }
      recompute();
    };

    onValue(rootRef, handler);

    // Tick every second to keep secondsLeft fresh
    const ticker = setInterval(recompute, 1000);

    return () => {
      off(rootRef, 'value', handler);
      clearInterval(ticker);
      rawDataRef.current.clear();
      setPeriods([]);
    };
  }, [adminUserId]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isUrgent = (seconds: number) => seconds <= WARNING_THRESHOLD_SECS;

  return { periods, formatTime, isUrgent };
}
