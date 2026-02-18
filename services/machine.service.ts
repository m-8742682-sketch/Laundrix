import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  Timestamp,
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
  isLive: boolean; // NEW: Online/offline status
  location?: string; // NEW: Machine location
};

export type IoTData = {
  load: number;
  vibration: number;
  buzzerState: boolean;
  lastPing: number;
};

/* ---------------------------
   REAL-TIME SUBSCRIPTIONS
---------------------------- */

/**
 * Subscribe to all machines with real-time updates
 * Includes Firestore data + RTDB online status
 */
export const subscribeMachines = (
  callback: (machines: Machine[]) => void
) => {
  const q = query(collection(db, "machines"));

  // Subscribe to Firestore machines
  const unsubscribeFirestore = onSnapshot(q, snapshot => {
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
        lastUpdated: data.lastUpdated,
        estimatedEndTime: data.estimatedEndTime,
        isLive: data.isLive || false,
        location: data.location || "",
      } as Machine;
    });

    callback(machines);
  });

  return unsubscribeFirestore;
};

/**
 * Subscribe to a single machine (Firestore + RTDB combined)
 */
export const subscribeMachine = (
  machineId: string,
  callback: (machine: Machine & { iot?: IoTData }) => void
) => {
  const firestoreRef = doc(db, "machines", machineId);
  const rtdbRefPath = rtdbRef(rtdb, `iot/${machineId}`);

  let firestoreData: Partial<Machine> = {};
  let rtdbData: IoTData | null = null;

  const mergeAndCallback = () => {
    if (!firestoreData.machineId) return;
    
    callback({
      ...(firestoreData as Machine),
      iot: rtdbData || undefined,
      // Override with live RTDB data if available
      currentLoad: rtdbData?.load ?? firestoreData.currentLoad ?? 0,
      vibrationLevel: rtdbData?.vibration ?? firestoreData.vibrationLevel ?? 0,
    });
  };

  // Subscribe to Firestore
  const unsubscribeFirestore = onSnapshot(firestoreRef, snap => {
    if (!snap.exists()) return;
    
    firestoreData = {
      machineId: snap.id,
      ...snap.data(),
    } as Machine;
    
    mergeAndCallback();
  });

  // Subscribe to RTDB (IoT real-time data)
  const unsubscribeRTDB = onValue(rtdbRefPath, snapshot => {
    if (snapshot.exists()) {
      rtdbData = snapshot.val() as IoTData;
      
      // Auto-update isLive based on lastPing
      const now = Date.now();
      const lastPing = rtdbData.lastPing || 0;
      const isLive = now - lastPing < 60000; // 60 seconds threshold
      
      // Update Firestore isLive if changed (optional, debounced)
      if (firestoreData.machineId && firestoreData.isLive !== isLive) {
        updateMachineLiveStatus(firestoreData.machineId, isLive).catch(console.error);
      }
    } else {
      rtdbData = null;
    }
    
    mergeAndCallback();
  });

  return () => {
    unsubscribeFirestore();
    unsubscribeRTDB();
  };
};

/* ---------------------------
   FETCH OPERATIONS
---------------------------- */

/**
 * Fetch machines once (for initial load)
 */
export const fetchMachines = async (): Promise<Machine[]> => {
  const snap = await getDocs(collection(db, "machines"));

  return snap.docs.map(doc => {
    const data = doc.data();
    return {
      machineId: doc.id,
      status: data.status || "Available",
      currentLoad: data.currentLoad || 0,
      vibrationLevel: data.vibrationLevel || 0,
      currentUserId: data.currentUserId || null,
      unauthorizedFlag: data.unauthorizedFlag || false,
      buzzerActive: data.buzzerActive || false,
      lastUpdated: data.lastUpdated,
      estimatedEndTime: data.estimatedEndTime,
      isLive: data.isLive || false,
      location: data.location || "",
    } as Machine;
  });
};

/* ---------------------------
   IOT (Realtime Database)
---------------------------- */

/**
 * Subscribe to live IoT sensor data only
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

/**
 * Check if machine is online based on lastPing
 */
export const checkMachineOnline = (lastPing: number): boolean => {
  const now = Date.now();
  return now - lastPing < 60000; // 60 seconds threshold
};

/* ---------------------------
   STATUS COMPUTATION
---------------------------- */

/**
 * Compute machine status from IoT sensors
 */
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

/**
 * Update machine status based on IoT data
 */
export const updateMachineFromIoT = async (
  machineId: string,
  iotData: IoTData
) => {
  const machineRef = doc(db, "machines", machineId);
  
  const hasUser = !!iotData.load; // Simplified - check Firestore for actual user
  const newStatus = computeMachineStatus(
    iotData.load,
    iotData.vibration,
    hasUser
  );
  
  const isLive = checkMachineOnline(iotData.lastPing);

  await updateDoc(machineRef, {
    status: newStatus,
    currentLoad: iotData.load,
    vibrationLevel: iotData.vibration,
    isLive: isLive,
    lastUpdated: Timestamp.now(),
  });
};

/* ---------------------------
   UPDATES (Firestore)
---------------------------- */

/**
 * Update machine isLive status
 */
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

/**
 * Update machine with transaction (safety check)
 */
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

/**
 * Claim machine for user
 */
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

/**
 * Release machine
 */
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

/**
 * Toggle buzzer
 */
export const toggleBuzzer = async (
  machineId: string,
  active: boolean
) => {
  const ref = doc(db, "machines", machineId);
  await updateDoc(ref, {
    buzzerActive: active,
    lastUpdated: Timestamp.now(),
  });
};  