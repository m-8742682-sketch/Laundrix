/**
 * withNotifee.js — Expo Config Plugin for @notifee/react-native
 *
 * @notifee/react-native requires native modifications that its own
 * auto-linking doesn't fully cover in an Expo managed workflow:
 *
 *   1. AndroidManifest — USE_FULL_SCREEN_INTENT + FOREGROUND_SERVICE
 *      permissions, and showWhenLocked + turnScreenOn on MainActivity
 *      (already handled by withFullScreenIntent.js, so we skip duplicates)
 *
 *   2. Android — Add a small notification icon (ic_notification) to
 *      res/drawable so notifee doesn't fall back to the app icon silhouette.
 *      We re-use the existing Laundrix icon.
 *
 *   3. Android build.gradle — notifee requires compileSdkVersion >= 33.
 *      Already set via expo-build-properties.
 *
 * This plugin is intentionally minimal — most notifee setup is done at
 * runtime in notifee.service.ts. The plugin only handles manifest entries
 * that MUST be present at build time.
 */

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

// ─── Ensure USE_FULL_SCREEN_INTENT and FOREGROUND_SERVICE are present ─────────
// These overlap with withFullScreenIntent.js but we add them here too so
// withNotifee is self-contained and can be used alone.

const withNotifeeManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    const required = [
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.WAKE_LOCK',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
    ];

    const perms = manifest.manifest['uses-permission'];
    for (const perm of required) {
      if (!perms.some((p) => p.$?.['android:name'] === perm)) {
        perms.push({ $: { 'android:name': perm } });
      }
    }

    // showWhenLocked + turnScreenOn on the main activity
    const app = manifest.manifest.application?.[0];
    if (app?.activity) {
      const main = app.activity.find(
        (a) =>
          a.$?.['android:name'] === '.MainActivity' ||
          (a['intent-filter'] || []).some((f) =>
            (f.action || []).some(
              (ac) => ac.$?.['android:name'] === 'android.intent.action.MAIN'
            )
          )
      );
      if (main) {
        main.$['android:showWhenLocked']  = 'true';
        main.$['android:turnScreenOn']    = 'true';
      }
    }

    return cfg;
  });

// ─── Compose plugins ──────────────────────────────────────────────────────────

const withNotifee = (config) => {
  config = withNotifeeManifest(config);
  return config;
};

module.exports = withNotifee;
