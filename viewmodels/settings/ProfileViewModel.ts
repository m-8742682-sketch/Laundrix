import { useEffect, useState } from "react";
import { router} from "expo-router"; 
import { uploadMedia } from "@/services/mediaUpload.service";
import {
  getUserProfile,
  updateAvatar,
  updateUserName,
  updateContact,
  updateAcademicInfo,
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

    const uploadResult = await uploadMedia(uri, "image", "avatars");
    const avatarUrl = uploadResult.secure_url;
    await updateAvatar(userId, avatarUrl);

    setProfile(p => (p ? { ...p, avatarUrl } : p));
  };

  const saveProfile = async (
    name: string,
    contact?: string,
    practicum?: string,
    matricCard?: string,
    icNumber?: string,
  ) => {
    if (!userId) return;

    await updateUserName(userId, name);
    if (contact !== undefined) await updateContact(userId, contact);
    await updateAcademicInfo(userId, { practicum, matricCard, icNumber });

    setProfile(p =>
      p
        ? {
            ...p,
            name,
            contact: contact ?? p.contact,
            practicum: practicum ?? p.practicum,
            matricCard: matricCard ?? p.matricCard,
            icNumber: icNumber ?? p.icNumber,
          }
        : p
    );
    router.replace("/settings");
  };

  return {
    profile,
    loading,
    changeAvatar,
    saveProfile,
  };
}