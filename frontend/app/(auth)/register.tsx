import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useRegisterViewModel } from "@/viewmodels/auth/RegisterViewModel";

const logoImg = require("../../assets/images/laundrix.png");
const { width, height } = Dimensions.get("window");

export default function Register() {
  const {
    email,
    password,
    loading,
    setEmail,
    setPassword,
    register,
  } = useRegisterViewModel();

  const passwordInputRef = useRef<TextInput>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Input focus states
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse animation for decorative elements
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
        <View style={styles.decorCircle3} />
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
            {/* Logo with gradient background */}
            <Animated.View
              style={[
                styles.logoContainer,
                { transform: [{ scale: logoScale }] },
              ]}
            >
              <LinearGradient
                colors={["#4FC3F7", "#29B6F6", "#0288D1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Image source={logoImg} style={styles.logo} />
              </LinearGradient>
              <View style={styles.logoShadow} />
            </Animated.View>

            {/* Title Section */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>Join Laundrix</Text>
              <Text style={styles.subtitle}>
                Start Your Journey to Effortless Laundry 🧺
              </Text>
            </View>

            {/* Input Fields Container */}
            <View style={styles.inputsContainer}>
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
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
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

              {/* Password Input */}
              <View style={styles.inputWrapper}>
                <View
                  style={[
                    styles.inputContainer,
                    passwordFocused && styles.inputContainerFocused,
                  ]}
                >
                  <View style={styles.inputIconContainer}>
                    <View style={styles.iconCircle}>
                      <Text style={styles.inputIcon}>🔒</Text>
                    </View>
                  </View>
                  <TextInput
                    ref={passwordInputRef}
                    placeholder="Create password"
                    placeholderTextColor="#94a3b8"
                    style={styles.input}
                    value={password}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    onChangeText={setPassword}
                    secureTextEntry
                    editable={!loading}
                  />
                </View>
                <View
                  style={{
                    backgroundColor: passwordFocused ? "#0EA5E9" : "transparent",
                    position: 'absolute',
                    bottom: 0,
                    left: 16,
                    right: 16,
                    height: 3,
                    borderRadius: 2,
                  }}
                />
              </View>

              {/* Password hint */}
              <View style={styles.passwordHint}>
                <Text style={styles.hintText}>
                  💡 Use 8+ characters with letters & numbers
                </Text>
              </View>
            </View>

            {/* Register Button with Gradient */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButtonWrapper,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={() => register(() => router.replace("/(auth)/login"))}
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
                <Text style={styles.primaryButtonText}>
                  {loading ? "Creating account..." : "Create Account"}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Terms & Privacy */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                By signing up, you agree to our{" "}
              </Text>
              <Pressable>
                <Text style={styles.termsLink}>Terms</Text>
              </Pressable>
              <Text style={styles.termsText}> & </Text>
              <Pressable>
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Pressable>
            </View>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Pressable onPress={() => router.back()}>
                <LinearGradient
                  colors={["#0EA5E9", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginLinkGradient}
                >
                  <Text style={styles.loginLink}>Sign In</Text>
                </LinearGradient>
              </Pressable>
            </View>
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
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "#E0F7FA",
    opacity: 0.4,
    top: -100,
    right: -100,
  },

  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#B3E5FC",
    opacity: 0.3,
    bottom: 100,
    left: -50,
  },

  decorCircle3: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#81D4FA",
    opacity: 0.2,
    top: "40%",
    right: -30,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },

  content: {
    flex: 1,
    justifyContent: "center",
  },

  logoContainer: {
    alignSelf: "center",
    marginBottom: 32,
  },

  logoGradient: {
    width: 110,
    height: 110,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },

  logo: {
    width: 70,
    height: 70,
    tintColor: "#ffffff",
  },

  logoShadow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: "#0284C7",
    opacity: 0.2,
    bottom: -8,
    left: 0,
    zIndex: -1,
  },

  titleSection: {
    marginBottom: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
    color: "#0f172a",
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 15,
    color: "#64748b",
    textAlign: "center",
    fontWeight: "500",
    letterSpacing: 0.2,
  },

  inputsContainer: {
    marginBottom: 24,
  },

  inputWrapper: {
    marginBottom: 20,
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

  passwordHint: {
    marginTop: -8,
    marginBottom: 8,
  },

  hintText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    paddingLeft: 4,
  },

  primaryButtonWrapper: {
    marginTop: 8,
    marginBottom: 20,
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

  termsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },

  termsText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },

  termsLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284C7",
  },

  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },

  loginText: {
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },

  loginLinkGradient: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },

  loginLink: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
});