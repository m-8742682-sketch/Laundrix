import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

export const queueDataSource = {
  /**
   * Subscribe to real-time queue updates
   */
  subscribeQueue(
    machineId: string,
    callback: (data: any) => void
  ) {
    return onSnapshot(doc(db, "queues", machineId), snap => {
      if (snap.exists()) {
        callback(snap.data());
      }
    });
  },

  /**
   * Get queue data once (for manual refresh)
   */
  async getQueue(machineId: string): Promise<any | null> {
    try {
      const docRef = doc(db, "queues", machineId);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (error) {
      console.error("[QueueDataSource] getQueue error:", error);
      return null;
    }
  },
};
