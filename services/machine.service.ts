import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  Timestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import {
  onValue,
  ref as rtdbRef,
  set as rtdbSet,
  update as rtdbUpdate,
  get as rtdbGet,
} from "firebase/database";
import { db, rtdb } from "./firebase";

export type MachineStatus =
  | "Available"
  | "Clothes Inside"
  | "In Use"
  | "Unauthorized Use";

// Unified Machine type that matches RTDB structure
export type Machine = {
  machineId: string;
  status: MachineStatus;
  currentLoad: number;
  vibrationLevel: number;
  currentUserId: string | null;
  unauthorizedFlag: boolean;
  buzzerActive: boolean;
  lastUpdated: Date;
  estimatedEndTime: Date | null;
  isLive: boolean;
  location: string | null;
  locked: boolean;
  lastPing: number;
};

// RTDB raw data structure
export type IoTData = {
  load: number;
  vibration: number;
  buzzerState: boolean;
  lastPing: number;
  locked: boolean;
  state: string;
  location: string | null;
  isLive: boolean;
  currentUserId?: string | null;
};

/* ---------------------------
   RTDB ONLY SUBSCRIPTIONS
---------------------------- */

/**
 * Subscribe to ALL machines from RTDB (like AdminRepository)
 * Reads directly from iot/ path, no Firestore
 */
export const subscribeMachinesRTDB = (
  callback: (machines: Machine[]) => void
) => {
  const iotRef = rtdbRef(rtdb, "iot");

  const unsubscribe = onValue(iotRef, (snapshot) => {
    const data = snapshot.val() || {};
    const machines: Machine[] = [];

    Object.entries(data).forEach(([machineId, rawData]: [string, any]) => {
      const now = Date.now();
      const lastPing = rawData?.lastPing || 0;
      const isLive = rawData?.isLive !== undefined 
        ? rawData.isLive 
        : (now - lastPing < 90000);

      machines.push({
        machineId,
        status: rawData?.state || "Available",
        currentLoad: rawData?.load ?? 0,
        vibrationLevel: rawData?.vibration ?? 0,
        currentUserId: rawData?.currentUserId || null,
        unauthorizedFlag: rawData?.unauthorizedFlag || false,
        buzzerActive: rawData?.buzzerState ?? false,
        lastUpdated: new Date(lastPing),
        estimatedEndTime: null,
        isLive,
        location: rawData?.location || null,
        locked: rawData?.locked ?? true,
        lastPing,
      });
    });

    callback(machines);
  });

  return unsubscribe;
};

/**
 * Subscribe to SINGLE machine from RTDB (like AdminRepository)
 * Reads directly from iot/{machineId}, no Firestore
 */
export const subscribeMachineRTDB = (
  machineId: string,
  callback: (machine: Machine | null) => void
) => {
  const machineRef = rtdbRef(rtdb, `iot/${machineId}`);

  const unsubscribe = onValue(machineRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }

    const data = snapshot.val();
    const now = Date.now();
    const lastPing = data?.lastPing || 0;
    const isLive = data?.isLive !== undefined 
      ? data.isLive 
      : (now - lastPing < 90000);

    const machine: Machine = {
      machineId,
      status: data?.state || "Available",
      currentLoad: data?.load ?? 0,
      vibrationLevel: data?.vibration ?? 0,
      currentUserId: data?.currentUserId || null,
      unauthorizedFlag: data?.unauthorizedFlag || false,
      buzzerActive: data?.buzzerState ?? false,
      lastUpdated: new Date(lastPing),
      estimatedEndTime: null,
      isLive,
      location: data?.location || null,
      locked: data?.locked ?? true,
      lastPing,
    };

    callback(machine);
  });

  return unsubscribe;
};

/* ---------------------------
   LEGACY FIRESTORE (optional)
---------------------------- */

/**
 * Subscribe to Firestore machines (legacy - for other features)
 */
export const subscribeMachines = (
  callback: (machines: Machine[]) => void
) => {
  const q = query(collection(db, "machines"));

  return onSnapshot(q, snapshot => {
    const machines = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        machineId: doc.id,
        status: data.status || "Available",
        currentLoad: data.currentLoad || 0,
        vibrationLevel: data.vibrationLevel || 0,
        currentUserId: data.currentUserId || null,
        unauthorizedFlag: data.unauthorizedFlag || false,
        buzzerActive: data.buzzerActive || false,
        lastUpdated: data.lastUpdated?.toDate() || new Date(),
        estimatedEndTime: data.estimatedEndTime?.toDate() || null,
        isLive: data.isLive || false,
        location: data.location || null,
        locked: data.locked ?? true,
        lastPing: data.lastPing || 0,
      } as Machine;
    });

    callback(machines);
  });
};

/**
 * Subscribe to single machine (Firestore + RTDB merge)
 */
export const subscribeMachine = (
  machineId: string,
  callback: (machine: Machine & { iot?: IoTData }) => void
) => {
  // Use RTDB only - same as admin
  return subscribeMachineRTDB(machineId, (machine) => {
    if (machine) {
      callback({ ...machine, iot: undefined });
    }
  });
};

/* ---------------------------
   FETCH OPERATIONS
---------------------------- */

/**
 * Fetch machines once from RTDB
 */
export const fetchMachines = async (): Promise<Machine[]> => {
  const iotRef = rtdbRef(rtdb, "iot");
  const snapshot = await rtdbGet(iotRef);
  const data = snapshot.val() || {};
  
  return Object.entries(data).map(([machineId, rawData]: [string, any]) => {
    const now = Date.now();
    const lastPing = rawData?.lastPing || 0;
    const isLive = rawData?.isLive !== undefined 
      ? rawData.isLive 
      : (now - lastPing < 90000);

    return {
      machineId,
      status: rawData?.state || "Available",
      currentLoad: rawData?.load ?? 0,
      vibrationLevel: rawData?.vibration ?? 0,
      currentUserId: rawData?.currentUserId || null,
      unauthorizedFlag: rawData?.unauthorizedFlag || false,
      buzzerActive: rawData?.buzzerState ?? false,
      lastUpdated: new Date(lastPing),
      estimatedEndTime: null,
      isLive,
      location: rawData?.location || null,
      locked: rawData?.locked ?? true,
      lastPing,
    };
  });
};

/* ---------------------------
   IOT CONTROL (RTDB DIRECT)
---------------------------- */

/**
 * Check if machine is online based on lastPing
 */
export const checkMachineOnline = (lastPing: number): boolean => {
  const now = Date.now();
  return now - lastPing < 90000; // 90 seconds threshold
};

/**
 * Toggle buzzer directly in RTDB
 */
export const toggleBuzzerRTDB = async (
  machineId: string,
  active: boolean
) => {
  const ref = rtdbRef(rtdb, `iot/${machineId}`);
  await rtdbUpdate(ref, {
    buzzerState: active,
    lastPing: Date.now(),
  });
};

/**
 * Toggle lock directly in RTDB
 */
export const toggleLockRTDB = async (
  machineId: string,
  locked: boolean
) => {
  const ref = rtdbRef(rtdb, `iot/${machineId}`);
  await rtdbUpdate(ref, {
    locked: locked,
    lastPing: Date.now(),
  });
};

/* ---------------------------
   STATUS COMPUTATION
---------------------------- */

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

/* ---------------------------
   FIRESTORE OPERATIONS (legacy)
---------------------------- */

export const updateMachineLiveStatus = async (
  machineId: string,
  isLive: boolean
) => {
  const ref = doc(db, "machines", machineId);
  await updateDoc(ref, {
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

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    if (snap.data().currentUserId !== userId) return;

    tx.update(ref, {
      ...updates,
      lastUpdated: Timestamp.now(),
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
      status: "In Use",
      lastUpdated: Timestamp.now(),
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
      estimatedEndTime: null,
      lastUpdated: Timestamp.now(),
    });
  });
};

export const toggleBuzzer = async (
  machineId: string,
  active: boolean
) => {
  await toggleBuzzerRTDB(machineId, active);
};