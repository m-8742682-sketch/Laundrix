import Avatar from "@/components/Avatar";
import { useUser } from "@/components/UserContext";
import { useProfileViewModel } from "@/viewmodels/settings/ProfileViewModel";
import { useAccountViewModel } from "@/viewmodels/settings/AccountViewModel";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState, useRef } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function ProfileScreen() {
  const { user } = useUser();
  const { profile, loading, changeAvatar, saveProfile } =
    useProfileViewModel(user?.uid);
  const {
    email,
    resetPassword,
    logout,
    isEmailVerified,
    reauthenticate,
    loading: accountLoading,
  } = useAccountViewModel();

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Input focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [contactFocused, setContactFocused] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setContact(profile.contact ?? "");
    }
  }, [profile]);

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await changeAvatar(result.assets[0].uri);
    }
  };

  if (loading || !profile) {
    return (
      <View style={styles.center}>
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Decorative background */}
      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
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
            {/* Avatar Section */}
            <Animated.View
              style={[
                styles.avatarSection,
                { transform: [{ scale: scaleAnim }] },
              ]}
            >
              <Pressable style={styles.avatarContainer} onPress={pickAvatar}>
                <LinearGradient
                  colors={["#4FC3F7", "#29B6F6", "#0288D1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarGradient}
                >
                  <View style={styles.avatarInner}>
                    <Avatar
                      name={profile.name}
                      avatarUrl={profile.avatarUrl}
                      size={92}
                    />
                  </View>
                </LinearGradient>
                <View style={styles.avatarShadow} />
                
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={16} color="#ffffff" />
                </View>
              </Pressable>
              
              <Text style={styles.changePhotoText}>Tap to change photo</Text>
            </Animated.View>

            {/* Profile Info Card */}
            <View style={styles.card}>
              {/* Full Name */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Full Name</Text>
                <View
                  style={[
                    styles.inputContainer,
                    nameFocused && styles.inputContainerFocused,
                  ]}
                >
                  <View style={styles.inputIconContainer}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="person-outline" size={18} color="#0284C7" />
                    </View>
                  </View>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => setNameFocused(false)}
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View
                  style={{
                    backgroundColor: nameFocused ? "#0EA5E9" : "transparent",
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    borderRadius: 2,
                  }}
                />
              </View>

              {/* Email (Read-only) */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.readonlyContainer}>
                  <View style={styles.inputIconContainer}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="mail-outline" size={18} color="#64748b" />
                    </View>
                  </View>
                  <Text style={styles.readonlyText}>{email}</Text>
                </View>
              </View>

              {/* Contact */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Contact (Optional)</Text>
                <View
                  style={[
                    styles.inputContainer,
                    contactFocused && styles.inputContainerFocused,
                  ]}
                >
                  <View style={styles.inputIconContainer}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="call-outline" size={18} color="#0284C7" />
                    </View>
                  </View>
                  <TextInput
                    value={contact}
                    onChangeText={setContact}
                    onFocus={() => setContactFocused(true)}
                    onBlur={() => setContactFocused(false)}
                    style={styles.input}
                    placeholder="Phone / WhatsApp"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View
                  style={{
                    backgroundColor: contactFocused ? "#0EA5E9" : "transparent",
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    borderRadius: 2,
                  }}
                />
              </View>

              {/* Joined Date (Read-only) */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Member Since</Text>
                <View style={styles.readonlyContainer}>
                  <View style={styles.inputIconContainer}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="calendar-outline" size={18} color="#64748b" />
                    </View>
                  </View>
                  <Text style={styles.readonlyText}>
                    {profile.createdAt.toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {/* Save Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.saveButtonWrapper,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => saveProfile(name, contact)}
              >
                <LinearGradient
                  colors={["#0EA5E9", "#0284C7", "#0369A1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButton}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                  <Text style={styles.saveText}>Save Changes</Text>
                </LinearGradient>
              </Pressable>

              {/* Reset Password Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={resetPassword}
              >
                <Ionicons name="key-outline" size={20} color="#0284C7" />
                <Text style={styles.secondaryText}>Reset Password</Text>
              </Pressable>

              {/* Logout Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={async () => {
                  await logout();
                  router.replace("/(auth)/login");
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#dc2626" />
                <Text style={styles.logoutText}>Sign Out</Text>
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
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "#E0F7FA",
    opacity: 0.3,
    top: -80,
    right: -60,
  },

  decorCircle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#B3E5FC",
    opacity: 0.25,
    bottom: 100,
    left: -50,
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },

  content: {
    flex: 1,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },

  loadingText: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "500",
  },

  avatarSection: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 16,
  },

  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },

  avatarGradient: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },

  avatarInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },

  avatarShadow: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#0284C7",
    opacity: 0.15,
    bottom: -6,
    left: 0,
    zIndex: -1,
  },

  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#0EA5E9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
    elevation: 4,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  changePhotoText: {
    fontSize: 14,
    color: "#0284C7",
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },

  fieldContainer: {
    marginBottom: 20,
    position: "relative",
  },

  label: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    elevation: 2,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
  },

  inputContainerFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#0EA5E9",
    shadowOpacity: 0.1,
    elevation: 3,
  },

  inputIconContainer: {
    marginRight: 10,
  },

  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E0F7FA",
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    paddingVertical: 12,
    fontWeight: "500",
  },

  readonlyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  readonlyText: {
    flex: 1,
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },

  actionsContainer: {
    gap: 12,
  },

  saveButtonWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  saveButton: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  saveText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  secondaryButton: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    gap: 8,
  },

  secondaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0284C7",
  },

  logoutButton: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#fef2f2",
    borderWidth: 2,
    borderColor: "#fecaca",
    gap: 8,
  },

  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#dc2626",
  },

  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});