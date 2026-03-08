import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import type { UserProfile } from "@/types";

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Auto-create profile for new Google Sign-In users
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
      uid: userId,
      name: "User",
      email: null,
      avatarUrl: null,
      contact: "",
      role: "user",
      isVerified: false,
      createdAt: new Date(),
    };
  }

  const d = snap.data();

  return {
    uid: snap.id,
    name: d.name ?? "",
    email: d.email ?? null,
    avatarUrl: d.avatarUrl ?? null,
    contact: d.contact ?? "",
    role: d.role ?? "user",
    isVerified: d.isVerified ?? false,
    createdAt: (d.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: d.updatedAt ? (d.updatedAt as Timestamp).toDate() : undefined,
    practicum: d.practicum ?? "",
    matricCard: d.matricCard ?? "",
    icNumber: d.icNumber ?? "",
  };
}

// ─── Write ────────────────────────────────────────────────────────────────────

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

export async function updateAcademicInfo(userId: string, fields: {
  practicum?: string;
  matricCard?: string;
  icNumber?: string;
}) {
  const updates: Record<string, any> = { updatedAt: serverTimestamp() };
  if (fields.practicum  !== undefined) updates.practicum  = fields.practicum;
  if (fields.matricCard !== undefined) updates.matricCard = fields.matricCard;
  if (fields.icNumber   !== undefined) updates.icNumber   = fields.icNumber;
  await updateDoc(doc(db, "users", userId), updates);
}
