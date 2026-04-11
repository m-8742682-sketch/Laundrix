/**
 * information.tsx — Complete your profile
 * UI: matches login/register exactly (same animations, colors, structure)
 * Required: name, matricCard, icNumber
 * Optional: contact, practicum (present but don't block dashboard)
 * i18n: EN / MS / ZH
 */
import { useI18n } from '@/i18n/i18n';
import { auth, db } from '@/services/firebase';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated, Dimensions, Keyboard,
  KeyboardAvoidingView, Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text, TextInput,
  View,
} from 'react-native';

const { height } = Dimensions.get('window');

type FieldKey = 'name' | 'matricCard' | 'icNumber' | 'contact' | 'practicum';

interface FieldDef {
  key:          FieldKey;
  icon:         string;
  required:     boolean;
  keyboardType?: 'default' | 'phone-pad';
}

const FIELD_DEFS: FieldDef[] = [
  { key: 'name',       icon: 'person-outline',  required: true  },
  { key: 'matricCard', icon: 'card-outline',     required: true  },
  { key: 'icNumber',   icon: 'id-card-outline',  required: true  },
  { key: 'contact',    icon: 'call-outline',     required: false, keyboardType: 'phone-pad' },
  { key: 'practicum',  icon: 'school-outline',   required: false },
];

// ─── Isolated input — no sibling re-renders on focus ─────────────────────────
interface FieldInputProps {
  labelText:       string;
  placeholder:     string;
  icon:            string;
  required:        boolean;
  value:           string;
  isFocused:       boolean;
  loading:         boolean;
  onChangeText:    (text: string) => void;
  onFocus:         () => void;
  onBlur:          () => void;
  onSubmitEditing: () => void;
  inputRef:        React.RefObject<TextInput | null>;
  keyboardType?:   'default' | 'phone-pad';
  isLast?:         boolean;
}

const FieldInput = memo(({
  labelText, placeholder, icon, required, value, isFocused, loading,
  onChangeText, onFocus, onBlur, onSubmitEditing, inputRef,
  keyboardType = 'default', isLast = false,
}: FieldInputProps) => (
  <View style={styles.inputWrapper}>
    <Text style={styles.label}>
      {labelText}
      {required
        ? <Text style={styles.req}> *</Text>
        : <Text style={styles.optional}> (optional)</Text>
      }
    </Text>
    <View style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}>
      <View style={styles.inputIconContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon as any} size={20} color={isFocused ? '#0EA5E9' : '#64748B'} />
        </View>
      </View>
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        editable={!loading}
        keyboardType={keyboardType}
        autoCapitalize="words"
        selectionColor="#0EA5E9"
        returnKeyType={isLast ? 'done' : 'next'}
        blurOnSubmit={isLast}
      />
    </View>
    {/* Focus underline — matches login/register */}
    <View style={{
      backgroundColor: isFocused ? '#0EA5E9' : 'transparent',
      position: 'absolute', bottom: 0, left: 16, right: 16,
      height: 3, borderRadius: 2,
    }} />
  </View>
));

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function InformationScreen() {
  const { t } = useI18n();

  const [values, setValues] = useState<Record<FieldKey, string>>({
    name: '', matricCard: '', icNumber: '', contact: '', practicum: '',
  });
  const [focusedField, setFocusedField] = useState<FieldKey | null>(null);
  const [loading, setLoading] = useState(false);

  // One ref per field
  const nameRef      = useRef<TextInput>(null);
  const matricRef    = useRef<TextInput>(null);
  const icRef        = useRef<TextInput>(null);
  const contactRef   = useRef<TextInput>(null);
  const practicumRef = useRef<TextInput>(null);
  const refs: Record<FieldKey, React.RefObject<TextInput | null>> = {
    name: nameRef, matricCard: matricRef, icNumber: icRef,
    contact: contactRef, practicum: practicumRef,
  };
  const ORDER: FieldKey[] = ['name', 'matricCard', 'icNumber', 'contact', 'practicum'];

  // Animations — identical to login / register
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Self-guard: if already complete, redirect immediately ───────────────────
  // expo-router can restore the last visited route on app relaunch.
  // If the user already has profileComplete, we skip the form entirely.
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      const data = snap.exists() ? snap.data() : null;
      const alreadyComplete =
        data?.profileComplete === true ||
        (!!data?.name?.trim() && !!data?.matricCard?.trim() && !!data?.icNumber?.trim());
      if (alreadyComplete) router.replace('/(tabs)/dashboard');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50,   friction: 8, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50,   friction: 7, useNativeDriver: true }),
    ]).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.05, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 2000, useNativeDriver: true }),
    ])).start();
  }, []);

  const handleChange = useCallback((key: FieldKey) => (val: string) => {
    setValues(v => ({ ...v, [key]: val }));
  }, []);

  const handleFocus = useCallback((key: FieldKey) => () => setFocusedField(key), []);
  const handleBlur  = useCallback(() => setFocusedField(null), []);

  const handleSubmit = useCallback((key: FieldKey) => () => {
    const idx  = ORDER.indexOf(key);
    const next = ORDER[idx + 1] as FieldKey | undefined;
    if (next) refs[next].current?.focus();
    else Keyboard.dismiss();
  }, []);

  const handleSave = async () => {
    // Only required fields gate the save
    const REQUIRED: FieldKey[] = ['name', 'matricCard', 'icNumber'];
    const labelMap: Record<FieldKey, string> = {
      name: t.fullNameLabel, matricCard: t.matricCardLabel,
      icNumber: t.icNumberLabel, contact: t.contactOptional,
      practicum: t.practicum,
    };
    const missing = REQUIRED.filter(k => !values[k].trim());
    if (missing.length) {
      Alert.alert(t.missingInfo, t.pleaseFillIn + missing.map(k => labelMap[k]).join(', '));
      return;
    }

    const user = auth.currentUser;
    if (!user) { Alert.alert('Error', t.notSignedIn); return; }

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name:            values.name.trim(),
        matricCard:      values.matricCard.trim(),
        icNumber:        values.icNumber.trim(),
        contact:         values.contact.trim()   || null,
        practicum:       values.practicum.trim() || null,
        profileComplete: true,
        updatedAt:       serverTimestamp(),
      });
      // FIX: 更新本地缓存，下次启动直接到dashboard
      await AsyncStorage.setItem(`profileComplete_${user.uid}`, 'true');
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const labelMap: Record<FieldKey, string> = {
    name:       t.fullNameLabel,
    matricCard: t.matricCardLabel,
    icNumber:   t.icNumberLabel,
    contact:    t.contactOptional,
    practicum:  t.practicum,
  };
  const placeholderMap: Record<FieldKey, string> = {
    name:       t.fullNamePlaceholder,
    matricCard: t.matricCardPlaceholder,
    icNumber:   t.icNumberPlaceholder,
    contact:    '0123456789',
    practicum:  t.practicumPlaceholder,
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Decorative circles — matches login/register */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ scale: pulseAnim }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ scale: pulseAnim }] }]} />
        <View style={styles.decorCircle3} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          keyboardDismissMode="on-drag"
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            {/* Logo gradient */}
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
              <LinearGradient
                colors={['#4FC3F7', '#29B6F6', '#0288D1']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.logoGradient}
              >
                <Ionicons name="person-add" size={40} color="#ffffff" />
              </LinearGradient>
              <View style={styles.logoShadow} />
            </Animated.View>

            {/* Title */}
            <View style={styles.titleSection}>
              <Text style={styles.title}>{t.completeYourProfile}</Text>
              <Text style={styles.subtitle}>{t.completeProfileSub}</Text>
            </View>

            {/* Fields */}
            <View style={styles.inputsContainer}>
              {FIELD_DEFS.map((def, i) => (
                <FieldInput
                  key={def.key}
                  labelText={labelMap[def.key]}
                  placeholder={placeholderMap[def.key]}
                  icon={def.icon}
                  required={def.required}
                  value={values[def.key]}
                  isFocused={focusedField === def.key}
                  loading={loading}
                  onChangeText={handleChange(def.key)}
                  onFocus={handleFocus(def.key)}
                  onBlur={handleBlur}
                  onSubmitEditing={handleSubmit(def.key)}
                  inputRef={refs[def.key]}
                  keyboardType={def.keyboardType}
                  isLast={i === FIELD_DEFS.length - 1}
                />
              ))}
            </View>

            {/* Save button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButtonWrapper,
                pressed && styles.primaryButtonPressed,
              ]}
              onPress={handleSave}
              disabled={loading}
            >
              <LinearGradient
                colors={loading ? ['#94a3b8', '#64748b'] : ['#0EA5E9', '#0284C7', '#0369A1']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.primaryButton}
              >
                {loading && <ActivityIndicator color="#fff" size="small" style={{ marginRight: 8 }} />}
                <Text style={styles.primaryButtonText}>
                  {loading ? t.saving : t.saveAndContinue}
                </Text>
              </LinearGradient>
            </Pressable>

            <Text style={styles.noteText}>{t.updateLater}</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#ffffff' },
  backgroundDecor: { position: 'absolute', width: '100%', height: '100%' },
  decorCircle1:    { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: '#E0F7FA', opacity: 0.4, top: -100, right: -100 },
  decorCircle2:    { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#B3E5FC', opacity: 0.3, bottom: 100, left: -50 },
  decorCircle3:    { position: 'absolute', width: 150, height: 150, borderRadius: 75,  backgroundColor: '#81D4FA', opacity: 0.2, top: '40%', right: -30 },
  keyboardView:    { flex: 1 },
  scrollContent:   { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  content:         { flex: 1, justifyContent: 'center', minHeight: height - 100 },

  logoContainer:   { alignSelf: 'center', marginBottom: 32 },
  logoGradient:    { width: 110, height: 110, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
  logoShadow:      { position: 'absolute', width: 110, height: 110, borderRadius: 28, backgroundColor: '#0284C7', opacity: 0.2, bottom: -8, left: 0, zIndex: -1 },

  titleSection:    { marginBottom: 40 },
  title:           { fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 8, color: '#0f172a', letterSpacing: -0.5 },
  subtitle:        { fontSize: 15, color: '#64748b', textAlign: 'center', fontWeight: '500', letterSpacing: 0.2 },

  inputsContainer: { marginBottom: 24 },
  inputWrapper:    { marginBottom: 20 },
  label:           { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, letterSpacing: 0.2 },
  req:             { color: '#EF4444' },
  optional:        { color: '#94A3B8', fontWeight: '500' },

  inputContainer:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 4, elevation: 2, shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0, shadowRadius: 8 },
  inputContainerFocused: { backgroundColor: '#ffffff', borderColor: '#0EA5E9', shadowOpacity: 0.15, elevation: 4 },
  inputIconContainer:    { marginRight: 12 },
  iconCircle:            { width: 40, height: 40, borderRadius: 12, backgroundColor: '#E0F7FA', alignItems: 'center', justifyContent: 'center' },
  input:                 { flex: 1, fontSize: 16, color: '#0f172a', paddingVertical: 16, fontWeight: '500' },

  primaryButtonWrapper:  { marginTop: 8, marginBottom: 20, borderRadius: 16, overflow: 'hidden', elevation: 6, shadowColor: '#0284C7', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
  primaryButtonPressed:  { transform: [{ scale: 0.98 }], elevation: 3 },
  primaryButton:         { flexDirection: 'row', paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText:     { color: '#ffffff', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  noteText:              { textAlign: 'center', color: '#94A3B8', fontSize: 13, fontWeight: '500', marginTop: 8 },
});
