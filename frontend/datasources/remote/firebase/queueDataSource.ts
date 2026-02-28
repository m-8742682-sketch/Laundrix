import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

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

    const merge = () => {
      if (!queueData) return;
      callback({
        ...queueData,
        currentUserId: machineData?.currentUserId ?? null,
        nextUserId: machineData?.nextUserId ?? null,
        machineStatus: machineData?.status ?? "Unknown",
      });
    };

    const unsubQueue = onSnapshot(doc(db, "queues", machineId), (snap) => {
      queueData = snap.exists() ? snap.data() : { users: [], machineId };
      merge();
    });

    const unsubMachine = onSnapshot(doc(db, "machines", machineId), (snap) => {
      machineData = snap.exists() ? snap.data() : null;
      merge();
    });

    return () => {
      unsubQueue();
      unsubMachine();
    };
  },

  /**
   * Get queue data once (for manual refresh) — also merges machine data.
   */
  async getQueue(machineId: string): Promise<any | null> {
    try {
      const [queueSnap, machineSnap] = await Promise.all([
        getDoc(doc(db, "queues", machineId)),
        getDoc(doc(db, "machines", machineId)),
      ]);

      if (!queueSnap.exists()) return null;

      return {
        ...queueSnap.data(),
        currentUserId: machineSnap.exists()
          ? machineSnap.data()?.currentUserId ?? null
          : null,
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
