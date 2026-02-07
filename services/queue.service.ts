import {
  doc,
  addDoc,
  updateDoc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

/* =========================
   HELPERS
========================= */
const generateQueueToken = () =>
  `q_${Math.random().toString(36).slice(2, 10)}`;

/* =========================
   JOIN QUEUE
========================= */
export const joinQueue = async (machineId: string, userId: string) => {
  const ref = doc(db, "queues", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Queue not found");

    const data = snap.data();
    const users = data.users ?? [];

    if (users.some((u: any) => u.userId === userId)) {
      throw new Error("Already in queue");
    }

    const userSnap = await tx.get(doc(db, "users", userId));
    const profile = userSnap.data();

    const newUser = {
      userId,
      name: profile?.name ?? "User",
      avatarUrl: profile?.avatarUrl ?? null,
      joinedAt: new Date(),
      queueToken: `q_${Date.now()}`,
      position: users.length + 1,
    };

    tx.update(ref, {
      users: [...users, newUser],
      lastUpdated: new Date(),
    });
  });
};

/* =========================
   CHECK QUEUE STATUS
========================= */
export const checkQueueStatus = async (
  machineId: string,
  userId: string
) => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return false;

  const users = snap.data().users ?? [];
  return users.some((u: any) => u.userId === userId);
};

/* =========================
   GET QUEUE INFO
========================= */
export const getQueueInfo = async (machineId: string) => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return { waiting: 0, inUse: 0 };

  const data = snap.data();
  return {
    waiting: (data.users ?? []).length,
    inUse: data.currentUserId ? 1 : 0,
  };
};

/* =========================
   GET QUEUE USERS
========================= */
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

/* =========================
   PROMOTE NEXT USER (TRANSACTION)
========================= */
export const promoteNextUser = async (machineId: string) => {
  const ref = doc(db, "queues", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    const users = [...(data.users ?? [])];

    if (users.length === 0) {
      tx.update(ref, {
        currentUserId: null,
        currentQueueToken: null,
      });
      return;
    }

    const next = users.shift(); // remove first user

    const reindexed = users.map((u, i) => ({
      ...u,
      position: i + 1,
    }));

    tx.update(ref, {
      currentUserId: next.userId,
      currentQueueToken: next.queueToken,
      users: reindexed,
      lastUpdated: serverTimestamp(),
    });
  });
};

/* =========================
   VALIDATE QR TOKEN
========================= */
export const validateQueueToken = async (
  machineId: string,
  scannedToken: string,
  userId: string
) => {
  const snap = await getDoc(doc(db, "queues", machineId));
  if (!snap.exists()) return false;

  const data = snap.data();

  return (
    data.currentUserId === userId &&
    data.currentQueueToken === scannedToken
  );
};

/* =========================
   CONFIRM USAGE (QR OK)
========================= */
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

  await updateDoc(doc(db, "queues", machineId), {
    usageStartedAt: serverTimestamp(),
  });
};

/* =========================
   SKIP USER (TIMEOUT)
========================= */
export const skipCurrentUser = async (
  machineId: string,
  userId: string
) => {
  const queueRef = doc(db, "queues", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(queueRef);
    if (!snap.exists()) return;

    if (snap.data().currentUserId !== userId) return;

    tx.update(queueRef, {
      currentUserId: null,
      currentQueueToken: null,
      lastUpdated: serverTimestamp(),
    });
  });

  await promoteNextUser(machineId);
};

export const leaveQueue = async (machineId: string, userId: string) => {
  const ref = doc(db, "queues", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const users = (snap.data().users ?? [])
      .filter((u: any) => u.userId !== userId)
      .map((u: any, i: number) => ({
        ...u,
        position: i + 1,
      }));

    tx.update(ref, {
      users,
      lastUpdated: serverTimestamp(),
    });
  });
};
