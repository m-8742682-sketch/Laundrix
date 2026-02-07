/**
 * Queue ViewModel
 * 
 * Manages queue state with Firestore subscription
 * and backend API calls for join/leave operations.
 */

import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { container } from "@/di/container";
import { joinQueue as apiJoinQueue, leaveQueue as apiLeaveQueue } from "@/services/api";

export function useQueueViewModel(
  machineId: string,
  userId?: string,
  userName?: string
) {
  const { queueRepository } = container;

  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<any>(null);
  const [queueUsers, setQueueUsers] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [inUseCount, setInUseCount] = useState(0);
  const [myPosition, setMyPosition] = useState<number | null>(null);

  // Subscribe to queue changes via Firestore
  useEffect(() => {
    if (!userId) return;

    const unsub = queueRepository.subscribe(machineId, (data) => {
      setQueue(data);

      const users = queueRepository.mapUsers(data.users ?? []);

      setQueueUsers(users);
      setWaitingCount(users.length);
      
      // Check if user is in queue
      const userInQueue = users.find((u) => u.userId === userId);
      setJoined(!!userInQueue);
      setMyPosition(userInQueue?.position ?? null);
      
      // Check if it's user's turn (they are currentUserId OR nextUserId)
      const isCurrentUser = data.currentUserId === userId;
      const isNextUser = data.nextUserId === userId;
      setIsMyTurn(isCurrentUser || isNextUser);
      
      setInUseCount(data.currentUserId ? 1 : 0);
    });

    return unsub;
  }, [machineId, userId]);

  /**
   * Join queue via backend API
   */
  const joinQueue = async () => {
    if (!userId || !userName) return;

    try {
      setLoading(true);
      const result = await apiJoinQueue(machineId, userId, userName);
      
      if (!result.success) {
        Alert.alert("Error", result.message || "Failed to join queue");
      }
      // Firestore subscription will update the UI automatically
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to join queue"
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Leave queue via backend API
   */
  const leaveQueue = async () => {
    if (!userId) return;

    try {
      setLoading(true);
      const result = await apiLeaveQueue(machineId, userId);
      
      if (!result.success) {
        Alert.alert("Error", result.message || "Failed to leave queue");
      }
      // Firestore subscription will update the UI automatically
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to leave queue"
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    queue,
    queueUsers,
    joined,
    isMyTurn,
    waitingCount,
    inUseCount,
    myPosition,
    loading,
    joinQueue,
    leaveQueue,
  };
}
