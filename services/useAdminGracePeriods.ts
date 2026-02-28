/**
 * useAdminGracePeriods
 *
 * For admin users: subscribes to ALL active grace periods across every machine.
 * Returns an array so the admin can see when ANY user's turn is active.
 *
 * Each entry includes the userName (stored in RTDB when grace starts) so no
 * extra Firestore fetch is needed.
 */

import { getDatabase, off, onValue, ref } from "firebase/database";
import { useEffect, useState } from "react";

export type AdminGracePeriod = {
  machineId: string;
  userId: string;
  userName: string;
  secondsLeft: number;
  expiresAt: Date;
  startedAt: Date;
};

export function useAdminGracePeriods(adminUserId?: string) {
  const [periods, setPeriods] = useState<AdminGracePeriod[]>([]);

  useEffect(() => {
    if (!adminUserId) return;

    const database = getDatabase();
    const graceRootRef = ref(database, "gracePeriods");

    const handleValue = (snapshot: any) => {
      const raw = snapshot.val();
      if (!raw) {
        setPeriods([]);
        return;
      }

      const now = Date.now();
      const active: AdminGracePeriod[] = [];

      // raw = { M001: { status, userId, userName, expiresAt, ... }, M002: {...}, ... }
      Object.entries(raw).forEach(([machineId, data]: [string, any]) => {
        if (!data || data.status !== "active") return;

        const expiresAt = new Date(data.expiresAt);
        const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
        if (secondsLeft <= 0) return;

        active.push({
          machineId,
          userId: data.userId,
          userName: data.userName || "Unknown",
          secondsLeft,
          expiresAt,
          startedAt: new Date(data.startedAt),
        });
      });

      // Sort: soonest-expiring first
      active.sort((a, b) => a.secondsLeft - b.secondsLeft);
      setPeriods(active);
    };

    onValue(graceRootRef, handleValue);

    // Tick every second so secondsLeft stays current
    const ticker = setInterval(() => {
      setPeriods((prev) => {
        const now = Date.now();
        return prev
          .map((p) => ({
            ...p,
            secondsLeft: Math.max(0, Math.floor((p.expiresAt.getTime() - now) / 1000)),
          }))
          .filter((p) => p.secondsLeft > 0);
      });
    }, 1000);

    return () => {
      off(graceRootRef, "value", handleValue);
      clearInterval(ticker);
    };
  }, [adminUserId]);

  return periods;
}
