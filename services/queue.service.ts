/**
 * Queue Service
 *
 * CRITICAL FIX: This file previously wrote to Firestore directly,
 * completely bypassing the backend API (join-queue, leave-queue).
 *
 * All queue mutations now go through the Vercel backend so that:
 *  - Server-side idempotency checks work correctly
 *  - nextUserId / currentUserId are updated atomically by the server
 *  - Notifications are sent by the server (FCM)
 *  - RTDB commands are triggered server-side
 *
 * Read-only helpers (checkQueueStatus, getQueueInfo, etc.) still
 * query Firestore directly — that is fine and expected.
 */

import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";
import { joinQueue as apiJoinQueue, leaveQueue as apiLeaveQueue } from "./api";

// ─── Mutations: go through backend API ───────────────────────────────────────

export const joinQueue = async (
  machineId: string, 
  userId: string, 
  userName: string,
  idempotencyKey?: string
) => {
  const result = await apiJoinQueue(machineId, userId, userName, idempotencyKey);
  if (!result.success) {
    throw new Error(result.message || "Failed to join queue");
  }
  return result;
};

export const leaveQueue = async (machineId: string, userId: string) => {
  const result = await apiLeaveQueue(machineId, userId);
  if (!result.success) {
    throw new Error(result.message || "Failed to leave queue");
  }
  return result;
};

// ─── Read-only helpers (Firestore direct reads — no server writes) ────────────

export const checkQueueStatus = async (
  machineId: string,
  userId: string
): Promise<boolean> => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return false;
  const users = snap.data().users ?? [];
  return users.some((u: any) => u.userId === userId);
};

export const getQueueInfo = async (machineId: string) => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return { waiting: 0, inUse: 0 };
  const data = snap.data();
  return {
    waiting: (data.users ?? []).length,
    inUse: data.currentUserId ? 1 : 0,
  };
};

export const getQueueUsers = async (machineId: string) => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return [];
  return (snap.data().users ?? [])
    .sort((a: any, b: any) => a.position - b.position)
    .map((u: any) => ({
      ...u,
      joinedAt: u.joinedAt?.toDate?.() ?? new Date(),
    }));
};

export const validateQueueToken = async (
  machineId: string,
  scannedToken: string,
  userId: string
): Promise<boolean> => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return false;
  const data = snap.data();
  return (
    data.currentUserId === userId && data.currentQueueToken === scannedToken
  );
};

export const confirmUsage = async (
  machineId: string,
  userId: string,
  queueToken: string
) => {
  await addDoc(collection(db, "usageHistory"), {
    userId,
    machineId,
    queueToken,
    startTime: serverTimestamp(),
    resultStatus: "InProgress",
  });
};