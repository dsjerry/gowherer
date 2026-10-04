const { withAppBuildGradle, withFinalizedMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const GRADLE_MARKER = '// @gowherer-debug-identity';
const AMAP_API_KEY_META_DATA = 'com.amap.api.v2.apikey';
const APP_LABEL_PLACEHOLDER = '${appLabel}';
const AMAP_KEY_PLACEHOLDER = '${amapApiKey}';

function escapeGradleString(value) {
  return String(value).replace(/'/g, "\\'");
}

// The AMap key and launcher label become manifest placeholders so each variant
// resolves its own value at manifest-merge time. This runs as a finalized mod
// (after every base mod, including expo-gaode-map which writes the AMap key
// literal back on every prebuild) so the placeholder cannot be overwritten.
function patchAndroidManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    return;
  }

  let contents = fs.readFileSync(manifestPath, 'utf8');

  contents = contents.replace(
    /(<application\b[^>]*?android:label=")([^"]*)(")/,
    (match, prefix, value) =>
      value === APP_LABEL_PLACEHOLDER ? match : `${prefix}${APP_LABEL_PLACEHOLDER}"`,
  );

  const amapKeyPatterns = [
    new RegExp(
      `(<meta-data\\b[^>]*?android:name="${AMAP_API_KEY_META_DATA}"[^>]*?android:value=")([^"]*)(")`,
    ),
    new RegExp(
      `(<meta-data\\b[^>]*?android:value=")([^"]*)("[^>]*?android:name="${AMAP_API_KEY_META_DATA}")`,
    ),
  ];
  for (const pattern of amapKeyPatterns) {
    const match = contents.match(pattern);
    if (match && match[2] !== AMAP_KEY_PLACEHOLDER) {
      contents = contents.replace(
        pattern,
        (_match, prefix, _value, suffix) => `${prefix}${AMAP_KEY_PLACEHOLDER}${suffix}`,
      );
      break;
    }
  }

  fs.writeFileSync(manifestPath, contents);
}

// Debug builds get their own applicationId so `expo run:android` can be installed
// alongside the release build on the same device. The suffix is scoped to the
// debug buildType only, so CI/EAS release artifacts keep the original id.
// AMap keys are bound to a package name + SHA1 pair: the suffixed debug package
// needs its own key (AMAP_ANDROID_DEBUG_KEY), otherwise AMap shows blank tiles
// in debug builds.
module.exports = function withAndroidDebugIdentity(config, props) {
  const options = props ?? {};
  const applicationIdSuffix = options.debugApplicationIdSuffix ?? '.debug';
  const versionNameSuffix = options.debugVersionNameSuffix ?? '-debug';
  const appLabelSuffix = options.debugAppLabelSuffix ?? ' Dev';
  const releaseAmapKey = options.releaseAmapAndroidKey ?? options.amapAndroidKey ?? '';
  const debugAmapKey = options.debugAmapAndroidKey ?? releaseAmapKey;
  const appLabel = config.name ?? 'gowherer';

  config = withFinalizedMod(config, [
    'android',
    (config) => {
      const manifestPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'AndroidManifest.xml',
      );
      patchAndroidManifest(manifestPath);
      return config;
    },
  ]);

  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    // Replace any previously injected block so refreshed props (e.g. a new
    // AMAP_ANDROID_DEBUG_KEY in .env) take effect on the next prebuild.
    const markerIndex = contents.indexOf(GRADLE_MARKER);
    const base = markerIndex === -1 ? contents : contents.slice(0, markerIndex).trimEnd();

    const block = [
      GRADLE_MARKER,
      '// Scoped to the debug buildType only; release keeps the original applicationId.',
      `android.defaultConfig.manifestPlaceholders.appLabel = '${escapeGradleString(appLabel)}'`,
      `android.defaultConfig.manifestPlaceholders.amapApiKey = '${escapeGradleString(releaseAmapKey)}'`,
      `android.buildTypes.debug.applicationIdSuffix = '${escapeGradleString(applicationIdSuffix)}'`,
      `android.buildTypes.debug.versionNameSuffix = '${escapeGradleString(versionNameSuffix)}'`,
      `android.buildTypes.debug.manifestPlaceholders.appLabel = '${escapeGradleString(appLabel + appLabelSuffix)}'`,
      `android.buildTypes.debug.manifestPlaceholders.amapApiKey = '${escapeGradleString(debugAmapKey)}'`,
    ].join('\n');

    config.modResults.contents = `${base}\n\n${block}\n`;
    return config;
  });

  return config;
};
