import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

/* =========================
   LOGIN
========================= */
export const login = async (email: string, password: string) => {
  const result = await signInWithEmailAndPassword(auth, email, password);

  // update last login
  await updateDoc(doc(db, "users", result.user.uid), {
    lastLogin: serverTimestamp(),
  });

  return result.user;
};

/* =========================
   REGISTER
========================= */
export const register = async (
  email: string,
  password: string,
  name: string
) => {
  const result = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = result.user;

  // create Firestore user profile (REPLACES Supabase trigger)
  await setDoc(doc(db, "users", user.uid), {
    userId: user.uid,
    name,
    email,
    role: "user",
    isVerified: user.emailVerified,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    notificationEnabled: true,
    machineReadyNotifications: true,
    queueReminderNotifications: true,
  });

  const cred = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  // send verification email (Firebase does NOT do this automatically)
  await sendEmailVerification(cred.user);

  return user;
};

/* =========================
   LOGOUT
========================= */
export const logout = async () => {
  await signOut(auth);
};

/* =========================
   GET CURRENT USER PROFILE
========================= */
export const getCurrentUserProfile = async () => {
  const user = auth.currentUser;

  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) return null;

  return {
    uid: user.uid,
    emailVerified: user.emailVerified,
    ...snap.data(),
  };
};

export const deleteAccount = async () => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No authenticated user.");
  }

  const uid = user.uid;
  // 1️⃣ Delete Firestore profile
  await deleteDoc(doc(db, "users", uid));

  // 2️⃣ Delete Auth account
  await deleteUser(user);

  // 3️⃣ Optional: sign out
  await signOut(auth);
};

export const reauthenticate = async (
  email: string,
  password: string
) => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("No authenticated user.");
  }

  const credential = EmailAuthProvider.credential(
    email,
    password
  );

  await reauthenticateWithCredential(user, credential);
};