import { Timestamp } from "firebase/firestore";
import { historyDataSource } from "@/datasources/remote/firebase/historyDataSource";

export type UsageRecord = {
  id: string;
  machineId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  load: number;
  resultStatus: "Normal" | "Unauthorized" | "Interrupted" | "";
};

export class HistoryRepository {
  async getHistory(userId: string): Promise<UsageRecord[]> {
    const snapshot =
      await historyDataSource.fetchByUser(userId);

    return snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        machineId: data.machineId,
        startTime: (data.startTime as Timestamp).toDate(),
        endTime: (data.endTime as Timestamp).toDate(),
        duration: data.duration,
        load: data.load,
        resultStatus: data.resultStatus ?? "",
      };
    });
  }
}