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
      const mapped = raw.map((r: any) => {
        // duration is stored in SECONDS by the backend — convert to minutes for display
        const durationSecs = r.duration || 0;
        const durationMins = durationSecs > 0 ? Math.round(durationSecs / 60) : 0;
        // rawDate: reliable Date object for grouping/sorting (not locale string)
        let rawDate: Date;
        try {
          rawDate = r.startTime?.toDate ? r.startTime.toDate() : new Date(r.startTime);
          if (isNaN(rawDate.getTime())) rawDate = new Date();
        } catch { rawDate = new Date(); }
        return {
          id: r.id,
          userId: r.userId,
          user: r.userId ? r.userId.slice(0, 5) + "..." : "User",
          machineId: r.machineId,
          duration: durationMins,          // minutes for display
          durationSecs,                    // seconds for avg calculation
          load: r.load || 0,
          status: r.resultStatus || "Completed",
          date: formatTime(r.startTime),   // human-readable string for display
          rawDate,                         // reliable Date for chart grouping
        };
      });
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
    const [rawUsers, rawMachines, rawRecords] = await Promise.all([
      adminDataSource.getUsersOnce(),
      adminDataSource.getMachinesOnce(),
      adminDataSource.getHistoryOnce(),
    ]);

    const now          = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parse each record the same way subscribeToHistory does
    const records = rawRecords.map((r: any) => {
      const durationSecs = r.duration || 0;
      const durationMins = durationSecs > 0 ? Math.round(durationSecs / 60) : 0;
      let rawDate: Date;
      try {
        rawDate = r.startTime?.toDate ? r.startTime.toDate() : new Date(r.startTime);
        if (isNaN(rawDate.getTime())) rawDate = new Date();
      } catch { rawDate = new Date(); }
      return {
        id: r.id,
        userId: r.userId || '',
        user: r.userId ? r.userId.slice(0, 6) + '...' : 'Unknown',
        machineId: r.machineId,
        duration: durationMins,
        durationSecs,
        load: r.load || 0,
        status: r.resultStatus || 'Completed',
        date: formatTime(r.startTime),
        rawDate,
      };
    });

    // Avg duration in minutes (durationSecs → minutes)
    const totalSecs      = records.reduce((s: number, r: any) => s + (r.durationSecs || 0), 0);
    const avgDurationMin = records.length > 0 ? Math.round(totalSecs / records.length / 60) : 0;

    // Daily stats — fill all 7 days
    const dateMap = new Map<string, { count: number; dateObj: Date }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      dateMap.set(d.toISOString().slice(0, 10), { count: 0, dateObj: new Date(d) });
    }
    records.forEach((r: any) => {
      const rd: Date = r.rawDate;
      if (rd >= sevenDaysAgo) {
        const d = new Date(rd); d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10);
        const ex = dateMap.get(key);
        if (ex) ex.count++;
      }
    });
    const dailyStats = Array.from(dateMap.values())
      .map(({ count, dateObj }) => ({ date: dateObj.toISOString(), count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Peak hours
    const hourMap = new Map<number, number>();
    records.forEach((r: any) => { const h = (r.rawDate as Date).getHours(); hourMap.set(h, (hourMap.get(h) || 0) + 1); });
    const peakHours = Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Active users (7d)
    const activeUserIds = new Set(
      records.filter((r: any) => (r.rawDate as Date) >= sevenDaysAgo).map((r: any) => r.userId)
    ).size;

    const totalSessions      = records.length;
    const normalCount        = records.filter((r: any) => r.status === 'Normal').length;
    const unauthorizedCount  = records.filter((r: any) => r.status === 'Unauthorized').length;
    const incidentCount      = records.filter((r: any) => ['Unauthorized', 'Interrupted', 'Error'].includes(r.status)).length;
    const completionRate     = totalSessions > 0 ? Math.round((normalCount / totalSessions) * 100) : 0;

    return {
      generatedAt: new Date().toLocaleString(),
      stats: {
        totalSessions,
        totalUsers: rawUsers.length,
        totalMachines: rawMachines.length,
        activeUsers: activeUserIds,
        averageDuration: `${avgDurationMin} min`,
        completionRate: `${completionRate}%`,
        unauthorizedCount,
        totalIncidents: incidentCount,
        peakHours,
        dailyStats,
      },
      records,
    };
  },
};