/**
 * Queue Repository
 *
 * KEY FIX vs original:
 * - Avatar cache now uses AsyncStorage with 24-hour TTL
 * - In-memory module-level cache was reset on every app restart
 *   causing N Firestore reads on every queue load
 * - mapUsersWithAvatars checks avatarUrl already on the queue doc first
 *   (populated by backend at join time), falls back to persistent cache,
 *   then fetches from Firestore as last resort
 */

import { queueDataSource } from "@/datasources/remote/firebase/queueDataSource";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────

export type QueueUser = {
  userId:     string;
  name:       string;
  avatarUrl?: string | null;
  joinedAt:   Date;
  queueToken: string;
  position:   number;
};

type AvatarCacheEntry = {
  url:       string | null;
  timestamp: number;
};

// ─── Persistent avatar cache (AsyncStorage, 24 h TTL) ────────────────────────

const CACHE_KEY     = "@queue_avatar_cache";
const CACHE_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours

async function loadCache(): Promise<Record<string, AvatarCacheEntry>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveCache(cache: Record<string, AvatarCacheEntry>): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn("[QueueRepo] Failed to save avatar cache:", err);
  }
}

async function fetchUserAvatar(userId: string): Promise<string | null> {
  const cache = await loadCache();
  const now   = Date.now();

  // Valid cache hit?
  const hit = cache[userId];
  if (hit && now - hit.timestamp < CACHE_TTL_MS) {
    return hit.url;
  }

  // Fetch from Firestore
  let avatarUrl: string | null = null;
  try {
    const snap = await getDoc(doc(db, "users", userId));
    if (snap.exists()) {
      avatarUrl = snap.data()?.avatarUrl ?? null;
    }
  } catch (err) {
    console.warn("[QueueRepo] Failed to fetch avatar for", userId, err);
  }

  // Save to persistent cache
  cache[userId] = { url: avatarUrl, timestamp: now };
  await saveCache(cache);

  return avatarUrl;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class QueueRepository {
  subscribe(machineId: string, onUpdate: (state: any) => void) {
    return queueDataSource.subscribeQueue(machineId, onUpdate);
  }

  async getQueue(machineId: string): Promise<any | null> {
    return queueDataSource.getQueue(machineId);
  }

  /**
   * Fast synchronous map — no avatar fetching.
   * Used for queue position checks, counts, etc.
   */
  mapUsers(rawUsers: any[]): QueueUser[] {
    return (rawUsers ?? [])
      .sort((a, b) => a.position - b.position)
      .map((u) => ({
        ...u,
        // joinedAt is stored as ISO string on backend (new Date().toISOString())
        // Firestore Timestamp → .toDate(); ISO string → new Date(str); missing → now
        joinedAt:
          u.joinedAt?.toDate?.() ??
          (u.joinedAt ? new Date(u.joinedAt) : new Date()),
      }));
  }

  /**
   * Async map with avatar URLs.
   * Priority order:
   *   1. avatarUrl already in queue document (populated at join time by backend)
   *   2. persistent AsyncStorage cache (24 h TTL)
   *   3. Firestore users/{userId} read (slowest — only when cache misses)
   */
  async mapUsersWithAvatars(rawUsers: any[]): Promise<QueueUser[]> {
    const sorted = (rawUsers ?? []).sort((a, b) => a.position - b.position);

    // Load cache once for the whole batch
    const cache = await loadCache();
    const now   = Date.now();

    const results = await Promise.all(
      sorted.map(async (u) => {
        // 1. Already embedded in queue doc
        if (u.avatarUrl) {
          return {
            ...u,
            avatarUrl: u.avatarUrl,
            joinedAt:
              u.joinedAt?.toDate?.() ??
              (u.joinedAt ? new Date(u.joinedAt) : new Date()),
          };
        }

        // 2. Persistent cache
        const hit = cache[u.userId];
        if (hit && now - hit.timestamp < CACHE_TTL_MS) {
          return {
            ...u,
            avatarUrl: hit.url,
            joinedAt:
              u.joinedAt?.toDate?.() ??
              (u.joinedAt ? new Date(u.joinedAt) : new Date()),
          };
        }

        // 3. Firestore fetch
        const avatarUrl = await fetchUserAvatar(u.userId);
        return {
          ...u,
          avatarUrl,
          joinedAt:
            u.joinedAt?.toDate?.() ??
            (u.joinedAt ? new Date(u.joinedAt) : new Date()),
        };
      })
    );

    return results;
  }

  /**
   * FIX #4: Fetch a single user's profile (name + avatar) for the "In Use" card.
   */
  async getUserProfile(userId: string): Promise<{ name: string; displayName?: string; avatarUrl: string | null } | null> {
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const { db } = await import("@/services/firebase");
      const snap = await getDoc(doc(db, "users", userId));
      if (!snap.exists()) return null;
      const data = snap.data();
      return {
        name: data.name || data.displayName || "User",
        displayName: data.displayName,
        avatarUrl: data.photoURL || data.avatarUrl || null,
      };
    } catch (err) {
      console.warn("[QueueRepo] getUserProfile failed:", err);
      return null;
    }
  }
}
