# GoWherer

[中文文档](./README.zh-CN.md)

GoWherer is an Expo React Native app for recording and reviewing journey timelines (travel/commute). It focuses on fast capture, clear recap, and shareable output.

## Features

- Journey start/end flow
- Timeline entries with text, location, photos, and videos
- Camera capture and media library import
- Entry edit/delete
- Journey history with type filter
- Reverse geocoding (lat/lng to place name)
- Journey/entry tags and recap keyword/tag filters
- Journey stats card:
  - Distance
  - Duration
  - Average speed
  - Location point count
- Route visualization (native map + web fallback)
- PDF export with route preview image and stats
- Manual light/dark mode toggle with local persistence

## Tech Stack

- Expo SDK 55
- React Native 0.83.2
- React 19.2.0
- Expo Router
- AsyncStorage
- `expo-image-picker`, `expo-location`, `expo-video`, `expo-print`, `expo-sharing`
- `react-native-maps`

## Getting Started

### Requirements

- Node.js 18+
- npm
- Expo environment for Android/iOS/Web

### Install

```bash
npm install
```

### Run

```bash
npm run start
```

Or run platform-specific commands:

```bash
npm run android
npm run ios
npm run web
```

## Scripts

- `npm run start` - start Expo dev server
- `npm run android` - run on Android target
- `npm run ios` - run on iOS target
- `npm run web` - run web target
- `npm run lint` - run lint checks
- `npm run reset-project` - reset starter layout script

## Project Structure

- `app/(tabs)/index.tsx` - active journey creation/management
- `app/(tabs)/explore.tsx` - history, recap, and PDF export
- `lib/journey-storage.ts` - local persistence logic
- `types/journey.ts` - core data types
- `components/track-map.tsx` - native route map
- `components/track-map.web.tsx` - web route map fallback
- `.github/workflows/eas-build.yml` - EAS CI workflow
- `app.config.ts` - Expo app config

## EAS Build and CI

This project is configured for EAS builds with GitHub Actions manual dispatch (`platform`: `android`/`ios`/`all`, `profile`: `preview`/`production`).

Required GitHub secrets:

- `EXPO_TOKEN`
- `EAS_PROJECT_ID`

### Known Android CI issue

If Android keystore is not provisioned yet, non-interactive CI build may fail with:

`Generating a new Keystore is not supported in --non-interactive mode`

Run once locally (interactive) to provision credentials:

```bash
npx eas-cli@latest login
npx eas-cli@latest credentials -p android
```

Then rerun the GitHub Action.

## Roadmap

- P1:
  - Smart route analysis (stay points / segment summary)
  - GPS track denoise/smoothing
  - Timeline entry templates
  - PDF template and cover customization
  - Journey share card generation
- P2:
  - Cloud sync
  - Cross-device restore/browsing
  - Collaboration mode
  - Privacy controls for coordinate masking
  - Geofence reminders and optional background auto logging

## License

MIT License. See [LICENSE](./LICENSE).
