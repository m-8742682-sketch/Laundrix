import { db, rtdb } from "@/services/firebase";
import {
  collection,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  addDoc,
  serverTimestamp,
  Unsubscribe,
  getDocs
} from "firebase/firestore";
import { ref, onValue, update, off } from "firebase/database";

export const adminDataSource = {

  // --- EXPORT CONTENT ---
  getUsersOnce: async (): Promise<any[]> => {
    const q = query(collection(db, "users"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  getMachinesOnce: async () : Promise<any[]> => {
    const q = query(collection(db, "machines"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  getHistoryOnce: async () : Promise<any[]> => {
    // Get last 1000 records for export
    const q = query(collection(db, "usageHistory"), orderBy("startTime", "desc"), limit(1000));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  // --- USERS ---
  subscribeToUsers: (onUpdate: (users: any[]) => void): Unsubscribe => {
    const q = collection(db, "users");
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      onUpdate(users);
    });
  },

  updateUserRole: async (userId: string, isAdmin: boolean) => {
    const userRef = doc(db, "users", userId);
    return updateDoc(userRef, {
      role: isAdmin ? "admin" : "user",
      updatedAt: serverTimestamp(),
    });
  },

  deleteUser: async (userId: string) => {
    const userRef = doc(db, "users", userId);
    return deleteDoc(userRef);
  },

  // --- MACHINES (FIRESTORE - The "Source of Truth" for existence) ---
  subscribeToMachineConfigs: (onUpdate: (machines: any[]) => void): Unsubscribe => {
    const q = collection(db, "machines");
    return onSnapshot(q, (snapshot) => {
      const machines = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      onUpdate(machines);
    });
  },

  // --- IOT CONTROL (REALTIME DB - The "Live State") ---
  subscribeToIoTState: (onUpdate: (data: any) => void) => {
    const iotRef = ref(rtdb, "iot");
    const listener = onValue(iotRef, (snapshot) => {
      onUpdate(snapshot.val() || {});
    });
    return () => off(iotRef, 'value', listener);
  },

  // NEW: Specific machine listener (Matches machineId.tsx exactly)
  subscribeToMachineIoT: (machineId: string, onUpdate: (data: any) => void) => {
    const machineRef = ref(rtdb, `iot/${machineId}`);
    const listener = onValue(machineRef, (snapshot) => {
      onUpdate(snapshot.val());
    });
    return () => off(machineRef, 'value', listener);
  },


  // Update RTDB and Log to Firestore
  toggleIoTControl: async (
    machineId: string,
    key: "locked" | "buzzerState", // Exact RTDB keys
    value: boolean
  ) => {
    const machineRef = ref(rtdb, `iot/${machineId}`);
    
    // 1. Update RTDB (Fast control)
    await update(machineRef, {
      [key]: value,
      lastPing: Date.now(),
    });

    // 2. Log to Admin Logs (Audit)
    try {
      await addDoc(collection(db, "adminLogs"), {
        action: `TOGGLE_${key.toUpperCase()}`,
        machineId: machineId,
        newValue: value,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Admin log failed", e);
    }
  },

  // --- HISTORY & INCIDENTS ---
  subscribeToHistory: (onUpdate: (records: any[]) => void): Unsubscribe => {
    const q = query(collection(db, "usageHistory"), orderBy("startTime", "desc"), limit(50));
    return onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      onUpdate(records);
    }, (error) => {
        console.error("History Error (Check Index):", error);
        onUpdate([]);
    });
  },

  subscribeToIncidents: (onUpdate: (incidents: any[]) => void): Unsubscribe => {
    const q = query(
      collection(db, "usageHistory"),
      where("resultStatus", "in", ["Unauthorized", "Interrupted", "Error"]),
      orderBy("startTime", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const incidents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      onUpdate(incidents);
    }, (error) => {
        console.error("Incidents Error (Check Index):", error);
        onUpdate([]);
    });
  },
  
  logAction: async (adminId: string, action: string, details: any) => {
    const logRef = collection(db, "adminLogs");
    return addDoc(logRef, {
      adminId,
      action,
      ...details,
      timestamp: serverTimestamp(),
    });
  }
};