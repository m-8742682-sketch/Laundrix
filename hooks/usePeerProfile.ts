// hooks/usePeerProfile.ts
import { db } from "@/services/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

type PeerProfile = {
  name: string;
  avatarUrl: string | null;
};

export function usePeerProfile(peerId: string | undefined, initialName?: string, initialAvatar?: string) {
  const [profile, setProfile] = useState<PeerProfile>({
    name: initialName || "Unknown",
    avatarUrl: initialAvatar || null,
  });
  const [loading, setLoading] = useState(!initialName && !!peerId);

  useEffect(() => {
    // If we already have the data from params, don't fetch
    if (initialName && initialAvatar !== undefined) {
      setProfile({ name: initialName, avatarUrl: initialAvatar || null });
      setLoading(false);
      return;
    }

    if (!peerId) {
      setLoading(false);
      return;
    }

    // Fetch from Firestore
    const userRef = doc(db, "users", peerId);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            name: data.name || "Unknown",
            avatarUrl: data.avatarUrl || null,
          });
        } else {
          setProfile({ name: "Unknown", avatarUrl: null });
        }
        setLoading(false);
      },
      (error) => {
        console.error("[usePeerProfile] Error fetching peer:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [peerId, initialName, initialAvatar]);

  return { ...profile, loading };
}