import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import { router } from "expo-router";

/* -----------------------------
   Types
------------------------------ */

export type UserProfile = {
  uid: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  role: string;
  isVerified: boolean;
};

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

/* -----------------------------
   Context
------------------------------ */

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

/* -----------------------------
   Provider
------------------------------ */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------- Load user profile ---------- */
  const loadUserProfile = async (authUser: FirebaseUser | null) => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const ref = doc(db, "users", authUser.uid);
      const snap = await getDoc(ref);

      // 🔥 Auto-create Firestore user doc if missing
      if (!snap.exists()) {
        const newUser: UserProfile = {
          uid: authUser.uid,
          email: authUser.email,
          name: authUser.displayName ?? "User",
          avatarUrl: null,
          role: "user",
          isVerified: authUser.emailVerified,
        };

        await setDoc(ref, {
          name: newUser.name,
          avatarUrl: null,
          role: "user",
          createdAt: new Date(),
        });

        setUser(newUser);
        setLoading(false);
        return;
      }

      const data = snap.data();

      setUser({
        uid: authUser.uid,
        email: authUser.email,
        name: data.name ?? "User",
        avatarUrl: data.avatarUrl ?? null,
        role: data.role ?? "user",
        isVerified: authUser.emailVerified,
      });
    } catch (err) {
      console.error("Failed to load user profile", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Refresh manually ---------- */
  const refreshUser = async () => {
    setLoading(true);
    await loadUserProfile(auth.currentUser);
  };

  /* ---------- Auth listener ---------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, loadUserProfile);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, loading]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/* -----------------------------
   Hook
------------------------------ */

export const useUser = () => useContext(AuthContext);
