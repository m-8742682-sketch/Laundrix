import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/services/firebase";

export const chatDataSource = {
  subscribe(channel: string, cb: (msgs: any[]) => void) {
    const q = query(
      collection(db, "chats", channel, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        // 🔐 Guard after logout
        if (!auth.currentUser) return;

        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));

        cb(data);
      },
      error => {
        // 🔥 THIS IS THE FIX
        if (error.code === "permission-denied") {
          console.warn("Chat listener closed (logout)");
          return;
        }

        console.error("Chat snapshot error:", error);
      }
    );

    return unsubscribe;
  },

  sendText(channel: string, payload: any) {
    return addDoc(
      collection(db, "chats", channel, "messages"),
      {
        ...payload,
        createdAt: serverTimestamp(),
      }
    );
  },

  updateMessage(channel: string, id: string, data: any) {
    return updateDoc(
      doc(db, "chats", channel, "messages", id),
      data
    );
  },

  deleteMessage(channel: string, id: string) {
    return deleteDoc(
      doc(db, "chats", channel, "messages", id)
    );
  },
};