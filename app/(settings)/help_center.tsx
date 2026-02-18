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
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

export default function HelpCenter() {
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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Background Decor */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorCircle3} />
      </View>

      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
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
            <Text style={styles.headerTitle}>Help Center</Text>
            <Text style={styles.headerSubtitle}>We're here to help</Text>
          </View>
          <View style={styles.headerPlaceholder} />
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
              description="Get instant help"
              colors={["#8B5CF6", "#7C3AED"]}
              onPress={() => router.push("/(settings)/ai_assistant")}
            />
            <QuickActionCard
              icon="mail"
              label="Contact Us"
              description="Email support"
              colors={["#0EA5E9", "#0284C7"]}
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
            />
          </View>

          {/* FAQ Section */}
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          <FaqItem
            icon="notifications"
            question="How do notifications work?"
            answer="Laundrix notifies you when your laundry is ready or when it's almost your turn. Customize in Settings > Notifications."
            gradient={["#22D3EE", "#06B6D4"]}
          />

          <FaqItem
            icon="alert-circle"
            question="Why am I not receiving notifications?"
            answer="Check that notifications are enabled in app settings and device settings. Go to Settings > Notifications."
            gradient={["#6366F1", "#4F46E5"]}
          />

          <FaqItem
            icon="mail"
            question="Can I change my email address?"
            answer="Currently, email changes are not supported. This feature will be added soon. Contact support for assistance."
            gradient={["#8B5CF6", "#7C3AED"]}
          />

          <FaqItem
            icon="time"
            question="How does the queue system work?"
            answer="Join a queue and receive position updates. The system automatically updates based on laundry completion times."
            gradient={["#0EA5E9", "#0284C7"]}
          />

          <FaqItem
            icon="shield-checkmark"
            question="Is my data secure?"
            answer="Yes! We use industry-standard encryption. Your information is never sold. Learn more in Privacy Policy."
            gradient={["#22D3EE", "#06B6D4"]}
          />

          {/* Contact Support Card */}
          <View style={styles.supportCard}>
            <LinearGradient
              colors={["#ECFEFF", "#CFFAFE"]}
              style={styles.supportCardGradient}
            >
              <View style={styles.supportHeader}>
                <LinearGradient
                  colors={["#22D3EE", "#06B6D4"]}
                  style={styles.supportIcon}
                >
                  <Ionicons name="chatbubbles" size={24} color="#ffffff" />
                </LinearGradient>
                <View style={styles.supportTextContainer}>
                  <Text style={styles.supportTitle}>Still need help?</Text>
                  <Text style={styles.supportDescription}>
                    Our support team is ready to assist you
                  </Text>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [styles.contactButton, pressed && { opacity: 0.9 }]}
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
                  colors={["#22D3EE", "#06B6D4", "#0891B2"]}
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
            <View style={styles.infoHeader}>
              <LinearGradient
                colors={["#E0E7FF", "#C7D2FE"]}
                style={styles.infoIconGradient}
              >
                <Ionicons name="information-circle" size={22} color="#4F46E5" />
              </LinearGradient>
              <Text style={styles.infoText}>
                Laundrix helps you manage laundry queues and receive notifications when 
                your laundry is ready. Designed to make laundry day hassle-free!
              </Text>
            </View>
            <View style={styles.versionContainer}>
              <View style={styles.versionDot} />
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
function QuickActionCard({ icon, label, description, colors, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickActionCard,
        pressed && styles.quickActionCardPressed,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.quickActionGradient}
      >
        <View style={styles.quickActionIconCircle}>
          <Ionicons name={icon} size={28} color="#ffffff" />
        </View>
        <Text style={styles.quickActionLabel}>{label}</Text>
        <Text style={styles.quickActionDescription}>{description}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* ---------- FAQ ITEM ---------- */
function FaqItem({ 
  icon, 
  question, 
  answer,
  gradient,
}: { 
  icon: string;
  question: string; 
  answer: string;
  gradient: [string, string];
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Pressable 
      style={styles.faq}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.faqHeader}>
        <LinearGradient
          colors={gradient}
          style={styles.faqIconGradient}
        >
          <Ionicons name={icon as any} size={18} color="#fff" />
        </LinearGradient>
        <Text style={styles.question}>{question}</Text>
        <Ionicons 
          name={expanded ? "chevron-up" : "chevron-down"} 
          size={18} 
          color="#94a3b8" 
        />
      </View>
      {expanded && (
        <Text style={styles.answer}>{answer}</Text>
      )}
    </Pressable>
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
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#E0E7FF",
    opacity: 0.35,
    bottom: 200,
    left: -60,
  },

  decorCircle3: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#A5F3FC",
    opacity: 0.25,
    top: "45%",
    right: -30,
  },

  container: {
    flex: 1,
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

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 20,
  },

  quickActionsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
  },

  quickActionCard: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },

  quickActionCardPressed: {
    transform: [{ scale: 0.97 }],
  },

  quickActionGradient: {
    padding: 20,
    alignItems: "center",
  },

  quickActionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  quickActionLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },

  quickActionDescription: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },

  faq: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    elevation: 2,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },

  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  faqIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  question: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },

  answer: {
    fontSize: 14,
    color: "#64748b",
    lineHeight: 22,
    marginTop: 12,
    marginLeft: 48,
    fontWeight: "500",
  },

  supportCard: {
    marginTop: 20,
    marginBottom: 8,
    borderRadius: 24,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#22D3EE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },

  supportCardGradient: {
    padding: 20,
  },

  supportHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },

  supportIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  supportTextContainer: {
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

  contactButton: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },

  contactButtonGradient: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  contactButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },

  infoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  infoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },

  infoIconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    fontWeight: "500",
  },

  versionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    gap: 8,
  },

  versionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#6366F1",
  },

  versionText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
});