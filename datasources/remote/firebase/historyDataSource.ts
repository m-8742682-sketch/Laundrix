import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const historyDataSource = {
  fetchByUser(userId: string) {
    const q = query(
      collection(db, "usageHistory"),
      where("userId", "==", userId),
      orderBy("startTime", "desc")
    );

    return getDocs(q);
  },
};