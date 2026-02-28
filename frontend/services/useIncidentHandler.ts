/**
 * Incident Handler Hook
 *
 * FOR REGULAR USERS (machine owners):
 *   - Subscribes to `incidents` where ownerUserId === userId AND status === "pending"
 *   - Shows IncidentModal: "Is this you at Machine X?"
 *   - Plays alarm.mp3
 *
 * FOR ADMINS:
 *   - Subscribes to ALL incidents with status === "timeout" (expired without resolution)
 *   - Shows AdminIncidentModal AFTER the countdown ends (not during)
 *   - Plays urgent.mp3
 *   - Admin should NOT see the owner's IncidentModal (that's only for the machine owner)
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
  orderBy,
  limit,
} from "firebase/firestore";
import { Audio } from "expo-av";
import { incidentAction } from "@/services/api";
import { toggleBuzzerRTDB } from "@/services/machine.service";

export type ActiveIncident = {
  id: string;
  machineId: string;
  intruderName: string;
  intruderId: string;
  ownerUserId: string;
  expiresAt: Date;
  secondsLeft: number;
};

export type TimedOutIncident = {
  id: string;
  machineId: string;
  intruderName: string;
  intruderId: string;
  ownerUserId: string;
  resolvedAt?: Date;
};

type UseIncidentHandlerParams = {
  userId?: string;
  isAdmin?: boolean;
};

// ─── Sound helpers ─────────────────────────────────────────────────────────────

async function playAlarmSound(): Promise<Audio.Sound | null> {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require("@/assets/sounds/alarm.mp3"),
      { isLooping: true, volume: 1.0 }
    );
    await sound.playAsync();
    return sound;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useIncidentHandler({ userId, isAdmin }: UseIncidentHandlerParams) {
  // Owner incident (pending) — shown during the 60s window to the machine owner
  const [incident, setIncident] = useState<ActiveIncident | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin-only: timeout incidents (after 60s expires unresolved)
  const [timedOutIncident, setTimedOutIncident] = useState<TimedOutIncident | null>(null);
  const [adminDismissed, setAdminDismissed] = useState<Set<string>>(new Set());

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

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

      // Only play alarm for the machine OWNER (not admins — they get a different notification)
      playAlarmSound().then((s) => {
        soundRef.current = s;
      });
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);

      const tick = () => {
        const remaining = Math.max(0, Math.floor((doc.expiresAt.getTime() - Date.now()) / 1000));
        if (remaining <= 0) {
          clearIncident();
          return;
        }
        setIncident({ ...doc, secondsLeft: remaining });
      };

      tick();
      countdownRef.current = setInterval(tick, 1000);
    },
    [clearIncident]
  );

  // ── Owner subscription: PENDING incidents where they are ownerUserId ────────
  useEffect(() => {
    // Admins don't get the owner IncidentModal — they have their own flow
    if (!userId || isAdmin) return;

    const db = getFirestore();
    const q = query(
      collection(db, "incidents"),
      where("ownerUserId", "==", userId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        clearIncident();
        return;
      }

      const docSnap = snapshot.docs[0];
      const data = docSnap.data();

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
        intruderName: data.intruderName ?? "Unknown",
        intruderId: data.intruderId ?? "",
        ownerUserId: data.ownerUserId ?? data.nextUserId ?? "",
        expiresAt,
      });
    });

    return () => {
      unsubscribe();
      clearIncident();
    };
  }, [userId, isAdmin, startCountdown, clearIncident]);

  // ── Admin subscription: TIMEOUT incidents (after 60s expires) ──────────────
  useEffect(() => {
    if (!isAdmin || !userId) return;

    const db = getFirestore();
    // Watch for incidents that timed out recently (last 5 min)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const q = query(
      collection(db, "incidents"),
      where("status", "==", "timeout"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setTimedOutIncident(null);
        return;
      }

      // Find the most recent timeout we haven't dismissed
      for (const docSnap of snapshot.docs) {
        if (adminDismissed.has(docSnap.id)) continue;

        const data = docSnap.data();
        // Only show if it expired recently (< 10 min ago)
        const createdAt = typeof data.createdAt === "string"
          ? new Date(data.createdAt)
          : data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date(0);

        if (Date.now() - createdAt.getTime() > 10 * 60 * 1000) continue;

        setTimedOutIncident({
          id: docSnap.id,
          machineId: data.machineId,
          intruderName: data.intruderName ?? "Unknown",
          intruderId: data.intruderId ?? "",
          ownerUserId: data.ownerUserId ?? "",
          resolvedAt: typeof data.expiresAt === "string" ? new Date(data.expiresAt) : undefined,
        });
        return;
      }
      setTimedOutIncident(null);
    });

    return () => unsubscribe();
  }, [userId, isAdmin, adminDismissed]);

  // ── Owner actions ──────────────────────────────────────────────────────────

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

  // ── Admin actions ──────────────────────────────────────────────────────────

  const handleAdminStopBuzzer = async () => {
    if (!timedOutIncident) return;
    setLoading(true);
    try {
      await toggleBuzzerRTDB(timedOutIncident.machineId, false);
      Alert.alert("✅ Buzzer Stopped", `Machine ${timedOutIncident.machineId} buzzer deactivated.`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to stop buzzer");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminDismiss = () => {
    if (!timedOutIncident) return;
    setAdminDismissed((prev) => new Set([...prev, timedOutIncident.id]));
    setTimedOutIncident(null);
  };

  return {
    // Owner
    incident,
    loading,
    handleNotMe,
    handleThatsMe,
    // Admin
    timedOutIncident,
    handleAdminStopBuzzer,
    handleAdminDismiss,
  };
}
