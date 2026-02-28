# GoWherer Project State

Last updated: 2026-02-28

## Project Overview

GoWherer is an Expo React Native app for creating and reviewing journey timelines (travel/commute), including:

- Journey start/end flow
- Timeline entries with text, location, photos, and videos
- Camera capture + media library import
- Entry edit/delete
- Journey history with type filter
- Reverse geocoding for location labels (lat/lng -> place name)
- Journey/entry tags + keyword/tag filter in recap
- Basic journey stats card (distance/duration/avg speed/location points)
- Media recap improvements (photo/video grouping + video thumbnail placeholder)
- Manual light/dark theme toggle with local persistence
- Route visualization (native map + web fallback)
- PDF export (with generated route preview image)
- GitHub Actions EAS build workflow

## Current Tech Stack

- Expo SDK 55 (`expo ~55.0.0`)
- React Native 0.83.2
- React 19.2.0
- Expo Router
- AsyncStorage for local persistence
- Media/location/PDF:
  - `expo-image-picker`
  - `expo-location`
  - `expo-video`
  - `expo-print`
  - `expo-sharing`
- Map: `react-native-maps`

## Key Files

- App screens:
  - `app/(tabs)/index.tsx` (create/manage active journey)
  - `app/(tabs)/explore.tsx` (history, recap, PDF export)
- Storage and types:
  - `lib/journey-storage.ts`
  - `types/journey.ts`
- Map components:
  - `components/track-map.tsx`
  - `components/track-map.web.tsx`
- Build config:
  - `.github/workflows/eas-build.yml`
  - `eas.json`
  - `app.config.ts`

## EAS / CI Status

- EAS project: `@dsjerry/gowherer`
- EAS projectId: `82904fd8-1c6c-4a9f-bae4-b3c2446c9ac9`
- App identifiers:
  - Android package: `com.dsjerry.gowherer`
  - iOS bundle identifier: `com.dsjerry.gowherer`
- GitHub Action supports manual dispatch (`workflow_dispatch`) with:
  - `platform`: `android` / `ios` / `all`
  - `profile`: `preview` / `production`
- Required GitHub repository secrets:
  - `EXPO_TOKEN`
  - `EAS_PROJECT_ID` (recommended to match value above)

## Current Blocker

Android build in GitHub Actions fails in non-interactive mode when Android keystore is not yet provisioned on EAS.

Error (key line):
- `Generating a new Keystore is not supported in --non-interactive mode`

## Unblock Steps

Run once locally in interactive mode to generate/upload Android keystore:

```bash
npx eas-cli@latest login
npx eas-cli@latest credentials -p android
```

Alternative (also interactive path):

```bash
npx eas-cli@latest build -p android --profile preview
```

After credentials exist on Expo servers, re-run GitHub Action.

## Local Workspace Snapshot

Current uncommitted changes (2026-02-28):
- `app.config.ts`
- `package.json`
- `package-lock.json`
- `LICENSE`
- `docs/PROJECT_STATE.md` (this file)

## Progress Log (2026-02-28)

- Migrated media playback from `expo-av` to `expo-video` for SDK 55 compatibility (Expo Go path).
- Added safe-area top spacing for tab pages.
- Implemented reverse geocoding and place-name display in journey timeline, recap, and PDF export.
- Added journey/entry tags with storage normalization for backward compatibility.
- Added recap search and filtering by keyword + tags.
- Added journey stats card (distance, duration, average speed, location points) and synced stats into PDF export.
- Added recap card collapse/expand with animation; default remains expanded.
- Switched recap action controls to icon buttons (expand/collapse, export PDF, delete).
- Added manual light/dark theme toggle with local persistence and page-level theme adaptation.
- Completed theme-following fixes for cards, inputs, tags, stats block, and media cards across `index` and `explore`.
- Updated tab icon for `旅程` to a map-oriented symbol.
- Added video cover behavior in media cards using dependency-free preview fallback (current environment-safe approach).

## Feature Roadmap (Planned)

### P0 - High ROI / Near-term

- [Done] Place reverse geocoding (lat/lng -> human-readable place name).
- [Done] Tags for journey and entry, with keyword + tag filters.
- [Done] Basic stats card per journey:
  - Total distance
  - Duration
  - Average speed
  - Location point count
- [Done] Video/Photo media improvements (dependency-free baseline):
  - Better grouped media display in recap
  - Video thumbnail placeholder support (and `thumbnailUri` field for future upgrade)
- Safe area and full-screen adaptation refinements across pages.

### P1 - Product Depth

- Smart route analysis:
  - Stay-point detection (hotspots)
  - Segment summary by movement/rest
- GPS track denoise/smoothing for cleaner route lines.
- Timeline templates (departure/arrival/rest/check-in quick entry).
- Export enhancement:
  - PDF theme templates
  - Cover customization
  - Optional sectioned layout
- Journey share card generation (title + route snapshot + key metrics).

### P2 - Advanced

- Cloud sync (replace/extend local storage).
- Cross-device restore and browsing.
- Collaboration mode (multi-user journey timeline).
- Privacy controls:
  - Hide/mask sensitive coordinates on export/share
- Geofence reminders and optional background auto logging.

### Delivery Notes

- Recommended first implementation batch:
  1. cloud sync design draft
- Reason: low-to-medium implementation cost, immediate UX gain, and minimal risk to current core flow.

## Suggested Next Actions

1. Provision Android keystore in EAS (one-time).
2. Re-run GitHub Action Android preview build and verify artifact output.
3. Optionally add a short CI preflight step (`eas credentials` status check doc/process) to reduce credential-related CI failures.
4. Start P1 implementation (recommended: timeline templates or route denoise/smoothing).
5. Prepare cloud sync technical design draft (data model, conflict policy, provider choice).
6. If release is planned, define production profile signing/release checklist in `docs/`.
