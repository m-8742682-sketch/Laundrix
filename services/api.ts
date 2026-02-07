/**
 * Vercel Backend API Service
 * 
 * All calls to the Laundrix backend go through here.
 * Configure BACKEND_URL in your environment.
 */

// TODO: Replace with your Vercel deployment URL
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "https://laundrix-backend.vercel.app";

export type ScanResult = {
  success: boolean;
  action: "unlocked" | "already_current" | "incident_created" | "not_in_queue";
  message: string;
  incidentId?: string;
  expiresAt?: string;
  nextUserId?: string;
  nextUserName?: string;
};

export type ReleaseResult = {
  success: boolean;
  message: string;
  nextUserId?: string | null;
  graceExpiresAt?: string | null;
};

export type IncidentActionResult = {
  success: boolean;
  message: string;
  buzzerTriggered?: boolean;
};

export type GraceTimeoutResult = {
  success: boolean;
  message: string;
  action?: "warned" | "removed";
  newNextUserId?: string | null;
};

export type QueueResult = {
  success: boolean;
  message: string;
  position?: number;
  queueToken?: string;
};

/**
 * Call backend API with error handling
 */
async function apiCall<T>(
  endpoint: string,
  body: Record<string, any>
): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Get response as text first
    const text = await response.text();
    
    // Try to parse as JSON
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      // Response is not JSON (likely HTML error page)
      console.error(`API returned non-JSON response from ${endpoint}:`, text.substring(0, 200));
      throw new Error(`Server error: Unable to reach API. Please check your internet connection.`);
    }

    if (!response.ok) {
      throw new Error(data.error || `API request failed with status ${response.status}`);
    }

    return data as T;
  } catch (error: any) {
    // Network errors (no internet, DNS failure, etc.)
    if (error.message === 'Network request failed') {
      throw new Error('No internet connection. Please check your network.');
    }
    throw error;
  }
}

/**
 * Scan QR code - main entry point for machine access
 */
export async function scanMachine(
  machineId: string,
  userId: string,
  userName: string
): Promise<ScanResult> {
  return apiCall<ScanResult>("/api/scan", { machineId, userId, userName });
}

/**
 * Release machine - end current session
 */
export async function releaseMachine(
  machineId: string,
  userId: string
): Promise<ReleaseResult> {
  return apiCall<ReleaseResult>("/api/release", { machineId, userId });
}

/**
 * Handle incident action (not_me, dismiss, timeout)
 */
export async function incidentAction(
  incidentId: string,
  userId: string,
  action: "confirm_not_me" | "dismiss" | "timeout"
): Promise<IncidentActionResult> {
  return apiCall<IncidentActionResult>("/api/incident-action", {
    incidentId,
    userId,
    action,
  });
}

/**
 * Handle grace period timeout (warning at 2min, expired at 5min)
 */
export async function graceTimeout(
  machineId: string,
  userId: string,
  type: "warning" | "expired"
): Promise<GraceTimeoutResult> {
  return apiCall<GraceTimeoutResult>("/api/grace-timeout", {
    machineId,
    userId,
    type,
  });
}

/**
 * Claim machine during grace period
 */
export async function claimGrace(
  machineId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  return apiCall("/api/claim-grace", { machineId, userId });
}

/**
 * Dismiss buzzer alarm
 */
export async function dismissAlarm(
  machineId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  return apiCall("/api/dismiss-alarm", { machineId, userId });
}

/**
 * Join queue for a machine
 */
export async function joinQueue(
  machineId: string,
  userId: string,
  userName: string
): Promise<QueueResult> {
  return apiCall<QueueResult>("/api/join-queue", {
    machineId,
    userId,
    userName,
  });
}

/**
 * Leave queue for a machine
 */
export async function leaveQueue(
  machineId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  return apiCall("/api/leave-queue", { machineId, userId });
}

/**
 * Notify chat participants (called by chat.service.ts)
 */
export async function notifyChat(
  machineId: string,
  senderId: string,
  senderName: string,
  message: string,
  recipientIds: string[]
): Promise<{ success: boolean; notified: number }> {
  return apiCall("/api/notify-chat", {
    machineId,
    senderId,
    senderName,
    message,
    recipientIds,
  });
}

/**
 * Notify incoming call
 */
export async function notifyIncomingCall(
  callId: string,
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean = false
): Promise<{ success: boolean; sent: boolean }> {
  return apiCall("/api/notify-call", {
    callId,
    callerId,
    callerName,
    recipientId,
    isVideo,
    action: "incoming",
  });
}

/**
 * Notify missed call
 */
export async function notifyMissedCall(
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean = false
): Promise<{ success: boolean; sent: boolean }> {
  return apiCall("/api/notify-call", {
    callId: "", // Not needed for missed call
    callerId,
    callerName,
    recipientId,
    isVideo,
    action: "missed",
  });
}

/**
 * Health check
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const url = `${BACKEND_URL}/api/health`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Health check failed - invalid response");
    }
  } catch (error: any) {
    if (error.message === 'Network request failed') {
      throw new Error('No internet connection');
    }
    throw error;
  }
}
