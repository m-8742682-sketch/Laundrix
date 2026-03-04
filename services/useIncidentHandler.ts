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
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
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
};

// ─── Sound helper ─────────────────────────────────────────────────────────────

async function playIncidentSound(): Promise<AudioPlayer | null> {
  try {
    await setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    // FIX #3: Always use urgent.mp3 for the incident/unauthorized modal
    const player = createAudioPlayer(require("@/assets/sounds/urgent.mp3"));
    player.loop = true;
    player.volume = 1.0;
    player.play();
    return player;
  } catch (err) {
    console.warn("[useIncidentHandler] Sound error:", err);
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIncidentHandler({ userId, isAdmin }: UseIncidentHandlerParams) {
  const [incident, setIncident] = useState<ActiveIncident | null>(null);
  const [loading, setLoading] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);

  const clearIncident = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    soundRef.current?.stopAsync().catch(() => {});
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
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
      if (countdownRef.current) clearInterval(countdownRef.current);

      const isOwner = userId === doc.ownerUserId;

      // Play urgent sound for all incident modal cases
      playIncidentSound().then((s) => {
        soundRef.current = s;
      });
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
  }, [userId, isAdmin, startCountdown, clearIncident]);

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

  return { incident, loading, handleNotMe, handleThatsMe };
}
