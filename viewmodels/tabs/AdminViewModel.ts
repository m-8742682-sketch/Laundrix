import { useState, useEffect, useRef, useCallback } from "react";
import { adminRepository } from "@/repositories/tabs/AdminRepository";

export const useAdminViewModel = (currentUserId: string) => {
  const [users, setUsers] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Analytics data
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [peakHours, setPeakHours] = useState<any[]>([]);
  const [userEngagement, setUserEngagement] = useState<number>(0);

  const unsubs = useRef<(() => void)[]>([]);

  // Calculate analytics on records change
  useEffect(() => {
    if (records.length > 0) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // ── Daily stats: use rawDate (reliable Date) not date (locale string) ──
      // Fill all 7 days even if count = 0 so the bar chart always has 7 bars
      const dateMap = new Map<string, { count: number; dateObj: Date }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
        dateMap.set(key, { count: 0, dateObj: new Date(d) });
      }
      records.forEach((r) => {
        try {
          const rd: Date = r.rawDate instanceof Date ? r.rawDate : new Date(r.rawDate);
          if (isNaN(rd.getTime())) return;
          if (rd >= sevenDaysAgo) {
            rd.setHours(0, 0, 0, 0);
            const key = rd.toISOString().slice(0, 10);
            const existing = dateMap.get(key);
            if (existing) existing.count++;
          }
        } catch {}
      });
      const daily = Array.from(dateMap.values())
        .map(({ count, dateObj }) => ({ date: dateObj.toISOString(), count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setDailyStats(daily);

      // ── Peak hours: use rawDate ──────────────────────────────────────────
      const hourMap = new Map<number, number>();
      records.forEach((r) => {
        try {
          const rd: Date = r.rawDate instanceof Date ? r.rawDate : new Date(r.rawDate);
          if (!isNaN(rd.getTime())) {
            const h = rd.getHours();
            hourMap.set(h, (hourMap.get(h) || 0) + 1);
          }
        } catch {}
      });
      const peaks = Array.from(hourMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setPeakHours(peaks);

      // ── User engagement: unique users with rawDate ───────────────────────
      const uniqueUsers = new Set(
        records.filter(r => {
          try {
            const rd: Date = r.rawDate instanceof Date ? r.rawDate : new Date(r.rawDate);
            return !isNaN(rd.getTime()) && rd >= sevenDaysAgo;
          } catch { return false; }
        }).map(r => r.userId)
      ).size;
      setUserEngagement(uniqueUsers);
    } else {
      // Fill 7 empty days so chart always renders
      const now = new Date();
      const emptyDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0, 0, 0, 0);
        return { date: d.toISOString(), count: 0 };
      });
      setDailyStats(emptyDays);
      setPeakHours([]);
      setUserEngagement(0);
    }
  }, [records]);

  useEffect(() => {
    setLoading(true);
    
    const u1 = adminRepository.subscribeToUsers(setUsers);
    const u2 = adminRepository.subscribeToHistory(setRecords);
    const u3 = adminRepository.subscribeToIncidents(setIncidents);
    const u4 = adminRepository.subscribeToMachines(setMachines);

    unsubs.current = [u1, u2, u3, u4];
    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubs.current.forEach(u => u());
      clearTimeout(timer);
    };
  }, []);

  const toggleAdmin = useCallback((userId: string, makeAdmin: boolean) => {
    adminRepository.updateUserRole(currentUserId, userId, makeAdmin);
  }, [currentUserId]);

  const deleteUser = useCallback((userId: string) => {
    adminRepository.deleteUser(currentUserId, userId);
  }, [currentUserId]);

  const toggleMachineControl = useCallback((machineId: string, key: "locked" | "buzzerState", value: boolean) => {
    adminRepository.toggleMachineControl(currentUserId, machineId, key, value);
  }, [currentUserId]);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Export utilities - returns data structures that can be used to create files
  const getExportData = useCallback(() => {
    return {
      records,
      users,
      machines,
      incidents,
      stats: {
        totalSessions: records.length,
        totalUsers: users.length,
        totalMachines: machines.length,
        totalIncidents: incidents.length,
        activeUsers: userEngagement,
        dailyStats,
        peakHours,
      }
    };
  }, [records, users, machines, incidents, userEngagement, dailyStats, peakHours]);

  return {
    users: filteredUsers,
    allUsers: users,
    records,
    incidents,
    machines,
    loading,
    searchQuery,
    setSearchQuery,
    toggleAdmin,
    deleteUser,
    toggleMachineControl,
    // Analytics
    dailyStats,
    peakHours,
    userEngagement,
    // Export function
    getExportData,
  };
};