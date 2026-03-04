/**
 * useAdminGracePeriods — subscribes to ALL grace periods (root)
 * For admin dashboard display. GraceAlarmModal itself is driven by graceAlarmService
 * which is updated by useGracePeriod (all users) and here (admins).
 */

import { getDatabase, off, onValue, ref } from "firebase/database";
import { useEffect, useRef, useState } from "react";
import { graceAlarmService } from "@/services/graceAlarmService";

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
  const alarmKeyRef = useRef<Map<string, string>>(new Map()); // machineId → alarmKey

  useEffect(() => {
    if (!adminUserId) return;

    const database     = getDatabase();
    const graceRootRef = ref(database, "gracePeriods");

    const handleValue = (snapshot: any) => {
      const raw = snapshot.val() as Record<string, any> | null;

      if (!raw) {
        setPeriods([]);
        graceAlarmService.clear().catch(() => {});
        alarmKeyRef.current.clear();
        return;
      }

      const now    = Date.now();
      const active: AdminGracePeriod[] = [];

      for (const [machineId, data] of Object.entries(raw)) {
        if (!data || data.status !== "active") continue;

        const expiresAt   = new Date(data.expiresAt);
        const secondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
        if (secondsLeft <= 0) continue;

        active.push({
          machineId,
          userId:    data.userId,
          userName:  data.userName || "Unknown",
          secondsLeft,
          expiresAt,
          startedAt: new Date(data.startedAt),
        });

        // Start graceAlarmService for sound + countdown on new grace
        // GraceAlarmModal reads dismissedBy/silencedBy from RTDB directly
        const alarmKey = `${machineId}::${data.expiresAt}`;
        const prevKey  = alarmKeyRef.current.get(machineId);
        if (prevKey !== alarmKey) {
          alarmKeyRef.current.set(machineId, alarmKey);
          graceAlarmService.start(machineId, data.userId, expiresAt, {
            userName:  data.userName || "Unknown",
            startedAt: data.startedAt,
          }).catch(() => {});
        }
      }

      if (active.length === 0) {
        graceAlarmService.clear().catch(() => {});
        alarmKeyRef.current.clear();
      }

      active.sort((a, b) => a.secondsLeft - b.secondsLeft);
      setPeriods(active);
    };

    onValue(graceRootRef, handleValue);

    const ticker = setInterval(() => {
      setPeriods((prev) => {
        const now = Date.now();
        return prev
          .map((p) => ({ ...p, secondsLeft: Math.max(0, Math.floor((p.expiresAt.getTime() - now) / 1000)) }))
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