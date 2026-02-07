/**
 * Incident Handler Hook
 * 
 * Handles incoming unauthorized access incidents for the rightful user (nextUserId).
 * Shows action modal with countdown when someone tries to use their machine.
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
  expiresAt: Date;
  secondsLeft: number;
};

type UseIncidentHandlerParams = {
  userId?: string;
};

export function useIncidentHandler({ userId }: UseIncidentHandlerParams) {
  const [incident, setIncident] = useState<ActiveIncident | null>(null);
  const [loading, setLoading] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to pending incidents for this user
  useEffect(() => {
    if (!userId) return;

    const db = getFirestore();
    const q = query(
      collection(db, "incidents"),
      where("nextUserId", "==", userId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        clearIncident();
        return;
      }

      // Get the most recent pending incident
      const doc = snapshot.docs[0];
      const data = doc.data();
      const expiresAt = (data.expiresAt as Timestamp).toDate();

      // Start countdown
      startCountdown({
        id: doc.id,
        machineId: data.machineId,
        intruderName: data.intruderName,
        expiresAt,
      });
    });

    return () => {
      unsubscribe();
      clearIncident();
    };
  }, [userId]);

  /**
   * Start countdown for incident
   */
  const startCountdown = useCallback(
    (incidentData: { id: string; machineId: string; intruderName: string; expiresAt: Date }) => {
      // Clear existing countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }

      // Vibrate to alert user
      Vibration.vibrate([0, 500, 200, 500, 200, 500]);

      const updateCountdown = () => {
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((incidentData.expiresAt.getTime() - now) / 1000));

        if (remaining <= 0) {
          // Timeout - incident will be handled by backend or intruder's app
          clearIncident();
          return;
        }

        setIncident({
          ...incidentData,
          secondsLeft: remaining,
        });
      };

      updateCountdown();
      countdownRef.current = setInterval(updateCountdown, 1000);
    },
    []
  );

  /**
   * Clear incident and countdown
   */
  const clearIncident = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIncident(null);
  }, []);

  /**
   * Handle "Not Me" action - trigger buzzer
   */
  const handleNotMe = async () => {
    if (!incident || !userId) return;

    setLoading(true);
    try {
      const result = await incidentAction(incident.id, userId, "confirm_not_me");

      if (result.buzzerTriggered) {
        Alert.alert(
          "🔔 Buzzer Activated",
          "The machine alarm has been triggered."
        );
      }

      clearIncident();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to confirm");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle "That's Me" action - dismiss incident
   */
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

  return {
    incident,
    loading,
    handleNotMe,
    handleThatsMe,
  };
}
