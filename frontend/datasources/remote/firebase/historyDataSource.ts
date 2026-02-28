/**
 * History DataSource — FIXED #7
 *
 * - fetchByUser: user can only see their own records
 * - fetchAll: admin sees every record (all users, ordered by startTime desc)
 * Both filter on the `usageHistory` Firestore collection.
 */

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/services/firebase";

export const historyDataSource = {
  /** Normal users — see only their own sessions */
  fetchByUser(userId: string) {
    const q = query(
      collection(db, "usageHistory"),
      where("userId", "==", userId),
      orderBy("startTime", "desc"),
      limit(200)
    );
    return getDocs(q);
  },

  /** Admin — see all sessions across all users */
  fetchAll() {
    const q = query(
      collection(db, "usageHistory"),
      orderBy("startTime", "desc"),
      limit(1000)
    );
    return getDocs(q);
  },
};
