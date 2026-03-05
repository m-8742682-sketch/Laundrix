import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebase";
import type { UserProfile } from "@/types";

// ─── Context Types ────────────────────────────────────────────────────────────

type AuthContextType = {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);

  const buildUserProfile = useCallback(
    (firebaseUser: FirebaseUser, firestoreData: any | null): UserProfile => ({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name:
        firestoreData?.name ??
        firebaseUser.displayName ??
        firebaseUser.email?.split("@")[0] ??
        "User",
      avatarUrl: firestoreData?.avatarUrl ?? firebaseUser.photoURL ?? null,
      role: firestoreData?.role ?? "user",
      isVerified: firebaseUser.emailVerified,
    }),
    []
  );

  const ensureUserDocExists = useCallback(async (firebaseUser: FirebaseUser) => {
    const ref = doc(db, "users", firebaseUser.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          name:
            firebaseUser.displayName ??
            firebaseUser.email?.split("@")[0] ??
            "User",
          avatarUrl: firebaseUser.photoURL ?? null,
          email: firebaseUser.email,
          role: "user",
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.warn("[UserContext] Could not check/create user doc:", err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "users", authUser.uid));
      setUser(buildUserProfile(authUser, snap.exists() ? snap.data() : null));
    } catch (err) {
      console.warn("[UserContext] refreshUser error:", err);
    } finally {
      setLoading(false);
    }
  }, [authUser, buildUserProfile]);

  // Auth state listener
  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setAuthUser(firebaseUser);
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
      }
    });
  }, []);

  // Firestore profile listener — real-time + offline cache support
  useEffect(() => {
    if (!authUser) return;

    ensureUserDocExists(authUser);

    return onSnapshot(
      doc(db, "users", authUser.uid),
      { includeMetadataChanges: false },
      (snap) => {
        setUser(buildUserProfile(authUser, snap.exists() ? snap.data() : null));
        setLoading(false);
      },
      (error) => {
        console.warn("[UserContext] Firestore listener error:", error.message);
        setUser(buildUserProfile(authUser, null));
        setLoading(false);
      }
    );
  }, [authUser, buildUserProfile, ensureUserDocExists]);

  // NOTE: Navigation is intentionally handled in app/_layout.tsx (with hasNavigated guard).
  // DO NOT add a navigation useEffect here — it would fire on every Firestore user-doc
  // update, re-navigating to dashboard during calls/grace periods (Maximum update depth).

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useUser = () => useContext(AuthContext);
