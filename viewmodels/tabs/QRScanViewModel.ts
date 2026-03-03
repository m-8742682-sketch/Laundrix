/**
 * QR Scan ViewModel — FIXED VERSION
 *
 * FIX #5: No scan flicker — once an incident is active, do NOT reset `scanned`
 *         so the camera stops scanning.  Only reset on explicit cancel/dismiss.
 *         Deduplication: if same incidentId arrives again, just update secondsLeft.
 * FIX #6: Pass ownerUserName to the modal (could be currentUser or nextUser)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import { Audio } from "expo-av";
import { router } from "expo-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { graceAlarmService } from "@/services/graceAlarmService";
import {
  validateAndScan,
  processScanResult,
  startIncidentCountdown,
  handleIncidentAction,
  parseMachineIdFromQR,
} from "@/services/qrscan.service";
import { claimGrace } from "@/services/api";

// Removed duplicate recordUnauthorizedUsage

type Params = {
  userId?: string;
  userName?: string;
  machineId?: string;
};

export type IncidentState = {
  incidentId: string;
  expiresAt: Date;
  ownerUserId: string;
  ownerUserName: string;   // unified field (was nextUserName)
  secondsLeft: number;
  machineId?: string;
};


/**
 * FIX #5: Record unauthorized access to Firestore usageHistory
 */
async function recordUnauthorizedAccess(
  userId: string,
  userName: string,
  machineId: string,
  incidentId: string
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await addDoc(collection(db, "usageHistory"), {
      userId,
      userName,
      machineId,
      startTime: now,
      endTime: now,
      duration: 0,
      resultStatus: "Unauthorized",
      incidentId,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[QRScanVM] Failed to record unauthorized:", err);
  }
}

export function useQRScanViewModel({ userId, userName, machineId }: Params) {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);

  const [incident, setIncident] = useState<IncidentState | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);
  // Pending incident data awaiting user confirmation
  const pendingIncidentRef = useRef<{
    incidentId: string; expiresAt: string; ownerUserId: string;
    ownerUserName: string; machineId: string;
  } | null>(null);

  const countdownCleanupRef = useRef<(() => void) | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeIncidentIdRef = useRef<string | null>(null);
  const lastScannedMachineIdRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      countdownCleanupRef.current?.();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const playUrgent = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync(require("@/assets/sounds/urgent.mp3"), { isLooping: true, volume: 1.0 }); // FIX #6: loop until dismissed
      soundRef.current = sound;
      await sound.playAsync();
    } catch { /* silent */ }
  }, []);

  const stopSound = useCallback(async () => {
    if (!soundRef.current) return;
    try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
    soundRef.current = null;
  }, []);

  const handleTimeout = useCallback(async (incidentId: string) => {
    if (!userId) return;
    try {
      await handleIncidentAction(incidentId, userId, "timeout");
      // FIX #5: record unauthorized access (use machineId ref to avoid stale closure)
      recordUnauthorizedAccess(userId, userName ?? "Unknown", lastScannedMachineIdRef.current || incidentId.split("_")[0], incidentId);
      Vibration.vibrate([0, 500, 200, 500]);
      Alert.alert("⏰ Time's Up", "The buzzer has been triggered. Please step away from the machine.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err) {
      console.error("Timeout error:", err);
    } finally {
      setIncident(null);
      activeIncidentIdRef.current = null;
      setScanned(false);  // allow re-scan after timeout
      stopSound();
    }
  }, [userId, userName, stopSound]);

  const startCountdown = useCallback((incidentData: {
    incidentId: string;
    expiresAt: string;
    ownerUserId: string;
    ownerUserName: string;
    machineId?: string;
  }) => {
    // Deduplicate — if same incident already running, just update the UI
    if (activeIncidentIdRef.current === incidentData.incidentId) return;

    // Stop any previous countdown
    countdownCleanupRef.current?.();
    activeIncidentIdRef.current = incidentData.incidentId;

    const expiresAt = new Date(incidentData.expiresAt);

    const cleanup = startIncidentCountdown(
      incidentData.incidentId,
      expiresAt,
      (secondsLeft) => {
        setIncident(prev =>
          prev?.incidentId === incidentData.incidentId
            ? { ...prev, secondsLeft }
            : prev
        );
      },
      () => handleTimeout(incidentData.incidentId)
    );
    countdownCleanupRef.current = cleanup;

    const initialSecondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    setIncident({
      incidentId: incidentData.incidentId,
      expiresAt,
      ownerUserId: incidentData.ownerUserId,
      ownerUserName: incidentData.ownerUserName,
      secondsLeft: initialSecondsLeft,
      machineId: incidentData.machineId || incidentData.incidentId.split("_")[0],
    });
    // Sound + vibration are started by the caller after user confirms
  }, [handleTimeout]);

  const onScan = useCallback(async (data: string) => {
    // FIX #5: blocked while scanned=true (incident active or loading)
    // FIX #2: machineId from params is optional — the real machineId is parsed from QR data
    if (scanned || !userId || !userName) return;

    setScanned(true);
    setLoading(true);

    try {
      const response = await validateAndScan(data, userId, userName);
      const { state, message } = processScanResult(response);
      // FIX #2: use machineId from QR data for navigation (works even without params)
      const scannedMachineId = parseMachineIdFromQR(data) || machineId;
      lastScannedMachineIdRef.current = scannedMachineId || null;

      switch (state) {
        case "authorized":
        case "already_current":
        case "queue_empty_claim":
          // FIX: stop local grace alarm immediately
          graceAlarmService.clear().catch(() => {});
          // FIX: explicitly tell backend to clear the grace period from RTDB.
          // This ensures admin panel, queue screen, and dashboard all see the dismissal.
          // (scan.ts already removes it for CASE 2, but this covers edge cases)
          if (scannedMachineId && userId) {
            claimGrace(scannedMachineId, userId).catch(() => {});
          }
          router.replace(`../iot/${scannedMachineId}`);
          // Don't reset scanned — we're navigating away
          break;

        case "unauthorized":
          if (response.data?.incidentId) {
            const expiresAtStr = response.data.expiresAt
              ?? (response.data.expiresIn ? new Date(Date.now() + response.data.expiresIn * 1000).toISOString() : new Date(Date.now() + 60000).toISOString());
            const ownerUserName = response.data.ownerUserName || (response.data as any).nextUserName || "the rightful user";
            const ownerUserId = response.data.nextUserId || "";

            // Store pending incident — wait for user confirmation before showing modal
            pendingIncidentRef.current = {
              incidentId: response.data.incidentId,
              expiresAt: expiresAtStr,
              ownerUserId,
              ownerUserName,
              machineId: scannedMachineId || machineId || "",
            };

            setLoading(false);

            // Show pre-confirmation alert BEFORE triggering unauthorized modal
            Alert.alert(
              "⚠️ Machine In Use",
              `This machine is currently used by ${ownerUserName}. Proceeding will be logged as unauthorized access and the owner + admin will be notified immediately.\n\nAre you sure you want to proceed?`,
              [
                {
                  text: "No, Go Back",
                  style: "cancel",
                  onPress: () => {
                    // Cancel the incident on backend (fire-and-forget)
                    if (pendingIncidentRef.current && userId) {
                      handleIncidentAction(pendingIncidentRef.current.incidentId, userId, "dismiss")
                        .catch(() => {});
                    }
                    pendingIncidentRef.current = null;
                    setScanned(false);
                    router.back();
                  },
                },
                {
                  text: "Yes, I Understand",
                  style: "destructive",
                  onPress: () => {
                    const pending = pendingIncidentRef.current;
                    if (!pending) return;
                    pendingIncidentRef.current = null;
                    // Record unauthorized access
                    recordUnauthorizedAccess(
                      userId!, userName ?? "Unknown",
                      pending.machineId, pending.incidentId
                    );
                    // Now show the unauthorized modal with countdown
                    startCountdown(pending);
                    playUrgent();
                    Vibration.vibrate([0, 300, 150, 300, 150, 300]);
                  },
                },
              ]
            );
          } else {
            Alert.alert("⛔ Access Denied", message || "You are not authorized to use this machine.");
            setScanned(false);
            setLoading(false);
          }
          break;

        case "machine_not_found":
          Alert.alert("Machine Not Found", "This machine does not exist.", [{ text: "OK", onPress: () => router.back() }]);
          setScanned(false);
          setLoading(false);
          break;

        case "user_not_found":
          Alert.alert("User Error", "Please log in again.", [{ text: "OK", onPress: () => router.back() }]);
          setScanned(false);
          setLoading(false);
          break;

        default:
          Alert.alert("Error", message);
          setScanned(false);
          setLoading(false);
      }
    } catch (err: any) {
      console.error("QR scan error:", err);
      Alert.alert("Scan Failed", err?.message ?? "Please try again");
      setScanned(false);
      setLoading(false);
    }
  }, [scanned, userId, machineId, userName, startCountdown]);

  const dismissIncident = useCallback(async () => {
    if (!incident || !userId) return;
    setIncidentLoading(true);
    try {
      await handleIncidentAction(incident.incidentId, userId, "dismiss");
      countdownCleanupRef.current?.();
      countdownCleanupRef.current = null;
      activeIncidentIdRef.current = null;
      setIncident(null);
      stopSound();
      router.replace(`../iot/${lastScannedMachineIdRef.current || machineId}`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to dismiss");
    } finally {
      setIncidentLoading(false);
    }
  }, [incident, userId, machineId, stopSound]);

  const cancelIncident = useCallback(async (reason?: string) => {
    // Stop countdown and sound immediately (optimistic UI)
    countdownCleanupRef.current?.();
    countdownCleanupRef.current = null;
    const currentIncident = incident; // capture before clearing
    activeIncidentIdRef.current = null;
    setIncident(null);
    stopSound();
    setScanned(false); // allow re-scan after cancel

    // Submit reason to backend (fire-and-forget — don't block navigation)
    if (currentIncident && userId) {
      handleIncidentAction(currentIncident.incidentId, userId, "dismiss", reason)
        .catch((err) => console.warn("[QRScanVM] cancelIncident API call failed:", err));
    }

    router.back();
  }, [incident, userId, stopSound]);

  return {
    scanned,
    loading,
    torch,
    setTorch,
    onScan,
    incident,
    incidentLoading,
    dismissIncident,
    cancelIncident,
    playUrgent,
  };
}