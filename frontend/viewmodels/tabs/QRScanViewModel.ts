/**
 * QR Scan ViewModel
 *
 * Unauthorized access flow (two steps):
 *   Step 1 — PRE-WARNING (no sound):
 *     "Machine is currently in use. Do you want to proceed?"
 *     [Leave Now]  [I understand, proceed]
 *
 *   Step 2 — INCIDENT COUNTDOWN (play urgent.mp3):
 *     "Unauthorized access detected. Actions will be taken in Xs."
 *     60-second countdown with no extra buttons (just a message)
 *
 * Scan is LOCKED (scanned=true) from first scan until:
 *   - User taps "Leave Now" in pre-warning → reset, go back
 *   - Countdown times out → reset, go back
 *   - Authorized scan → navigate to machine page (no reset needed)
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

// ─── Record unauthorized access to usageHistory ─────────────────────────────

async function recordUnauthorizedAccess(
  userId: string,
  machineId: string,
  incidentId: string
): Promise<void> {
  try {
    await addDoc(collection(db, "usageHistory"), {
      userId,
      userName: "Unknown",
      machineId,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      resultStatus: "Unauthorized",
      incidentId,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[QRScanVM] Failed to record unauthorized:", err);
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Params = {
  userId?: string;
  userName?: string;
  machineId?: string;
};

// Pre-warning: "machine in use, do you want to proceed?"
export type PreWarningState = {
  ownerUserName: string;
  machineId: string;
  incidentId: string;
  expiresAt: string;
  ownerUserId: string;
};

// Incident countdown: unauthorized confirmed, 60s running
export type IncidentState = {
  incidentId: string;
  expiresAt: Date;
  ownerUserId: string;
  ownerUserName: string;
  secondsLeft: number;
  machineId?: string;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQRScanViewModel({ userId, userName, machineId }: Params) {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);

  // Step 1: pre-warning
  const [preWarning, setPreWarning] = useState<PreWarningState | null>(null);

  // Step 2: incident countdown
  const [incident, setIncident] = useState<IncidentState | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);

  const countdownCleanupRef = useRef<(() => void) | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeIncidentIdRef = useRef<string | null>(null);
  const lastScannedMachineIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      countdownCleanupRef.current?.();
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  // Play urgent.mp3 — only for unauthorized scan, AFTER user confirms intent
  const playUrgent = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/urgent.mp3"),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch { /* ignore */ }
  }, []);

  const stopSound = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    } catch {}
    soundRef.current = null;
  }, []);

  // ── Start the actual incident countdown (step 2) ────────────────────────

  const startCountdown = useCallback(
    (incidentData: {
      incidentId: string;
      expiresAt: string;
      ownerUserId: string;
      ownerUserName: string;
      machineId?: string;
    }) => {
      if (activeIncidentIdRef.current === incidentData.incidentId) return;

      countdownCleanupRef.current?.();
      activeIncidentIdRef.current = incidentData.incidentId;

      const expiresAt = new Date(incidentData.expiresAt);
      const initialSecondsLeft = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

      const handleTimeout = async () => {
        if (!userId) return;
        try {
          await handleIncidentAction(incidentData.incidentId, userId, "timeout");
          recordUnauthorizedAccess(
            userId,
            incidentData.machineId || "",
            incidentData.incidentId
          );
          Vibration.vibrate([0, 500, 200, 500]);
          Alert.alert(
            "⏰ Time's Up",
            "The buzzer has been triggered. Please step away from the machine.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        } catch {}
        setIncident(null);
        activeIncidentIdRef.current = null;
        setScanned(false);
        stopSound();
      };

      const cleanup = startIncidentCountdown(
        incidentData.incidentId,
        expiresAt,
        (secondsLeft) => {
          setIncident((prev) =>
            prev?.incidentId === incidentData.incidentId
              ? { ...prev, secondsLeft }
              : prev
          );
        },
        handleTimeout
      );

      countdownCleanupRef.current = cleanup;

      setIncident({
        incidentId: incidentData.incidentId,
        expiresAt,
        ownerUserId: incidentData.ownerUserId,
        ownerUserName: incidentData.ownerUserName,
        secondsLeft: initialSecondsLeft,
        machineId: incidentData.machineId,
      });

      // Play urgent.mp3 — intruder side only
      playUrgent();
      Vibration.vibrate([0, 300, 150, 300, 150, 300]);
    },
    [userId, stopSound, playUrgent]
  );

  // ── Main scan handler ────────────────────────────────────────────────────

  const onScan = useCallback(
    async (data: string) => {
      // Lock scan immediately — prevent double-scan
      if (scanned || !userId || !userName) return;
      setScanned(true);
      setLoading(true);

      try {
        const response = await validateAndScan(data, userId, userName);
        const { state, message } = processScanResult(response);
        const scannedMachineId = parseMachineIdFromQR(data) || machineId;
        lastScannedMachineIdRef.current = scannedMachineId || null;

        switch (state) {
          case "authorized":
          case "already_current":
          case "queue_empty_claim":
            // Clear grace alarm — user successfully started their session
            graceAlarmService.clear().catch(() => {});
            router.replace(`../iot/${scannedMachineId}`);
            // Don't reset scanned — we're navigating away
            break;

          case "unauthorized":
            if (response.data?.incidentId) {
              const expiresAtStr =
                response.data.expiresAt ??
                new Date(Date.now() + 60000).toISOString();
              const ownerUserName =
                response.data.ownerUserName ||
                (response.data as any).nextUserName ||
                "the machine owner";
              const ownerUserId = response.data.nextUserId ?? response.data.currentUserId ?? "";

              // Step 1: show pre-warning (no sound, no countdown yet)
              setPreWarning({
                ownerUserName,
                machineId: scannedMachineId || machineId || "",
                incidentId: response.data.incidentId,
                expiresAt: expiresAtStr,
                ownerUserId,
              });
            } else {
              // No incident created (edge case)
              Alert.alert(
                "⛔ Access Denied",
                message || "You are not authorized to use this machine.",
                [{ text: "OK", onPress: () => setScanned(false) }]
              );
            }
            setLoading(false);
            break;

          case "machine_not_found":
            Alert.alert("Machine Not Found", "This machine does not exist.", [
              { text: "OK", onPress: () => { setScanned(false); router.back(); } },
            ]);
            setLoading(false);
            break;

          case "user_not_found":
            Alert.alert("Session Error", "Please log in again.", [
              { text: "OK", onPress: () => { setScanned(false); router.back(); } },
            ]);
            setLoading(false);
            break;

          default:
            Alert.alert("Error", message, [
              { text: "OK", onPress: () => setScanned(false) },
            ]);
            setLoading(false);
        }
      } catch (err: any) {
        console.error("QR scan error:", err);
        Alert.alert("Scan Failed", err?.message ?? "Please try again", [
          { text: "OK", onPress: () => setScanned(false) },
        ]);
        setLoading(false);
      }
    },
    [scanned, userId, userName, machineId, startCountdown]
  );

  // ── Pre-warning actions ───────────────────────────────────────────────────

  // "Leave Now" — cancel the incident intent, go back
  const onPreWarningLeave = useCallback(() => {
    setPreWarning(null);
    setScanned(false); // allow re-scan if they change their mind
    router.back();
  }, []);

  // "I understand, proceed" — start the actual 60s countdown
  const onPreWarningProceed = useCallback(() => {
    if (!preWarning || !userId) return;

    // Record unauthorized access now that user confirmed intent
    recordUnauthorizedAccess(userId, preWarning.machineId, preWarning.incidentId);

    // Transition to step 2: incident countdown
    setPreWarning(null);
    startCountdown({
      incidentId: preWarning.incidentId,
      expiresAt: preWarning.expiresAt,
      ownerUserId: preWarning.ownerUserId,
      ownerUserName: preWarning.ownerUserName,
      machineId: preWarning.machineId,
    });
  }, [preWarning, userId, startCountdown]);

  // ── Incident actions (step 2 — countdown running) ─────────────────────────

  // Cancel during countdown — stop and go back
  const cancelIncident = useCallback(() => {
    countdownCleanupRef.current?.();
    countdownCleanupRef.current = null;
    activeIncidentIdRef.current = null;
    setIncident(null);
    stopSound();
    setScanned(false);
    router.back();
  }, [stopSound]);

  return {
    scanned,
    loading,
    torch,
    setTorch,
    onScan,
    // Step 1: pre-warning
    preWarning,
    onPreWarningLeave,
    onPreWarningProceed,
    // Step 2: incident countdown
    incident,
    incidentLoading,
    cancelIncident,
  };
}
