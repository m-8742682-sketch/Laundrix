/**
 * Vercel Backend API Service
 *
 * PERFORMANCE OPTIMIZATIONS vs original:
 * 1. AbortController timeout (5 s) — was 8 s by default
 * 2. Connection: keep-alive header — reuses TCP connection
 * 3. warmupBackend() — call at app launch to pre-warm the cold Vercel function
 * 4. Better error messages for slow networks
 */

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL || "https://laundrix-backend.vercel.app";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScanResult =
  | "authorized"
  | "already_current"
  | "queue_empty_claim"
  | "unauthorized"
  | "machine_not_found"
  | "user_not_found";

export interface ScanResponse {
  success: boolean;
  result: ScanResult;
  message: string;
  data?: {
    unlocked?: boolean;
    incidentId?: string;
    expiresAt?: string;
    expiresIn?: number;
    position?: number;
    queueToken?: string;
    // FIX: Separate owner (current user) from next user (queue)
    ownerUserId?: string;      // Current machine user (for "in use" case)
    ownerUserName?: string;    // Current machine user's name
    nextUserId?: string;       // Next in queue (for grace period case)
    nextUserName?: string;     // Next user's name
    machineId?: string;
  };
  error?: string;
}

export interface ReleaseResult {
  success: boolean;
  message: string;
  data?: {
    released?: boolean;
    nextUserId?: string | null;
    nextUserName?: string | null;
    gracePeriodMinutes?: number;
    status?: string;
  };
}

export interface IncidentActionResult {
  success: boolean;
  message: string;
  data?: { status?: string; buzzerTriggered?: boolean };
}

export interface GraceTimeoutResult {
  success: boolean;
  message: string;
  data?: {
    warningSent?: boolean;
    minutesRemaining?: number;
    nextUserId?: string | null;
    nextUserName?: string | null;
    cleared?: boolean;
  };
}

export interface ClaimGraceResult {
  success: boolean;
  message: string;
  data?: { cleared: boolean };
}

export interface DismissAlarmResult {
  success: boolean;
  message: string;
  data?: { dismissed: boolean };
}

export interface QueueResult {
  success: boolean;
  message: string;
  data?: { position: number; queueToken: string; joinedAt: string };
}

export interface LeaveQueueResult {
  success: boolean;
  message: string;
}

export interface NotifyCallResult {
  success: boolean;
  message: string;
  data?: { sent: boolean; stored: boolean };
}

export interface NotifyChatResult {
  success: boolean;
  message: string;
  data?: { sent: boolean; notificationId: string };
}

export interface AdminUserDeletedResult {
  success: boolean;
  message: string;
}

export interface AdminCleanupResult {
  success: boolean;
  message: string;
  data?: {
    totalRemoved: number;
    queuesAffected: number;
    details: Array<{ queueId: string; removedUsers: string[] }>;
  };
}

export interface HealthCheckResult {
  status: string;
  timestamp: string;
}

// ─── Shared headers — keep-alive reuses TCP socket on same device ─────────────

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Connection: "keep-alive",
};

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiCall<T>(
  endpoint: string,
  body: Record<string, any>,
  timeoutMs = 6000
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: BASE_HEADERS,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);
    const text = await response.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(`Non-JSON from ${endpoint}:`, text.substring(0, 200));
      throw new Error("Server error: Unable to reach API.");
    }

    if (!response.ok) {
      if (endpoint === "/api/scan" && data && typeof data === "object") {
        return data as T;
      }
      throw new Error(data.error || `API error ${response.status}`);
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error("Request timed out. Check your connection and try again.");
    }
    if (err.message === "Network request failed") {
      throw new Error("No internet connection. Please check your network.");
    }
    throw err;
  }
}

// ─── Warm-up: call once at app launch to eliminate cold-start penalty ─────────

let warmupDone = false;

export async function warmupBackend(): Promise<void> {
  if (warmupDone) return;
  warmupDone = true;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(`${BACKEND_URL}/api/warmup`, {
      method: "GET",
      headers: BASE_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timer);
    console.log("[API] Backend warmed up ✓");
  } catch {
    console.warn("[API] Warmup skipped (non-critical)");
  }
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export async function joinQueue(
  machineId: string,
  userId: string,
  userName: string,
  idempotencyKey?: string
): Promise<QueueResult> {
  return apiCall<QueueResult>("/api/queue", {
    action: "join",
    machineId,
    userId,
    userName,
    idempotencyKey,
  });
}

export async function leaveQueue(
  machineId: string,
  userId: string
): Promise<LeaveQueueResult> {
  return apiCall<LeaveQueueResult>("/api/queue", {
    action: "leave",
    machineId,
    userId,
  });
}

// ─── Machine scan & release ───────────────────────────────────────────────────

export async function scanMachine(
  machineId: string,
  userId: string,
  userName: string
): Promise<ScanResponse> {
  return apiCall<ScanResponse>("/api/scan", { machineId, userId, userName }, 6000);
}

export async function releaseMachine(
  machineId: string,
  userId: string
): Promise<ReleaseResult> {
  return apiCall<ReleaseResult>("/api/release", { machineId, userId });
}

// ─── Incident ─────────────────────────────────────────────────────────────────

export async function incidentAction(
  incidentId: string,
  userId: string,
  action: "confirm_not_me" | "dismiss" | "timeout"
): Promise<IncidentActionResult> {
  return apiCall<IncidentActionResult>("/api/incident-action", {
    incidentId, userId, action,
  });
}

// ─── Grace period ─────────────────────────────────────────────────────────────

export async function graceTimeout(
  machineId: string,
  userId: string,
  type: "warning" | "expired"
): Promise<GraceTimeoutResult> {
  return apiCall<GraceTimeoutResult>("/api/grace-timeout", {
    machineId, userId, timeoutType: type,
  });
}

export async function claimGrace(
  machineId: string,
  userId: string
): Promise<ClaimGraceResult> {
  return apiCall<ClaimGraceResult>("/api/claim-grace", { machineId, userId });
}

// ─── Alarm ───────────────────────────────────────────────────────────────────

export async function dismissAlarm(
  machineId: string,
  userId: string
): Promise<DismissAlarmResult> {
  return apiCall<DismissAlarmResult>("/api/dismiss-alarm", { machineId, userId });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function notifyChat(
  machineId: string,
  senderId: string,
  senderName: string,
  message: string,
  recipientIds: string[]
): Promise<NotifyChatResult> {
  return apiCall<NotifyChatResult>("/api/notify-chat", {
    machineId, senderId, senderName, message, recipientIds,
  });
}

export async function notifyIncomingCall(
  callId: string,
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean = false
): Promise<NotifyCallResult> {
  return apiCall<NotifyCallResult>("/api/notify-call", {
    callId, callerId, callerName, recipientId, isVideo, action: "incoming",
  });
}

export async function notifyMissedCall(
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean = false
): Promise<NotifyCallResult> {
  return apiCall<NotifyCallResult>("/api/notify-call", {
    callId: "", callerId, callerName, recipientId, isVideo, action: "missed",
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function notifyUserDeleted(
  userId: string
): Promise<AdminUserDeletedResult> {
  return apiCall<AdminUserDeletedResult>("/api/admin", {
    action: "user-deleted", userId,
  });
}

export async function runQueueCleanup(): Promise<AdminCleanupResult> {
  return apiCall<AdminCleanupResult>("/api/admin", { action: "cleanup-queue" });
}

// ─── Health / warm-up check ───────────────────────────────────────────────────

export async function healthCheck(): Promise<HealthCheckResult> {
  const url = `${BACKEND_URL}/api/warmup`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: "GET",
      headers: BASE_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return JSON.parse(await response.text());
  } catch (err: any) {
    throw new Error(err.message === "Network request failed"
      ? "No internet connection"
      : err.message);
  }
}
