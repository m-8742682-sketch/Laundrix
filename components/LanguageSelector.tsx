import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useI18n, Language } from "@/i18n/i18n";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const languages: { code: Language; name: string; flag: string; nativeName: string }[] = [
  { code: "en", name: "English", flag: "🇬🇧", nativeName: "English" },
  { code: "ms", name: "Bahasa Melayu", flag: "🇲🇾", nativeName: "Bahasa Melayu" },
  { code: "zh", name: "中文", flag: "🇨🇳", nativeName: "中文" },
];

export default function LanguageSelector({ visible, onClose }: Props) {
  const { language, setLanguage, t } = useI18n();

  const handleSelect = async (lang: Language) => {
    await setLanguage(lang);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.selectLanguage}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View style={styles.options}>
            {languages.map((lang) => (
              <TouchableOpacity 
                key={lang.code} 
                style={[
                  styles.option, 
                  language === lang.code && styles.optionActive
                ]} 
                onPress={() => handleSelect(lang.code)}
              >
                <View style={styles.optionLeft}>
                  <Text style={styles.flag}>{lang.flag}</Text>
                  <View>
                    <Text style={styles.langName}>{lang.nativeName}</Text>
                    <Text style={styles.langSubName}>{lang.name}</Text>
                  </View>
                </View>
                {language === lang.code && (
                  <LinearGradient colors={["#0EA5E9", "#0284C7"]} style={styles.checkCircle}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  </LinearGradient>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: "rgba(0, 0, 0, 0.5)", 
    justifyContent: "center", 
    alignItems: "center", 
    padding: 24 
  },
  container: { 
    backgroundColor: "#fff", 
    borderRadius: 20, 
    width: "100%", 
    maxWidth: 340, 
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: "#f1f5f9" 
  },
  title: { 
    fontSize: 18, 
    fontWeight: "700", 
    color: "#0f172a" 
  },
  closeBtn: { 
    padding: 4 
  },
  options: { 
    padding: 12 
  },
  option: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingVertical: 14, 
    paddingHorizontal: 16, 
    borderRadius: 12, 
    marginBottom: 8, 
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "transparent",
  },
  optionActive: {
    backgroundColor: "#f0f9ff",
    borderColor: "#0ea5e9",
  },
  optionLeft: { 
    flexDirection: "row", 
    alignItems: "center" 
  },
  flag: { 
    fontSize: 28, 
    marginRight: 14 
  },
  langName: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: "#1e293b" 
  },
  langSubName: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  checkCircle: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    alignItems: "center", 
    justifyContent: "center" 
  },
});