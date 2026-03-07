import React from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "@/i18n/i18n";

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
  const { t } = useI18n();
  const SUPPORT_ITEMS = [
    {
      icon: "sparkles",
      label: t.footerAiAssistant,
      description: t.footerAiDesc,
      color: "#0284C7",
      bgColor: "rgba(245, 243, 255, 0.8)",
      gradientColors: ["#0284C7", "#A78BFA"],
    },
    {
      icon: "help-buoy",
      label: t.footerHelpCenter,
      description: t.footerHelpDesc,
      color: "#0EA5E9",
      bgColor: "rgba(240, 249, 255, 0.8)",
      gradientColors: ["#0EA5E9", "#38BDF8"],
    },
    {
      icon: "shield-checkmark",
      label: t.footerPrivacy,
      description: t.footerPrivacyDesc,
      color: "#10B981",
      bgColor: "rgba(236, 253, 245, 0.8)",
      gradientColors: ["#10B981", "#34D399"],
    },
  ];
  const handlers = [onAIPress, onHelpPress, onPoliciesPress];

  return (
    <View style={styles.container}>
      <View style={styles.glassGroup}>
        {SUPPORT_ITEMS.map((item, index) => (
          <FooterItem 
            key={item.label}
            icon={item.icon}
            label={item.label}
            description={item.description}
            color={item.color}
            bgColor={item.bgColor}
            onPress={handlers[index]}
            isLast={index === SUPPORT_ITEMS.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function FooterItem({ 
  icon, 
  label, 
  description,
  color, 
  bgColor,
  onPress, 
  isLast 
}: any) {
  return (
    <Pressable 
      onPress={onPress} 
      style={({pressed}) => [
        styles.item, 
        pressed && styles.itemPressed,
        isLast && styles.itemLast
      ]}
    >
      <View style={styles.itemLeft}>
        <View style={[styles.iconBox, { backgroundColor: bgColor }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.itemText}>{label}</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      </View>
      <View style={styles.chevronContainer}>
        <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 4,
  },
  glassGroup: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(241, 245, 249, 0.8)",
    backgroundColor: "transparent",
  },
  itemPressed: {
    backgroundColor: "rgba(248, 250, 252, 0.9)",
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  textContainer: {
    flex: 1,
  },
  itemText: {
    fontSize: 15,
    color: "#0F172A",
    fontWeight: "700",
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  chevronContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(241, 245, 249, 0.8)",
    alignItems: 'center',
    justifyContent: 'center',
  },
});