import { useState } from "react";
import { router } from "expo-router"
import { auth } from "@/services/firebase";
import { authDataSource } from "@/datasources/remote/firebase/authDataSource";

export function useAccountViewModel() {
  const [loading, setLoading] = useState(false);

  const user = auth.currentUser;

  const email = user?.email ?? "";
  const isEmailVerified = user?.emailVerified ?? false;

  /* -------------------------
     Actions
  -------------------------- */

  const resetPassword = async () => {
    if (!email) {
        throw new Error("No email found");
    }

    router.push("/(auth)/forgot_password");
    };

  const logout = async () => {
    setLoading(true);
    try {
      await authDataSource.logout();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Required before delete / change email / change password
   */
  const reauthenticate = async (email: string, password: string) => {
    setLoading(true);
    try {
      await authDataSource.reauthenticate(email, password);
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    setLoading(true);
    try {
      await authDataSource.deleteAccount();
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    email,
    isEmailVerified,
    resetPassword,
    logout,
    reauthenticate,
    deleteAccount,
  };
}
