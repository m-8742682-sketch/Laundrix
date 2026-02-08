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
  /**
   * Subscribe to real-time queue updates
   */
  subscribe(machineId: string, onUpdate: (state: any) => void) {
    return queueDataSource.subscribeQueue(machineId, onUpdate);
  }

  /**
   * Get queue data once (for manual refresh)
   */
  async getQueue(machineId: string): Promise<any | null> {
    return queueDataSource.getQueue(machineId);
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
