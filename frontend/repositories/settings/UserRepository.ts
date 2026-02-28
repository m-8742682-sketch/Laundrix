import { db } from "@/services/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import type { UserProfile } from "@/types/UserProfile";

/* ---------- READ ---------- */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);

  // 🔥 Auto-create profile if missing (important for Google users)
  if (!snap.exists()) {
    const now = serverTimestamp();

    await setDoc(ref, {
      name: "User",
      avatarUrl: null,
      contact: "",
      role: "user",
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: userId,
      name: "User",
      avatarUrl: null,
      contact: "",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const d = snap.data();

  return {
    id: snap.id,
    name: d.name ?? "",
    avatarUrl: d.avatarUrl ?? null,
    contact: d.contact ?? "",
    role: d.role ?? "user",
    createdAt: (d.createdAt as Timestamp).toDate(),
    updatedAt: d.updatedAt
      ? (d.updatedAt as Timestamp).toDate()
      : undefined,
  };
}

/* ---------- WRITE ---------- */
export async function updateAvatar(userId: string, avatarUrl: string) {
  await updateDoc(doc(db, "users", userId), {
    avatarUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserName(userId: string, name: string) {
  await updateDoc(doc(db, "users", userId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function updateContact(userId: string, contact: string) {
  await updateDoc(doc(db, "users", userId), {
    contact,
    updatedAt: serverTimestamp(),
  });
}
