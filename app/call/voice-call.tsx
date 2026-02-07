import Avatar from "@/components/Avatar";
import { db, auth } from "@/services/firebase";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
} from "react-native-agora";

import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID!;

export default function VoiceCallScreen() {
  const { channel, name, receiverId } = useLocalSearchParams<{
    channel: string;
    name?: string;
    receiverId: string;
  }>();


  const myUserId = auth.currentUser?.uid;
  if (!channel || !receiverId || !myUserId) return null;

  const engineRef = useRef<any>(null);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [seconds, setSeconds] = useState(0);

  /* ---------- INIT ---------- */
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const mic = await Audio.requestPermissionsAsync();
      if (!mic.granted) {
        router.back();
        return;
      }

      // 🔑 CREATE / ENSURE CALL DOCUMENT
    if (myUserId === receiverId) {
      // receiver joined → DO NOT write callerId
      await updateDoc(doc(db, "calls", channel), {
        status: "ongoing",
      });
    } else {
      // caller creates the call
      await setDoc(
        doc(db, "calls", channel),
        {
          channel,
          callerId: myUserId,
          receiverId,
          status: "ongoing",
          startedAt: serverTimestamp(),
          endedAt: null,
        },
        { merge: true }
      );
    }

      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      engine.joinChannel("", channel, 0, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
      });

      timer = setInterval(() => setSeconds(s => s + 1), 1000);
    })();

    return () => {
      timer && clearInterval(timer);
      engineRef.current?.leaveChannel();
      engineRef.current?.release();
    };
  }, []);

  /* ---------- CONTROLS ---------- */
  const toggleMute = () => {
    engineRef.current?.muteLocalAudioStream(!muted);
    setMuted(!muted);
  };

  const toggleSpeaker = () => {
    engineRef.current?.setEnableSpeakerphone(!speaker);
    setSpeaker(!speaker);
  };

  const endCall = async () => {
    engineRef.current?.leaveChannel();
    engineRef.current?.release();

    // 🔑 MARK CALL AS ENDED
    await updateDoc(doc(db, "calls", channel), {
      status: "ended",
      endedAt: serverTimestamp(),
    });

    router.back();
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0"
    )}`;

  return (
    <View style={styles.container}>
      {/* TOP */}
      <Text style={styles.timer}>{formatTime(seconds)}</Text>
      <Text style={styles.name}>{name ?? "Unknown"}</Text>

      {/* AVATAR */}
      <View style={styles.avatarWrap}>
        <Avatar name={name ?? "User"} size={96} />
      </View>

      {/* ACTION GRID */}
      <View style={styles.grid}>
        <Action
          icon={muted ? "mic-off" : "mic"}
          label="Mute"
          active={muted}
          onPress={toggleMute}
        />

        <Action
          icon="volume-high"
          label="Speaker"
          active={speaker}
          onPress={toggleSpeaker}
        />

        <Action
          icon="videocam"
          label="Video call"
          onPress={() =>
            router.replace({
              pathname: "/call/video-call",
              params: { channel },
            })
          }
        />

        <Action
          icon="add"
          label="Add call"
          onPress={() => {
            // future multi-call
          }}
        />
      </View>

      {/* END */}
      <Pressable style={styles.end} onPress={endCall}>
        <Ionicons name="call" size={28} color="white" />
      </Pressable>
    </View>
  );
}

/* ---------- ACTION ---------- */
function Action({
  icon,
  label,
  onPress,
  active,
}: {
  icon: any;
  label: string;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <View
        style={[
          styles.actionIcon,
          active && { backgroundColor: "#2563eb" },
        ]}
      >
        <Ionicons name={icon} size={22} color="white" />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    paddingTop: 60,
  },

  timer: {
    color: "#9ca3af",
    fontSize: 13,
  },

  name: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
    marginTop: 8,
  },

  avatarWrap: {
    marginTop: 30,
    marginBottom: 40,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "70%",
    rowGap: 28,
  },

  action: {
    width: "45%",
    alignItems: "center",
  },

  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1f2933",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },

  actionText: {
    color: "#e5e7eb",
    fontSize: 12,
  },

  end: {
    marginTop: 44,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "135deg" }],
  },
});
