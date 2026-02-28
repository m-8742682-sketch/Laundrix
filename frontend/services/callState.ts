/**
 * Global Call State Management - COMPLETE CENTRALIZATION
 * 
 * Architecture:
 * - Screens use callState functions
 * - callState uses api.ts for backend calls
 * - api.ts calls /api/notify-call endpoint
 */

import { BehaviorSubject } from 'rxjs';
import { doc, onSnapshot, updateDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { notifyIncomingCall, notifyMissedCall } from './api';

const db = getFirestore();

// --- Types ---
export interface CallData {
  id: string;
  callId: string;
  targetUserId: string;  // B - the recipient (who receives the call)
  targetName: string;    // B's name
  targetAvatar?: string;
  callerId: string;      // A - the caller (who initiated)
  callerName: string;    // A's name
  callerAvatar?: string;
  type: "voice" | "video";
  status: "calling" | "connected" | "ended" | "rejected" | "missed";
  startTime?: Date;
  isOutgoing?: boolean;
  isMinimized?: boolean;
}

// --- Screen State Tracking ---
export const isIncomingScreenOpen$ = new BehaviorSubject<boolean>(false);
export const isOutgoingScreenOpen$ = new BehaviorSubject<boolean>(false);
export const isActiveCallScreenOpen$ = new BehaviorSubject<boolean>(false);

// --- Call Data State ---
export const incomingCallData$ = new BehaviorSubject<CallData | null>(null);
export const outgoingCallData$ = new BehaviorSubject<CallData | null>(null);
export const activeCallData$ = new BehaviorSubject<CallData | null>(null);

// --- Audio Control ---
export const shouldPlayIncomingRingtone$ = new BehaviorSubject<boolean>(false);
export const shouldPlayOutgoingDialTone$ = new BehaviorSubject<boolean>(false);

// --- Countdown State ---
export const incomingCallCountdown$ = new BehaviorSubject<number>(30);
export const outgoingCallCountdown$ = new BehaviorSubject<number>(30);
export const isIncomingCallRinging$ = new BehaviorSubject<boolean>(false);
export const isOutgoingCallRinging$ = new BehaviorSubject<boolean>(false);

// --- Private refs for timers ---
let incomingCountdownInterval: ReturnType<typeof setInterval> | null = null;
let outgoingCountdownInterval: ReturnType<typeof setInterval> | null = null;
let incomingAutoRejectTimeout: ReturnType<typeof setTimeout> | null = null;
let outgoingAutoEndTimeout: ReturnType<typeof setTimeout> | null = null;
let callStatusUnsubscribe: (() => void) | null = null;
const CALL_TIMEOUT_MS = 30000;

// --- Helper Functions ---

export const setIncomingScreenOpen = (isOpen: boolean) => {
  isIncomingScreenOpen$.next(isOpen);
};

export const setOutgoingScreenOpen = (isOpen: boolean) => {
  isOutgoingScreenOpen$.next(isOpen);
};

export const setActiveCallScreenOpen = (isOpen: boolean) => {
  isActiveCallScreenOpen$.next(isOpen);
};

// --- Countdown Management ---

const startIncomingCountdown = () => {
  stopIncomingCountdown();
  
  console.log('[CallState] Starting INCOMING countdown from 30');
  incomingCallCountdown$.next(30);
  isIncomingCallRinging$.next(true);
  
  incomingCountdownInterval = setInterval(() => {
    const current = incomingCallCountdown$.value;
    if (current > 0) {
      incomingCallCountdown$.next(current - 1);
    } else {
      stopIncomingCountdown();
    }
  }, 1000);
  
  incomingAutoRejectTimeout = setTimeout(() => {
    console.log('[CallState] Auto-reject timeout triggered for incoming call');
    handleIncomingAutoReject();
  }, CALL_TIMEOUT_MS);
};

const stopIncomingCountdown = () => {
  if (incomingCountdownInterval) {
    clearInterval(incomingCountdownInterval);
    incomingCountdownInterval = null;
  }
  if (incomingAutoRejectTimeout) {
    clearTimeout(incomingAutoRejectTimeout);
    incomingAutoRejectTimeout = null;
  }
  isIncomingCallRinging$.next(false);
};

const startOutgoingCountdown = () => {
  stopOutgoingCountdown();
  
  console.log('[CallState] Starting OUTGOING countdown from 30');
  outgoingCallCountdown$.next(30);
  isOutgoingCallRinging$.next(true);
  
  outgoingCountdownInterval = setInterval(() => {
    const current = outgoingCallCountdown$.value;
    if (current > 0) {
      outgoingCallCountdown$.next(current - 1);
    } else {
      stopOutgoingCountdown();
    }
  }, 1000);
  
  outgoingAutoEndTimeout = setTimeout(() => {
    console.log('[CallState] Auto-end timeout triggered for outgoing call');
    handleOutgoingAutoEnd();
  }, CALL_TIMEOUT_MS);
};

const stopOutgoingCountdown = () => {
  if (outgoingCountdownInterval) {
    clearInterval(outgoingCountdownInterval);
    outgoingCountdownInterval = null;
  }
  if (outgoingAutoEndTimeout) {
    clearTimeout(outgoingAutoEndTimeout);
    outgoingAutoEndTimeout = null;
  }
  isOutgoingCallRinging$.next(false);
};

// --- Call Status Listener ---

const startCallStatusListener = (callId: string) => {
  stopCallStatusListener();
  
  console.log('[CallState] Starting call status listener for:', callId);
  
  callStatusUnsubscribe = onSnapshot(doc(db, "calls", callId), (snapshot) => {
    const data = snapshot.data();
    if (!data) return;
    
    console.log('[CallState] Call status changed:', data.status);
    
    if (["ended", "rejected", "missed"].includes(data.status)) {
      console.log('[CallState] Call ended by remote, status:', data.status);
      
      stopIncomingCountdown();
      stopOutgoingCountdown();
      stopCallStatusListener();
      
      shouldPlayIncomingRingtone$.next(false);
      shouldPlayOutgoingDialTone$.next(false);
      
      const currentIncoming = incomingCallData$.value;
      const currentOutgoing = outgoingCallData$.value;
      
      if (currentIncoming && currentIncoming.callId === callId) {
        incomingCallData$.next(null);
        isIncomingCallRinging$.next(false);
      }
      
      if (currentOutgoing && currentOutgoing.callId === callId) {
        outgoingCallData$.next(null);
        isOutgoingCallRinging$.next(false);
      }
    } else if (data.status === "connected") {
      console.log('[CallState] Call connected!');
      stopIncomingCountdown();
      stopOutgoingCountdown();
    }
  });
};

const stopCallStatusListener = () => {
  if (callStatusUnsubscribe) {
    callStatusUnsubscribe();
    callStatusUnsubscribe = null;
  }
};

// --- Auto-Reject Handler (Incoming) ---

const handleIncomingAutoReject = async () => {
  const call = incomingCallData$.value;
  if (!call) {
    console.log('[CallState] No incoming call to auto-reject');
    return;
  }
  
  console.log('[CallState] Auto-rejecting call:', call.callId);
  
  try {
    await updateDoc(doc(db, "calls", call.callId), {
      status: "missed",
      endedAt: serverTimestamp(),
      missedBy: 'auto-timeout',
    });
    console.log('[CallState] Auto-reject successful, status set to missed');
  } catch (error) {
    console.error('[CallState] Auto-reject error:', error);
  }
  
  // Clear state
  shouldPlayIncomingRingtone$.next(false);
  incomingCallData$.next(null);
  isIncomingCallRinging$.next(false);
  stopCallStatusListener();
  
  // Send missed call notification via api.ts
  // B (targetUserId) missed the call from A (callerId)
  console.log('[CallState] Sending missed call notification TO:', call.targetUserId);
  try {
    await notifyMissedCall(
      call.callerId,      // A's ID (who called)
      call.callerName,    // A's name
      call.targetUserId,  // B's ID (who receives the notification)
      call.type === "video"
    );
    console.log('[CallState] Missed call notification sent successfully');
  } catch (error) {
    console.error('[CallState] Failed to send missed call notification:', error);
  }
};

// --- Auto-End Handler (Outgoing) ---

const handleOutgoingAutoEnd = async () => {
  const call = outgoingCallData$.value;
  if (!call) {
    console.log('[CallState] No outgoing call to auto-end');
    return;
  }
  
  console.log('[CallState] Auto-ending outgoing call:', call.callId);
  
  try {
    await updateDoc(doc(db, "calls", call.callId), {
      status: "ended",
      endedAt: serverTimestamp(),
      endedBy: call.callerId,
      endReason: 'timeout-no-answer',
    });
    console.log('[CallState] Auto-end successful');
  } catch (error) {
    console.error('[CallState] Auto-end error:', error);
  }
  
  shouldPlayOutgoingDialTone$.next(false);
  outgoingCallData$.next(null);
  isOutgoingCallRinging$.next(false);
  stopCallStatusListener();
};

// --- OUTGOING CALL FUNCTIONS ---

export const startOutgoingCall = (call: CallData) => {
  console.log('[CallState] START outgoing call:', call.callId);
  outgoingCallData$.next(call);
  shouldPlayOutgoingDialTone$.next(true);
  startOutgoingCountdown();
  startCallStatusListener(call.callId);
};

export const endOutgoingCall = () => {
  console.log('[CallState] END outgoing call');
  shouldPlayOutgoingDialTone$.next(false);
  outgoingCallData$.next(null);
  stopOutgoingCountdown();
  stopCallStatusListener();
};

export const connectOutgoingCall = () => {
  console.log('[CallState] CONNECT outgoing call');
  shouldPlayOutgoingDialTone$.next(false);
  stopOutgoingCountdown();
  const current = outgoingCallData$.value;
  if (current) {
    activeCallData$.next({ ...current, status: 'connected', startTime: new Date() });
    outgoingCallData$.next(null);
  }
};

// --- INCOMING CALL FUNCTIONS ---

export const startIncomingCall = (call: CallData) => {
  console.log('[CallState] START incoming call:', call.callId);
  
  const current = incomingCallData$.value;
  if (current?.callId === call.callId) {
    console.log('[CallState] Already ringing this call, continuing countdown');
    return;
  }
  
  incomingCallData$.next(call);
  shouldPlayIncomingRingtone$.next(true);
  startIncomingCountdown();
  startCallStatusListener(call.callId);
};

export const acceptIncomingCall = () => {
  console.log('[CallState] ACCEPT incoming call');
  stopIncomingCountdown();
  shouldPlayIncomingRingtone$.next(false);
  
  const current = incomingCallData$.value;
  if (current) {
    activeCallData$.next({ ...current, status: 'connected', startTime: new Date() });
    incomingCallData$.next(null);
  }
};

export const rejectIncomingCall = () => {
  console.log('[CallState] REJECT incoming call');
  stopIncomingCountdown();
  shouldPlayIncomingRingtone$.next(false);
  incomingCallData$.next(null);
  isIncomingCallRinging$.next(false);
  stopCallStatusListener();
};

export const endIncomingCall = () => {
  console.log('[CallState] END incoming call');
  stopIncomingCountdown();
  shouldPlayIncomingRingtone$.next(false);
  incomingCallData$.next(null);
  isIncomingCallRinging$.next(false);
  stopCallStatusListener();
};

// --- ACTIVE CALL FUNCTIONS ---

export const transitionToActiveCall = (call: CallData) => {
  console.log('[CallState] TRANSITION to active call:', call.callId);
  activeCallData$.next(call);
};

export const minimizeActiveCall = () => {
  console.log('[CallState] MINIMIZE active call');
  setActiveCallScreenOpen(false);
};

export const maximizeActiveCall = () => {
  console.log('[CallState] MAXIMIZE active call');
  setActiveCallScreenOpen(true);
};

export const endActiveCall = () => {
  console.log('[CallState] END active call');
  activeCallData$.next(null);
  stopCallStatusListener();
};

// --- NOTIFICATION HELPERS (for screens to use) ---

/**
 * Notify receiver of incoming call
 * Used by outgoing screens
 */
export const sendIncomingCallNotification = async (
  callId: string,
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean
) => {
  console.log('[CallState] Sending incoming call notification to:', recipientId);
  try {
    const result = await notifyIncomingCall(callId, callerId, callerName, recipientId, isVideo);
    console.log('[CallState] Incoming notification result:', result);
    return result;
  } catch (error) {
    console.error('[CallState] Failed to send incoming notification:', error);
    throw error;
  }
};

/**
 * Send missed call notification
 * Used by incoming screens when call is missed/rejected
 */
export const sendMissedCallNotification = async (
  callerId: string,
  callerName: string,
  recipientId: string,
  isVideo: boolean
) => {
  console.log('[CallState] Sending missed call notification to:', recipientId);
  try {
    const result = await notifyMissedCall(callerId, callerName, recipientId, isVideo);
    console.log('[CallState] Missed notification result:', result);
    return result;
  } catch (error) {
    console.error('[CallState] Failed to send missed notification:', error);
    throw error;
  }
};

// --- CLEAR ALL ---

export const clearAllCallState = () => {
  console.log('[CallState] CLEAR ALL');
  
  stopIncomingCountdown();
  stopOutgoingCountdown();
  stopCallStatusListener();
  
  shouldPlayIncomingRingtone$.next(false);
  shouldPlayOutgoingDialTone$.next(false);
  incomingCallData$.next(null);
  outgoingCallData$.next(null);
  activeCallData$.next(null);
  isIncomingCallRinging$.next(false);
  isOutgoingCallRinging$.next(false);
  incomingCallCountdown$.next(30);
  outgoingCallCountdown$.next(30);
  
  isIncomingScreenOpen$.next(false);
  isOutgoingScreenOpen$.next(false);
  isActiveCallScreenOpen$.next(false);
};

// --- UTILITY FUNCTIONS ---

export const isCallStillValid = (callId: string): boolean => {
  const incoming = incomingCallData$.value;
  const outgoing = outgoingCallData$.value;
  const active = activeCallData$.value;
  
  return (incoming?.callId === callId) || 
         (outgoing?.callId === callId) || 
         (active?.callId === callId);
};

export const getCallDuration = (callId: string): number => {
  const active = activeCallData$.value;
  if (active?.callId === callId && active.startTime) {
    return Math.floor((Date.now() - active.startTime.getTime()) / 1000);
  }
  return 0;
};