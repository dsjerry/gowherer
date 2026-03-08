const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidPointerTagging(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const app = configWithManifest.modResults.manifest.application?.[0];
    if (!app) {
      return configWithManifest;
    }

    app.$ = app.$ || {};
    app.$['android:allowNativeHeapPointerTagging'] = 'false';
    return configWithManifest;
  });
};
