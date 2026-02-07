import Avatar from "@/components/Avatar";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

export default function VoiceIncomingScreen() {
  const { channel, name, receiverId } = useLocalSearchParams<{
    channel: string;
    name?: string;
    receiverId?: string;
  }>();

  const scale = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);

  /* ---------- RINGTONE + VIBRATION ---------- */
  useEffect(() => {
    let vibration: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/ringtone.mp3"),
        { isLooping: true }
      );
      soundRef.current = sound;
      await sound.playAsync();

      vibration = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 1500);
    })();

    return () => {
      soundRef.current?.stopAsync();
      soundRef.current?.unloadAsync();
      vibration && clearInterval(vibration);
    };
  }, []);

  /* ---------- AUTO MISS (30s) ---------- */
  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        const ref = doc(db, "calls", channel);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          await updateDoc(ref, {
            status: "missed",
            endedAt: serverTimestamp(),
          });
        }
      } finally {
        router.back();
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, []);

  /* ---------- AVATAR PULSE ---------- */
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.05,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const reject = async () => {
    try {
      const ref = doc(db, "calls", channel);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        await updateDoc(ref, {
          status: "rejected",
          endedAt: serverTimestamp(),
        });
      } else {
        console.warn("Call doc not created yet, skipping update");
      }

      router.back();
    } catch (e) {
      console.error("Reject failed:", e);
      router.back(); // still exit UI
    }
  };


  if (!channel) return null;

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Avatar name={name ?? "Unknown"} size={96} />
      </Animated.View>

      <Text style={styles.name}>{name ?? "Incoming call"}</Text>
      <Text style={styles.ringing}>Voice call…</Text>

      <View style={styles.actions}>
        {/* REJECT */}
        <Pressable style={styles.reject} onPress={reject}>
          <Ionicons name="call" size={26} color="white" />
        </Pressable>

        {/* ACCEPT */}
        <Pressable
          style={styles.accept}
          onPress={() =>
            router.replace({
              pathname: "/call/voice-call",
              params: { channel, name , receiverId},
            })
          }
        >
          <Ionicons name="call" size={26} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    marginTop: 16,
    color: "white",
    fontSize: 20,
    fontWeight: "600",
  },
  ringing: {
    marginTop: 6,
    color: "#aaa",
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 50,
    marginTop: 60,
  },
  reject: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "135deg" }],
  },
  accept: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
  },
});
