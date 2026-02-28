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
      // Calculate daily stats (last 7 days)
      const dateMap = new Map<string, number>();
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      records.forEach((r) => {
        try {
          const recordDate = new Date(r.date);
          if (recordDate >= sevenDaysAgo) {
            const dateKey = recordDate.toLocaleDateString();
            dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1);
          }
        } catch (e) {
          console.warn("Invalid date in record:", r.date);
        }
      });
      
      const daily = Array.from(dateMap.entries()).map(([date, count]) => ({ date, count }));
      setDailyStats(daily.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));

      // Calculate peak hours (24 hour format)
      const hourMap = new Map<number, number>();
      records.forEach((r) => {
        try {
          const recordDate = new Date(r.date);
          const hour = recordDate.getHours();
          hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
        } catch (e) {
          console.warn("Invalid date for hour calculation:", r.date);
        }
      });
      
      const peaks = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }));
      setPeakHours(peaks.sort((a, b) => b.count - a.count).slice(0, 5));

      // User engagement (unique users in last 7 days)
      const uniqueUsers = new Set(
        records
          .filter(r => {
            try {
              const recordDate = new Date(r.date);
              return recordDate >= sevenDaysAgo;
            } catch {
              return false;
            }
          })
          .map(r => r.userId)
      ).size;
      setUserEngagement(uniqueUsers);
    } else {
      setDailyStats([]);
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