/**
 * Queue ViewModel
 * 
 * Manages queue state with Firestore subscription
 * and backend API calls for join/leave operations.
 * 
 * OPTIMIZATIONS:
 * - Optimistic UI updates for faster perceived performance
 * - Rollback on error
 * - Debouncing to prevent rapid clicking
 */

import { useEffect, useState, useRef, useCallback } from "react";
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
  const [pendingAction, setPendingAction] = useState<'join' | 'leave' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<any>(null);
  const [queueUsers, setQueueUsers] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [inUseCount, setInUseCount] = useState(0);
  const [myPosition, setMyPosition] = useState<number | null>(null);

  // Debouncing refs
  const lastActionTime = useRef(0);
  const DEBOUNCE_MS = 1000;

  // Update queue state from data
  const updateQueueState = useCallback(async (data: any) => {
    setQueue(data);

    // First update with basic user data (no avatars)
    const basicUsers = queueRepository.mapUsers(data.users ?? []);
    setQueueUsers(basicUsers);
    setWaitingCount(basicUsers.length);
    
    // Check if user is in queue
    const userInQueue = basicUsers.find((u) => u.userId === userId);
    setJoined(!!userInQueue);
    setMyPosition(userInQueue?.position ?? null);
    
    // Check if it's user's turn (they are currentUserId OR nextUserId)
    const isCurrentUser = data.currentUserId === userId;
    const isNextUser = data.nextUserId === userId;
    setIsMyTurn(isCurrentUser || isNextUser);
    
    setInUseCount(data.currentUserId ? 1 : 0);

    // Then fetch avatars asynchronously and update
    try {
      const usersWithAvatars = await queueRepository.mapUsersWithAvatars(data.users ?? []);
      setQueueUsers(usersWithAvatars);
    } catch (err) {
      console.warn("[QueueVM] Failed to fetch avatars:", err);
    }
  }, [queueRepository, userId]);

  // Subscribe to queue changes via Firestore
  useEffect(() => {
    if (!userId) return;

    const unsub = queueRepository.subscribe(machineId, (data) => {
      updateQueueState(data);
      setRefreshing(false);
    });

    return unsub;
  }, [machineId, userId, updateQueueState, queueRepository]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!userId) return;
    
    setRefreshing(true);
    try {
      // The subscription will automatically update, but we can also fetch directly
      const data = await queueRepository.getQueue(machineId);
      if (data) {
        updateQueueState(data);
      }
    } catch (error) {
      console.error("[QueueVM] Refresh failed:", error);
    } finally {
      setRefreshing(false);
    }
  }, [machineId, userId, queueRepository, updateQueueState]);

  /**
   * Join queue via backend API with optimistic update
   */
  const joinQueue = async () => {
    if (!userId || !userName) return;

    // Debounce to prevent rapid clicking
    const now = Date.now();
    if (now - lastActionTime.current < DEBOUNCE_MS) {
      return;
    }
    lastActionTime.current = now;

    // Store previous state for rollback
    const previousJoined = joined;
    const previousQueueUsers = queueUsers;
    const previousWaitingCount = waitingCount;

    try {
      setLoading(true);
      setPendingAction('join');

      // Optimistic update - immediately show user in queue
      setJoined(true);
      const optimisticPosition = queueUsers.length + 1;
      setMyPosition(optimisticPosition);
      setWaitingCount(optimisticPosition);

      // Show optimistic user in queue list
      const optimisticUser = {
        userId,
        name: userName,
        joinedAt: new Date(),
        position: optimisticPosition,
        queueToken: `temp-${Date.now()}`,
        avatarUrl: null,
      };
      setQueueUsers([...queueUsers, optimisticUser]);

      // Call backend API
      const result = await apiJoinQueue(machineId, userId, userName);
      
      if (!result.success) {
        // Rollback on error
        setJoined(previousJoined);
        setQueueUsers(previousQueueUsers);
        setWaitingCount(previousWaitingCount);
        setMyPosition(null);
        
        Alert.alert("Error", result.message || "Failed to join queue");
      }
      // Firestore subscription will update the UI with real data
    } catch (err: any) {
      // Rollback on error
      setJoined(previousJoined);
      setQueueUsers(previousQueueUsers);
      setWaitingCount(previousWaitingCount);
      setMyPosition(null);
      
      Alert.alert(
        "Error",
        err?.message ?? "Failed to join queue. Please try again."
      );
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  /**
   * Leave queue via backend API with optimistic update
   */
  const leaveQueue = async () => {
    if (!userId) return;

    // Debounce to prevent rapid clicking
    const now = Date.now();
    if (now - lastActionTime.current < DEBOUNCE_MS) {
      return;
    }
    lastActionTime.current = now;

    // Store previous state for rollback
    const previousJoined = joined;
    const previousQueueUsers = queueUsers;
    const previousWaitingCount = waitingCount;
    const previousMyPosition = myPosition;

    try {
      setLoading(true);
      setPendingAction('leave');

      // Optimistic update - immediately remove user from queue
      setJoined(false);
      setMyPosition(null);
      setQueueUsers(queueUsers.filter((u) => u.userId !== userId));
      setWaitingCount(Math.max(0, waitingCount - 1));

      // Call backend API
      const result = await apiLeaveQueue(machineId, userId);
      
      if (!result.success) {
        // Rollback on error
        setJoined(previousJoined);
        setQueueUsers(previousQueueUsers);
        setWaitingCount(previousWaitingCount);
        setMyPosition(previousMyPosition);
        
        Alert.alert("Error", result.message || "Failed to leave queue");
      }
      // Firestore subscription will update the UI with real data
    } catch (err: any) {
      // Rollback on error
      setJoined(previousJoined);
      setQueueUsers(previousQueueUsers);
      setWaitingCount(previousWaitingCount);
      setMyPosition(previousMyPosition);
      
      Alert.alert(
        "Error",
        err?.message ?? "Failed to leave queue. Please try again."
      );
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  return {
    queue,
    queueUsers,
    joined,
    pendingAction,
    isMyTurn,
    waitingCount,
    inUseCount,
    myPosition,
    loading,
    refreshing,
    refresh,
    joinQueue,
    leaveQueue,
  };
}
