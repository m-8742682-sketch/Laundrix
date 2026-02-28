// types/UserProfile.ts
export type UserProfile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  contact?: string;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt?: Date;
};

