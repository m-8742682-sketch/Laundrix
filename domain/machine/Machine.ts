export type MachineStatus =
  | "Available"
  | "Clothes Inside"
  | "In Use"
  | "Unauthorized Use";

export type Machine = {
  machineId: string;                 
  location: string | null;
  status: MachineStatus;

  currentLoad: number;
  vibrationLevel: number;

  currentUserId: string | null;

  unauthorizedFlag: boolean;
  buzzerActive: boolean;

  lastUpdated: Date;
  estimatedEndTime: Date | null;
};