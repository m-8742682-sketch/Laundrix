import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, setDoc, getDocFromCache, getDoc } from "firebase/firestore";
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
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);

  /* ---------- Build user profile from Firestore data ---------- */
  const buildUserProfile = useCallback((
    firebaseUser: FirebaseUser,
    firestoreData: any | null
  ): UserProfile => {
    // Priority: Firestore data > Auth displayName > email prefix > "User"
    const name = firestoreData?.name 
      || firebaseUser.displayName 
      || firebaseUser.email?.split("@")[0] 
      || "User";
    
    const avatarUrl = firestoreData?.avatarUrl 
      || firebaseUser.photoURL 
      || null;

    const role = firestoreData?.role || "user";

    console.log("[UserContext] Building profile:", {
      uid: firebaseUser.uid,
      name,
      avatarUrl: avatarUrl ? "present" : "null",
      source: firestoreData?.name ? "firestore" : "fallback",
    });

    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name,
      avatarUrl,
      role,
      isVerified: firebaseUser.emailVerified,
    };
  }, []);

  /* ---------- Create user doc if it doesn't exist ---------- */
  const ensureUserDocExists = useCallback(async (firebaseUser: FirebaseUser) => {
    const userRef = doc(db, "users", firebaseUser.uid);
    
    try {
      // Try to get the doc first
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) {
        console.log("[UserContext] Creating new user doc in Firestore");
        await setDoc(userRef, {
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          avatarUrl: firebaseUser.photoURL || null,
          email: firebaseUser.email,
          role: "user",
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.warn("[UserContext] Could not check/create user doc:", err);
      // Don't throw - we'll still work with fallback data
    }
  }, []);

  /* ---------- Refresh user data manually ---------- */
  const refreshUser = useCallback(async () => {
    if (!authUser) return;
    
    setLoading(true);
    try {
      const userRef = doc(db, "users", authUser.uid);
      const snap = await getDoc(userRef);
      const data = snap.exists() ? snap.data() : null;
      setUser(buildUserProfile(authUser, data));
    } catch (err) {
      console.warn("[UserContext] refreshUser error:", err);
      // Keep existing user data on error
    } finally {
      setLoading(false);
    }
  }, [authUser, buildUserProfile]);

  /* ---------- Auth state listener ---------- */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log("[UserContext] Auth state changed:", firebaseUser?.uid || "null");
      setAuthUser(firebaseUser);
      
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  /* ---------- Firestore user profile listener ---------- */
  useEffect(() => {
    if (!authUser) return;

    console.log("[UserContext] Setting up Firestore listener for:", authUser.uid);
    
    // First, ensure user doc exists
    ensureUserDocExists(authUser);

    const userRef = doc(db, "users", authUser.uid);

    // Use onSnapshot for real-time updates and offline support
    // onSnapshot automatically uses cache when offline!
    const unsubscribe = onSnapshot(
      userRef,
      { includeMetadataChanges: false },
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          console.log("[UserContext] Got Firestore data:", {
            name: data.name,
            avatarUrl: data.avatarUrl ? "present" : "null",
            fromCache: snap.metadata.fromCache,
          });
          setUser(buildUserProfile(authUser, data));
        } else {
          // Doc doesn't exist yet - use fallback
          console.log("[UserContext] No Firestore doc, using fallback");
          setUser(buildUserProfile(authUser, null));
        }
        setLoading(false);
      },
      (error) => {
        console.warn("[UserContext] Firestore listener error:", error.message);
        // On error, still build a profile from Auth data
        setUser(buildUserProfile(authUser, null));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [authUser, buildUserProfile, ensureUserDocExists]);

  /* ---------- Navigation after user is loaded ---------- */
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
