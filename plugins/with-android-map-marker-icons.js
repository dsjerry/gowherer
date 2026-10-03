const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// expo-gaode-map's native MarkerView only accepts an icon as a string:
// an http(s) URL, a file:// path, or a local drawable resource name. The
// bundler's require(...) id is a number and crashes the view. Copy the marker
// PNGs into android res/drawable-nodpi so markers can reference them by name.
const MARKER_ASSETS = [
  ["marker-start.png", "marker_start.png"],
  ["marker-end.png", "marker_end.png"],
  ["marker-mid.png", "marker_mid.png"],
];

module.exports = function withAndroidMapMarkerIcons(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable-nodpi"
      );
      fs.mkdirSync(resDir, { recursive: true });

      for (const [assetName, resourceName] of MARKER_ASSETS) {
        const source = path.join(
          config.modRequest.projectRoot,
          "assets",
          "images",
          assetName
        );
        if (fs.existsSync(source)) {
          fs.copyFileSync(source, path.join(resDir, resourceName));
        }
      }

      return config;
    },
  ]);
};
