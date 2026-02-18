import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  onHelpPress: () => void;
  onAIPress: () => void;
  onPoliciesPress: () => void;
}

export default function DashboardFooter({
  onHelpPress,
  onAIPress,
  onPoliciesPress,
}: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Help Section */}
      <Text style={styles.sectionTitle}>Need Help?</Text>
      
      <View style={styles.helpButtons}>
        <Pressable onPress={onHelpPress} style={styles.helpBtn}>
          <View style={styles.helpIconCircle}>
            <Ionicons name="help-buoy" size={20} color="#64748B" />
          </View>
          <View style={styles.helpTextContainer}>
            <Text style={styles.helpTitle}>Help Center</Text>
            <Text style={styles.helpSubtitle}>FAQs & Guides</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </Pressable>

        <Pressable onPress={onAIPress} style={[styles.helpBtn, styles.aiBtn]}>
          <LinearGradient colors={["#6366F1", "#4F46E5"]} style={styles.aiIconCircle}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </LinearGradient>
          <View style={styles.helpTextContainer}>
            <Text style={[styles.helpTitle, { color: "#4F46E5" }]}>Ask AI</Text>
            <Text style={[styles.helpSubtitle, { color: "#6366F1" }]}>Smart Assistant</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#6366F1" />
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Policies */}
      <Pressable onPress={onPoliciesPress} style={styles.policiesRow}>
        <Ionicons name="shield-checkmark" size={18} color="#06B6D4" />
        <Text style={styles.policiesText}>Privacy & Policies</Text>
        <Ionicons name="open-outline" size={16} color="#94A3B8" />
      </Pressable>

      {/* Footer Info */}
      <View style={styles.footerInfo}>
        <Text style={styles.regulatedText}>Regulated by Laundrix Team</Text>
        <Text style={styles.kmjText}>Kolej Matrikulasi Johor</Text>
      </View>

      {/* Logos - Using Images */}
      <View style={styles.logosRow}>
        <View style={styles.logoBadge}>
          <Image 
            source={require("@/assets/images/laundrix-icon.png")} 
            style={styles.logoImage} 
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoText}>Laundrix</Text>
            <Text style={styles.logoSubtext}>Smart Laundry</Text>
          </View>
        </View>
        
        <View style={styles.dividerVertical} />
        
        <View style={styles.kmjBadge}>
          <Image 
            source={require("@/assets/images/kmj.png")} 
            style={styles.kmjImage} 
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.kmjLogoText}>KMJ</Text>
            <Text style={styles.kmjSubtext}>Kolej Matrikulasi Johor</Text>
          </View>
        </View>
      </View>

      {/* Copyright */}
      <Text style={styles.copyright}>© 2025 Laundrix. All rights reserved.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 16,
  },
  helpButtons: {
    gap: 12,
  },
  helpBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  aiBtn: {
    backgroundColor: "#F5F3FF",
    borderColor: "#E0E7FF",
  },
  helpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  aiIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  helpTextContainer: {
    flex: 1,
  },
  helpTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  helpSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 20,
  },
  policiesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    marginBottom: 20,
  },
  policiesText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  footerInfo: {
    alignItems: "center",
    marginBottom: 20,
  },
  regulatedText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  kmjText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    marginTop: 4,
  },
  logosRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
  },
  logoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  logoTextContainer: {
    gap: 2,
  },
  logoText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  logoSubtext: {
    fontSize: 11,
    color: "#06B6D4",
    fontWeight: "600",
  },
  dividerVertical: {
    width: 1,
    height: 32,
    backgroundColor: "#E2E8F0",
  },
  kmjBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kmjImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  kmjLogoText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  kmjSubtext: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  copyright: {
    fontSize: 12,
    color: "#CBD5E1",
    textAlign: "center",
    fontWeight: "500",
  },
});