import { View, Text, StyleSheet, ScrollView, Pressable, Animated, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { LinearGradient } from "expo-linear-gradient";

export default function Policies() {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

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
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Decorative background */}
      <View style={styles.backgroundDecor}>
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />
      </View>

      <Animated.View 
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#0f172a" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Legal & Privacy</Text>
            <Text style={styles.headerSubtitle}>Policies & Disclosures</Text>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Privacy Policy Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <LinearGradient
                colors={["#4FC3F7", "#29B6F6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="shield-checkmark" size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Privacy Policy</Text>
            </View>

            <View style={styles.contentBlock}>
              <View style={styles.bulletPoint}>
                <View style={styles.bullet} />
                <Text style={styles.text}>
                  Laundrix respects your privacy. We collect only the information
                  necessary to provide our services, such as your email address,
                  account details, and notification preferences.
                </Text>
              </View>

              <View style={styles.bulletPoint}>
                <View style={styles.bullet} />
                <Text style={styles.text}>
                  Your data is securely stored and is never sold to third parties.
                  Notifications are sent only based on your preferences.
                </Text>
              </View>

              <View style={styles.infoBox}>
                <Ionicons name="information-circle" size={20} color="#0284C7" />
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
                colors={["#10b981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="document-text" size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Terms of Service</Text>
            </View>

            <View style={styles.contentBlock}>
              <View style={styles.bulletPoint}>
                <View style={styles.bullet} />
                <Text style={styles.text}>
                  By using Laundrix, you agree to use the app responsibly. Laundrix
                  is provided "as is" without warranties.
                </Text>
              </View>

              <View style={styles.bulletPoint}>
                <View style={styles.bullet} />
                <Text style={styles.text}>
                  We are not responsible for missed laundry, machine availability,
                  or service interruptions.
                </Text>
              </View>

              <View style={styles.warningBox}>
                <Ionicons name="alert-circle" size={20} color="#f59e0b" />
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
                colors={["#8b5cf6", "#7c3aed"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <Ionicons name="notifications" size={24} color="#ffffff" />
              </LinearGradient>
              <Text style={styles.sectionTitle}>Disclosures</Text>
            </View>

            <View style={styles.contentBlock}>
              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="notifications-outline" size={20} color="#0284C7" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Push Notifications</Text>
                  <Text style={styles.featureText}>
                    Laundrix uses notifications to alert you about laundry status.
                    You can disable them anytime in settings.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="wifi-outline" size={20} color="#0284C7" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Internet Access</Text>
                  <Text style={styles.featureText}>
                    The app requires internet access to function properly and sync
                    your data in real-time.
                  </Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={styles.featureIconContainer}>
                  <Ionicons name="cloud-outline" size={20} color="#0284C7" />
                </View>
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Data Storage</Text>
                  <Text style={styles.featureText}>
                    Your information is stored securely in the cloud and synced
                    across your devices.
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contact Support Card */}
          <View style={styles.supportCard}>
            <View style={styles.supportContent}>
              <Ionicons name="help-circle-outline" size={32} color="#0284C7" />
              <View style={styles.supportText}>
                <Text style={styles.supportTitle}>Have Questions?</Text>
                <Text style={styles.supportDescription}>
                  Contact our support team for any privacy or legal concerns
                </Text>
              </View>
            </View>
            <Pressable style={styles.supportButton}>
              <LinearGradient
                colors={["#0EA5E9", "#0284C7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.supportButtonGradient}
              >
                <Text style={styles.supportButtonText}>Contact Support</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
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
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0F7FA",
    opacity: 0.3,
    top: -50,
    right: -50,
  },

  decorCircle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#B3E5FC",
    opacity: 0.25,
    bottom: 200,
    left: -40,
  },

  container: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },

  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },

  iconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#0284C7",
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
    gap: 12,
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
    backgroundColor: "#0EA5E9",
    marginTop: 6,
  },

  text: {
    flex: 1,
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    fontWeight: "500",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  infoText: {
    flex: 1,
    fontSize: 13,
    color: "#1e40af",
    fontWeight: "600",
  },

  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    fontWeight: "600",
  },

  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
  },

  featureIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E0F7FA",
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
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },

  supportContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },

  supportText: {
    flex: 1,
  },

  supportTitle: {
    fontSize: 16,
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
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  supportButtonGradient: {
    flexDirection: "row",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  supportButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  footer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 8,
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