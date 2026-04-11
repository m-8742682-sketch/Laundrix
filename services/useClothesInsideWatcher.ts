/**
 * useClothesInsideWatcher
 *
 * Subscribes to ALL iot/{machineId}/state nodes in RTDB.
 * When any machine transitions to state === 'Clothes Inside',
 * immediately calls POST /api/grace-actions { action: "start-clothes" }
 * to start the clothes collection grace — with ZERO cron latency.
 *
 * The backend endpoint is idempotent, so duplicate calls from multiple
 * clients are harmless (only the first one creates the clothesGrace node).
 *
 * Mount this hook once in app/_layout.tsx so it runs globally.
 */

import { getDatabase, onValue, off, ref } from 'firebase/database';
import { useEffect, useRef } from 'react';
import { triggerClothesGrace } from '@/services/api';

type Params = {
  userId?: string;
};

export function useClothesInsideWatcher({ userId }: Params) {
  // Track which machines we've already triggered to avoid duplicate calls
  // within the same session (RTDB fires onValue on reconnect too)
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const db      = getDatabase();
    const iotRef  = ref(db, 'iot');

    const handler = (snapshot: any) => {
      const all = snapshot.val() as Record<string, any> | null;
      if (!all) return;

      for (const [machineId, data] of Object.entries(all)) {
        if (!data) continue;

        // Trigger key: machineId + currentUserId so it re-fires for each new session
        const triggerKey = `${machineId}::${data.currentUserId}`;

        if (
          data.state === 'Clothes Inside' &&
          data.currentUserId &&                // must have a current user
          !triggeredRef.current.has(triggerKey) // not already triggered this session
        ) {
          triggeredRef.current.add(triggerKey);

          // Fire and forget — backend is idempotent
          triggerClothesGrace(machineId, data.currentUserId)
            .then(result => {
              if (!result?.data?.started) {
                // Already existed — remove from triggered so if the node is
                // cleared and Clothes Inside fires again, we catch it
                // (e.g., new session on same machine)
                // Keep it in triggered for this session — next session
                // creates a new key since currentUserId differs
              }
            })
            .catch(err => {
              // Remove on error so it retries on next RTDB update
              triggeredRef.current.delete(triggerKey);
              console.warn('[useClothesInsideWatcher] trigger failed:', err);
            });
        }

        // When state leaves 'Clothes Inside', clear that triggerKey so the
        // NEXT time this machine reaches 'Clothes Inside' we fire again
        if (data.state !== 'Clothes Inside') {
          // Clear any stale trigger keys for this machine
          for (const key of triggeredRef.current) {
            if (key.startsWith(`${machineId}::`)) {
              triggeredRef.current.delete(key);
            }
          }
        }
      }
    };

    onValue(iotRef, handler);
    return () => off(iotRef, 'value', handler);
  }, [userId]);
}
