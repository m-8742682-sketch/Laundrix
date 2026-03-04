import {
  doc,
  runTransaction,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  get as rtdbGet,
  onValue,
  ref as rtdbRef,
  update as rtdbUpdate,
} from "firebase/database";
import { db, rtdb } from "./firebase";
import type { Machine, IoTData, MachineStatus } from "@/types";

export type { Machine, IoTData, MachineStatus };

// ─── Constants ────────────────────────────────────────────────────────────────

const MACHINE_OFFLINE_THRESHOLD_MS = 90_000;

// ─── Shared Parser ────────────────────────────────────────────────────────────
// Previously copy-pasted verbatim inside subscribeMachinesRTDB, subscribeMachineRTDB,
// and fetchMachines. Now a single source of truth.

function parseMachine(machineId: string, raw: any): Machine {
  const lastPing = raw?.lastPing ?? 0;
  const isLive =
    raw?.isLive !== undefined
      ? raw.isLive
      : Date.now() - lastPing < MACHINE_OFFLINE_THRESHOLD_MS;

  return {
    machineId,
    status: (raw?.state as MachineStatus) ?? "Available",
    currentLoad: raw?.load ?? 0,
    vibrationLevel: raw?.vibration ?? 0,
    currentUserId: raw?.currentUserId ?? null,
    unauthorizedFlag: raw?.unauthorizedFlag ?? false,
    buzzerActive: raw?.buzzerState ?? false,
    lastUpdated: new Date(lastPing),
    estimatedEndTime: null,
    isLive,
    location: raw?.location ?? null,
    locked: raw?.locked ?? true,
    lastPing,
  };
}

// ─── RTDB Subscriptions ───────────────────────────────────────────────────────

export const subscribeMachinesRTDB = (callback: (machines: Machine[]) => void) => {
  return onValue(rtdbRef(rtdb, "iot"), (snapshot) => {
    const data = snapshot.val() ?? {};
    callback(Object.entries(data).map(([id, raw]) => parseMachine(id, raw)));
  });
};

export const subscribeMachineRTDB = (
  machineId: string,
  callback: (machine: Machine | null) => void
) => {
  return onValue(rtdbRef(rtdb, `iot/${machineId}`), (snapshot) => {
    callback(snapshot.exists() ? parseMachine(machineId, snapshot.val()) : null);
  });
};

// Alias kept for call-site compatibility
export const subscribeMachine = subscribeMachineRTDB;

// Firestore-based subscription kept for DashboardViewModel which merges both sources.
// Uses the same Machine type so it is a drop-in replacement.
import { collection, onSnapshot, query } from "firebase/firestore";

export const subscribeMachines = (callback: (machines: Machine[]) => void) => {
  return onSnapshot(query(collection(db, "machines")), (snapshot) => {
    const machines = snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        machineId: docSnap.id,
        status: (d.status as MachineStatus) ?? "Available",
        currentLoad: d.currentLoad ?? 0,
        vibrationLevel: d.vibrationLevel ?? 0,
        currentUserId: d.currentUserId ?? null,
        unauthorizedFlag: d.unauthorizedFlag ?? false,
        buzzerActive: d.buzzerActive ?? false,
        lastUpdated: d.lastUpdated?.toDate?.() ?? new Date(),
        estimatedEndTime: d.estimatedEndTime?.toDate?.() ?? null,
        isLive: d.isLive ?? false,
        location: d.location ?? null,
        locked: d.locked ?? true,
        lastPing: d.lastPing ?? 0,
      } as Machine;
    });
    callback(machines);
  });
};

// ─── Fetch ────────────────────────────────────────────────────────────────────

export const fetchMachines = async (): Promise<Machine[]> => {
  const snapshot = await rtdbGet(rtdbRef(rtdb, "iot"));
  const data = snapshot.val() ?? {};
  return Object.entries(data).map(([id, raw]) => parseMachine(id, raw));
};

// ─── IoT Controls ─────────────────────────────────────────────────────────────

export const checkMachineOnline = (lastPing: number): boolean =>
  Date.now() - lastPing < MACHINE_OFFLINE_THRESHOLD_MS;

export const toggleBuzzer = async (machineId: string, active: boolean) => {
  await rtdbUpdate(rtdbRef(rtdb, `iot/${machineId}`), {
    buzzerState: active,
    lastPing: Date.now(),
  });
};

// Alias kept for call-site compatibility (was toggleBuzzerRTDB)
export const toggleBuzzerRTDB = toggleBuzzer;

export const toggleLock = async (machineId: string, locked: boolean) => {
  await rtdbUpdate(rtdbRef(rtdb, `iot/${machineId}`), {
    locked,
    lastPing: Date.now(),
  });
};

// Alias kept for call-site compatibility (was toggleLockRTDB)
export const toggleLockRTDB = toggleLock;

// ─── Status Computation ───────────────────────────────────────────────────────

export const computeMachineStatus = (
  load: number,
  vibration: number,
  hasUser: boolean
): MachineStatus => {
  if (vibration > 5 && !hasUser) return "Unauthorized Use";
  if (vibration > 5 && load > 0) return "In Use";
  if (load > 0 && vibration <= 5) return "Clothes Inside";
  return "Available";
};

// ─── Firestore Operations ─────────────────────────────────────────────────────

export const updateMachineLiveStatus = async (machineId: string, isLive: boolean) => {
  await updateDoc(doc(db, "machines", machineId), {
    isLive,
    lastUpdated: Timestamp.now(),
  });
};

export const updateMachineStatus = async (
  machineId: string,
  userId: string,
  updates: Partial<Machine>
) => {
  const ref = doc(db, "machines", machineId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().currentUserId !== userId) return;
    tx.update(ref, { ...updates, lastUpdated: Timestamp.now() });
  });
};

export const claimMachine = async (machineId: string, userId: string) => {
  const ref = doc(db, "machines", machineId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Machine not found");

    const { currentUserId } = snap.data();
    if (currentUserId && currentUserId !== userId) throw new Error("Machine already in use");

    tx.update(ref, {
      currentUserId: userId,
      status: "In Use",
      lastUpdated: Timestamp.now(),
    });
  });
};

export const releaseMachine = async (machineId: string, userId: string) => {
  const ref = doc(db, "machines", machineId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().currentUserId !== userId) return;

    tx.update(ref, {
      currentUserId: null,
      status: "Available",
      buzzerActive: false,
      estimatedEndTime: null,
      lastUpdated: Timestamp.now(),
    });
  });
};
