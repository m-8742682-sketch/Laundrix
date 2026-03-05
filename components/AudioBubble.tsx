import React, { useState, useEffect, useRef, memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import Avatar from "@/components/Avatar";

interface AudioBubbleProps {
  uri?: string;
  url?: string;
  isMe: boolean;
  storedDuration?: number;
  timestamp?: string; 
  isPending?: boolean; // New
  read?: boolean;      // New
  forwardedFrom?: string;
  fromAvatar?: string;
  fromUserId?: string;     // ADD
  myUserId?: string;       // ADD
  onForwardedPress?: () => void; // ADD
  hideForwarded?: boolean; // ADD - to hide if parent renders it
}

function AudioBubbleComponent({ uri, url, isMe, storedDuration, timestamp, isPending, read, forwardedFrom, fromAvatar, fromUserId, myUserId, onForwardedPress, hideForwarded }: AudioBubbleProps) {
  const audioUri = uri || url || "";
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(storedDuration || 0);
  const [isLoaded, setIsLoaded] = useState(false);
  const soundRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (!audioUri) return;
    let isMounted = true;
    const loadAudioMetadata = async () => {
      if (storedDuration && storedDuration > 0) { setDuration(storedDuration); return; }
      try {
        const tempPlayer = createAudioPlayer({ uri: audioUri });
        // Wait briefly for duration to be available
        await new Promise(r => setTimeout(r, 300));
        if (isMounted && tempPlayer.duration > 0) setDuration(tempPlayer.duration);
        try { tempPlayer.remove(); } catch {}
      } catch (err) { console.warn("Failed to load audio metadata:", err); }
    };
    loadAudioMetadata();
    return () => { isMounted = false; };
  }, [audioUri, storedDuration]);

  useEffect(() => {
    return () => { if (soundRef.current) { try { soundRef.current.remove(); } catch {} } };
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
      if (soundRef.current) { try { soundRef.current.remove(); } catch {} soundRef.current = null; }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const newPlayer = createAudioPlayer({ uri: audioUri });
      newPlayer.addListener('playbackStatusUpdate', onPlaybackStatusUpdate);
      soundRef.current = newPlayer;
      setIsLoaded(true);
      await new Promise(r => setTimeout(r, 200));
      if (newPlayer.duration > 0) setDuration(newPlayer.duration);
      newPlayer.play();
      setIsPlaying(true);
    } catch (err) { console.error("Audio load error:", err); } 
    finally { setIsLoading(false); }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    // expo-audio status: { currentTime, duration, playing, didJustFinish }
    if (status.currentTime !== undefined) {
      setPosition(status.currentTime);
      if (status.duration > 0) setDuration(status.duration);
      if (status.didJustFinish) { setIsPlaying(false); setPosition(0); }
      else setIsPlaying(status.playing ?? false);
    }
  };

  const togglePlayback = async () => {
    if (isLoading) return;
    if (!isLoaded || !soundRef.current) { await loadAndPlay(); return; }
    try {
      if (isPlaying) await soundRef.current.pause();
      else await soundRef.current.play();
    } catch (err) { console.error("Playback toggle error:", err); await loadAndPlay(); }
  };

  const onSliderValueChange = async (value: number) => {
    if (soundRef.current && isLoaded) {
      try { soundRef.current.seekTo(value); setPosition(value); } 
      catch (err) { console.warn("Seek error:", err); }
    }
  };

  const theme = isMe ? {
    bgColors: ["#6366F1", "#4F46E5"], iconColor: "#fff", textPrimary: "#fff", textSecondary: "rgba(255,255,255,0.7)",
    trackColor: "rgba(255,255,255,0.3)", thumbColor: "#fff", buttonBg: "rgba(255,255,255,0.2)",
  } : {
    bgColors: ["#ffffff", "#f8fafc"], iconColor: "#6366F1", textPrimary: "#1e293b", textSecondary: "#64748b",
    trackColor: "#e2e8f0", thumbColor: "#6366F1", buttonBg: "#F5F3FF",
  };

  return (
    <LinearGradient colors={theme.bgColors as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.container}>
      {/* Forwarded Badge - Inside bubble like text messages */}
            {/* Forwarded Badge - Inside bubble like text messages */}
      {forwardedFrom && !hideForwarded && (
        <TouchableOpacity 
          onPress={onForwardedPress}
          activeOpacity={0.7}
          disabled={!onForwardedPress}
        >
          <View style={[
            styles.forwardedContainer,
            isMe && { borderBottomColor: 'rgba(255,255,255,0.2)' }
          ]}>
            <View style={styles.forwardedHeader}>
              <Ionicons 
                name="arrow-forward" 
                size={11} 
                color={isMe ? "rgba(255,255,255,0.7)" : "#64748B"} 
              />
              <Text style={[
                styles.forwardedLabel,
                { color: isMe ? "rgba(255,255,255,0.85)" : "#64748B" }
              ]}>
                Forwarded
              </Text>
            </View>
            
            <View style={styles.forwardedSender}>
              {fromAvatar ? (
                <View style={styles.forwardedAvatar}>
                  <Avatar name={forwardedFrom} avatarUrl={fromAvatar.trim()} size={20} />
                </View>
              ) : (
                <View style={[
                  styles.forwardedAvatarPlaceholder,
                  { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : '#F1F5F9' }
                ]}>
                  <Ionicons 
                    name="person" 
                    size={13} 
                    color={isMe ? "rgba(255,255,255,0.7)" : "#94A3B8"} 
                  />
                </View>
              )}
              
              <Text style={[
                styles.forwardedFromText,
                { color: isMe ? '#fff' : '#1e293b' }
              ]}>
                {forwardedFrom}
              </Text>
              
              {onForwardedPress && (
                <Ionicons 
                  name="chevron-forward" 
                  size={15} 
                  color={isMe ? "rgba(255,255,255,0.7)" : "#64748B"} 
                />
              )}
            </View>
          </View>
        </TouchableOpacity>
      )}
      
      <View style={styles.audioRow}>
        <TouchableOpacity onPress={togglePlayback} style={[styles.playButton, { backgroundColor: theme.buttonBg }]} disabled={isLoading} activeOpacity={0.7}>
          {isLoading ? <ActivityIndicator size="small" color={theme.iconColor} /> : (
            <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={theme.iconColor} style={{ marginLeft: isPlaying ? 0 : 2 }} />
          )}
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <View style={styles.sliderWrapper}>
             <Slider
              style={styles.slider} minimumValue={0} maximumValue={duration || 1} value={position}
              onSlidingComplete={onSliderValueChange}
              minimumTrackTintColor={theme.thumbColor} maximumTrackTintColor={theme.trackColor} thumbTintColor={theme.thumbColor} tapToSeek
            />
          </View>

          <View style={styles.footerRow}>
            <Text style={[styles.timeText, { color: theme.textSecondary }]}>
              {formatTime(position)} / {formatTime(duration)}
            </Text>
            
            <View style={styles.spacer} />
            
            <View style={styles.statusContainer}>
              {timestamp && <Text style={[styles.timestampText, { color: theme.textSecondary }]}>{timestamp}</Text>}
              {isMe && (
                isPending ? (
                  <Ionicons name="time-outline" size={12} color={theme.textSecondary} style={styles.statusIcon} />
                ) : (
                  <Ionicons name={read ? "checkmark-done" : "checkmark"} size={12} color={read ? "#22D3EE" : theme.textSecondary} style={styles.statusIcon} />
                )
              )}
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    borderRadius: 20, 
    minWidth: 220, 
    maxWidth: 260, 
    elevation: 3 
  },
  
  // Forwarded badge styles - matching text message design
  forwardedContainer: {
    paddingBottom: 8,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
  },
  forwardedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  forwardedLabel: {
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  forwardedSender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forwardedAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  forwardedAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardedFromText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  // Audio row container
  audioRow: {
    flexDirection: "row", 
    alignItems: "center",
  },
  playButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: "center", 
    alignItems: "center", 
    marginRight: 10 
  },
  contentContainer: { 
    flex: 1, 
    justifyContent: "center" 
  },
  sliderWrapper: { 
    height: 20, 
    justifyContent: "center", 
    marginTop: 4 
  },
  slider: { 
    width: "100%", 
    height: 20 
  },
  footerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginTop: 2, 
    paddingHorizontal: 2 
  },
  timeText: { 
    fontSize: 11, 
    fontWeight: "600" 
  },
  spacer: { 
    flex: 1 
  },
  statusContainer: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  timestampText: { 
    fontSize: 10, 
    fontWeight: "500" 
  },
  statusIcon: { 
    marginLeft: 4 
  },
    // FIXED: Audio forwarded wrapper styles
  myForwardedWrapper: {
    backgroundColor: '#6366F1',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    marginBottom: -4,
  },
  
  otherForwardedWrapper: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    marginBottom: -4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
    borderBottomWidth: 0,
  },
});

export default memo(AudioBubbleComponent);