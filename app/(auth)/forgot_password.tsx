import { router } from "expo-router";
import {
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from "react-native";
import { useRef, useEffect, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";

import { useForgotPasswordViewModel } from "@/viewmodels/auth/ForgotPasswordViewModel";
import { useI18n } from "@/i18n/i18n";

const { width, height } = Dimensions.get("window");

export default function ForgotPassword() {
  const {
    email,
    loading,
    setEmail,
    sendReset,
  } = useForgotPasswordViewModel();
  const { t } = useI18n();

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Input focus state
  const [emailFocused, setEmailFocused] = useState(false);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Decorative background elements */}
      <View style={styles.backgroundDecor}>
        <Animated.View
          style={[
            styles.decorCircle1,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
        <Animated.View
          style={[
            styles.decorCircle2,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Icon with gradient background */}
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ scale: iconScale }] },
              ]}
            >
              <LinearGradient
                colors={["#4FC3F7", "#29B6F6", "#0288D1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Text style={styles.lockIcon}>🔐</Text>
              </LinearGradient>
              <View style={styles.iconShadow} />
            </Animated.View>

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>{t.forgotPasswordExclamation}</Text>
              <Text style={styles.subtitle}>{t.noWorriesReset}</Text>
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.inputContainer,
                  emailFocused && styles.inputContainerFocused,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.inputIcon}>📧</Text>
                  </View>
                </View>
                <TextInput
                  placeholder="Email address"
                  placeholderTextColor="#94a3b8"
                  style={styles.input}
                  value={email}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
              <View
                style={{
                  backgroundColor: emailFocused ? "#0EA5E9" : "transparent",
                  position: 'absolute',
                  bottom: 0,
                  left: 16,
                  right: 16,
                  height: 3,
                  borderRadius: 2,
                }}
              />
            </View>

            {/* Send Reset Button with Gradient */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButtonWrapper,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={() => sendReset(() => router.replace("/(auth)/login"))}
              disabled={loading}
            >
              <LinearGradient
                colors={
                  loading
                    ? ["#94a3b8", "#64748b"]
                    : ["#0EA5E9", "#0284C7", "#0369A1"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                {loading && (
                  <Animated.View
                    style={[
                      styles.loadingSpinner,
                      { transform: [{ scale: pulseAnim }] },
                    ]}
                  >
                    <Text style={styles.loadingDot}>⚪</Text>
                  </Animated.View>
                )}
                <Text style={styles.primaryButtonText}>{loading ? t.sending : t.sendResetLink}</Text>
              </LinearGradient>
            </Pressable>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>{t.checkInboxSpam}</Text>
            </View>

            {/* Back to Login */}
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              style={styles.backButton}
            >
              <Text style={styles.backArrow}>←</Text>
              <Text style={styles.backText}>{t.backToSignIn}</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  backgroundDecor: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },

  decorCircle1: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -80,
    right: -80,
  },

  decorCircle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 120,
    left: -60,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  content: {
    flex: 1,
    justifyContent: "center",
  },

  iconContainer: {
    alignSelf: "center",
    marginBottom: 28,
  },

  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },

  lockIcon: {
    fontSize: 48,
  },

  iconShadow: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 26,
    backgroundColor: "#0284C7",
    opacity: 0.2,
    bottom: -8,
    left: 0,
    zIndex: -1,
  },

  titleSection: {
    marginBottom: 32,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    color: "#0f172a",
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 22,
    paddingHorizontal: 10,
    letterSpacing: 0.2,
  },

  inputWrapper: {
    marginBottom: 24,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 2,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 8,
  },

  inputContainerFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#0EA5E9",
    shadowOpacity: 0.15,
    elevation: 4,
  },

  inputIconContainer: {
    marginRight: 12,
  },

  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E0F7FA",
    alignItems: "center",
    justifyContent: "center",
  },

  inputIcon: {
    fontSize: 20,
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: "#0f172a",
    paddingVertical: 16,
    fontWeight: "500",
  },

  primaryButtonWrapper: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },

  primaryButtonPressed: {
    transform: [{ scale: 0.98 }],
    elevation: 3,
  },

  primaryButton: {
    flexDirection: "row",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  loadingSpinner: {
    marginRight: 8,
  },

  loadingDot: {
    fontSize: 16,
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1e40af",
    fontWeight: "500",
    lineHeight: 18,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },

  backArrow: {
    fontSize: 20,
    color: "#0284C7",
    marginRight: 8,
  },

  backText: {
    fontSize: 16,
    color: "#0284C7",
    fontWeight: "600",
  },
});