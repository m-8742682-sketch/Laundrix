/**
 * Shared App Types
 *
 * Single source of truth for all shared types.
 * Previously duplicated across:
 *   - types/UserProfile.ts       (used `id` field)
 *   - components/UserContext.tsx (used `uid` field — inconsistent)
 *   - domain/machine/Machine.ts  (re-defined Machine independently)
 *   - services/machine.service.ts (re-defined MachineStatus, Machine, IoTData)
 *
 * Resolution: uid everywhere (aligns with Firebase Auth).
 */

// ─── User ─────────────────────────────────────────────────────────────────────

export type UserRole = "user" | "admin";

export type UserProfile = {
  uid: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  contact?: string;
  role: UserRole;
  isVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  // Student academic fields
  practicum?: string;    // 学生班级
  matricCard?: string;   // Matric card number
  icNumber?: string;     // IC Number
};

// ─── Machine ──────────────────────────────────────────────────────────────────

export type MachineStatus =
  | "Available"
  | "Clothes Inside"
  | "In Use"
  | "Unauthorized Use";

export type Machine = {
  machineId: string;
  location: string | null;
  status: MachineStatus;
  locked: boolean;
  lastPing: number;
  currentLoad: number;
  vibrationLevel: number;
  currentUserId: string | null;
  unauthorizedFlag: boolean;
  buzzerActive: boolean;
  lastUpdated: Date;
  estimatedEndTime: Date | null;
  isLive: boolean;
};

// Raw IoT data shape from RTDB
export type IoTData = {
  load: number;
  vibration: number;
  buzzerState: boolean;
  lastPing: number;
  locked: boolean;
  state: string;
  location: string | null;
  isLive: boolean;
  currentUserId?: string | null;
};

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "queue"
  | "unauthorized"
  | "laundry"
  | "system"
  | "chat"
  | "auth"
  | "verification"
  | "missedCall"
  | "missedVideo"
  | "incomingCall"
  | "incomingVideo";
