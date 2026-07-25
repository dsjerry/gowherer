# AGENTS.md

This repository contains an AI integration guide for `expo-gaode-map`.

Use these instructions when an AI coding agent is asked to integrate, migrate, or troubleshoot `expo-gaode-map`, `expo-gaode-map-navigation`, or `expo-gaode-map-web-api` in an Expo / React Native project.

## Core Workflow

1. Inspect the target app first: `package.json`, Expo config, lockfile, route structure, and existing map/update dependencies.
2. Choose the smallest correct package:
   - `expo-gaode-map` for map, location, overlays, offline map, and built-in native search.
   - `expo-gaode-map-navigation` for route planning and navigation UI.
   - `expo-gaode-map-web-api` only when JavaScript Web API services are needed.
3. Install only the required package.
4. Update the existing Expo config with the Config Plugin.
5. Add a minimal map screen or integration point while preserving the existing navigation and state architecture.
6. Run or attempt `npx expo prebuild` after Config Plugin changes.
7. Report what changed, what still needs real API keys, and how to verify on device.

## Hard Rules

- If the target app already has `app.json`, update `app.json` directly.
- Do not create `app.config.js` or `app.config.ts` only to add the `expo-gaode-map` Config Plugin.
- If the user has not provided `androidKey` or `iosKey`, still add the Config Plugin with placeholders:

```json
[
  "expo-gaode-map",
  {
    "androidKey": "your-android-key",
    "iosKey": "your-ios-key",
    "enableLocation": true,
    "locationDescription": "需要访问位置信息以展示当前位置"
  }
]
```

- After adding or changing the Config Plugin, run or attempt:

```bash
npx expo prebuild
```

- Do not call `ExpoGaodeMapModule.initSDK({ androidKey, iosKey })` in basic map code when keys are configured through the Config Plugin.
- Only use `initSDK` when Web API needs `webKey`, or when there is no native key configuration at all.
- Do not install `expo-gaode-map` and `expo-gaode-map-navigation` together.

## References

- Main skill instructions: `SKILL.md`
- Package decision guide: `references/package-choice.md`
- Setup guide: `references/setup.md`
- Initialization guide: `references/initialization.md`
- Basic map integration: `references/basic-integration.md`
- Troubleshooting guide: `references/troubleshooting.md`

## Useful Script

Run the doctor script against a target app:

```bash
./scripts/integration_doctor.sh /path/to/app
```

It checks common mistakes such as missing dependency, missing Config Plugin, conflicting packages, and accidental `app.config.*` creation when `app.json` should be edited.
