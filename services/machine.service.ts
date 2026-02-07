import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
} from "firebase/firestore";
import {
  onValue,
  ref as rtdbRef,
} from "firebase/database";
import { db, rtdb } from "./firebase";

export type MachineStatus =
  | "Available"
  | "Clothes Inside"
  | "In Use"
  | "Unauthorized Use";

export type Machine = {
  machineId: string;
  status: MachineStatus;
  currentLoad: number;
  vibrationLevel: number;
  currentUserId?: string | null;
  unauthorizedFlag: boolean;
  buzzerActive: boolean;
  lastUpdated: any;
  estimatedEndTime?: any;
};

export type IoTData = {
  load: number;
  vibration: number;
  buzzerState: boolean;
  lastPing: number;
};

export const subscribeMachines = (
  callback: (machines: Machine[]) => void
) => {
  const q = query(collection(db, "machines"));

  const unsubscribe = onSnapshot(q, snapshot => {
    const machines = snapshot.docs.map(doc => ({
      machineId: doc.id,
      ...doc.data(),
    })) as Machine[];

    callback(machines);
  });

  return unsubscribe;
};

/**
 * Subscribe to a single machine
 */
export const subscribeMachine = (
  machineId: string,
  callback: (machine: Machine) => void
) => {
  const ref = doc(db, "machines", machineId);

  const unsubscribe = onSnapshot(ref, snap => {
    if (!snap.exists()) return;

    callback({
      machineId: snap.id,
      ...snap.data(),
    } as Machine);
  });

  return unsubscribe;
};

/**
 * Fetch machines once
 */
export const fetchMachines = async (
  callback: (machines: Machine[]) => void
) => {
  const snap = await getDocs(collection(db, "machines"));

  const machines = snap.docs.map(doc => ({
    machineId: doc.id,
    ...doc.data(),
  })) as Machine[];

  callback(machines);
};

/* -----------------------------
   IOT (Realtime Database)
------------------------------ */

/**
 * Subscribe to live IoT sensor data
 * Path: /iot/{machineId}
 */
export const subscribeIoTData = (
  machineId: string,
  callback: (data: IoTData) => void
) => {
  const ref = rtdbRef(rtdb, `iot/${machineId}`);

  const unsubscribe = onValue(ref, snapshot => {
    if (!snapshot.exists()) return;
    callback(snapshot.val() as IoTData);
  });

  return () => unsubscribe();
};

/* -----------------------------
   STATUS LOGIC
------------------------------ */

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

/* -----------------------------
   UPDATES (Firestore)
------------------------------ */

export const updateMachineStatus = async (
  machineId: string,
  userId: string,
  updates: Partial<Machine>
) => {
  const ref = doc(db, "machines", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    if (snap.data().currentUserId !== userId) return;

    tx.update(ref, {
      ...updates,
      lastUpdated: new Date(),
    });
  });
};

export const claimMachine = async (
  machineId: string,
  userId: string
) => {
  const ref = doc(db, "machines", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Machine not found");

    const data = snap.data();

    if (data.currentUserId && data.currentUserId !== userId) {
      throw new Error("Machine already in use");
    }

    tx.update(ref, {
      currentUserId: userId,
      lastUpdated: new Date(),
    });
  });
};

export const releaseMachine = async (
  machineId: string,
  userId: string
) => {
  const ref = doc(db, "machines", machineId);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    if (snap.data().currentUserId !== userId) return;

    tx.update(ref, {
      currentUserId: null,
      status: "Available",
      buzzerActive: false,
      lastUpdated: new Date(),
    });
  });
};