import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Avatar from "@/components/Avatar";

interface Props {
  userName: string;
  userAvatarUrl: string | null;
  onScanPress: () => void;
  onNotificationsPress: () => void;
  onProfilePress: () => void;
}

export default function DashboardHeader({ 
  userName, 
  userAvatarUrl, 
  onScanPress, 
  onNotificationsPress, 
  onProfilePress 
}: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.wrapper}>
      {/* 🎨 Beautiful Gradient Background */}
      <LinearGradient
        colors={["#6366F1", "#8B5CF6", "#A78BFA"]}
        locations={[0, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBg}
      />
      
      {/* Decorative Circles */}
      <View style={[styles.decorCircle, { top: -30, left: -30, backgroundColor: "rgba(255,255,255,0.1)" }]} />
      <View style={[styles.decorCircle, { top: 20, right: 80, backgroundColor: "rgba(255,255,255,0.08)" }]} />
      <View style={[styles.decorCircle, { bottom: -20, left: 100, backgroundColor: "rgba(255,255,255,0.05)" }]} />
      
      <View style={styles.container}>
        {/* 👤 LEFT SIDE: Avatar + Welcome */}
        <View style={styles.leftContent}>
          <Pressable 
            onPress={onProfilePress} 
            style={({ pressed }) => [
              styles.avatarContainer,
              pressed && styles.avatarPressed
            ]}
          >
            <View style={styles.avatarGlow}>
              <Avatar name={userName} avatarUrl={userAvatarUrl} size={48} />
            </View>
          </Pressable>
          
          <View style={styles.textColumn}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.nameText} numberOfLines={1}>{userName}</Text>
          </View>
        </View>

        {/* 🔘 RIGHT SIDE: Glass Action Buttons */}
        <View style={styles.rightActions}>
          <Pressable 
            onPress={onScanPress} 
            style={({ pressed }) => [
              styles.glassBtn, 
              pressed && styles.glassBtnPressed
            ]}
          >
            <Ionicons name="scan" size={20} color="#6366F1" />
          </Pressable>
          
          <Pressable 
            onPress={onNotificationsPress} 
            style={({ pressed }) => [
              styles.glassBtn, 
              pressed && styles.glassBtnPressed
            ]}
          >
            <Ionicons name="notifications" size={20} color="#6366F1" />
            <Animated.View style={[styles.badge, { transform: [{ scale: pulseAnim }] }]} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
  },
  decorCircle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  container: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 20,
    position: 'relative',
    zIndex: 1,
  },
  // 👤 LEFT SIDE: Avatar + Text
  leftContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12 
  },
  avatarContainer: {
    borderRadius: 28,
  },
  avatarGlow: { 
    borderWidth: 3, 
    borderColor: 'rgba(255,255,255,0.8)', 
    borderRadius: 28, 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    shadowOffset: { width: 0, height: 4 },
    elevation: 4 
  },
  avatarPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9
  },
  textColumn: { 
    alignItems: 'flex-start'
  },
  welcomeText: { 
    fontSize: 12, 
    color: 'rgba(255,255,255,0.8)', 
    fontWeight: '600', 
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4
  },
  nameText: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: '#FFFFFF',
    letterSpacing: -0.5
  },
  // 🔘 RIGHT SIDE: Action Buttons
  rightActions: { 
    flexDirection: 'row', 
    gap: 12 
  },
  glassBtn: { 
    width: 44, 
    height: 44, 
    borderRadius: 14, 
    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  glassBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    transform: [{ scale: 0.95 }],
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});