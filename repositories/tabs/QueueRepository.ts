import { queueDataSource } from "@/datasources/remote/firebase/queueDataSource";
import { joinQueue, leaveQueue } from "@/services/queue.service";

export type QueueUser = {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  joinedAt: Date;
  queueToken: string;
  position: number;
};

export class QueueRepository {
  subscribe(machineId: string, onUpdate: (state: any) => void) {
    return queueDataSource.subscribeQueue(machineId, onUpdate);
  }

  async join(machineId: string, userId: string) {
    return joinQueue(machineId, userId);
  }

  async leave(machineId: string, userId: string) {
    return leaveQueue(machineId, userId);
  }

  mapUsers(rawUsers: any[]): QueueUser[] {
    return (rawUsers ?? [])
      .sort((a, b) => a.position - b.position)
      .map(u => ({
        ...u,
        joinedAt: u.joinedAt?.toDate?.() ?? new Date(),
      }));
  }
}