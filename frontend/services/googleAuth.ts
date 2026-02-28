/**
 * Universal Google Auth Hook
 * 
 * Supports Web, Android, and iOS platforms with a single API.
 * 
 * Platform detection:
 * - Web: Uses Firebase signInWithPopup
 * - Android/iOS: Uses @react-native-google-signin/google-signin
 */

import { useEffect, useCallback } from "react";
import { Platform } from "react-native";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { auth } from "@/services/firebase";

// Only import native Google Sign-In on mobile platforms
let GoogleSignin: any = null;
if (Platform.OS !== "web") {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
}

// OAuth Client IDs (from Google Cloud Console)
const GOOGLE_WEB_CLIENT_ID = "122162141800-30rn4v06i7d883l1e8kfmkr773q3oqts.apps.googleusercontent.com";
// iOS Client ID - you'll get this from Google Cloud Console
const GOOGLE_IOS_CLIENT_ID = "122162141800-tc2j8hu9acjg3mrid6r85aki2r0lvl44.apps.googleusercontent.com";

export function useGoogleAuth() {
  // Configure Google Sign-In on mount (mobile only)
  useEffect(() => {
    if (Platform.OS !== "web" && GoogleSignin) {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: Platform.OS === "ios" ? GOOGLE_IOS_CLIENT_ID : undefined,
        offlineAccess: false,
        forceCodeForRefreshToken: false,
      });
    }
  }, []);

  /**
   * Sign in with Google - works on all platforms
   */
  const signInWithGoogle = useCallback(async (): Promise<User> => {
    if (Platform.OS === "web") {
      return signInWithGoogleWeb();
    } else {
      return signInWithGoogleNative();
    }
  }, []);

  /**
   * Sign out from Google - works on all platforms
   */
  const signOutWithGoogle = useCallback(async (): Promise<void> => {
    // Always sign out from Firebase
    await firebaseSignOut(auth);

    // Also sign out from native Google (mobile only)
    if (Platform.OS !== "web" && GoogleSignin) {
      try {
        await GoogleSignin.revokeAccess();
        await GoogleSignin.signOut();
      } catch {
        // Ignore if not signed in
      }
    }
  }, []);

  return { signInWithGoogle, signOutWithGoogle };
}

/**
 * Web: Sign in using Firebase popup
 */
async function signInWithGoogleWeb(): Promise<User> {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    
    // Force account selection every time
    provider.setCustomParameters({
      prompt: "select_account",
    });

    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error: any) {
    console.error("[GoogleAuth] Web sign-in failed:", error);
    
    // Handle specific errors
    if (error.code === "auth/popup-closed-by-user") {
      throw new Error("Sign-in cancelled");
    }
    if (error.code === "auth/popup-blocked") {
      throw new Error("Popup blocked. Please allow popups for this site.");
    }
    
    throw error;
  }
}

/**
 * Android/iOS: Sign in using native Google Sign-In
 */
async function signInWithGoogleNative(): Promise<User> {
  if (!GoogleSignin) {
    throw new Error("Google Sign-In not available on this platform");
  }

  try {
    // Check Play Services (Android) or just proceed (iOS)
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });

    console.log("[GoogleAuth] Starting sign-in with webClientId:", GOOGLE_WEB_CLIENT_ID);

    // Reset previous session for fresh account selection
    try {
      await GoogleSignin.revokeAccess();
      await GoogleSignin.signOut();
    } catch {
      // Ignore if not signed in
    }

    // Start Google Sign-In flow
    await GoogleSignin.signIn();

    // Get tokens
    const { idToken } = await GoogleSignin.getTokens();

    if (!idToken) {
      throw new Error("Failed to get Google ID token");
    }

    // Create Firebase credential and sign in
    const credential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, credential);

    return result.user;
  } catch (error: any) {
    console.error("[GoogleAuth] Native sign-in failed:", error);
    console.error("[GoogleAuth] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.error("[GoogleAuth] Error code:", error.code);
    console.error("[GoogleAuth] Error message:", error.message);

    // Handle specific errors
    if (error.code === "SIGN_IN_CANCELLED" || error.code === 12501) {
      throw new Error("Sign-in cancelled");
    }
    if (error.code === "IN_PROGRESS") {
      throw new Error("Sign-in already in progress");
    }
    if (error.code === "PLAY_SERVICES_NOT_AVAILABLE") {
      throw new Error("Google Play Services not available");
    }

    throw error;
  }
}

export default useGoogleAuth;
