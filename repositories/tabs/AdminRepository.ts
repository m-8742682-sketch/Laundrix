import { adminDataSource } from "@/datasources/remote/firebase/adminDataSource";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  contact: string;
  avatarUrl?: string | null;
  role: string;
  isAdmin: boolean;
  lastActive: string;
  practicum?: string;
  matricCard?: string;
  icNumber?: string;
};

export type MachineState = {
  id: string;
  name: string;
  status: string;
  isLive: boolean;
  load: number;
  vibration: number;
  locked: boolean;
  buzzer: boolean;
};

const formatTime = (ts: any): string => {
  if (!ts) return "N/A";
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  } catch (e) {
    return "Invalid Date";
  }
};

export const adminRepository = {
  subscribeToUsers: (callback: (users: AdminUser[]) => void) => {
    return adminDataSource.subscribeToUsers((rawUsers) => {
      const mapped = rawUsers.map((u: any) => ({
        id: u.id,
        name: u.name || "No Name",
        email: u.email || "-",
        contact: u.contact || "-",
        avatarUrl: u.avatarUrl || null,
        role: u.role,
        isAdmin: u.role === "admin",
        lastActive: u.updatedAt ? formatTime(u.updatedAt) : "Unknown",
        practicum: u.practicum || "",
        matricCard: u.matricCard || "",
        icNumber: u.icNumber || "",
      }));
      callback(mapped);
    });
  },

  updateUserRole: (adminId: string, targetUserId: string, makeAdmin: boolean) => {
    adminDataSource.logAction(adminId, makeAdmin ? "PROMOTE_USER" : "DEMOTE_USER", { targetUserId });
    return adminDataSource.updateUserRole(targetUserId, makeAdmin);
  },

  deleteUser: (adminId: string, userId: string) => {
    adminDataSource.logAction(adminId, "DELETE_USER", { targetUserId: userId });
    return adminDataSource.deleteUser(userId);
  },

  // CRITICAL FIX: Individual IoT subscriptions per machine
  subscribeToMachines: (callback: (machines: MachineState[]) => void) => {
    let machineConfigs: any[] = [];
    let iotStates: Record<string, any> = {};
    const iotUnsubs: Record<string, () => void> = {};

    const emit = () => {
      const merged = machineConfigs.map((m) => {
        const live = iotStates[m.id] || {};
        const now = Date.now();
        const lastPing = live.lastPing || 0;
        
        // Calculate if live (last 90 seconds)
        const isLive = live.isLive !== undefined 
          ? live.isLive 
          : (now - lastPing < 90000);

        return {
          id: m.id,
          name: m.machineId || m.id,
          status: m.status || (isLive ? "Online" : "Offline"),
          isLive: isLive,
          // Direct mapping from RTDB (Matches machineId.tsx)
          load: live.load ?? 0,
          vibration: live.vibration ?? 0,
          locked: live.locked ?? false,
          // Map buzzerState -> buzzer
          buzzer: live.buzzerState ?? false,
        };
      });
      callback(merged);
    };

    // 1. Listen to Firestore for machine list/config
    const unsubFirestore = adminDataSource.subscribeToMachineConfigs((configs) => {
      machineConfigs = configs;
      
      // Setup/Teardown individual IoT listeners
      const currentIds = new Set(configs.map(m => m.id));
      
      // Remove listeners for deleted machines
      Object.keys(iotUnsubs).forEach(id => {
        if (!currentIds.has(id)) {
          iotUnsubs[id]();
          delete iotUnsubs[id];
          delete iotStates[id];
        }
      });
      
      // Add listeners for new machines
      configs.forEach(m => {
        if (!iotUnsubs[m.id]) {
          iotUnsubs[m.id] = adminDataSource.subscribeToMachineIoT(m.id, (data) => {
            iotStates[m.id] = data || {};
            emit();
          });
        }
      });
      
      emit();
    });

    return () => {
      unsubFirestore();
      Object.values(iotUnsubs).forEach(unsub => unsub());
    };
  },

  toggleMachineControl: (adminId: string, machineId: string, key: "locked" | "buzzerState", value: boolean) => {
    adminDataSource.logAction(adminId, `TOGGLE_${key.toUpperCase()}`, { machineId, reason: `Set to ${value}` });
    return adminDataSource.toggleIoTControl(machineId, key, value);
  },

  // ... subscribeToHistory and subscribeToIncidents remain the same
  subscribeToHistory: (callback: (records: any[]) => void) => {
    return adminDataSource.subscribeToHistory((raw) => {
      const mapped = raw.map((r: any) => ({
        id: r.id, userId: r.userId, user: r.userId ? r.userId.slice(0, 5) + "..." : "User",
        machineId: r.machineId, duration: r.duration || 0, load: r.load || 0,
        status: r.resultStatus || "Completed", date: formatTime(r.startTime),
      }));
      callback(mapped);
    });
  },

  subscribeToIncidents: (callback: (records: any[]) => void) => {
    return adminDataSource.subscribeToIncidents((raw) => {
      const mapped = raw.map((r: any) => ({
        id: r.id, type: r.resultStatus, userId: r.userId,
        user: r.userId ? r.userId.slice(0, 6) + "..." : "Unknown",
        machine: r.machineId, resolved: r.resultStatus === "Resolved",
        date: formatTime(r.startTime),
      }));
      callback(mapped);
    });
  },


  // --- EXPORT DATA LOGIC ---
  getExportData: async () => {
    // 1. Fetch raw data
    const [rawUsers, rawMachines, rawRecords] = await Promise.all([
      adminDataSource.getUsersOnce(),
      adminDataSource.getMachinesOnce(),
      adminDataSource.getHistoryOnce(),
    ]);

    // 2. Calculate Analytics
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Average Duration
    const totalDuration = rawRecords.reduce((sum, r) => sum + (r.duration || 0), 0);
    const averageDuration = rawRecords.length > 0 ? Math.round(totalDuration / rawRecords.length) : 0;

    // Peak Hours (Count sessions per hour)
    const hourMap = new Map<number, number>();
    rawRecords.forEach((r) => {
      try {
        const date = r.startTime?.toDate ? r.startTime.toDate() : new Date(r.startTime);
        const hour = date.getHours();
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
      } catch (e) {}
    });
    const peakHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour: `${hour}:00`, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily Stats (Last 7 days)
    const dateMap = new Map<string, number>();
    rawRecords.forEach((r) => {
      try {
        const date = r.startTime?.toDate ? r.startTime.toDate() : new Date(r.startTime);
        if (date >= sevenDaysAgo) {
          const key = date.toLocaleDateString();
          dateMap.set(key, (dateMap.get(key) || 0) + 1);
        }
      } catch (e) {}
    });
    const dailyStats = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Active Users (Unique users in last 7 days)
    const activeUserIds = new Set(
      rawRecords
        .filter((r) => {
          try {
            const date = r.startTime?.toDate ? r.startTime.toDate() : new Date(r.startTime);
            return date >= sevenDaysAgo;
          } catch { return false; }
        })
        .map((r) => r.userId)
    ).size;

    // FIX 1: Calculate Total Incidents
    const totalIncidents = rawRecords.filter((r) => 
      ["Unauthorized", "Interrupted", "Error"].includes(r.resultStatus)
    ).length;

    // 3. Format Records for Export
    const records = rawRecords.map((r) => ({
      id: r.id,
      user: r.userId ? r.userId.slice(0, 6) + "..." : "Unknown",
      machineId: r.machineId,
      duration: r.duration || 0,
      load: r.load || 0,
      status: r.resultStatus || "Completed",
      date: formatTime(r.startTime),
    }));

    // 4. Return Final Structure
    return {
      generatedAt: new Date().toLocaleString(),
      stats: {
        totalSessions: rawRecords.length,
        totalUsers: rawUsers.length,
        totalMachines: rawMachines.length,
        activeUsers: activeUserIds,
        averageDuration: `${averageDuration} min`,
        peakHours: peakHours,
        dailyStats: dailyStats,
        totalIncidents: totalIncidents, // FIX 2: Add to returned object
      },
      records: records,
    };
  },
};