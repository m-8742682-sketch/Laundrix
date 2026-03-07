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
import { useI18n } from "@/i18n/i18n";

const { width } = Dimensions.get("window");
const SLIDE_WIDTH = width - 48;
const SLIDE_HEIGHT = 160;

interface Slide {
  id: number;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  gradient: readonly [string, string];
  accentColor: string;
}

const getSlides = (t: any): Slide[] => [
  {
    id: 1,
    icon: "scan",
    title: t.slideScanGoTitle,
    description: t.slideScanGoDesc,
    gradient: ["#0EA5E9", "#0284C7"],
    accentColor: "#38BDF8",
  },
  {
    id: 2,
    icon: "notifications",
    title: t.slideSmartAlertsTitle,
    description: t.slideSmartAlertsDesc,
    gradient: ["#0EA5E9", "#0369A1"],
    accentColor: "#818CF8",
  },
  {
    id: 3,
    icon: "people",
    title: t.slideQueueTitle,
    description: t.slideQueueDesc,
    gradient: ["#0284C7", "#7C3AED"],
    accentColor: "#A78BFA",
  },
  {
    id: 4,
    icon: "wifi",
    title: t.slideIoTTitle,
    description: t.slideIoTDesc,
    gradient: ["#10B981", "#059669"],
    accentColor: "#34D399",
  },
];

export default function DashboardSlideshow() {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const SLIDES = getSlides(t);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnims = useRef(SLIDES.map(() => new Animated.Value(0.9))).current;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % SLIDES.length;
        animateToSlide(next);
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, { 
      toValue: 1, 
      duration: 800, 
      useNativeDriver: true 
    }).start();
    
    // Initial scale animation
    Animated.stagger(
      100,
      scaleAnims.map(anim =>
        Animated.spring(anim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        })
      )
    ).start();
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
      {/* Glass Container */}
      <View style={styles.glassContainer}>
        <Animated.View
          style={[
            styles.slidesContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          {SLIDES.map((slide, index) => (
            <View key={slide.id} style={styles.slide}>
              <LinearGradient
                colors={slide.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.slideGradient}
              >
                {/* Glass Overlay */}
                <View style={styles.glassOverlay} />
                
                {/* Decorative Elements */}
                <View style={[styles.decorCircle, { backgroundColor: slide.accentColor + '30' }]} />
                <View style={[styles.decorRing, { borderColor: slide.accentColor + '20' }]} />
                
                {/* Content */}
                <View style={styles.content}>
                  <View style={styles.iconSection}>
                    <View style={styles.iconCircle}>
                      <Ionicons name={slide.icon} size={28} color={slide.gradient[1]} />
                    </View>
                    
                    {/* Slide Number */}
                    <View style={styles.slideNumber}>
                      <Text style={styles.slideNumberText}>{String(index + 1).padStart(2, '0')}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.textContainer}>
                    <Text style={styles.slideTitle}>{slide.title}</Text>
                    <Text style={styles.slideDescription}>{slide.description}</Text>
                  </View>
                </View>

                {/* Bottom Accent Line */}
                <View style={[styles.accentLine, { backgroundColor: slide.accentColor }]} />
              </LinearGradient>
            </View>
          ))}
        </Animated.View>

        {/* Touch areas */}
        <Pressable
          style={[styles.swipeArea, styles.swipeLeft]}
          onPress={() => onManualSwipe("right")}
        />
        <Pressable
          style={[styles.swipeArea, styles.swipeRight]}
          onPress={() => onManualSwipe("left")}
        />
      </View>

      {/* Indicators - Glass Pills */}
      <View style={styles.indicatorContainer}>
        {SLIDES.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => {
              setCurrentIndex(index);
              animateToSlide(index);
            }}
            style={styles.indicatorPressable}
          >
            <View style={styles.indicatorWrapper}>
              {index === currentIndex && (
                <View style={styles.indicatorActive} />
              )}
              <View
                style={[
                  styles.indicator,
                  index === currentIndex && styles.indicatorActiveBg,
                ]}
              />
            </View>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  glassContainer: {
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  slidesContainer: {
    flexDirection: "row",
  },
  slide: {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    paddingHorizontal: 4,
  },
  slideGradient: {
    flex: 1,
    borderRadius: 28,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  glassOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  decorCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -50,
    right: -30,
  },
  decorRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    bottom: -80,
    left: -50,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 1,
  },
  iconSection: {
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  slideNumber: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  slideNumberText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  textContainer: {
    flex: 1,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  slideDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.92)",
    fontWeight: "500",
    lineHeight: 20,
  },
  accentLine: {
    position: 'absolute',
    bottom: 0,
    left: 24,
    right: 24,
    height: 3,
    borderRadius: 2,
    opacity: 0.6,
  },
  
  // Indicators
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 20,
  },
  indicatorPressable: {
    padding: 4,
  },
  indicatorWrapper: {
    position: 'relative',
    height: 8,
    justifyContent: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E2E8F0",
  },
  indicatorActiveBg: {
    backgroundColor: "transparent",
  },
  indicatorActive: {
    position: 'absolute',
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0EA5E9",
    left: -8,
  },
  
  // Swipe areas
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