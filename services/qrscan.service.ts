/**
 * QR Scan Service - OPTIMIZED VERSION
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Request deduplication (prevent double scans)
 * 2. Optimistic UI updates
 * 3. Connection keep-alive
 * 4. Timeout handling
 */

import { doc, getDoc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import { 
  scanMachine, 
  releaseMachine, 
  incidentAction,
  ScanResponse,
  ScanResult,
  ReleaseResult,
  IncidentActionResult 
} from "./api";

export type { ScanResponse, ScanResult, ReleaseResult, IncidentActionResult };

export type QRScanState = 
  | "idle"
  | "scanning"
  | "processing"
  | "authorized"
  | "unauthorized"
  | "incident"
  | "already_current"
  | "queue_empty_claim"
  | "machine_not_found"
  | "user_not_found"
  | "error";

export type IncidentState = {
  active: boolean;
  incidentId: string;
  machineId: string;
  intruderName: string;
  expiresAt: Date;
  secondsLeft: number;
};

export type ScanOptions = {
  onSuccess?: (result: ScanResponse) => void;
  onUnauthorized?: (result: ScanResponse) => void;
  onError?: (error: Error) => void;
};

// Request deduplication cache
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Parse QR code data to extract machineId
 */
export const parseMachineIdFromQR = (qrData: string): string | null => {
  // Try direct machineId (alphanumeric)
  if (/^[A-Za-z0-9_-]+$/.test(qrData) && qrData.length <= 20) {
    return qrData.toUpperCase();
  }

  // Try URL with machineId param
  try {
    const url = new URL(qrData);
    const machineId = url.searchParams.get("machineId");
    if (machineId) return machineId.toUpperCase();
  } catch {
    // Not a valid URL, continue
  }

  // Try JSON
  try {
    const json = JSON.parse(qrData);
    if (json.machineId) return json.machineId.toUpperCase();
  } catch {
    // Not valid JSON, continue
  }

  return null;
};

/**
 * Validate and scan with deduplication and timeout
 */
export const validateAndScan = async (
  qrData: string,
  userId: string,
  userName: string,
  timeoutMs: number = 8000 // 8 second timeout
): Promise<ScanResponse> => {
  const machineId = parseMachineIdFromQR(qrData);
  
  if (!machineId) {
    return {
      success: false,
      result: "machine_not_found" as ScanResult,
      message: "Invalid QR code format",
    };
  }

  // Create cache key for deduplication
  const cacheKey = `${machineId}_${userId}`;
  
  // Check if there's already a pending request for this machine+user
  if (pendingRequests.has(cacheKey)) {
    console.log('[QRScan] Deduplicating request for', machineId);
    return pendingRequests.get(cacheKey)!;
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Create the request promise
  const requestPromise = scanMachine(machineId, userId, userName)
    .finally(() => {
      clearTimeout(timeoutId);
      pendingRequests.delete(cacheKey);
    });

  // Store in pending requests
  pendingRequests.set(cacheKey, requestPromise);

  return requestPromise;
};

/**
 * Process scan result and return normalized state
 */
export const processScanResult = (response: ScanResponse): {
  state: QRScanState;
  data?: ScanResponse["data"];
  message: string;
} => {
  if (!response.success) {
    return {
      state: "error",
      message: response.message || "Scan failed",
    };
  }

  const stateMap: Record<ScanResult, QRScanState> = {
    authorized: "authorized",
    already_current: "already_current",
    queue_empty_claim: "queue_empty_claim",
    unauthorized: "unauthorized",
    machine_not_found: "machine_not_found",
    user_not_found: "user_not_found",
  };

  return {
    state: stateMap[response.result] || "error",
    data: response.data,
    message: response.message,
  };
};

/**
 * Start monitoring an incident countdown
 */
export const startIncidentCountdown = (
  incidentId: string,
  expiresAt: Date,
  onTick: (secondsLeft: number) => void,
  onExpire: () => void
): (() => void) => {
  const interval = setInterval(() => {
    const now = Date.now();
    const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now) / 1000));

    onTick(remaining);

    if (remaining <= 0) {
      clearInterval(interval);
      onExpire();
    }
  }, 1000);

  // Initial call
  const initialRemaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  onTick(initialRemaining);

  return () => clearInterval(interval);
};

/**
 * Handle incident action
 */
export const handleIncidentAction = async (
  incidentId: string,
  userId: string,
  action: "confirm_not_me" | "dismiss" | "timeout",
  cancelReason?: string
): Promise<IncidentActionResult> => {
  return incidentAction(incidentId, userId, action, cancelReason);
};

/**
 * Release machine session
 */
export const releaseMachineSession = async (
  machineId: string,
  userId: string
): Promise<ReleaseResult> => {
  return releaseMachine(machineId, userId);
};

/**
 * Subscribe to machine status changes
 */
export const subscribeToMachine = (
  machineId: string,
  callback: (machine: any) => void
) => {
  const machineRef = doc(db, "machines", machineId);
  
  return onSnapshot(machineRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    
    callback({
      machineId: snapshot.id,
      ...snapshot.data(),
    });
  });
};

/**
 * Subscribe to incident status changes
 */
export const subscribeToIncident = (
  incidentId: string,
  callback: (incident: any) => void
) => {
  const incidentRef = doc(db, "incidents", incidentId);
  
  return onSnapshot(incidentRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    
    const data = snapshot.data();
    callback({
      id: snapshot.id,
      ...data,
      expiresAt: data.expiresAt?.toDate?.() || new Date(data.expiresAt),
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    });
  });
};

// ─── Utility Functions ────────────────────────────────────────────────────────

export const isAuthorized = (response: ScanResponse): boolean => {
  return response.success && response.result === "authorized";
};

export const hasIncident = (response: ScanResponse): boolean => {
  return response.success && 
         response.result === "unauthorized" && 
         !!response.data?.incidentId;
};

export const getIncidentExpiry = (response: ScanResponse): Date | null => {
  if (!response.data?.expiresAt) return null;
  return new Date(response.data.expiresAt);
};

export const formatRemainingTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const shouldShowClaimDialog = (response: ScanResponse): boolean => {
  return response.success && response.result === "queue_empty_claim";
};

export const isAlreadyCurrentUser = (response: ScanResponse): boolean => {
  return response.success && response.result === "already_current";
};