/**
 * DebugPanel — Dashboard debug toggle for full-screen incident testing
 *
 * Shows a floating bug icon on dashboard. Tap to open:
 *  - Toggle full-screen incident notifications ON/OFF
 *  - Diagnosis log: FCM delivery status, notifee fullscreen capability, permission states
 *  - "Test Incident" button to simulate a full-screen incident
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView,
  Switch, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import notifee, { AndroidImportance } from '@notifee/react-native';

const DEBUG_FULLSCREEN_KEY = 'laundrix_debug_fullscreen_enabled';

export function useFullScreenIncidentEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem(DEBUG_FULLSCREEN_KEY).then(v => setEnabled(v === 'true'));
  }, []);
  return enabled;
}

interface DiagLog {
  key: string;
  label: string;
  value: string;
  status: 'ok' | 'warn' | 'error' | 'info';
}

async function runDiagnosis(): Promise<DiagLog[]> {
  const logs: DiagLog[] = [];

  // Permission checks
  const notifPerm = await Notifications.getPermissionsAsync();
  logs.push({
    key: 'notif_perm',
    label: 'Notifications Permission',
    value: notifPerm.status,
    status: notifPerm.status === 'granted' ? 'ok' : 'error',
  });

  const camPerm = await Camera.getCameraPermissionsAsync();
  logs.push({
    key: 'cam_perm',
    label: 'Camera Permission',
    value: camPerm.status,
    status: camPerm.status === 'granted' ? 'ok' : 'warn',
  });

  const micPerm = await Audio.getPermissionsAsync();
  logs.push({
    key: 'mic_perm',
    label: 'Microphone Permission',
    value: micPerm.status,
    status: micPerm.status === 'granted' ? 'ok' : 'error',
  });

  // Notifee check
  try {
    const settings = await notifee.getNotificationSettings();
    logs.push({
      key: 'notifee_auth',
      label: 'Notifee Authorization',
      value: settings.authorizationStatus === 1 ? 'Authorized' : `Status: ${settings.authorizationStatus}`,
      status: settings.authorizationStatus === 1 ? 'ok' : 'warn',
    });
  } catch (e: any) {
    logs.push({ key: 'notifee_auth', label: 'Notifee Auth', value: `Error: ${e.message}`, status: 'error' });
  }

  // Android-specific
  if (Platform.OS === 'android') {
    try {
      const channels = await notifee.getChannels();
      const callsChannel = channels.find(c => c.id === 'calls');
      logs.push({
        key: 'calls_channel',
        label: 'Calls Notification Channel',
        value: callsChannel ? `Importance: ${callsChannel.importance}` : 'NOT FOUND',
        status: callsChannel && callsChannel.importance === AndroidImportance.HIGH ? 'ok' : 'error',
      });
    } catch (e: any) {
      logs.push({ key: 'calls_channel', label: 'Calls Channel', value: `Error: ${e.message}`, status: 'error' });
    }

    // FCM token check
    try {
      const { getMessaging, getToken } = require('@react-native-firebase/messaging');
      const { getApp } = require('@react-native-firebase/app');
      const token = await getToken(getMessaging(getApp()));
      logs.push({
        key: 'fcm_token',
        label: 'FCM Token',
        value: token ? `${token.slice(0, 20)}…` : 'MISSING',
        status: token ? 'ok' : 'error',
      });
    } catch (e: any) {
      logs.push({ key: 'fcm_token', label: 'FCM Token', value: `Error: ${e.message}`, status: 'error' });
    }

    // Android version
    const androidVersion = Platform.Version;
    logs.push({
      key: 'android_ver',
      label: 'Android API Level',
      value: String(androidVersion),
      status: (androidVersion as number) >= 26 ? 'ok' : 'warn',
    });
  }

  // Debug fullscreen toggle status
  const debugEnabled = await AsyncStorage.getItem(DEBUG_FULLSCREEN_KEY);
  logs.push({
    key: 'debug_fullscreen',
    label: 'Debug Full-Screen Incidents',
    value: debugEnabled === 'true' ? 'ENABLED' : 'disabled',
    status: debugEnabled === 'true' ? 'ok' : 'info',
  });

  return logs;
}

async function testFullScreenIncident() {
  try {
    await notifee.displayNotification({
      title: '🚨 TEST: Incident Alert',
      body: 'This is a test full-screen incident notification from Laundrix debug panel.',
      android: {
        channelId: 'critical',
        importance: AndroidImportance.HIGH,
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default' },
        sound: 'urgent',
      },
    });
    Alert.alert('Test Sent', 'Full-screen incident test notification dispatched. Check lock screen.');
  } catch (e: any) {
    Alert.alert('Test Failed', `Error: ${e.message}`);
  }
}

interface Props {
  /** Only show to admins or in dev builds */
  visible?: boolean;
}

export default function DebugPanel({ visible = true }: Props) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [logs, setLogs] = useState<DiagLog[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEBUG_FULLSCREEN_KEY).then(v => setFullscreenEnabled(v === 'true'));
  }, []);

  const handleToggleFullscreen = async (val: boolean) => {
    setFullscreenEnabled(val);
    await AsyncStorage.setItem(DEBUG_FULLSCREEN_KEY, String(val));
  };

  const handleRunDiag = async () => {
    setDiagRunning(true);
    const result = await runDiagnosis();
    setLogs(result);
    setDiagRunning(false);
  };

  const statusColor = (s: DiagLog['status']) => {
    switch (s) {
      case 'ok':    return '#22c55e';
      case 'warn':  return '#F59E0B';
      case 'error': return '#EF4444';
      case 'info':  return '#0EA5E9';
    }
  };

  const statusIcon = (s: DiagLog['status']) => {
    switch (s) {
      case 'ok':    return 'checkmark-circle';
      case 'warn':  return 'warning';
      case 'error': return 'close-circle';
      case 'info':  return 'information-circle';
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Floating debug button */}
      <Pressable
        style={({ pressed }) => [db.fab, pressed && { opacity: 0.8 }]}
        onPress={() => { setPanelOpen(true); handleRunDiag(); }}
      >
        <Ionicons name="bug" size={20} color="#fff" />
      </Pressable>

      {/* Debug modal */}
      <Modal visible={panelOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setPanelOpen(false)}>
        <View style={db.overlay}>
          <View style={db.panel}>
            {/* Header */}
            <LinearGradient colors={['#0D2240', '#0A1A30']} style={db.header}>
              <View style={db.headerRow}>
                <Ionicons name="bug" size={20} color="#0EA5E9" />
                <Text style={db.headerTitle}>Debug Panel</Text>
                <Pressable onPress={() => setPanelOpen(false)} hitSlop={12}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
                </Pressable>
              </View>
              <Text style={db.headerSub}>Full-Screen Notification Diagnostics</Text>
            </LinearGradient>

            <ScrollView style={db.scroll} contentContainerStyle={db.scrollContent}>
              {/* Toggle */}
              <View style={db.settingRow}>
                <View style={db.settingInfo}>
                  <Text style={db.settingLabel}>Full-Screen Incidents (Android)</Text>
                  <Text style={db.settingDesc}>
                    When ON: incident alerts will attempt to show as full-screen on lock screen
                  </Text>
                </View>
                <Switch
                  value={fullscreenEnabled}
                  onValueChange={handleToggleFullscreen}
                  trackColor={{ false: '#E2E8F0', true: '#0EA5E9' }}
                  thumbColor={fullscreenEnabled ? '#fff' : '#fff'}
                />
              </View>

              {/* Test button */}
              {Platform.OS === 'android' && (
                <Pressable
                  onPress={testFullScreenIncident}
                  style={({ pressed }) => [db.testBtn, pressed && { opacity: 0.85 }]}
                >
                  <LinearGradient colors={['#7C3AED', '#6D28D9']} style={db.testGrad}>
                    <Ionicons name="notifications" size={16} color="#fff" />
                    <Text style={db.testText}>Test Full-Screen Incident</Text>
                  </LinearGradient>
                </Pressable>
              )}

              {/* Diagnosis */}
              <Text style={db.diagTitle}>Diagnosis {diagRunning ? '(running…)' : ''}</Text>
              <Pressable onPress={handleRunDiag} style={db.refreshBtn}>
                <Ionicons name="refresh" size={14} color="#0EA5E9" />
                <Text style={db.refreshText}>Refresh</Text>
              </Pressable>

              {logs.map(log => (
                <View key={log.key} style={db.logRow}>
                  <Ionicons name={statusIcon(log.status) as any} size={16} color={statusColor(log.status)} />
                  <View style={db.logInfo}>
                    <Text style={db.logLabel}>{log.label}</Text>
                    <Text style={[db.logValue, { color: statusColor(log.status) }]}>{log.value}</Text>
                  </View>
                </View>
              ))}

              {logs.length === 0 && !diagRunning && (
                <Text style={db.noLogs}>Tap "Refresh" to run diagnosis</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const db = StyleSheet.create({
  fab:           { position: 'absolute', bottom: 90, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8, zIndex: 999 },
  overlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  panel:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', maxHeight: '85%' },
  header:        { padding: 20 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  headerTitle:   { flex: 1, color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub:     { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  scroll:        { maxHeight: 500 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 10 },
  settingRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  settingInfo:   { flex: 1 },
  settingLabel:  { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  settingDesc:   { fontSize: 12, color: '#64748B', lineHeight: 17 },
  testBtn:       { borderRadius: 12, overflow: 'hidden' },
  testGrad:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 7 },
  testText:      { color: '#fff', fontSize: 14, fontWeight: '700' },
  diagTitle:     { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  refreshBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  refreshText:   { color: '#0EA5E9', fontSize: 13, fontWeight: '700' },
  logRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  logInfo:       { flex: 1 },
  logLabel:      { fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  logValue:      { fontSize: 12, fontWeight: '600' },
  noLogs:        { textAlign: 'center', color: '#94A3B8', fontSize: 13, paddingVertical: 16 },
});
