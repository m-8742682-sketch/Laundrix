import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import Slider from "@react-native-community/slider";

type Props = {
  url: string;
  isMe: boolean;
};

export default function AudioBubble({ url, isMe }: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(1);
  const [position, setPosition] = useState(0);
  const [isSliding, setIsSliding] = useState(false);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const togglePlay = async () => {
    if (!soundRef.current) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsPlaying(true);
    } else {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    if (!isSliding) {
      setPosition(status.positionMillis);
    }

    setDuration(status.durationMillis ?? 1);
    setIsPlaying(status.isPlaying);
  };

  const onSlideStart = async () => {
    setIsSliding(true);
    await soundRef.current?.pauseAsync();
  };

  const onSlideComplete = async (value: number) => {
    await soundRef.current?.setPositionAsync(value);
    setPosition(value);
    setIsSliding(false);
    await soundRef.current?.playAsync();
  };

  return (
    <View style={[styles.container, isMe ? styles.me : styles.other]}>
      <TouchableOpacity onPress={togglePlay}>
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={22}
          color={isMe ? "#fff" : "#000"}
        />
      </TouchableOpacity>

      {/* SLIDER */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration}
        value={position}
        onSlidingStart={onSlideStart}
        onSlidingComplete={onSlideComplete}
        minimumTrackTintColor={isMe ? "#fff" : "#2563eb"}
        maximumTrackTintColor="rgba(0,0,0,0.15)"
        thumbTintColor={isMe ? "#fff" : "#2563eb"}
      />

      <Text style={[styles.time, { color: isMe ? "#fff" : "#555" }]}>
        {formatTime(position)} / {formatTime(duration)}
      </Text>
    </View>
  );
}

function formatTime(ms: number) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 220,
  },


  me: {}, // ← keep empty or delete
  other: {},

  slider: {
    flex: 1,
    marginHorizontal: 10,
  },

  time: {
    fontSize: 11,
    marginLeft: 4,
    minWidth: 70,
    textAlign: "right",
  },
});