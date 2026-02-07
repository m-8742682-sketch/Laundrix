import { Timestamp } from "firebase/firestore";
import { dashboardDataSource } from "@/datasources/remote/firebase/dashboardDataSource";
import type { Machine, MachineStatus } from "@/domain/machine/Machine";

export class DashboardRepository {
  async getAll(): Promise<Machine[]> {
    const snap = await dashboardDataSource.fetchAll();

    return snap.docs.map(doc => {
      const d = doc.data();

      return {
        machineId: doc.id,
        location: d.location ?? null,
        status: d.status as MachineStatus,

        currentLoad: d.currentLoad ?? 0,
        vibrationLevel: d.vibrationLevel ?? 0,

        currentUserId: d.currentUserId ?? null,

        unauthorizedFlag: Boolean(d.unauthorizedFlag),
        buzzerActive: Boolean(d.buzzerActive),

        lastUpdated: (d.lastUpdated as Timestamp).toDate(),
        estimatedEndTime: d.estimatedEndTime
          ? (d.estimatedEndTime as Timestamp).toDate()
          : null,
      };
    });
  }

  /* ---------- DERIVED STATE ---------- */

  getStats(machines: Machine[]) {
    return {
      available: machines.filter(
        m => m.status === "Available"
      ).length,

      inUse: machines.filter(
        m => m.status === "In Use"
      ).length,

      unauthorized: machines.filter(
        m => m.unauthorizedFlag
      ).length,
    };
  }

  getPrimaryMachine(machines: Machine[]) {
    return machines[0] ?? null;
  }
}