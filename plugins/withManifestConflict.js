const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withManifestConflict(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // 找到所有的 meta-data 标签
    if (mainApplication['meta-data']) {
      mainApplication['meta-data'].forEach((metaData) => {
        const name = metaData.$['android:name'];
        
        // 如果是这几个引起冲突的 Firebase 键，强制添加 tools:replace 属性
        if (
          name === 'com.google.firebase.messaging.default_notification_channel_id' ||
          name === 'com.google.firebase.messaging.default_notification_color'
        ) {
          // 添加 tools 命名空间支持（如果还没有的话）
          config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
          // 告诉 Android：如果冲突，替换掉库里的旧值
          if (name.includes('color')) {
             metaData.$['tools:replace'] = 'android:resource';
          } else {
             metaData.$['tools:replace'] = 'android:value';
          }
        }
      });
    }

    return config;
  });
};