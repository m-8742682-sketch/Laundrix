/**
 * Incident Handler Hook — FIXED
 *
 * Incidents collection fields:
 *   ownerUserId  — the current machine user (who is being protected)
 *   ownerUserName — the current machine user's display name
 *   intruderId   — person who scanned without permission
 *   intruderName — intruder's display name
 *   machineId    — which machine
 *   status       — "pending" | "resolved" | "timeout"
 *   expiresAt    — when the 60s countdown expires
 *
 * No nextUserId field — removed per design.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { incidentAction } from "@/services/api";

export type ActiveIncident = {
  id: string;
  machineId: string;
  intruderName: string;
  intruderId: string;
  ownerUserId: string;
  expiresAt: Date;
  secondsLeft: number;
};

type UseIncidentHandlerParams = {
  userId?: string;
  /** If true, subscribe to ALL pending incidents (admin view) */
  isAdmin?: boolean;
  /** If true, subscribe to incidents where THIS user is the intruder */
  isIntruder?: boolean;
};

// ─── Module-level dismissed incident registry ─────────────────────────────────
//
// WHY NOT useRef: useRef resets to null every time the hook remounts (tab switch).
// Dashboard + Queue + Admin all mount their own instance of useIncidentHandler.
// When user dismisses an incident on the Queue tab, then switches to Dashboard,
// Dashboard's hook remounts with dismissedIncidentIdRef = null → Firestore snapshot
// fires again for the same (still-pending) incident → brief urgent.mp3 for 0.5s.
//
// Module-level Set is shared across ALL instances and survives remounts entirely.
const _globalDismissedIncidentIds = new Set<string>();

// ─── Sound via GlobalSoundController ─────────────────────────────────────────
// We don't play audio directly here — instead we write to soundState$ and let
// GlobalSoundController handle it. This prevents conflicting AudioSession owners.
import { playSound, stopSound } from "@/services/soundState";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIncidentHandler({ userId, isAdmin, isIntruder }: UseIncidentHandlerParams) {
  const [incident, setIncident] = useState<ActiveIncident | null>(null);
  const [loading, setLoading] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIncidentIdRef = useRef<string | null>(null);
  // NOTE: dismissed IDs are tracked in _globalDismissedIncidentIds (module-level),
  // NOT in a useRef — so they survive tab switches and hook remounts.

  const clearIncident = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    stopSound();
    // Register in global dismissed set so remounted instances won't re-trigger
    if (activeIncidentIdRef.current) {
      _globalDismissedIncidentIds.add(activeIncidentIdRef.current);
    }
    activeIncidentIdRef.current = null;
    Vibration.cancel();
    setIncident(null);
  }, []);

  const startCountdown = useCallback(
    (doc: {
      id: string;
      machineId: string;
      intruderName: string;
      intruderId: string;
      ownerUserId: string;
      expiresAt: Date;
    }) => {
      // Don't re-start if same incident is already active
      if (activeIncidentIdRef.current === doc.id) return;
      // Don't re-show an incident the user already dismissed (survives tab switches)
      if (_globalDismissedIncidentIds.has(doc.id)) return;
      if (countdownRef.current) clearInterval(countdownRef.current);

      const isOwner = userId === doc.ownerUserId;
      activeIncidentIdRef.current = doc.id;   // track active incident

      // Play urgent sound via GlobalSoundController (not directly)
      playSound("urgent");
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);

      const tick = () => {
        const remaining = Math.max(
          0,
          Math.floor((doc.expiresAt.getTime() - Date.now()) / 1000)
        );

        if (remaining <= 0) {
          clearIncident();
          return;
        }

        setIncident({ ...doc, secondsLeft: remaining });
      };

      tick();
      countdownRef.current = setInterval(tick, 1000);
    },
    [userId, isAdmin, clearIncident]
  );

  // ── Firestore subscription ────────────────────────────────────────────────

  useEffect(() => {
    if (!userId) return;

    const db = getFirestore();

    let q;
    if (isAdmin) {
      // Admin sees ALL pending incidents
      q = query(collection(db, "incidents"), where("status", "==", "pending"));
    } else if (isIntruder) {
      // Intruder: incidents where THEY caused the alert (so they know they're flagged)
      q = query(
        collection(db, "incidents"),
        where("intruderId", "==", userId),
        where("status", "==", "pending")
      );
    } else {
      // Owner: incidents where they are the ownerUserId (notified when intruder appears)
      q = query(
        collection(db, "incidents"),
        where("ownerUserId", "==", userId),
        where("status", "==", "pending")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        clearIncident();
        return;
      }

      // Take the most recent incident
      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

      // Handle both Firestore Timestamp and ISO string
      let expiresAt: Date;
      if (data.expiresAt instanceof Timestamp) {
        expiresAt = data.expiresAt.toDate();
      } else if (typeof data.expiresAt === "string") {
        expiresAt = new Date(data.expiresAt);
      } else {
        expiresAt = new Date(Date.now() + 60000);
      }

      startCountdown({
        id: docSnap.id,
        machineId: data.machineId,
        intruderName: data.intruderName ?? data.intruderUserId ?? "Unknown",
        intruderId: data.intruderId ?? data.intruderUserId ?? "",
        ownerUserId: data.ownerUserId ?? data.nextUserId ?? "", // fallback for legacy records
        expiresAt,
      });
    });

    return () => {
      unsubscribe();
      clearIncident();
    };
  }, [userId, isAdmin, isIntruder, startCountdown, clearIncident]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleNotMe = async () => {
    if (!incident || !userId) return;
    setLoading(true);
    try {
      const result = await incidentAction(incident.id, userId, "confirm_not_me");
      if (result.data?.buzzerTriggered) {
        Alert.alert("🔔 Buzzer Activated", "The machine alarm has been triggered.");
      }
      clearIncident();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to confirm");
    } finally {
      setLoading(false);
    }
  };

  const handleThatsMe = async () => {
    if (!incident || !userId) return;
    setLoading(true);
    try {
      await incidentAction(incident.id, userId, "dismiss");
      clearIncident();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to dismiss");
    } finally {
      setLoading(false);
    }
  };

  /** Intruder-only: just close the modal locally, don't touch the incident */
  const handleDismissLocally = () => {
    clearIncident();
  };

  return { incident, loading, handleNotMe, handleThatsMe, handleDismissLocally, isAdmin: !!isAdmin };
}
