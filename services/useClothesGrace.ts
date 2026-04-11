/**
 * useClothesGrace
 *
 * Subscribes to clothesGrace/{machineId} in RTDB.
 * Used by:
 *   - ClothesGraceModal (global, in _layout.tsx) — shows the alarm for the current user
 *   - queue.tsx — changes "Currently In Use" label to
 *       "Preparing to collect clothes" (status=active)
 *       "Collecting clothes"            (status=collecting)
 *
 * RTDB structure (clothesGrace/{machineId}):
 *   machineId   : string
 *   userId      : string   ← the current user who must collect
 *   userName    : string
 *   startedAt   : ISO
 *   expiresAt   : ISO
 *   warningSent : boolean
 *   status      : 'active' | 'collecting' | 'expired'
 */

import { getDatabase, off, onValue, ref } from 'firebase/database';
import { useEffect, useRef, useState } from 'react';

export type ClothesGraceState = {
  machineId: string;
  userId: string;
  userName: string;
  startedAt: Date;
  expiresAt: Date;
  secondsLeft: number;
  status: 'active' | 'collecting' | 'expired';
};

type Params = {
  /** When provided only watches this machine. When undefined watches all machines. */
  machineId?: string;
  userId?: string;
  isAdmin?: boolean;
};

export function useClothesGrace({ machineId, userId, isAdmin }: Params) {
  const [clothesGrace, setClothesGrace] = useState<ClothesGraceState | null>(null);
  const tickerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataRef    = useRef<any>(null);

  const computeState = (): ClothesGraceState | null => {
    const d = dataRef.current;
    if (!d) return null;
    if (d.status === 'expired') return null;
    const expiresAt   = new Date(d.expiresAt);
    const startedAt   = new Date(d.startedAt);
    const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    // Keep showing even when seconds=0 if status=collecting (user acknowledged)
    if (secondsLeft <= 0 && d.status === 'active') return null;
    return {
      machineId: d.machineId,
      userId:    d.userId,
      userName:  d.userName,
      startedAt,
      expiresAt,
      secondsLeft,
      status:    d.status,
    };
  };

  const startTicker = () => {
    if (tickerRef.current) return;
    tickerRef.current = setInterval(() => {
      const state = computeState();
      setClothesGrace(state);
      if (!state) stopTicker();
    }, 500);
  };

  const stopTicker = () => {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
  };

  useEffect(() => {
    if (!userId) return;

    const db      = getDatabase();
    // Watch single machine or all machines
    const watchPath = machineId ? `clothesGrace/${machineId}` : 'clothesGrace';
    const watchRef  = ref(db, watchPath);

    const handler = (snapshot: any) => {
      const val = snapshot.val();

      if (!val) {
        dataRef.current = null;
        setClothesGrace(null);
        stopTicker();
        return;
      }

      // If watching all machines, find the relevant one
      let found: any = null;
      if (machineId) {
        // Single machine node — val IS the grace object
        if (val.status === 'expired') { dataRef.current = null; setClothesGrace(null); stopTicker(); return; }
        // Regular user only sees their own grace; admin sees all
        if (!isAdmin && val.userId !== userId) { dataRef.current = null; setClothesGrace(null); stopTicker(); return; }
        found = { ...val, machineId };
      } else {
        // All machines — val is Record<machineId, grace>
        for (const [mId, data] of Object.entries(val as Record<string, any>)) {
          if (!data || data.status === 'expired') continue;
          if (!isAdmin && data.userId !== userId) continue;
          found = { ...data, machineId: mId };
          break; // take first match
        }
      }

      if (!found) { dataRef.current = null; setClothesGrace(null); stopTicker(); return; }

      dataRef.current = found;
      const state = computeState();
      setClothesGrace(state);
      if (state) startTicker();
    };

    onValue(watchRef, handler);

    return () => {
      off(watchRef, 'value', handler);
      stopTicker();
      dataRef.current = null;
      setClothesGrace(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, machineId]);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return { clothesGrace, formatTime };
}
