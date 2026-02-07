import React, { useRef, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Pressable, 
  Alert,
  Animated,
  StatusBar,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function HelpCenter() {
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
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#0f172a" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Help Center</Text>
            <Text style={styles.headerSubtitle}>We're here to help</Text>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsContainer}>
            <QuickActionCard
              icon="sparkles"
              label="AI Assistant"
              colors={["#8b5cf6", "#7c3aed"]}
              onPress={() => router.push("/(settings)/ai_assistant")}
            />
            <QuickActionCard
              icon="mail"
              label="Contact Us"
              colors={["#0ea5e9", "#0284c7"]}
              onPress={() =>
                Alert.alert(
                  "Contact Support",
                  "Email us at:\n\nsupport@laundrix.app",
                  [
                    { text: "Cancel", style: "cancel" },
                    { 
                      text: "Open Email", 
                      onPress: () => Linking.openURL("mailto:support@laundrix.app")
                    },
                  ]
                )
              }
            />
          </View>

          {/* FAQ Section */}
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          <FaqItem
            icon="notifications"
            iconColor="#3b82f6"
            iconBg="#eff6ff"
            question="How do notifications work?"
            answer="Laundrix notifies you when your laundry is ready or when it's almost your turn, based on your notification settings. You can customize these in Settings > Notifications."
          />

          <FaqItem
            icon="alert-circle"
            iconColor="#ef4444"
            iconBg="#fef2f2"
            question="Why am I not receiving notifications?"
            answer="Please check that notifications are enabled in the app settings and in your device settings. Go to Settings > Notifications to enable all alerts."
          />

          <FaqItem
            icon="mail"
            iconColor="#8b5cf6"
            iconBg="#faf5ff"
            question="Can I change my email address?"
            answer="Currently, email changes are not supported. This feature will be added in a future update. Contact support if you need assistance."
          />

          <FaqItem
            icon="time"
            iconColor="#10b981"
            iconBg="#f0fdf4"
            question="How does the queue system work?"
            answer="When you join a queue, you'll receive notifications about your position. The system automatically updates based on laundry completion times."
          />

          <FaqItem
            icon="lock-closed"
            iconColor="#f59e0b"
            iconBg="#fef3c7"
            question="Is my data secure?"
            answer="Yes! We use industry-standard encryption to protect your data. Your information is never sold to third parties. Learn more in our Privacy Policy."
          />

          {/* Contact Support Card */}
          <View style={styles.supportCard}>
            <LinearGradient
              colors={["#f8fafc", "#ffffff"]}
              style={styles.supportCardGradient}
            >
              <View style={styles.supportHeader}>
                <View style={styles.supportIconContainer}>
                  <LinearGradient
                    colors={["#0ea5e9", "#0284c7"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.supportIcon}
                  >
                    <Ionicons name="chatbubbles" size={24} color="#ffffff" />
                  </LinearGradient>
                </View>
                <View style={styles.supportTextContainer}>
                  <Text style={styles.supportTitle}>Still need help?</Text>
                  <Text style={styles.supportDescription}>
                    Our support team is ready to assist you
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.contactButton,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() =>
                  Alert.alert(
                    "Contact Support",
                    "Email us at:\n\nsupport@laundrix.app",
                    [
                      { text: "Cancel", style: "cancel" },
                      { 
                        text: "Open Email", 
                        onPress: () => Linking.openURL("mailto:support@laundrix.app")
                      },
                    ]
                  )
                }
              >
                <LinearGradient
                  colors={["#0ea5e9", "#0284c7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.contactButtonGradient}
                >
                  <Ionicons name="mail" size={18} color="#ffffff" />
                  <Text style={styles.contactButtonText}>Contact Support</Text>
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </View>

          {/* App Info */}
          <Text style={styles.sectionTitle}>About Laundrix</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Laundrix helps you manage laundry queues and receive notifications when 
              your laundry is ready. Designed to make laundry day hassle-free!
            </Text>
            <View style={styles.versionContainer}>
              <Ionicons name="information-circle" size={16} color="#64748b" />
              <Text style={styles.versionText}>Version 1.0.0</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

/* ---------- QUICK ACTION CARD ---------- */
function QuickActionCard({ icon, label, colors, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionCard,
        pressed && { opacity: 0.8 },
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickActionGradient}
      >
        <Ionicons name={icon} size={24} color="#ffffff" />
        <Text style={styles.quickActionLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ---------- FAQ ITEM ---------- */
function FaqItem({ 
  icon, 
  iconColor, 
  iconBg, 
  question, 
  answer 
}: { 
  icon: string;
  iconColor: string;
  iconBg: string;
  question: string; 
  answer: string;
}) {
  return (
    <View style={styles.faq}>
      <View style={styles.faqHeader}>
        <View style={[styles.faqIconBox, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
        </View>
        <Text style={styles.question}>{question}</Text>
      </View>
      <Text style={styles.answer}>{answer}</Text>
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
    backgroundColor: "#ddd6fe",
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

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },

  quickActionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },

  quickActionCard: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },

  quickActionGradient: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  quickActionLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },

  faq: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#f1f5f9",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },

  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },

  faqIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },

  answer: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 22,
    marginLeft: 48,
    fontWeight: "500",
  },

  supportCard: {
    marginVertical: 24,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },

  supportCardGradient: {
    padding: 20,
    borderWidth: 2,
    borderColor: "#f1f5f9",
    borderRadius: 20,
  },

  supportHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },

  supportIconContainer: {
    borderRadius: 14,
    overflow: "hidden",
  },

  supportIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  supportTextContainer: {
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

  contactButton: {
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#0284c7",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  contactButtonGradient: {
    flexDirection: "row",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  contactButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  infoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  infoText: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: "500",
  },

  versionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  versionText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
});