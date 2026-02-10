import React, { useState, useEffect, useRef, memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";

interface AudioBubbleProps {
  uri?: string;
  url?: string; // Alias for uri
  isMe: boolean;
  storedDuration?: number; // Duration stored in Firestore (seconds)
}

function AudioBubbleComponent({ uri, url, isMe, storedDuration }: AudioBubbleProps) {
  const audioUri = uri || url || "";
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(storedDuration || 0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Load audio metadata on mount to get duration
  useEffect(() => {
    if (!audioUri) return;
    let isMounted = true;

    const loadAudioMetadata = async () => {
      // Use stored duration if available
      if (storedDuration && storedDuration > 0) {
        setDuration(storedDuration);
        return;
      }

      // Otherwise, load to get duration
      try {
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: false },
          undefined,
          false
        );

        if (isMounted && status.isLoaded && status.durationMillis) {
          setDuration(status.durationMillis / 1000);
        }
        
        // Unload immediately - we just wanted the duration
        await newSound.unloadAsync();
      } catch (err) {
        console.warn("Failed to load audio metadata:", err);
      }
    };

    loadAudioMetadata();

    return () => {
      isMounted = false;
    };
  }, [audioUri, storedDuration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadAndPlay = async () => {
    if (!audioUri) return;
    
    try {
      setIsLoading(true);

      // Unload previous sound if exists
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );

      soundRef.current = newSound;
      setSound(newSound);
      setIsLoaded(true);

      if (status.isLoaded && status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }

      setIsPlaying(true);
    } catch (err) {
      console.error("Audio load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      
      if (status.durationMillis) {
        setDuration(status.durationMillis / 1000);
      }

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      } else {
        setIsPlaying(status.isPlaying);
      }
    }
  };

  const togglePlayback = async () => {
    if (isLoading) return;

    if (!isLoaded || !soundRef.current) {
      await loadAndPlay();
      return;
    }

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.error("Playback toggle error:", err);
      // Try to reload
      await loadAndPlay();
    }
  };

  const onSliderValueChange = async (value: number) => {
    if (soundRef.current && isLoaded) {
      try {
        await soundRef.current.setPositionAsync(value * 1000);
        setPosition(value);
      } catch (err) {
        console.warn("Seek error:", err);
      }
    }
  };

  // Colors matching the chat bubble design
  const iconColor = isMe ? "#fff" : "#0EA5E9";
  const sliderColor = isMe ? "rgba(255,255,255,0.8)" : "#0EA5E9";
  const timeColor = isMe ? "rgba(255,255,255,0.7)" : "#64748b";
  const micColor = isMe ? "rgba(255,255,255,0.6)" : "#94a3b8";

  const content = (
    <>
      <TouchableOpacity 
        onPress={togglePlayback} 
        style={styles.playButton}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause-circle" : "play-circle"}
            size={40}
            color={iconColor}
          />
        )}
      </TouchableOpacity>

      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={position}
          onSlidingComplete={onSliderValueChange}
          minimumTrackTintColor={sliderColor}
          maximumTrackTintColor={isMe ? "rgba(255,255,255,0.3)" : "#ccc"}
          thumbTintColor={sliderColor}
        />
        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: timeColor }]}>{formatTime(position)}</Text>
          <Text style={[styles.timeText, { color: timeColor }]}>{formatTime(duration)}</Text>
        </View>
      </View>

      <Ionicons name="mic" size={18} color={micColor} style={styles.micIcon} />
    </>
  );

  // Use LinearGradient for isMe (blue), plain View for other (white)
  if (isMe) {
    return (
      <LinearGradient
        colors={["#0EA5E9", "#0284C7"]}
        style={styles.container}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 220,
    maxWidth: 280,
  },
  playButton: {
    marginRight: 4,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  sliderContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  slider: {
    width: "100%",
    height: 24,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  timeText: {
    fontSize: 11,
    color: "#64748b",
  },
  micIcon: {
    marginLeft: 4,
  },
});

export default memo(AudioBubbleComponent);
