/**
 * withFullScreenIntent.js
 *
 * Expo config plugin that adds the USE_FULL_SCREEN_INTENT permission to
 * AndroidManifest.xml so high-priority notifications (incoming calls, grace
 * periods, incidents) can display a full-screen activity overlay even when the
 * phone is locked.
 *
 * Android 14+ requires the MANAGE_FULL_SCREEN_INTENT permission and the user
 * must explicitly grant it. This plugin adds the permission declaration;
 * runtime grant logic is handled in notification.service.ts.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const withFullScreenIntent = (config) => {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;

    // Ensure uses-permission array exists
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    const permissions = manifest.manifest['uses-permission'];

    const required = [
      'android.permission.USE_FULL_SCREEN_INTENT',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
      'android.permission.WAKE_LOCK',
    ];

    for (const perm of required) {
      const exists = permissions.some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!exists) {
        permissions.push({ $: { 'android:name': perm } });
      }
    }

    // Add showWhenLocked + turnScreenOn flags to the main activity
    const app = manifest.manifest.application?.[0];
    if (app?.activity) {
      const mainActivity = app.activity.find(
        (a) =>
          a.$?.['android:name'] === '.MainActivity' ||
          (a['intent-filter'] || []).some((f) =>
            (f.action || []).some(
              (a) => a.$?.['android:name'] === 'android.intent.action.MAIN'
            )
          )
      );

      if (mainActivity) {
        mainActivity.$['android:showWhenLocked'] = 'true';
        mainActivity.$['android:turnScreenOn'] = 'true';
      }
    }

    return cfg;
  });
};

module.exports = withFullScreenIntent;
