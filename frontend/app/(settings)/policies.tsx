import { View, Text, StyleSheet, ScrollView, Pressable, Animated, StatusBar, Dimensions, Alert, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function Policies() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 3000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorCircle3} />
      </View>

      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <LinearGradient
              colors={["#ECFEFF", "#CFFAFE"]}
              style={styles.backButtonGradient}
            >
              <Ionicons name="chevron-back" size={24} color="#0891B2" />
            </LinearGradient>
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Legal & Privacy</Text>
            <Text style={styles.headerSubtitle}>Policies & Disclosures</Text>
          </View>
          <View style={styles.headerPlaceholder} />
        </View>
      </Animated.View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Privacy Policy Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={["#22D3EE", "#06B6D4"]}
                style={styles.iconGradient}
              >
                <Ionicons name="shield-checkmark" size={22} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Privacy Policy</Text>
            </View>

            <View style={styles.contentBlock}>
              <BulletPoint text="Laundrix respects your privacy. We collect only the information necessary to provide our services, such as your email address, account details, and notification preferences." />
              <BulletPoint text="Your data is securely stored and is never sold to third parties. Notifications are sent only based on your preferences." />
              
              <View style={styles.infoBox}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="lock-closed" size={18} color="#0891B2" />
                </View>
                <Text style={styles.infoText}>
                  We use industry-standard encryption to protect your data
                </Text>
              </View>
            </View>
          </View>

          {/* Terms of Service Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={["#0EA5E9", "#0284C7"]}
                style={styles.iconGradient}
              >
                <Ionicons name="document-text" size={22} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Terms of Service</Text>
            </View>

            <View style={styles.contentBlock}>
              <BulletPoint text="By using Laundrix, you agree to use the app responsibly. Laundrix is provided 'as is' without warranties." />
              <BulletPoint text="We are not responsible for missed laundry, machine availability, or service interruptions." />
              
              <View style={styles.warningBox}>
                <View style={styles.warningIconContainer}>
                  <Ionicons name="alert-circle" size={18} color="#6366F1" />
                </View>
                <Text style={styles.warningText}>
                  Please read these terms carefully before using the service
                </Text>
              </View>
            </View>
          </View>

          {/* Disclosures Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={["#8B5CF6", "#7C3AED"]}
                style={styles.iconGradient}
              >
                <Ionicons name="notifications" size={22} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Disclosures</Text>
            </View>

            <View style={styles.contentBlock}>
              <FeatureItem 
                icon="notifications-outline" 
                title="Push Notifications" 
                text="Laundrix uses notifications to alert you about laundry status. You can disable them anytime in settings."
              />
              <FeatureItem 
                icon="wifi-outline" 
                title="Internet Access" 
                text="The app requires internet access to function properly and sync your data in real-time."
              />
              <FeatureItem 
                icon="cloud-outline" 
                title="Data Storage" 
                text="Your information is stored securely in the cloud and synced across your devices."
                last
              />
            </View>
          </View>

          {/* Contact Support Card */}
          <View style={styles.supportCard}>
            <LinearGradient
              colors={["#EEF2FF", "#E0E7FF"]}
              style={styles.supportCardGradient}
            >
              <View style={styles.supportContent}>
                <LinearGradient
                  colors={["#6366F1", "#4F46E5"]}
                  style={styles.supportIconGradient}
                >
                  <Ionicons name="help-circle" size={28} color="#ffffff" />
                </LinearGradient>
                <View style={styles.supportText}>
                  <Text style={styles.supportTitle}>Have Questions?</Text>
                  <Text style={styles.supportDescription}>
                    Contact our support team for any privacy or legal concerns
                  </Text>
                </View>
              </View>
              <Pressable 
                style={styles.supportButton}
                onPress={() =>
                                Alert.alert(
                                  "Contact Support",
                                  "Email us at:\n\nlaundrix.services@gmail.com",
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { 
                                      text: "Open Email", 
                                      onPress: () => Linking.openURL("mailto:laundrix.services@gmail.com")
                                    },
                                  ]
                                )
                              }
                >
                <LinearGradient
                  colors={["#6366F1", "#4F46E5", "#3730A3"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.supportButtonGradient}
                >
                  <Text style={styles.supportButtonText}>Contact Support</Text>
                  <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerDecor}>
              <View style={styles.footerLine} />
              <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
              <View style={styles.footerLine} />
            </View>
            <Text style={styles.footerText}>
              Last updated: {new Date().toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </Text>
            <Text style={styles.footerVersion}>Laundrix v1.0.0</Text>
          </View>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- BULLET POINT ---------- */
function BulletPoint({ text }: { text: string }) {
  return (
    <View style={styles.bulletPoint}>
      <View style={styles.bullet} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

/* ---------- FEATURE ITEM ---------- */
function FeatureItem({ icon, title, text, last }: { 
  icon: string; 
  title: string; 
  text: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.featureItem, last && { marginBottom: 0 }]}>
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon as any} size={20} color="#0891B2" />
      </View>
      <View style={styles.featureContent}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureText}>{text}</Text>
      </View>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  safe: {
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
    backgroundColor: "#CFFAFE",
    opacity: 0.4,
    top: -80,
    right: -80,
  },

  decorCircle2: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#E0E7FF",
    opacity: 0.35,
    bottom: 180,
    left: -50,
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

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  backButton: {
    borderRadius: 14,
    overflow: "hidden",
  },

  backButtonGradient: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerContent: {
    flex: 1,
    marginLeft: 12,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },

  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },

  headerPlaceholder: {
    width: 44,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
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
    marginBottom: 18,
    gap: 14,
  },

  iconGradient: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },

  contentBlock: {
    gap: 14,
  },

  bulletPoint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22D3EE",
    marginTop: 7,
  },

  bulletText: {
    flex: 1,
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    fontWeight: "500",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFEFF",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#CFFAFE",
  },

  infoIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#CFFAFE",
    alignItems: "center",
    justifyContent: "center",
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#0891B2",
    fontWeight: "600",
    lineHeight: 18,
  },

  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },

  warningIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#C7D2FE",
    alignItems: "center",
    justifyContent: "center",
  },

  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#4F46E5",
    fontWeight: "600",
    lineHeight: 18,
  },

  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 14,
  },

  featureIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#ECFEFF",
    alignItems: "center",
    justifyContent: "center",
  },

  featureContent: {
    flex: 1,
  },

  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },

  featureText: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    fontWeight: "500",
  },

  supportCard: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 24,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },

  supportCardGradient: {
    padding: 20,
  },

  supportContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },

  supportIconGradient: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  supportText: {
    flex: 1,
  },

  supportTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },

  supportDescription: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },

  supportButton: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  supportButtonGradient: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  supportButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  footer: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 10,
  },

  footerDecor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },

  footerLine: {
    width: 40,
    height: 1,
    backgroundColor: "#e2e8f0",
  },

  footerText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "500",
  },

  footerVersion: {
    fontSize: 11,
    color: "#cbd5e1",
    fontWeight: "600",
  },
});