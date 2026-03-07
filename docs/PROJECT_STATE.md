# GoWherer Project State

Last updated: 2026-03-07

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
- Entry quick templates (per journey kind, editable/resettable)
- Manual light/dark theme toggle with local persistence
- Route visualization (native map + web fallback) with lightweight track smoothing
- Android AMap SDK place picker (tap map/POI to select location in timeline draft)
- PDF export (with generated route preview image)
- GitHub Actions EAS build workflow + artifact/release publishing

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
- Android map picker: `react-native-amap3d` (native SDK; not available in Expo Go)

## Key Files

- App screens:
  - `app/(tabs)/index.tsx` (create/manage active journey)
  - `app/(tabs)/explore.tsx` (history, recap, PDF export)
- Storage and types:
  - `lib/journey-storage.ts`
  - `types/journey.ts`
- Geocoding:
  - `lib/reverse-geocode.ts` (provider selection, AMap HTTP reverse geocode, fallback, coord transform)
- Map components:
  - `components/track-map.tsx`
  - `components/track-map.web.tsx`
  - `components/amap-place-picker.tsx` (Android native AMap SDK picker modal)
- Build config:
  - `.github/workflows/eas-build.yml`
  - `eas.json`
  - `app.config.ts`

## Geocoding Status

- Reverse geocoding is now provider-configurable:
  - `amap`: AMap Web API (`/v3/geocode/regeo`)
  - `system`: `Location.reverseGeocodeAsync`
- Active selector is `extra.geocoding.provider` (from env `EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER`, default `amap`).
- AMap key source is `EXPO_PUBLIC_AMAP_WEB_KEY`.
- Fallback behavior:
  - If AMap fails or returns empty place text, app falls back to `system` reverse geocoding.
- Coordinate-system handling:
  - For `amap`, input coords from `expo-location` are converted `WGS84 -> GCJ-02` before request.
  - Conversion applies only to mainland China bounds; outside China original coords are used.

## EAS / CI Status

- EAS project: `@dsjerry/gowherer`
- EAS projectId: `82904fd8-1c6c-4a9f-bae4-b3c2446c9ac9`
- App identifiers:
  - Android package: `com.dsjerry.gowherer`
  - iOS bundle identifier: `com.dsjerry.gowherer`
- GitHub Action supports manual dispatch (`workflow_dispatch`) with:
  - `platform`: `android` / `ios` / `all`
  - `profile`: `preview` / `production`
  - `app_version` (optional, `x.y.z` format)
- CI env and configuration:
  - `vars.EAS_PROJECT_ID` (or `secrets.EAS_PROJECT_ID`, optional due default fallback)
  - `vars.EXPO_PUBLIC_REVERSE_GEOCODE_PROVIDER` (optional)
  - `secrets.EXPO_PUBLIC_AMAP_WEB_KEY` (required when provider=`amap`)
  - `secrets.EXPO_TOKEN`
- Versioning behavior:
  - `app.config.ts` reads `APP_VERSION` for `expo.version` (default `1.0.0`).
  - `eas.json` uses remote app version source.
  - `autoIncrement: true` enabled for both `preview` and `production` profiles.
- Build outputs:
  - EAS artifacts are downloaded in CI and uploaded as GitHub workflow artifacts.
  - CI also publishes downloaded artifacts to GitHub Release tag: `eas-build-<profile>-<run_number>`.

## Current Risk / Blocker

First Android build in GitHub Actions can fail in non-interactive mode if Android keystore has never been provisioned on EAS.

Error (key line):
- `Generating a new Keystore is not supported in --non-interactive mode`

## One-time Unblock Steps (if keystore missing)

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

Current uncommitted changes (2026-03-07, before this update):
- `LICENSE`

## Progress Log (Recent)

2026-03-02 baseline:
- Added provider abstraction for reverse geocoding in `lib/reverse-geocode.ts`.
- Integrated AMap reverse geocoding via Web API and kept system reverse geocoding as fallback.
- Added Chinese response preference for AMap reverse geocoding (`language=zh_cn`).
- Added AMap error introspection (`status/info/infocode`) in dev logs.
- Added WGS84 -> GCJ-02 coordinate conversion before AMap reverse geocoding (mainland China only).
- Updated create-entry location UI layout to prevent "移除定位" from overflowing on long addresses.
- Updated CI workflow:
  - moved `EAS_PROJECT_ID` to GitHub Variables usage
  - added geocoding env injection
  - added optional `app_version` input with SemVer validation
- Updated app config to read `APP_VERSION` and geocoding env values.
- Enabled EAS auto-increment versioning for both `preview` and `production`.
- Updated README docs (EN + ZH) with env variables, coordinate-system note, and versioning behavior.

Post-baseline additions in repository:
- Added entry template system (`types/template.ts`, `lib/template-storage.ts`) and template management UI in `app/(tabs)/index.tsx`.
- Added lightweight track smoothing utility (`lib/track-utils.ts`) and wired it into native/web map display and explore metrics flow.
- Added Android AMap SDK place picker (`react-native-amap3d`) and integrated pick-and-fill flow into entry editor in `app/(tabs)/index.tsx`.
- Added Android key config path in `app.config.ts` (`AMAP_ANDROID_API_KEY` -> `extra.amap.androidApiKey`).
- Clarified runtime constraint in docs: third-party native SDK features require Dev Client / EAS build (Expo Go unsupported).
- CI now downloads EAS artifacts and publishes them to GitHub Releases in addition to workflow artifacts (`.github/workflows/eas-build.yml`).
- CI `EAS_PROJECT_ID` supports variable/secret fallback (`vars.EAS_PROJECT_ID || secrets.EAS_PROJECT_ID`).

## Feature Roadmap (Planned)

### P0 - High ROI / Near-term

- [Done] Place reverse geocoding (lat/lng -> human-readable place name).
- [Done] Provider-switch reverse geocoding (`amap`/`system`) with fallback.
- [Done] Mainland China coordinate-system adaptation (`WGS84 -> GCJ-02`) for AMap accuracy.
- [Done] Tags for journey and entry, with keyword + tag filters.
- [Done] Basic stats card per journey:
  - Total distance
  - Duration
  - Average speed
  - Location point count
- [Done] Video/Photo media improvements (dependency-free baseline):
  - Better grouped media display in recap
  - Video thumbnail placeholder support (and `thumbnailUri` field for future upgrade)
- [Done] Timeline templates (departure/arrival/rest/check-in quick entry; editable/resettable per journey kind).
- [Done] GPS track denoise/smoothing for cleaner route display and derived recap path metrics.
- Safe area and full-screen adaptation refinements across pages.

### P1 - Product Depth

- Smart route analysis:
  - Stay-point detection (hotspots)
  - Segment summary by movement/rest
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

## Suggested Next Actions

1. Verify Android and iOS CI builds on current workflow and confirm release assets naming/retention policy.
2. If not done yet, provision Android keystore in EAS (one-time), then re-run Android preview build.
3. Define release governance:
   - whether every preview run should publish GitHub Release
   - if yes, clean-up/retention strategy for `eas-build-*` tags/releases
4. Add workflow input `publish_release` (boolean) to make Release publishing optional per run.
5. Start P1 smart route analysis (stay-point + segment summary) on top of existing smoothing pipeline.
6. Plan export enhancement phase (PDF template/cover customization) and finalize minimal MVP scope.
