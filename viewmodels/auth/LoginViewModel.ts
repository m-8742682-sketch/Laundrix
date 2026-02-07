import { useState } from "react";
import { Alert } from "react-native";
import { container } from "@/di/container";

export function useAuthViewModel() {
  const { authRepository } = container;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const getLoginErrorMessage = (err: any) => {
    switch (err.code) {
      case "auth/user-not-found":
        return "No account found with this email. Please register first.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/invalid-email":
        return "Invalid email address format.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact support.";
      case "auth/too-many-requests":
        return "Too many failed attempts. Please try again later.";
      case "auth/network-request-failed":
        return "Network error. Please check your internet connection.";
      case "auth/email-not-verified":
        return "Please verify your email before logging in.";
      default:
        return "Login failed. Please try again.";
    }
  };

  const login = async (onSuccess: () => void) => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please enter both email and password.");
      return;
    }

    if (!email.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);
      await authRepository.login(email, password);
      onSuccess();
    } catch (err: any) {
      Alert.alert("Login failed", getLoginErrorMessage(err));
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
    login,
  };
}