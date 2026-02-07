/**
 * QR Scan ViewModel
 * 
 * Handles QR code scanning with backend integration.
 * Manages unauthorized incident flow with 60-second countdown.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Vibration } from "react-native";
import { router } from "expo-router";
import { scanMachine, incidentAction, ScanResult } from "@/services/api";

type Params = {
  userId?: string;
  userName?: string;
  machineId?: string;
};

export type IncidentState = {
  incidentId: string;
  expiresAt: Date;
  nextUserId: string;
  nextUserName: string;
  secondsLeft: number;
};

export function useQRScanViewModel({ userId, userName, machineId }: Params) {
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torch, setTorch] = useState(false);
  
  // Unauthorized incident state
  const [incident, setIncident] = useState<IncidentState | null>(null);
  const [incidentLoading, setIncidentLoading] = useState(false);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  /**
   * Start countdown timer for incident
   */
  const startCountdown = useCallback((incidentData: {
    incidentId: string;
    expiresAt: string;
    nextUserId: string;
    nextUserName: string;
  }) => {
    const expiresAt = new Date(incidentData.expiresAt);
    
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));
      
      setIncident(prev => prev ? { ...prev, secondsLeft: remaining } : null);
      
      // Timeout reached - trigger buzzer
      if (remaining <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        handleTimeout(incidentData.incidentId);
      }
    };

    // Initial state
    setIncident({
      incidentId: incidentData.incidentId,
      expiresAt,
      nextUserId: incidentData.nextUserId,
      nextUserName: incidentData.nextUserName,
      secondsLeft: 60,
    });

    // Start countdown
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
  }, []);

  /**
   * Handle timeout - buzzer triggers
   */
  const handleTimeout = async (incidentId: string) => {
    if (!userId) return;
    
    try {
      await incidentAction(incidentId, userId, "timeout");
      Vibration.vibrate([0, 500, 200, 500]); // Alert pattern
      
      Alert.alert(
        "⏰ Time's Up",
        "The buzzer has been triggered. Please step away from the machine.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      console.error("Timeout error:", err);
    } finally {
      setIncident(null);
    }
  };

  /**
   * Main scan handler
   */
  const onScan = async (data: string) => {
    if (scanned || !userId || !machineId || !userName) return;

    // QR should contain just the machineId (e.g., "M001")
    const scannedMachineId = data.trim();
    
    // Validate QR matches expected machine
    if (scannedMachineId !== machineId) {
      Alert.alert(
        "Wrong Machine",
        `Expected ${machineId}, but scanned ${scannedMachineId}`
      );
      return;
    }

    setScanned(true);
    setLoading(true);

    try {
      const result = await scanMachine(machineId, userId, userName);

      switch (result.action) {
        case "unlocked":
        case "already_current":
          // Success! Navigate to machine screen
          router.replace(`../iot/${machineId}`);
          break;

        case "incident_created":
          // Unauthorized - show countdown
          if (result.incidentId && result.expiresAt && result.nextUserId) {
            startCountdown({
              incidentId: result.incidentId,
              expiresAt: result.expiresAt,
              nextUserId: result.nextUserId,
              nextUserName: result.nextUserName || "the next user",
            });
          }
          setLoading(false);
          break;

        case "not_in_queue":
          Alert.alert(
            "Not in Queue",
            "Please join the queue first before scanning.",
            [{ text: "OK", onPress: () => router.back() }]
          );
          setScanned(false);
          setLoading(false);
          break;

        default:
          Alert.alert("Error", result.message || "Unknown error");
          setScanned(false);
          setLoading(false);
      }
    } catch (err: any) {
      console.error("QR scan error:", err);
      Alert.alert(
        "Scan Failed",
        err?.message ?? "Please try again"
      );
      setScanned(false);
      setLoading(false);
    }
  };

  /**
   * Dismiss incident - user confirms they are the rightful user
   */
  const dismissIncident = async () => {
    if (!incident || !userId) return;

    setIncidentLoading(true);
    try {
      await incidentAction(incident.incidentId, userId, "dismiss");
      
      // Clear countdown
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setIncident(null);
      
      // Navigate to machine screen since this means user is authorized
      router.replace(`../iot/${machineId}`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to dismiss");
    } finally {
      setIncidentLoading(false);
    }
  };

  /**
   * Cancel and go back
   */
  const cancelIncident = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIncident(null);
    setScanned(false);
    router.back();
  };

  return {
    scanned,
    loading,
    torch,
    setTorch,
    onScan,
    // Incident handling
    incident,
    incidentLoading,
    dismissIncident,
    cancelIncident,
  };
}
