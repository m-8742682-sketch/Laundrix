const { withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const PROGUARD_RULES = `
# Agora SDK
-keep class io.agora.** { *; }
-dontwarn io.agora.**
-keep class com.google.devtools.build.android.desugar.runtime.** { *; }
-dontwarn com.google.devtools.build.android.desugar.runtime.**

# Firebase
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# React Native
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**

# Google Sign In
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**
`;

module.exports = function withProguardRules(config) {
  return withAppBuildGradle(config, (config) => {
    const proguardPath = path.join(
      __dirname, '..', 'android', 'app', 'proguard-rules.pro'
    );

    // Append rules to the generated proguard file
    if (fs.existsSync(proguardPath)) {
      const existing = fs.readFileSync(proguardPath, 'utf8');
      if (!existing.includes('io.agora')) {
        fs.writeFileSync(proguardPath, existing + PROGUARD_RULES);
      }
    } else {
      fs.writeFileSync(proguardPath, PROGUARD_RULES);
    }

    return config;
  });
};