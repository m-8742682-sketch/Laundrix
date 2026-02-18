import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const SLIDE_WIDTH = width - 40;

interface Slide {
  id: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  gradient: [string, string];
}

const SLIDES: Slide[] = [
  {
    id: 1,
    icon: "scan",
    title: "Scan & Go",
    description: "Scan QR code on any machine to start instantly",
    gradient: ["#0EA5E9", "#0284C7"],
  },
  {
    id: 2,
    icon: "notifications",
    title: "Smart Alerts",
    description: "Get notified when your laundry is ready",
    gradient: ["#6366F1", "#4F46E5"],
  },
  {
    id: 3,
    icon: "people",
    title: "Queue Management",
    description: "Join queues and track your position",
    gradient: ["#8B5CF6", "#7C3AED"],
  },
  {
    id: 4,
    icon: "wifi",
    title: "IoT Connected",
    description: "Monitor machine status remotely",
    gradient: ["#0EA5E9", "#0284C7"],
  },
];

export default function DashboardSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Auto-advance every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        animateToSlide(next);
        return next;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Initial animation
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  const animateToSlide = useCallback((index: number) => {
    Animated.spring(slideAnim, {
      toValue: -index * SLIDE_WIDTH,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, []);

  const onManualSwipe = useCallback((direction: "left" | "right") => {
    setCurrentIndex((prev) => {
      let next;
      if (direction === "left") {
        next = prev < SLIDES.length - 1 ? prev + 1 : 0;
      } else {
        next = prev > 0 ? prev - 1 : SLIDES.length - 1;
      }
      animateToSlide(next);
      return next;
    });
  }, [animateToSlide]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Features</Text>
        <View style={styles.indicatorContainer}>
          {SLIDES.map((_, index) => (
            <Pressable
              key={index}
              onPress={() => {
                setCurrentIndex(index);
                animateToSlide(index);
              }}
            >
              <View
                style={[
                  styles.indicator,
                  index === currentIndex && styles.indicatorActive,
                ]}
              />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.slidesWrapper}>
        <Animated.View
          style={[
            styles.slidesContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {SLIDES.map((slide) => (
            <View key={slide.id} style={styles.slide}>
              <LinearGradient
                colors={slide.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.slideGradient}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name={slide.icon} size={24} color={slide.gradient[1]} />
                </View>
                
                <View style={styles.textContainer}>
                  <Text style={styles.slideTitle}>{slide.title}</Text>
                  <Text style={styles.slideDescription}>{slide.description}</Text>
                </View>
              </LinearGradient>
            </View>
          ))}
        </Animated.View>

        {/* Touch areas for manual swipe */}
        <Pressable
          style={[styles.swipeArea, styles.swipeLeft]}
          onPress={() => onManualSwipe("right")}
        />
        <Pressable
          style={[styles.swipeArea, styles.swipeRight]}
          onPress={() => onManualSwipe("left")}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  indicatorContainer: {
    flexDirection: "row",
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
  },
  indicatorActive: {
    backgroundColor: "#0EA5E9",
    width: 20,
    borderRadius: 3,
  },
  slidesWrapper: {
    overflow: "hidden",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  slidesContainer: {
    flexDirection: "row",
  },
  slide: {
    width: SLIDE_WIDTH,
    paddingHorizontal: 4,
  },
  slideGradient: {
    padding: 24,
    borderRadius: 20,
    minHeight: 140,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  slideTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
  },
  slideDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    lineHeight: 20,
  },
  swipeArea: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
  },
  swipeLeft: {
    left: 0,
  },
  swipeRight: {
    right: 0,
  },
});