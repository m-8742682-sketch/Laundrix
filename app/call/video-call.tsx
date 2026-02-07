import Avatar from "@/components/Avatar";
import { db, auth } from "@/services/firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { Camera } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  RtcSurfaceView,
} from "react-native-agora";

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID!;

export default function VideoCallScreen() {
  const { channel, receiverId } = useLocalSearchParams<{
    channel: string;
    receiverId: string;
  }>();
  const myUserId = auth.currentUser?.uid;
  if (!channel || !receiverId || !myUserId) return null;

  const engineRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(true);
  const [seconds, setSeconds] = useState(0);

  /* ---------- INIT ---------- */
  useEffect(() => {
    (async () => {
      const cam = await Camera.requestCameraPermissionsAsync();
      const mic = await Audio.requestPermissionsAsync();

      if (!cam.granted || !mic.granted) {
        Alert.alert("Permission required", "Camera & microphone needed");
        router.back();
        return;
      }

      await initAgora();
      setReady(true);
    })();

    return () => {
      engineRef.current = null;
    };
  }, []);

  /* ---------- TIMER ---------- */
  useEffect(() => {
    if (!ready) return;

    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [ready]);

  /* ---------- AGORA ---------- */
  const initAgora = async () => {
    const engine = createAgoraRtcEngine();
    engineRef.current = engine;

    engine.initialize({
      appId: AGORA_APP_ID,
      channelProfile: ChannelProfileType.ChannelProfileCommunication,
    });

    engine.registerEventHandler({
      onUserJoined: (_c, uid) => setRemoteUid(uid),
      onUserOffline: () => setRemoteUid(null),
      onRemoteVideoStateChanged: (_c, uid, state) => {
        if (state === 2) setRemoteUid(uid); // video ON
        if (state === 0) setRemoteUid(null); // video OFF
      },
    });

    engine.enableAudio();
    engine.enableVideo();
    engine.disableVideo(); // default camera OFF

    engine.joinChannel("", channel, 0, {
      clientRoleType: ClientRoleType.ClientRoleBroadcaster,
    });
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
  };

  /* ---------- HELPERS ---------- */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  /* ---------- CONTROLS ---------- */
  const toggleMute = () => {
    engineRef.current?.muteLocalAudioStream(!muted);
    setMuted(!muted);
  };

  const toggleVideo = () => {
    if (!engineRef.current) return;

    if (videoOff) {
      engineRef.current.enableVideo();
      engineRef.current.startPreview();
    } else {
      engineRef.current.stopPreview();
      engineRef.current.disableVideo();
    }

    setVideoOff(!videoOff);
  };

  const flipCamera = () => {
    engineRef.current?.switchCamera();
  };

  const endCall = async () => {
    try {
      engineRef.current?.leaveChannel();
      engineRef.current?.release();

      await updateDoc(doc(db, "calls", channel), {
        status: "ended",
        endedAt: serverTimestamp(),
      });

      router.back();
    } catch (err) {
      Alert.alert("Error", "Failed to end call");
    }
  };


  if (!ready) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      {/* REMOTE VIDEO / AVATAR */}
      {remoteUid !== null ? (
        <RtcSurfaceView style={styles.full} canvas={{ uid: remoteUid }} />
      ) : (
        <View style={styles.remoteAvatar}>
          <Avatar name="Queue User" size={96} />
          <Text style={styles.remoteName}>Camera off</Text>
        </View>
      )}

      {/* LOCAL PREVIEW */}
      <View style={styles.local}>
        {!videoOff ? (
          <RtcSurfaceView
            style={StyleSheet.absoluteFill}
            canvas={{ uid: 0 }}
          />
        ) : (
          <View style={styles.avatarWrap}>
            <Avatar name="You" size={56} />
          </View>
        )}
      </View>

      {/* TOP INFO */}
      <View style={styles.top}>
        <Text style={styles.name}>In Call</Text>
        <Text style={styles.timer}>{formatTime(seconds)}</Text>

        <View style={styles.statusRow}>
          {muted && <Text style={styles.badge}>Mic off</Text>}
          {videoOff && <Text style={styles.badge}>Camera off</Text>}
        </View>
      </View>

      {/* CONTROLS */}
      <View style={styles.controls}>
        <Control icon="camera-reverse-outline" onPress={flipCamera} />
        <Control
          icon={videoOff ? "videocam-off-outline" : "videocam-outline"}
          onPress={toggleVideo}
          active={!videoOff}
        />
        <Control
          icon={muted ? "mic-off-outline" : "mic-outline"}
          onPress={toggleMute}
          active={!muted}
        />
        <Pressable style={styles.end} onPress={endCall}>
          <Ionicons name="call" size={26} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- CONTROL ---------- */
function Control({
  icon,
  onPress,
  active = false,
}: {
  icon: any;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      style={[
        styles.ctrlBtn,
        { backgroundColor: active ? "#2563eb" : "rgba(255,255,255,0.2)" },
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color="white" />
    </Pressable>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "black" },

  full: {
    ...StyleSheet.absoluteFillObject,
  },

  local: {
    width: 120,
    height: 160,
    position: "absolute",
    top: 60,
    right: 20,
    borderRadius: 12,
    overflow: "hidden",
  },

  avatarWrap: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  remoteAvatar: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },

  remoteName: {
    marginTop: 12,
    color: "#aaa",
    fontSize: 14,
  },

  top: {
    position: "absolute",
    top: 40,
    left: 20,
  },

  name: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },

  timer: {
    color: "#ccc",
    fontSize: 13,
    marginTop: 2,
  },

  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },

  badge: {
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
  },

  controls: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 22,
  },

  ctrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  end: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
});
