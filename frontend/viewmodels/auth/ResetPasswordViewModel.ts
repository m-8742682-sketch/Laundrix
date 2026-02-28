import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { container } from "@/di/container";

export function useResetPasswordViewModel(oobCode?: string) {
  const { authRepository } = container;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifying, setVerifying] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      Alert.alert("Invalid link", "Missing reset token.");
      return;
    }

    authRepository
      .verifyResetCode(oobCode)
      .then(() => setVerifying(false))
      .catch(() =>
        Alert.alert("Invalid or expired link")
      );
  }, [oobCode]);

  const resetPassword = async (onSuccess: () => void) => {
    if (!password || !confirmPassword) {
      Alert.alert("Missing fields");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Password too short");
      return;
    }

    try {
      setLoading(true);
      await authRepository.resetPassword(oobCode!, password);

      Alert.alert("Success", "Password updated");
      onSuccess();
    } catch {
      Alert.alert("Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return {
    password,
    confirmPassword,
    verifying,
    loading,
    setPassword,
    setConfirmPassword,
    resetPassword,
  };
}