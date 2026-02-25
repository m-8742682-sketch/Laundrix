/**
 * History Repository — FIXED #7
 *
 * - getHistory(userId): user sees only their own records
 * - getAllHistory():    admin sees all records
 *
 * Handles both Firestore Timestamp and ISO string for startTime/endTime
 * (backend stores ISO strings; Firestore may return Timestamp after indexing).
 */

import { Timestamp } from "firebase/firestore";
import { historyDataSource } from "@/datasources/remote/firebase/historyDataSource";

export type UsageRecord = {
  id: string;
  userId: string;
  userName: string;
  machineId: string;
  startTime: Date;
  endTime: Date;
  duration: number;       // seconds
  resultStatus: "Normal" | "Unauthorized" | "Interrupted" | "";
  incidentId?: string | null;
};

function toDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === "string") return new Date(val);
  return new Date();
}

function mapDoc(doc: any): UsageRecord {
  const data = doc.data();
  return {
    id: doc.id,
    userId: data.userId ?? "",
    userName: data.userName ?? "Unknown",
    machineId: data.machineId ?? "",
    startTime: toDate(data.startTime),
    endTime: toDate(data.endTime),
    duration: data.duration ?? 0,
    resultStatus: data.resultStatus ?? "",
    incidentId: data.incidentId ?? null,
  };
}

export class HistoryRepository {
  /** For normal users — only their records */
  async getHistory(userId: string): Promise<UsageRecord[]> {
    const snapshot = await historyDataSource.fetchByUser(userId);
    return snapshot.docs.map(mapDoc);
  }

  /** For admins — all records */
  async getAllHistory(): Promise<UsageRecord[]> {
    const snapshot = await historyDataSource.fetchAll();
    return snapshot.docs.map(mapDoc);
  }
}
