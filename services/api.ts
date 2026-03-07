/**
 * Vercel Backend API Service
 *
 * PERFORMANCE OPTIMIZATIONS:
 * 1. AbortController timeout (5-12s depending on endpoint)
 * 2. Connection: keep-alive header — reuses TCP connection
 * 3. warmupBackend() — call at app launch to pre-warm the cold Vercel function
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
    ownerUserId?: string;
    ownerUserName?: string;
    nextUserId?: string;
    nextUserName?: string;
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

export interface LivekitTokenResult {
  success: boolean;
  token: string;
  roomName: string;
  participantId: string;
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

// ─── Shared headers ───────────────────────────────────────────────────────────

const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Connection: "keep-alive",
};

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiCall<T>(
  endpoint: string,
  body: Record<string, any>,
  timeoutMs = 8000
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
      throw Object.assign(new Error("Request timed out."), { name: "AbortError" });
    }
    if (err.message === "Network request failed") {
      throw new Error("No internet connection. Please check your network.");
    }
    throw err;
  }
}

// ─── Warm-up ──────────────────────────────────────────────────────────────────
// Vercel serverless spawns a separate Lambda per route. Warming /api/warmup
// does NOT warm /api/queue or /api/scan. We ping each critical endpoint with
// a lightweight OPTIONS-style POST (invalid body → 400, but Lambda is now warm).

let warmupDone = false;

async function pingEndpoint(url: string): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    await fetch(url, { method: 'POST', headers: BASE_HEADERS, body: '{}', signal: ctrl.signal });
  } catch { /* expected — either 400 or network; function is now warm */ }
  finally { clearTimeout(timer); }
}

export async function warmupBackend(): Promise<void> {
  if (warmupDone) return;
  warmupDone = true;
  try {
    // Warmup GET for the health-check endpoint
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    fetch(`${BACKEND_URL}/api/warmup`, { method: 'GET', headers: BASE_HEADERS, signal: ctrl.signal })
      .then(() => console.log('[API] Backend /api/warmup warmed ✓'))
      .catch(() => {})
      .finally(() => clearTimeout(timer));

    // Warm up critical endpoints in parallel — queue, scan, release are the hot paths.
    // Each ping returns 400 (missing fields) but the Lambda instance is now live.
    // This cuts first-action latency from ~3-5s (cold) to ~0.3-0.7s (warm).
    await Promise.allSettled([
      pingEndpoint(`${BACKEND_URL}/api/queue`),
      pingEndpoint(`${BACKEND_URL}/api/scan`),
      pingEndpoint(`${BACKEND_URL}/api/release`),
    ]);
    console.log('[API] Critical endpoints pre-warmed ✓');
  } catch {
    console.warn('[API] Warmup skipped (non-critical)');
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
  }, 12000);
}

export async function leaveQueue(
  machineId: string,
  userId: string
): Promise<LeaveQueueResult> {
  return apiCall<LeaveQueueResult>("/api/queue", {
    action: "leave",
    machineId,
    userId,
  }, 12000);
}

// ─── Machine scan & release ───────────────────────────────────────────────────

export async function scanMachine(
  machineId: string,
  userId: string,
  userName: string
): Promise<ScanResponse> {
  return apiCall<ScanResponse>("/api/scan", { machineId, userId, userName }, 10000);
}

export async function releaseMachine(
  machineId: string,
  userId: string
): Promise<ReleaseResult> {
  return apiCall<ReleaseResult>("/api/release", { machineId, userId }, 12000);
}

// ─── Incident ─────────────────────────────────────────────────────────────────

export async function incidentAction(
  incidentId: string,
  userId: string,
  action: "confirm_not_me" | "dismiss" | "timeout",
  cancelReason?: string
): Promise<IncidentActionResult> {
  return apiCall<IncidentActionResult>("/api/incident-action", {
    incidentId, userId, action, ...(cancelReason ? { cancelReason } : {}),
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

// ─── Notifications (unified /api/notify endpoint) ────────────────────────────

export async function notifyChat(
  machineId: string,
  senderId: string,
  senderName: string,
  message: string,
  recipientIds: string[]
): Promise<NotifyChatResult> {
  return apiCall<NotifyChatResult>("/api/notify", {
    type: "chat",
    machineId,
    senderId,
    senderName,
    message,
    recipientIds,
  });
}

export async function notifyIncomingCall(
  callId: string,
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean = false,
  callerAvatar: string = ''
): Promise<NotifyCallResult> {
  // 15s timeout — push notification delivery can be slower than regular API calls
  return apiCall<NotifyCallResult>("/api/notify", {
    type: "call",
    action: "incoming",
    callId,
    callerId,
    callerName,
    callerAvatar,
    recipientId,
    isVideo,
  }, 15000);
}

export async function notifyMissedCall(
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean = false
): Promise<NotifyCallResult> {
  return apiCall<NotifyCallResult>("/api/notify", {
    type: "call",
    action: "missed",
    callId: "",
    callerId,
    callerName,
    recipientId,
    isVideo,
  });
}

// ─── LiveKit Token ────────────────────────────────────────────────────────────

export async function getLivekitToken(
  roomName: string,
  participantId: string,
  participantName: string,
  isVideo: boolean = false
): Promise<LivekitTokenResult> {
  return apiCall<LivekitTokenResult>("/api/livekit-token", {
    roomName,
    participantId,
    participantName,
    isVideo,
  }, 10000);
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

// ─── Health check ─────────────────────────────────────────────────────────────

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