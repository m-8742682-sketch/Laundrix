import { db, rtdb } from "@/services/firebase";
import { get, onValue, ref } from "firebase/database";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

export const queueDataSource = {
  /**
   * Subscribe to real-time queue AND machine updates merged together.
   *
   * BUG FIX: The original version only listened to the queues/{machineId}
   * doc, but currentUserId / nextUserId live on machines/{machineId}.
   * The QueueViewModel reads both fields from the callback data, so we
   * merge them here before calling back.
   */
  subscribeQueue(machineId: string, callback: (data: any) => void) {
    let queueData: any = null;
    let machineData: any = null;
    let rtdbData: any = null;

    const merge = () => {
      if (!queueData) return;
      // RTDB has the most real-time currentUserId from QR scan
      const currentUserId = rtdbData?.currentUserId ?? machineData?.currentUserId ?? null;
      callback({
        ...queueData,
        currentUserId,
        nextUserId: machineData?.nextUserId ?? null,
        machineStatus: machineData?.status ?? "Unknown",
      });
    };

    // Firestore: queue data
    const unsubQueue = onSnapshot(doc(db, "queues", machineId), (snap) => {
      queueData = snap.exists() ? snap.data() : { users: [], machineId };
      merge();
    });

    // Firestore: machine data (fallback)
    const unsubMachine = onSnapshot(doc(db, "machines", machineId), (snap) => {
      machineData = snap.exists() ? snap.data() : null;
      merge();
    });

    // RTDB: real-time currentUserId from QR scan (PRIMARY SOURCE)
    const unsubRTDB = onValue(ref(rtdb, `iot/${machineId}`), (snap) => {
      rtdbData = snap.exists() ? snap.val() : null;
      merge();
    });

    return () => {
      unsubQueue();
      unsubMachine();
      unsubRTDB();
    };
  },

  /**
   * Get queue data once (for manual refresh) — also merges machine data.
   */
  async getQueue(machineId: string): Promise<any | null> {
    try {
      const [queueSnap, machineSnap, rtdbSnap] = await Promise.all([
        getDoc(doc(db, "queues", machineId)),
        getDoc(doc(db, "machines", machineId)),
        get(ref(rtdb, `iot/${machineId}`)).catch(() => ({ exists: () => false, val: () => null })),
      ]);

      if (!queueSnap.exists()) return null;

      // RTDB has the most real-time currentUserId from QR scan
      const rtdbData = rtdbSnap.exists() ? rtdbSnap.val() : null;
      const currentUserId = rtdbData?.currentUserId 
        ?? (machineSnap.exists() ? machineSnap.data()?.currentUserId ?? null : null);

      return {
        ...queueSnap.data(),
        currentUserId,
        nextUserId: machineSnap.exists()
          ? machineSnap.data()?.nextUserId ?? null
          : null,
        machineStatus: machineSnap.exists()
          ? machineSnap.data()?.status ?? "Unknown"
          : "Unknown",
      };
    } catch (error) {
      console.error("[QueueDataSource] getQueue error:", error);
      return null;
    }
  },
};
