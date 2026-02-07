import { useState } from "react";
import { Alert } from "react-native";
import { container } from "@/di/container";

export function useRegisterViewModel() {
  const { authRepository } = container;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const register = async (onSuccess: () => void) => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Email and password are required.");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        "Weak password",
        "Password must be at least 6 characters."
      );
      return;
    }

    try {
      setLoading(true);
      await authRepository.register(email, password);

      Alert.alert(
        "Verify your email",
        "We sent you a verification email. Please verify before logging in."
      );

      onSuccess();
    } catch (err: any) {
      let message = "Registration failed. Please try again.";

      if (err.code === "auth/email-already-in-use") {
        message = "This email is already registered.";
      }

      if (err.code === "auth/invalid-email") {
        message = "Invalid email address.";
      }

      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return {
    email,
    password,
    loading,
    setEmail,
    setPassword,
    register,
  };
}