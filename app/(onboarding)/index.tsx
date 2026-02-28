import { useI18n } from "@/i18n/i18n";
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  StyleSheet,
  ImageBackground,
  StatusBar,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

// Get dimensions outside to ensure they are accessible to the Stylesheet and FlatList
const { width, height } = Dimensions.get("window");



export default function Onboarding() {
  const { t } = useI18n();

  const slides = [

  {
    key: "1",
    title: "Welcome to Laundrix",
    description: "Laundry made simple, fast, and reliable.",
    image: require("../../assets/images/onboarding/wash1.jpg"),
  },
  {
    key: "2",
    title: "Track Your Orders",
    description: "Know exactly when your laundry is ready.",
    image: require("../../assets/images/onboarding/wash2.jpg"),
  },
  {
    key: "3",
    title: "Fresh & Clean",
    description: "Professional care for your everyday wear.",
    image: require("../../assets/images/onboarding/wash3.jpg"),
  },
];

  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  
  // Animation value for the text fade-in and subtle slide-up
  const contentFadeAnim = useRef(new Animated.Value(0)).current;

  const triggerAnimation = () => {
    contentFadeAnim.setValue(0); // Reset animation state
    Animated.timing(contentFadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  // Re-run the text animation every time the user swiped to a new slide
  useEffect(() => {
    triggerAnimation();
  }, [index]);

  const finish = async () => {
    await AsyncStorage.setItem("hasLaunched", "true");
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      {/* Translucent status bar allows the image to bleed into the top of the screen */}
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      
      <FlatList
        ref={listRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        // Use width to determine current slide index
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={{ width, height }}>
            <ImageBackground
              source={item.image}
              style={StyleSheet.absoluteFillObject} // Ensures the image covers the entire background
              resizeMode="cover"
            >
              {/* Brand-aligned overlay to ensure text readability */}
              <View style={styles.overlay} />

              <Animated.View 
                style={[
                  styles.content,
                  { 
                    opacity: contentFadeAnim,
                    transform: [{
                      translateY: contentFadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0] // Slides text up by 20 units
                      })
                    }]
                  }
                ]}
              >
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc}>{item.description}</Text>
              </Animated.View>
            </ImageBackground>
          </View>
        )}
      />

      {/* Footer UI elements are absolutely positioned to stay static while images swipe */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.activeDot]}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
          ]}
          onPress={() => {
            if (index < slides.length - 1) {
              listRef.current?.scrollToIndex({ index: index + 1 });
            } else {
              finish();
            }
          }}
        >
          <Text style={styles.buttonText}>
            {index === slides.length - 1 ? t.getStarted : t.next}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Black background prevents white flashes during transitions
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14,165,233,0.65)", // Primary Laundrix Blue with 65% opacity
  },
  content: {
    position: "absolute",
    bottom: 240, 
    left: 24,
    right: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#ffffff",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  desc: {
    fontSize: 18,
    color: "#e0f2fe",
    lineHeight: 26,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    paddingBottom: 50,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: "#fff",
    width: 24, // Expanded dot for active state
  },
  button: {
    marginHorizontal: 30,
    backgroundColor: "#0EA5E9",
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: "center",
    // Premium shadow styling
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});