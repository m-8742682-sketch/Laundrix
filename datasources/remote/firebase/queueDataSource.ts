import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase";

export const queueDataSource = {
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
};