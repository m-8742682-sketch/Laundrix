/**
 * i18n - Internationalization Support
 * 
 * Supports: English (en), Malay (ms), Chinese (zh)
 * Saves language preference to Firestore users/{uid}/language
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "@/services/firebase";
import { en, ms, zh, Translations } from "./translations";

// Available languages
export type Language = "en" | "ms" | "zh";

const translations: Record<Language, Translations> = { en, ms, zh };

interface I18nContextValue {
  language: Language;
  t: Translations;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const STORAGE_KEY = "@laundrix_language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && (stored === "en" || stored === "ms" || stored === "zh")) {
        setLanguageState(stored);
      }
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const firestoreLang = userDoc.data()?.language;
          if (firestoreLang === "en" || firestoreLang === "ms" || firestoreLang === "zh") {
            setLanguageState(firestoreLang);
            await AsyncStorage.setItem(STORAGE_KEY, firestoreLang);
          }
        }
      }
    } catch (error) {
      console.warn("[i18n] Error loading language:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = useCallback(async (lang: Language) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem(STORAGE_KEY, lang);
      const user = auth.currentUser;
      if (user) {
        await updateDoc(doc(db, "users", user.uid), { language: lang });
      }
    } catch (error) {
      console.error("[i18n] Error saving language:", error);
    }
  }, []);

  const value: I18nContextValue = {
    language,
    t: translations[language],
    setLanguage,
    isLoading,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function useTranslations() {
  const { t } = useI18n();
  return t;
}

export default { I18nProvider, useI18n, useTranslations };