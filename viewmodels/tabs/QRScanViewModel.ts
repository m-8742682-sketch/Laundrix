import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
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

type Params = {
  userId?: string;
  userName?: string;
  machineId?: string;
};

export type IncidentState = {
  incidentId: string;
  expiresAt: Date;
  ownerUserId: string;
  ownerUserName: string;
  secondsLeft: number;
  machineId?: string;
};

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
  
  const pendingIncidentRef = useRef<{
    incidentId: string; expiresAt: string; ownerUserId: string;
    ownerUserName: string; machineId: string;
  } | null>(null);

  const countdownCleanupRef = useRef<(() => void) | null>(null);
  const soundRef = useRef<AudioPlayer | null>(null);
  const activeIncidentIdRef = useRef<string | null>(null);
  const lastScannedMachineIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      countdownCleanupRef.current?.();
      try { soundRef.current?.pause(); soundRef.current?.remove(); } catch {}
    };
  }, []);

  const playUrgent = useCallback(async () => {
    try {
      // 🚀 核心修复点 1：移除 IOS 后缀，使用通用属性名
      await setAudioModeAsync({ 
        playsInSilentMode: true, 
      });
      const player = createAudioPlayer(require("@/assets/sounds/urgent.mp3"));
      player.loop = true;
      player.volume = 1.0;
      player.play();
      soundRef.current = player;
    } catch { /* silent */ }
  }, []);

  const stopSound = useCallback(async () => {
    if (!soundRef.current) return;
    try { soundRef.current.pause(); soundRef.current.remove(); } catch {}
    soundRef.current = null;
  }, []);

  const handleTimeout = useCallback(async (incidentId: string) => {
    if (!userId) return;
    try {
      await handleIncidentAction(incidentId, userId, "timeout");
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
      setScanned(false);
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
    if (activeIncidentIdRef.current === incidentData.incidentId) return;

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
  }, [handleTimeout]);

  const onScan = useCallback(async (data: string) => {
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
          graceAlarmService.clear().catch(() => {});
          if (scannedMachineId && userId) {
            claimGrace(scannedMachineId, userId).catch(() => {});
          }
          router.replace(`../iot/${scannedMachineId}`);
          break;

        case "unauthorized":
          if (response.data?.incidentId) {
            const expiresAtStr = response.data.expiresAt
              ?? (response.data.expiresIn ? new Date(Date.now() + response.data.expiresIn * 1000).toISOString() : new Date(Date.now() + 60000).toISOString());
            const ownerUserName = response.data.ownerUserName || (response.data as any).nextUserName || "the rightful user";
            const ownerUserId = response.data.nextUserId || "";

            pendingIncidentRef.current = {
              incidentId: response.data.incidentId,
              expiresAt: expiresAtStr,
              ownerUserId,
              ownerUserName,
              machineId: scannedMachineId || machineId || "",
            };

            setLoading(false);

            Alert.alert(
              "⚠️ Machine In Use",
              `This machine is currently used by ${ownerUserName}. Proceeding will be logged as unauthorized access and the owner + admin will be notified immediately.\n\nAre you sure you want to proceed?`,
              [
                {
                  text: "No, Go Back",
                  style: "cancel",
                  onPress: () => {
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
                  onPress: async () => {
                    const pending = pendingIncidentRef.current;
                    if (!pending) return;
                    pendingIncidentRef.current = null;
                    recordUnauthorizedAccess(
                      userId!, userName ?? "Unknown",
                      pending.machineId, pending.incidentId
                    );
                    // Confirm incident → activates modals for owner/admin/intruder
                    try {
                      await handleIncidentAction(pending.incidentId, userId!, "confirm");
                    } catch (err) {
                      console.warn("[QRScanVM] confirm incident failed:", err);
                    }
                    // Navigate back — GlobalIncidentModal will show the intruder modal
                    Vibration.vibrate([0, 300, 150, 300, 150, 300]);
                    router.back();
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
    countdownCleanupRef.current?.();
    countdownCleanupRef.current = null;
    const currentIncident = incident;
    activeIncidentIdRef.current = null;
    setIncident(null);
    stopSound();
    setScanned(false);

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