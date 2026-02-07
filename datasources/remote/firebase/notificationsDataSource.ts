import {
  collection,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const notificationsDataSource = {
  async fetchByUser(userId: string) {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );

    return getDocs(q);
  },

  markAsRead(id: string) {
    return updateDoc(doc(db, "notifications", id), {
      read: true,
    });
  },
  delete(id: string) {
    return deleteDoc(doc(db, "notifications", id));
  }
};