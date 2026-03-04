import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// ─── Login ────────────────────────────────────────────────────────────────────

export const login = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);
  await updateDoc(doc(db, "users", result.user.uid), { lastLogin: serverTimestamp() });
  return result.user;
};

// ─── Register ─────────────────────────────────────────────────────────────────
// FIX: was calling createUserWithEmailAndPassword twice — the second call
// always threw auth/email-already-in-use because the account already existed.

export const register = async (email: string, password: string, name: string) => {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);

  await setDoc(doc(db, "users", user.uid), {
    userId: user.uid,
    name,
    email: user.email,
    role: "user",
    isVerified: user.emailVerified,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    notificationEnabled: true,
    machineReadyNotifications: true,
    queueReminderNotifications: true,
  });

  await sendEmailVerification(user);
  return user;
};

// ─── Logout ───────────────────────────────────────────────────────────────────

export const logout = () => signOut(auth);

// ─── Profile ──────────────────────────────────────────────────────────────────

export const getCurrentUserProfile = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) return null;

  return { uid: user.uid, emailVerified: user.emailVerified, ...snap.data() };
};

// ─── Account Management ───────────────────────────────────────────────────────

export const deleteAccount = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");

  await deleteDoc(doc(db, "users", user.uid));
  await deleteUser(user);
  await signOut(auth);
};

export const reauthenticate = async (email: string, password: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated user.");

  const credential = EmailAuthProvider.credential(email, password);
  await reauthenticateWithCredential(user, credential);
};
