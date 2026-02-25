/**
 * Queue ViewModel — FIXED VERSION
 *
 * FIX #2/#3: isMyTurn is true ONLY when no currentUserId (machine free) AND I am nextUserId.
 *            If someone is currently using the machine, isMyTurn = false for everyone in queue.
 * FIX #4:    Exposes currentUser (name, avatar, userId) so the queue page can show
 *            who is currently using the machine.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Alert } from "react-native";
import { container } from "@/di/container";
import {
  joinQueue as serviceJoinQueue,
  leaveQueue as serviceLeaveQueue,
} from "@/services/queue.service";

export type CurrentUserInfo = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export function useQueueViewModel(
  machineId: string,
  userId?: string,
  userName?: string
) {
  const { queueRepository } = container;

  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<"join" | "leave" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [queue, setQueue] = useState<any>(null);
  const [queueUsers, setQueueUsers] = useState<any[]>([]);
  const [joined, setJoined] = useState(false);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [inUseCount, setInUseCount] = useState(0);
  const [myPosition, setMyPosition] = useState<number | null>(null);

  // FIX #4: current user info for display in queue list
  const [currentUser, setCurrentUser] = useState<CurrentUserInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const generateIdempotencyKey = useCallback(() =>
    `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, []);

  const updateQueueState = useCallback(
    async (data: any) => {
      setQueue(data);

      const basicUsers = queueRepository.mapUsers(data.users ?? []);
      setQueueUsers(basicUsers);
      setWaitingCount(basicUsers.length);

      const userInQueue = basicUsers.find((u: any) => u.userId === userId);
      setJoined(!!userInQueue);
      setMyPosition(userInQueue?.position ?? null);

      const isCurrentUser = data.currentUserId === userId;
      const isNextUser = data.nextUserId === userId;

      // FIX #2/#3: only "your turn" if the machine is FREE (no currentUserId)
      // and you are the nextUserId.  currentUser themselves also get true so
      // they can re-enter via QR while their session is active.
      const machineInUse = !!data.currentUserId;
      setIsMyTurn(isCurrentUser || (isNextUser && !machineInUse));

      const cid = data.currentUserId || null;
      setCurrentUserId(cid);
      setInUseCount(cid ? 1 : 0);

      // FIX #4: fetch current user details for display
      if (cid) {
        try {
          const profile = await queueRepository.getUserProfile(cid);
          setCurrentUser(profile ? { userId: cid, name: profile.name || profile.displayName || 'User', avatarUrl: profile.avatarUrl || null } : { userId: cid, name: 'Unknown', avatarUrl: null });
        } catch {
          setCurrentUser({ userId: cid, name: 'User', avatarUrl: null });
        }
      } else {
        setCurrentUser(null);
      }

      // Async avatar fetch for queue users
      try {
        const withAvatars = await queueRepository.mapUsersWithAvatars(data.users ?? []);
        setQueueUsers(withAvatars);
      } catch (err) {
        console.warn("[QueueVM] Avatar fetch failed:", err);
      }
    },
    [queueRepository, userId]
  );

  useEffect(() => {
    if (!userId) return;
    const unsub = queueRepository.subscribe(machineId, (data) => {
      updateQueueState(data);
      setRefreshing(false);
    });
    return unsub;
  }, [machineId, userId, updateQueueState, queueRepository]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const data = await queueRepository.getQueue(machineId);
      if (data) await updateQueueState(data);
    } catch (err) {
      console.error("[QueueVM] Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [machineId, userId, queueRepository, updateQueueState]);

  const joinQueue = useCallback(async () => {
    if (!userId || !userName) return;
    if (loading) return;

    const prevJoined = joined;
    const prevQueueUsers = queueUsers;
    const prevWaitingCount = waitingCount;
    const idempotencyKey = generateIdempotencyKey();

    try {
      setLoading(true);
      setPendingAction("join");
      const optimisticPosition = queueUsers.length + 1;
      setJoined(true);
      setMyPosition(optimisticPosition);
      setWaitingCount(optimisticPosition);
      setQueueUsers([...queueUsers, { userId, name: userName, joinedAt: new Date(), position: optimisticPosition, queueToken: idempotencyKey, avatarUrl: null }]);
      await serviceJoinQueue(machineId, userId, userName, idempotencyKey);
    } catch (err: any) {
      setJoined(prevJoined);
      setQueueUsers(prevQueueUsers);
      setWaitingCount(prevWaitingCount);
      setMyPosition(null);
      Alert.alert("Error", err?.message ?? "Failed to join queue");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }, [userId, userName, machineId, loading, joined, queueUsers, waitingCount, generateIdempotencyKey]);

  const leaveQueue = useCallback(async () => {
    if (!userId) return;
    if (loading) return;

    const prevJoined = joined;
    const prevQueueUsers = queueUsers;
    const prevWaitingCount = waitingCount;
    const prevMyPosition = myPosition;

    try {
      setLoading(true);
      setPendingAction("leave");
      setJoined(false);
      setMyPosition(null);
      setQueueUsers(queueUsers.filter((u) => u.userId !== userId));
      setWaitingCount(Math.max(0, waitingCount - 1));
      await serviceLeaveQueue(machineId, userId);
    } catch (err: any) {
      setJoined(prevJoined);
      setQueueUsers(prevQueueUsers);
      setWaitingCount(prevWaitingCount);
      setMyPosition(prevMyPosition);
      Alert.alert("Error", err?.message ?? "Failed to leave queue");
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }, [userId, machineId, loading, joined, queueUsers, waitingCount, myPosition]);

  return {
    queue,
    queueUsers,
    joined,
    pendingAction,
    isMyTurn,
    waitingCount,
    inUseCount,
    myPosition,
    currentUser,    // FIX #4: the user currently using the machine
    currentUserId,
    loading,
    refreshing,
    refresh,
    joinQueue,
    leaveQueue,
  };
}
