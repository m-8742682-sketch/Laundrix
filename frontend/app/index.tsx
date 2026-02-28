import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/services/firebase";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setHasSession(!!user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) return null;

  return hasSession ? (
    <Redirect href="/(tabs)/dashboard" />
  ) : (
    <Redirect href="/(auth)/login" />
  );
}
