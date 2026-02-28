import { Alert, Share } from "react-native";
import { container } from "@/di/container";

export function useSettingsViewModel(userId?: string) {  // ← Add userId parameter
  const { authRepository } = container;

  const logout = async (onSuccess: () => void) => {
    try {
      await authRepository.logout();
      onSuccess();
    } catch {
      Alert.alert("Error", "Failed to log out.");
    }
  };

  const deleteAccount = async (
    email: string,
    onSuccess: () => void
  ) => {
    if (!userId) {  // ← Add validation
      Alert.alert("Error", "User not found");
      return;
    }

    Alert.alert(
      "Delete account",
      "This action is permanent and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await authRepository.deleteAccount();
              
              // Clean up user from queue BEFORE showing success message
              try {
                await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL!}/api/user-deleted`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId })  // ← Use userId from parameter
                });
              } catch (cleanupErr) {
                console.error("Queue cleanup error:", cleanupErr);
                // Continue anyway - account is already deleted
              }

              Alert.alert(
                "Account deleted",
                "Your account has been permanently deleted."
              );
              onSuccess();
            } catch (err: any) {
              if (err.code === "auth/requires-recent-login") {
                Alert.prompt(
                  "Confirm password", 
                  "Please enter your password to continue",
                  async (password) => {
                    try {
                      await authRepository.reauthenticate(
                        email,
                        password
                      );
                      await authRepository.deleteAccount();
                      
                      // Clean up queue
                      try {
                        await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL!}/api/user-deleted`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ userId })
                        });
                      } catch (cleanupErr) {
                        console.error("Queue cleanup error:", cleanupErr);
                      }

                      Alert.alert(
                        "Account deleted",
                        "Your account has been permanently deleted."
                      );
                      onSuccess();
                    } catch (e: any) {
                      Alert.alert(
                        "Error",
                        e.message ?? "Authentication failed."
                      );
                    }
                  },
                  "secure-text"
                );
              } else {
                Alert.alert(
                  "Error",
                  err?.message ??
                    "Failed to delete account."
                );
              }
            }
          },
        },
      ]
    );
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message:
          "Try Laundrix! 📱 A smart laundry app to manage queues and get notified when your laundry is ready.\n\nDownload here:",
      });
    } catch {
      Alert.alert("Error", "Unable to share the app.");
    }
  };

  const showLanguageInfo = (language: string) => {
    Alert.alert(
      "Language",
      `Laundrix uses your device's system translation.\n\nTo view the app in ${language}, please use your phone's screen translate feature.`
    );
  };

  return {
    logout,
    deleteAccount,
    shareApp,
    showLanguageInfo,
  };
}