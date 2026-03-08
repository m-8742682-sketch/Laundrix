/**
 * notifications_settings.tsx — Comprehensive notification preferences
 *
 * Covers everything a user installing this app would want to configure:
 * - Master notification toggle
 * - Machine ready (grace modal + alarm)
 * - Queue reminders (position alerts)
 * - Call notifications
 * - Chat messages
 * - System / security alerts
 * - Do Not Disturb
 * - Sound and vibration
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Pressable,
  Alert, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/components/UserContext';
import { useI18n } from '@/i18n/i18n';
import { invalidatePrefsCache } from '@/services/notificationPreferences';
import { THEME } from '@/constants/Theme';

const STORAGE_KEY = 'notification_settings_v2';

interface NotificationSettings {
  // Master
  allNotifications: boolean;

  // Queue & Machine
  machineReady:         boolean;  // Grace modal / your turn popup
  machineReadySound:    boolean;  // Alarm sound when turn arrives
  queueReminder:        boolean;  // Notify when #2 in queue
  queuePositionAlert:   boolean;  // Any queue position changes

  // Calls
  incomingCalls:        boolean;
  callSound:            boolean;  // Ring for incoming calls
  missedCallAlert:      boolean;  // Notification for missed calls

  // Chat
  chatMessages:         boolean;
  chatPreview:          boolean;  // Show message content in notification
  chatSound:            boolean;

  // Security
  unauthorizedAlerts:   boolean;  // Unauthorized machine access
  unauthorizedVibrate:  boolean;

  // System
  systemAlerts:         boolean;  // App updates, maintenance etc.

  // DND
  doNotDisturb:         boolean;  // Mute all sounds (visual only)
  dndFrom:              string;   // "22:00"
  dndTo:                string;   // "07:00"
  dndScheduleEnabled:   boolean;
}

const DEFAULTS: NotificationSettings = {
  allNotifications:     true,
  machineReady:         true,
  machineReadySound:    true,
  queueReminder:        true,
  queuePositionAlert:   true,
  incomingCalls:        true,
  callSound:            true,
  missedCallAlert:      true,
  chatMessages:         true,
  chatPreview:          true,
  chatSound:            true,
  unauthorizedAlerts:   true,
  unauthorizedVibrate:  true,
  systemAlerts:         true,
  doNotDisturb:         false,
  dndFrom:              '22:00',
  dndTo:                '07:00',
  dndScheduleEnabled:   false,
};

export default function NotificationsSettingsScreen() {
  const { user } = useUser();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [settings, setSettings]           = useState<NotificationSettings>(DEFAULTS);
  const [permissionStatus, setPermStatus] = useState<string>('unknown');
  const [saving, setSaving]               = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  const loadSettings = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
  };

  const checkPermissions = async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermStatus(status);
  };

  const save = useCallback(async (updated: NotificationSettings) => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      invalidatePrefsCache(); // ensure notification service reads fresh settings
    } catch {}
    setSaving(false);
  }, []);

  const toggle = (key: keyof NotificationSettings) => {
    setSettings(prev => {
      const next = { ...prev, [key]: !prev[key] };
      save(next);
      return next;
    });
  };

  const requestPermission = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermStatus(status);
    if (status === 'denied') {
      Alert.alert(
        'Notifications Blocked',
        'Please enable notifications in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const isEnabled = (key: keyof NotificationSettings) => {
    if (!settings.allNotifications && key !== 'allNotifications') return false;
    return settings[key] as boolean;
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color={THEME.primary} />
        </Pressable>
        <Text style={s.headerTitle}>{t('notifSettingsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>

        {/* Permission warning */}
        {permissionStatus !== 'granted' && (
          <Pressable onPress={requestPermission} style={s.permBanner}>
            <Ionicons name="notifications-off" size={20} color="#fff" />
            <View style={{ flex: 1 }}>
              <Text style={s.permBannerTitle}>{t('notifSettingsNotifDisabled')}</Text>
              <Text style={s.permBannerSub}>{t('notifSettingsTapToEnable')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
          </Pressable>
        )}

        {/* Master toggle */}
        <Section title={t('notifSettingsGeneral')}>
          <SettingRow
            icon="notifications" iconColor="#0EA5E9"
            title={t('notifSettingsAllNotifications')}
            subtitle={t('notifSettingsAllNotificationsSub')}
            value={settings.allNotifications}
            onToggle={() => toggle('allNotifications')}
          />
        </Section>

        {/* Queue & Machine */}
        <Section title={t('notifSettingsQueueMachine')}>
          <SettingRow
            icon="checkmark-circle" iconColor="#10B981"
            title={t('notifSettingsMachineReady')}
            subtitle={t('notifSettingsMachineReadySub')}
            value={isEnabled('machineReady')}
            onToggle={() => toggle('machineReady')}
            disabled={!settings.allNotifications}
          />
          <SettingRow
            icon="musical-notes" iconColor="#F59E0B"
            title={t('notifSettingsAlarmSound')}
            subtitle={t('notifSettingsAlarmSoundSub')}
            value={isEnabled('machineReadySound')}
            onToggle={() => toggle('machineReadySound')}
            disabled={!settings.allNotifications || !settings.machineReady}
          />
          <SettingRow
            icon="people" iconColor="#0EA5E9"
            title={t('notifSettingsQueueReminder')}
            subtitle={t('notifSettingsQueueReminderSub')}
            value={isEnabled('queueReminder')}
            onToggle={() => toggle('queueReminder')}
            disabled={!settings.allNotifications}
          />
          <SettingRow
            icon="list" iconColor="#64748B"
            title={t('notifSettingsQueuePositionUpdates')}
            subtitle={t('notifSettingsQueuePositionUpdatesSub')}
            value={isEnabled('queuePositionAlert')}
            onToggle={() => toggle('queuePositionAlert')}
            disabled={!settings.allNotifications}
            last
          />
        </Section>

        {/* Calls */}
        <Section title={t('notifSettingsCalls')}>
          <SettingRow
            icon="call" iconColor="#0EA5E9"
            title={t('notifSettingsIncomingCalls')}
            subtitle={t('notifSettingsIncomingCallsSub')}
            value={isEnabled('incomingCalls')}
            onToggle={() => toggle('incomingCalls')}
            disabled={!settings.allNotifications}
          />
          <SettingRow
            icon="volume-high" iconColor="#3b82f6"
            title={t('notifSettingsRingtone')}
            subtitle={t('notifSettingsRingtoneSub')}
            value={isEnabled('callSound')}
            onToggle={() => toggle('callSound')}
            disabled={!settings.allNotifications || !settings.incomingCalls}
          />
          <SettingRow
            icon="call-outline" iconColor="#94A3B8"
            title={t('notifSettingsMissedCallAlerts')}
            subtitle={t('notifSettingsMissedCallAlertsSub')}
            value={isEnabled('missedCallAlert')}
            onToggle={() => toggle('missedCallAlert')}
            disabled={!settings.allNotifications}
            last
          />
        </Section>

        {/* Chat */}
        <Section title={t('notifSettingsMessages')}>
          <SettingRow
            icon="chatbubble" iconColor="#0EA5E9"
            title={t('notifSettingsChatMessages')}
            subtitle={t('notifSettingsChatMessagesSub')}
            value={isEnabled('chatMessages')}
            onToggle={() => toggle('chatMessages')}
            disabled={!settings.allNotifications}
          />
          <SettingRow
            icon="eye" iconColor="#64748B"
            title={t('notifSettingsMessagePreview')}
            subtitle={t('notifSettingsMessagePreviewSub')}
            value={isEnabled('chatPreview')}
            onToggle={() => toggle('chatPreview')}
            disabled={!settings.allNotifications || !settings.chatMessages}
          />
          <SettingRow
            icon="notifications" iconColor="#F59E0B"
            title={t('notifSettingsMessageSound')}
            subtitle={t('notifSettingsMessageSoundSub')}
            value={isEnabled('chatSound')}
            onToggle={() => toggle('chatSound')}
            disabled={!settings.allNotifications || !settings.chatMessages}
            last
          />
        </Section>

        {/* Security */}
        <Section title={t('notifSettingsSecurity')}>
          <SettingRow
            icon="shield" iconColor="#EF4444"
            title={t('notifSettingsUnauthorizedAlerts')}
            subtitle={t('notifSettingsUnauthorizedAlertsSub')}
            value={isEnabled('unauthorizedAlerts')}
            onToggle={() => toggle('unauthorizedAlerts')}
            disabled={!settings.allNotifications}
          />
          <SettingRow
            icon="phone-portrait" iconColor="#DC2626"
            title={t('notifSettingsVibrateAlerts')}
            subtitle={t('notifSettingsVibrateAlertsSub')}
            value={isEnabled('unauthorizedVibrate')}
            onToggle={() => toggle('unauthorizedVibrate')}
            disabled={!settings.allNotifications || !settings.unauthorizedAlerts}
            last
          />
        </Section>

        {/* Do Not Disturb */}
        <Section title={t('notifSettingsDnd')}>
          <SettingRow
            icon="moon" iconColor="#0EA5E9"
            title={t('notifSettingsDndToggle')}
            subtitle={t('notifSettingsDndToggleSub')}
            value={settings.doNotDisturb}
            onToggle={() => toggle('doNotDisturb')}
          />
          <SettingRow
            icon="time" iconColor="#94A3B8"
            title={t('notifSettingsScheduledDnd')}
            subtitle={`Silence from ${settings.dndFrom} to ${settings.dndTo} daily`}
            value={settings.dndScheduleEnabled}
            onToggle={() => toggle('dndScheduleEnabled')}
            disabled={!settings.doNotDisturb}
            last
          />
        </Section>

        {/* Info footer */}
        <View style={s.footer}>
          <Ionicons name="information-circle-outline" size={16} color="#94A3B8" />
          <Text style={s.footerText}>
            Critical alerts (your machine turn) will always appear even in Do Not Disturb mode.
            Call notifications require device-level permission to work when app is closed.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.card}>{children}</View>
    </View>
  );
}

function SettingRow({ icon, iconColor, title, subtitle, value, onToggle, disabled, last }: {
  icon: any; iconColor: string; title: string; subtitle: string;
  value: boolean; onToggle: () => void; disabled?: boolean; last?: boolean;
}) {
  return (
    <View style={[row.wrap, !last && row.separator]}>
      <View style={[row.iconWrap, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon} size={18} color={disabled ? '#CBD5E1' : iconColor} />
      </View>
      <View style={row.info}>
        <Text style={[row.title, disabled && row.titleDisabled]}>{title}</Text>
        <Text style={row.sub} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Switch
        value={value && !disabled}
        onValueChange={disabled ? undefined : onToggle}
        trackColor={{ false: '#E2E8F0', true: `${iconColor}60` }}
        thumbColor={value && !disabled ? iconColor : '#F1F5F9'}
        ios_backgroundColor="#E2E8F0"
        disabled={disabled}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#F8FAFC' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  content:      { padding: 16 },
  permBanner:   { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EF4444', borderRadius: 14, padding: 14, marginBottom: 16 },
  permBannerTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  permBannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  footer:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 8 },
  footerText:   { flex: 1, fontSize: 12, color: '#94A3B8', lineHeight: 17 },
});

const sec = StyleSheet.create({
  wrap:  { marginBottom: 20 },
  title: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.3, textTransform: 'uppercase' },
  card:  { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
});

const row = StyleSheet.create({
  wrap:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  separator:     { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconWrap:      { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  info:          { flex: 1 },
  title:         { fontSize: 15, fontWeight: '600', color: '#0F172A', marginBottom: 2 },
  titleDisabled: { color: '#CBD5E1' },
  sub:           { fontSize: 12, color: '#94A3B8', lineHeight: 16 },
});
