import { useState } from "react";
import { Alert } from "react-native";
import { container } from "@/di/container";

export function useForgotPasswordViewModel() {
  const { authRepository } = container;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const sendReset = async (onSuccess: () => void) => {
    if (!email) {
      Alert.alert("Missing email", "Please enter your email address.");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await authRepository.sendResetEmail(email);

      Alert.alert(
        "Check your email",
        "We sent you a password reset link."
      );

      onSuccess();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.message ?? "Failed to send reset email."
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    loading,
    setEmail,
    sendReset,
  };
}