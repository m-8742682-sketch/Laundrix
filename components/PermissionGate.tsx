/**
 * PermissionGate
 *
 * On first login AND every app launch:
 *  - Checks all required permissions
 *  - If any missing → shows permission request screen
 *  - App is unusable until all permissions granted
 *
 * Required permissions:
 *  - Camera (for video calls, QR scan)
 *  - Microphone (for voice/video calls)
 *  - Notifications (for all alerts)
 *  - USE_FULL_SCREEN_INTENT (Android — for lock-screen call/incident UI)
 *  - SYSTEM_ALERT_WINDOW (Android — for overlay)
 *
 * After granting, stores check timestamp in AsyncStorage so we re-check
 * on every launch but only prompt if something is missing.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Platform, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERM_CHECK_KEY = 'laundrix_perms_checked_v1';

interface PermStatus {
  key: string;
  label: string;
  description: string;
  icon: string;
  required: boolean;
  granted: boolean;
  request: () => Promise<boolean>;
}

async function checkAndRequestNotifications(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true, allowCriticalAlerts: true },
  });
  return newStatus === 'granted';
}

async function checkAndRequestCamera(): Promise<boolean> {
  const { status } = await Camera.getCameraPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Camera.requestCameraPermissionsAsync();
  return newStatus === 'granted';
}

async function checkAndRequestMic(): Promise<boolean> {
  const { status } = await Audio.getPermissionsAsync();
  if (status === 'granted') return true;
  const { status: newStatus } = await Audio.requestPermissionsAsync();
  return newStatus === 'granted';
}

// Android-specific: USE_FULL_SCREEN_INTENT and SYSTEM_ALERT_WINDOW
// These can't be checked/requested via Expo API directly — we guide users to Settings
async function openAndroidSettings(): Promise<void> {
  await Linking.openSettings();
}

async function gatherPermissions(): Promise<PermStatus[]> {
  const [camStatus, micStatus, notifStatus] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Audio.getPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);

  return [
    {
      key: 'camera',
      label: 'Camera',
      description: 'For video calls and QR code scanning',
      icon: 'camera',
      required: true,
      granted: camStatus.status === 'granted',
      request: checkAndRequestCamera,
    },
    {
      key: 'microphone',
      label: 'Microphone',
      description: 'For voice and video calls',
      icon: 'mic',
      required: true,
      granted: micStatus.status === 'granted',
      request: checkAndRequestMic,
    },
    {
      key: 'notifications',
      label: 'Notifications',
      description: 'For call alerts, laundry ready reminders, and incident alerts',
      icon: 'notifications',
      required: true,
      granted: notifStatus.status === 'granted',
      request: checkAndRequestNotifications,
    },
    ...(Platform.OS === 'android' ? [
      {
        key: 'fullscreen',
        label: 'Display Over Other Apps',
        description: 'Allows call & incident screens to appear on your lock screen (required for full-screen alerts)',
        icon: 'phone-portrait-outline' as string,
        required: true,
        granted: false, // we can't programmatically check this reliably
        request: async () => { await openAndroidSettings(); return false; },
      },
    ] : []),
  ];
}

interface Props {
  children: React.ReactNode;
}

export default function PermissionGate({ children }: Props) {
  const [checking, setChecking] = useState(true);
  const [perms, setPerms]       = useState<PermStatus[]>([]);
  const [allGranted, setAllGranted] = useState(false);
  const [requesting, setRequesting] = useState<string | null>(null);

  const checkPerms = useCallback(async () => {
    setChecking(true);
    const list = await gatherPermissions();
    setPerms(list);
    // On Android, skip the "fullscreen" check since we can't verify it programmatically
    const critical = list.filter(p => p.required && p.key !== 'fullscreen');
    const ok = critical.every(p => p.granted);
    setAllGranted(ok);

    if (ok) {
      await AsyncStorage.setItem(PERM_CHECK_KEY, Date.now().toString());
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    checkPerms();
  }, []);

  const handleRequest = async (perm: PermStatus) => {
    setRequesting(perm.key);
    try {
      if (perm.key === 'fullscreen') {
        Alert.alert(
          'Enable Full-Screen Alerts',
          'Please enable "Display Over Other Apps" for Laundrix in the next screen. This allows calls and incident alerts to appear on your lock screen.',
          [{ text: 'Open Settings', onPress: openAndroidSettings }]
        );
        // Re-check after user comes back
        setTimeout(checkPerms, 2000);
        return;
      }
      await perm.request();
      await checkPerms();
    } finally {
      setRequesting(null);
    }
  };

  const handleRequestAll = async () => {
    const missing = perms.filter(p => !p.granted && p.key !== 'fullscreen');
    for (const perm of missing) {
      await perm.request();
    }
    await checkPerms();
  };

  const handleSkipFullscreen = async () => {
    // Mark fullscreen as granted locally (user chose to skip)
    await AsyncStorage.setItem(PERM_CHECK_KEY, Date.now().toString());
    await checkPerms();
    setAllGranted(true);
  };

  if (checking) {
    return (
      <View style={s.loadWrap}>
        <LinearGradient colors={['#0C1A2E', '#0D2A4A']} style={StyleSheet.absoluteFill} />
        <Ionicons name="shield-checkmark-outline" size={40} color="#0EA5E9" />
        <Text style={s.loadText}>Checking permissions…</Text>
      </View>
    );
  }

  if (allGranted) return <>{children}</>;

  const missing     = perms.filter(p => !p.granted);
  const fullscreenP = missing.find(p => p.key === 'fullscreen');
  const criticalMissing = missing.filter(p => p.key !== 'fullscreen');

  return (
    <View style={s.root}>
      <LinearGradient colors={['#0C1A2E', '#0D2A4A', '#0C1A2E']} style={StyleSheet.absoluteFill} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.iconWrap}>
            <Ionicons name="shield-checkmark" size={44} color="#0EA5E9" />
          </View>
          <Text style={s.title}>Permissions Required</Text>
          <Text style={s.subtitle}>
            Laundrix needs a few permissions to work properly. Please grant all of them to continue.
          </Text>
        </View>

        {/* Permission list */}
        <View style={s.list}>
          {perms.map(perm => (
            <View key={perm.key} style={[s.item, perm.granted && s.itemGranted]}>
              <View style={[s.itemIcon, perm.granted && s.itemIconGranted]}>
                <Ionicons
                  name={perm.granted ? 'checkmark' : (perm.icon as any)}
                  size={20}
                  color={perm.granted ? '#22c55e' : '#0EA5E9'}
                />
              </View>
              <View style={s.itemInfo}>
                <Text style={s.itemLabel}>{perm.label}
                  {perm.required && <Text style={s.required}> *</Text>}
                </Text>
                <Text style={s.itemDesc}>{perm.description}</Text>
              </View>
              {!perm.granted && (
                <Pressable
                  style={({ pressed }) => [s.grantBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => handleRequest(perm)}
                  disabled={requesting === perm.key}
                >
                  <Text style={s.grantBtnText}>{requesting === perm.key ? '…' : 'Grant'}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        {/* Grant all button */}
        {criticalMissing.length > 0 && (
          <Pressable onPress={handleRequestAll} style={({ pressed }) => [s.grantAllBtn, pressed && { opacity: 0.88 }]}>
            <LinearGradient colors={['#0EA5E9', '#0284C7']} style={s.grantAllGrad}>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={s.grantAllText}>Grant All Permissions</Text>
            </LinearGradient>
          </Pressable>
        )}

        {/* Skip fullscreen (optional) */}
        {criticalMissing.length === 0 && fullscreenP && (
          <Pressable onPress={handleSkipFullscreen} style={({ pressed }) => [s.skipBtn, pressed && { opacity: 0.8 }]}>
            <Text style={s.skipText}>Continue without full-screen alerts (not recommended)</Text>
          </Pressable>
        )}

        <Text style={s.note}>* Required to use the app</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1 },
  loadWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadText:      { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  scroll:        { padding: 24, paddingBottom: 60, paddingTop: 80 },
  header:        { alignItems: 'center', marginBottom: 36 },
  iconWrap:      { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 2, borderColor: 'rgba(14,165,233,0.3)' },
  title:         { fontSize: 26, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 10 },
  subtitle:      { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 21 },
  list:          { gap: 10, marginBottom: 24 },
  item:          { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  itemGranted:   { backgroundColor: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.2)' },
  itemIcon:      { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(14,165,233,0.15)', alignItems: 'center', justifyContent: 'center' },
  itemIconGranted: { backgroundColor: 'rgba(34,197,94,0.15)' },
  itemInfo:      { flex: 1 },
  itemLabel:     { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  required:      { color: '#EF4444' },
  itemDesc:      { fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
  grantBtn:      { backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  grantBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },
  grantAllBtn:   { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  grantAllGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  grantAllText:  { fontSize: 16, fontWeight: '800', color: '#fff' },
  skipBtn:       { alignItems: 'center', marginBottom: 16 },
  skipText:      { color: 'rgba(255,255,255,0.35)', fontSize: 12, textDecorationLine: 'underline' },
  note:          { textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11 },
});
