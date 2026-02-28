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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";

export default function ProfileScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const { profile, loading, changeAvatar, saveProfile } =
    useProfileViewModel(user?.uid);
  const {
    email,
    resetPassword,
    logout,
    isEmailVerified,
    loading: accountLoading,
  } = useAccountViewModel();

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t.error, t.nameCannotBeEmpty);
      return;
    }
    await saveProfile(name, contact);
    Alert.alert(t.success, t.profileUpdated);
  };

  if (loading || !profile) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.backgroundDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>
        <View style={styles.center}>
          <LinearGradient
            colors={["#22D3EE", "#06B6D4"]}
            style={styles.loadingIcon}
          >
            <Ionicons name="person" size={28} color="#fff" />
          </LinearGradient>
          <Text style={styles.loadingText}>{t.loadingProfile}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
        <View style={styles.decorCircle3} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
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
              <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
                <LinearGradient
                  colors={["#22D3EE", "#0EA5E9", "#0284C7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRingGradient}
                />
              </Animated.View>
              
              <View style={styles.avatarInnerContainer}>
                <Avatar
                  name={profile.name}
                  avatarUrl={profile.avatarUrl}
                  size={88}
                />
              </View>
              
              <View style={styles.editBadge}>
                <LinearGradient
                  colors={["#22D3EE", "#06B6D4"]}
                  style={styles.editBadgeGradient}
                >
                  <Ionicons name="camera" size={14} color="#ffffff" />
                </LinearGradient>
              </View>
            </Pressable>
            
            <Text style={styles.userName}>{profile.name}</Text>
            <Text style={styles.changePhotoText}>{t.tapToChangePhoto}</Text>
          </Animated.View>

          {/* Profile Info Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={["#22D3EE", "#06B6D4"]}
                style={styles.cardIconGradient}
              >
                <Ionicons name="person" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.cardTitle}>{t.personalInformation}</Text>
            </View>

            {/* Full Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t.fullName}</Text>
              <View
                style={[
                  styles.inputContainer,
                  nameFocused && styles.inputContainerFocused,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons name="person-outline" size={18} color={nameFocused ? "#22D3EE" : "#64748b"} />
                </View>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={styles.input}
                  placeholder={t.placeholderYourName}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            {/* Email (Read-only) */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t.emailAddress}</Text>
              <View style={styles.readonlyContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="mail-outline" size={18} color="#64748b" />
                </View>
                <Text style={styles.readonlyText}>{email}</Text>
                {isEmailVerified && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#22D3EE" />
                  </View>
                )}
              </View>
            </View>

            {/* Contact */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>{t.contactOptional}</Text>
              <View
                style={[
                  styles.inputContainer,
                  contactFocused && styles.inputContainerFocused,
                ]}
              >
                <View style={styles.inputIconContainer}>
                  <Ionicons name="call-outline" size={18} color={contactFocused ? "#22D3EE" : "#64748b"} />
                </View>
                <TextInput
                  value={contact}
                  onChangeText={setContact}
                  onFocus={() => setContactFocused(true)}
                  onBlur={() => setContactFocused(false)}
                  style={styles.input}
                  placeholder={t.placeholderPhone}
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Joined Date (Read-only) */}
            <View style={[styles.fieldContainer, { marginBottom: 0 }]}>
              <Text style={styles.label}>{t.memberSince}</Text>
              <View style={styles.readonlyContainer}>
                <View style={styles.inputIconContainer}>
                  <Ionicons name="calendar-outline" size={18} color="#64748b" />
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
            {/* Save Button - CYAN (Primary Action) */}
            <Pressable
              style={({ pressed }) => [
                styles.saveButtonWrapper,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSave}
            >
              <LinearGradient
                colors={["#22D3EE", "#06B6D4", "#0891B2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                <Text style={styles.saveText}>{t.saveChanges}</Text>
              </LinearGradient>
            </Pressable>

            {/* Reset Password Button - ORANGE (Warning/Caution) */}
            <Pressable
              style={({ pressed }) => [
                styles.warningButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => {
                Alert.alert(
                  t.resetPasswordTitle,
                  t.resetPasswordBody,
                  [
                    { text: t.cancel, style: "cancel" },
                    { 
                      text: t.send, 
                      onPress: () => {
                        resetPassword();
                        Alert.alert(t.emailSent, t.checkInboxInstructions);
                      }
                    },
                  ]
                );
              }}
            >
              <Ionicons name="key-outline" size={20} color="#D97706" />
              <Text style={styles.warningText}>{t.resetPassword}</Text>
            </Pressable>

            {/* Logout Button - RED (Destructive) */}
            <Pressable
              style={({ pressed }) => [
                styles.destructiveButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={async () => {
                Alert.alert(
                  t.signOutTitle,
                  t.signOutConfirm,
                  [
                    { text: t.cancel, style: "cancel" },
                    { 
                      text: t.signOutTitle, 
                      style: "destructive",
                      onPress: async () => {
                        await logout();
                        router.replace("/(auth)/login");
                      }
                    },
                  ]
                );
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.destructiveText}>{t.signOut}</Text>
            </Pressable>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
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
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#CFFAFE",
    opacity: 0.4,
    top: -100,
    right: -80,
  },

  decorCircle2: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0E7FF",
    opacity: 0.3,
    bottom: 150,
    left: -60,
  },

  decorCircle3: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#A5F3FC",
    opacity: 0.25,
    top: "40%",
    right: -30,
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
  },

  loadingIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 6,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  loadingText: {
    fontSize: 16,
    color: "#0891B2",
    fontWeight: "600",
  },

  avatarSection: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 20,
  },

  avatarContainer: {
    position: "relative",
    marginBottom: 16,
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
  },

  avatarRingGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 60,
    elevation: 8,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },

  avatarInnerContainer: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
  },

  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 6,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  editBadgeGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#ffffff",
  },

  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 4,
    letterSpacing: -0.3,
  },

  changePhotoText: {
    fontSize: 13,
    color: "#0891B2",
    fontWeight: "600",
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    elevation: 3,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 12,
  },

  cardIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.2,
  },

  fieldContainer: {
    marginBottom: 18,
  },

  label: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 8,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    minHeight: 52,
  },

  inputContainerFocused: {
    backgroundColor: "#ffffff",
    borderColor: "#22D3EE",
  },

  inputIconContainer: {
    marginRight: 12,
    width: 20,
    alignItems: "center",
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    paddingVertical: 14,
    fontWeight: "500",
  },

  readonlyContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 16,
    minHeight: 52,
  },

  readonlyText: {
    flex: 1,
    fontSize: 15,
    color: "#64748b",
    fontWeight: "500",
  },

  verifiedBadge: {
    marginLeft: 8,
  },

  actionsContainer: {
    gap: 12,
  },

  // Save Button (Cyan/Primary)
  saveButtonWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  saveButton: {
    flexDirection: "row",
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  saveText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Warning Button (Orange/Amber)
  warningButton: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFBEB", // Amber-50
    borderWidth: 2,
    borderColor: "#FDE68A", // Amber-200
    gap: 10,
  },

  warningText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#D97706", // Amber-600
  },

  // Destructive Button (Red)
  destructiveButton: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FEF2F2", // Red-50
    borderWidth: 2,
    borderColor: "#FECACA", // Red-200
    gap: 10,
  },

  destructiveText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#DC2626", // Red-600
  },

  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});