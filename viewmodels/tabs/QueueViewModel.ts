/**
 * Queue ViewModel — FIXED VERSION
 *
 * FIX #2/#3: isMyTurn is true ONLY when no currentUserId (machine free) AND I am nextUserId.
 *            If someone is currently using the machine, isMyTurn = false for everyone in queue.
 * FIX #4:    Exposes currentUser (name, avatar, userId) so the queue page can show
 *            who is currently using the machine.
 * FIX #5:    One user one session - prevent users with active session from joining queue
 */

import { container } from "@/di/container";
import {
  joinQueue as serviceJoinQueue,
  leaveQueue as serviceLeaveQueue,
} from "@/services/queue.service";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

export type CurrentUserInfo = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

export type ActiveSessionInfo = {
  machineId: string;
  machineLocation?: string;
} | null;

export function useQueueViewModel(
  machineId: string,
  userId?: string,
  userName?: string,
  activeSession?: ActiveSessionInfo  // FIX #5: Add active session check
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

  const prevCurrentUserIdRef = useRef<string | null>(null);

  const updateQueueState = useCallback(
    (data: any) => {
      setQueue(data);

      const basicUsers = queueRepository.mapUsers(data.users ?? []);
      setQueueUsers(basicUsers);
      setWaitingCount(basicUsers.length);

      const userInQueue = basicUsers.find((u: any) => u.userId === userId);
      setJoined(!!userInQueue);
      setMyPosition(userInQueue?.position ?? null);

      // FIX #1: "It's your turn" ONLY when machine is FREE and user is nextUserId
      const machineInUse = !!data.currentUserId;
      const isNextUser = data.nextUserId === userId;
      setIsMyTurn(isNextUser && !machineInUse);

      const cid = data.currentUserId || null;
      setCurrentUserId(cid);
      setInUseCount(cid ? 1 : 0);

      // FIX #4: fetch current user profile — only when currentUserId actually changes
      if (cid !== prevCurrentUserIdRef.current) {
        prevCurrentUserIdRef.current = cid;
        if (cid) {
          queueRepository.getUserProfile(cid).then(profile => {
            setCurrentUser(profile
              ? { userId: cid, name: profile.name || profile.displayName || 'User', avatarUrl: profile.avatarUrl || null }
              : { userId: cid, name: 'User', avatarUrl: null });
          }).catch(() => {
            setCurrentUser({ userId: cid, name: 'User', avatarUrl: null });
          });
        } else {
          setCurrentUser(null);
        }
      }

      // Async avatar fetch for queue users (non-blocking)
      queueRepository.mapUsersWithAvatars(data.users ?? []).then(withAvatars => {
        setQueueUsers(withAvatars);
      }).catch(err => {
        console.warn("[QueueVM] Avatar fetch failed:", err);
      });
    },
    [queueRepository, userId]
  );

  useEffect(() => {
    if (!userId) return;
    // FIX #2: Fetch initial data immediately on mount so the queue state
    // is correct even after app reload (don't rely only on RTDB subscription)
    let isMounted = true;
    queueRepository.getQueue(machineId).then((data) => {
      if (data && isMounted) updateQueueState(data);
    }).catch(() => {});

    const unsub = queueRepository.subscribe(machineId, (data) => {
      updateQueueState(data);
      setRefreshing(false);
    });
    return () => {
      isMounted = false;
      unsub();
    };
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

    // FIX #5: Prevent user with active session from joining another queue
    if (activeSession) {
      Alert.alert(
        "Active Session",
        `You are already using machine ${activeSession.machineId}. Please complete your current session before joining another queue.`,
        [{ text: "OK" }]
      );
      return;
    }

    // FIX #5: Prevent joining queue for the same machine user is already using
    if (currentUserId === userId) {
      Alert.alert(
        "Already Using Machine",
        `You are already using machine ${machineId}.`,
        [{ text: "OK" }]
      );
      return;
    }

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
      const code = err?.code ?? err?.data?.code;
      // Don't show alert for network timeout — optimistic UI already rolled back
      const isTimeout = err?.name === 'AbortError' || (err?.message ?? '').toLowerCase().includes('timed out');
      if (!isTimeout) {
        if (code === 'ALREADY_USING_MACHINE' || code === 'ALREADY_IN_OTHER_QUEUE') {
          Alert.alert("One Machine at a Time", err?.message ?? "You already have an active session or queue spot.");
        } else {
          Alert.alert("Error", err?.message ?? "Failed to join queue");
        }
      }
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }, [userId, userName, machineId, loading, joined, queueUsers, waitingCount, generateIdempotencyKey, activeSession, currentUserId]);

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
      const isTimeout = err?.name === 'AbortError' || (err?.message ?? '').toLowerCase().includes('timed out');
      if (!isTimeout) {
        Alert.alert("Error", err?.message ?? "Failed to leave queue");
      }
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