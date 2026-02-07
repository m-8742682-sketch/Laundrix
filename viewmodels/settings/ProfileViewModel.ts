import { useEffect, useState } from "react";
import { router} from "expo-router"; 
import { uploadImage } from "@/services/mediaUpload.service";
import {
  getUserProfile,
  updateAvatar,
  updateUserName,
  updateContact,
} from "@/repositories/settings/UserRepository";
import type { UserProfile } from "@/types/UserProfile";

export function useProfileViewModel(userId?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /* ---------- Load profile ---------- */
  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      setLoading(true);
      const data = await getUserProfile(userId);
      setProfile(data);
      setLoading(false);
    };

    load();
  }, [userId]);

  /* ---------- Actions ---------- */
  const changeAvatar = async (uri: string) => {
    if (!userId) return;

    const avatarUrl = await uploadImage(uri, "avatars");
    await updateAvatar(userId, avatarUrl);

    setProfile(p => (p ? { ...p, avatarUrl } : p));
  };

  const saveProfile = async (name: string, contact?: string) => {
    if (!userId) return;

    await updateUserName(userId, name);
    router.replace("/settings");
    if (contact !== undefined) {
      await updateContact(userId, contact);
      router.replace("/settings");
    }

    setProfile(p =>
      p
        ? {
            ...p,
            name,
            contact: contact ?? p.contact,
          }
        : p
    );
  };

  return {
    profile,
    loading,
    changeAvatar,
    saveProfile,
  };
}