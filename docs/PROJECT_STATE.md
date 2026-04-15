# GoWherer Project State

Last updated: 2026-04-11

## Documentation Index

- `docs/KNOWLEDGE_POINTS.md` (build/runtime troubleshooting and key project decisions)
- `docs/PROJECT_KNOWLEDGE_BASE.md` (full project knowledge base)
- `docs/ONBOARDING.md` (beginner setup and first-run guide)
- `docs/TROUBLESHOOTING.md` (symptom-root cause-fix quick reference)

## Project Overview

GoWherer is an Expo React Native app for creating and reviewing journey timelines (travel/commute), including:

- Journey start/end flow
- Timeline entries with text, location, photos, videos, and audio clips
- Camera capture + media library import
- In-entry audio recording and playback
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
- **Continuous GPS location tracking toggle** — when enabled, records location points in the background during an active journey; accumulated track points are stored persistently and can be used to draw the journey route on the map when the journey ends
- PDF export (with generated route preview image)
- GitHub Actions EAS build workflow + artifact/release publishing

## Current Tech Stack

- Expo SDK 55 (`expo ~55.0.0`)
- React Native 0.83.2
- React 19.2.0
- Expo Router
- AsyncStorage for local persistence
- Media/location/PDF:
  - `expo-audio`
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
  - `types/journey.ts` (includes `Journey.trackLocations` for continuous GPS tracking)
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

Current uncommitted changes (2026-03-18):
- Added local audio timeline support in working tree (not yet reflected in a dedicated git commit):
  - new dependency `expo-audio`
  - `TimelineMedia.type` expanded from `photo | video` to `photo | video | audio`
  - journey draft supports microphone recording, stop/save to media list, and inline playback
  - existing timeline entries render audio playback cards alongside photo/video media
- Line ending normalization (LF -> CRLF) across these files:
- `LICENSE`
- `app/(tabs)/_layout.tsx`
- `app/(tabs)/explore.tsx`
- `app/(tabs)/index.tsx`
- `app/_layout.tsx`
- `app/location-picker.tsx`
- `android/app/build.gradle`
- `components/amap-place-picker.tsx`
- `components/track-map.tsx`
- `components/track-map.web.tsx`
- `docs/PROJECT_STATE.md`
- `hooks/locale-preference.tsx`
- `lib/i18n.ts`
- `lib/template-storage-i18n.ts`
- `locales/en.ts`
- `package.json`
- `package-lock.json`

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

Latest updates (2026-03-07):
- Added Android AMap picker stability hardening based on native crash traces:
  - replaced modal-style teardown path with persistent overlay container
  - removed map forced remount (`key` refresh) to avoid repeated engine destroy/create
  - adjusted picker close flow to reduce AMap surface destroy crash risk
- Restored map location UX in picker:
  - re-enabled AMap "my location" layer/button
  - auto-center camera to current location on picker open when location is available
  - fallback remains Beijing center when location cannot be obtained
- Added/updated local runtime logs (`lib/local-log.ts`) and initialization hook in journey screen for easier field diagnosis.
- Added project documentation set for onboarding and troubleshooting:
  - `docs/ONBOARDING.md`
  - `docs/TROUBLESHOOTING.md`
  - `docs/PROJECT_KNOWLEDGE_BASE.md`
  - refreshed `docs/KNOWLEDGE_POINTS.md` / `docs/PROJECT_STATE.md` index links

Latest updates (2026-03-08):
- Added dedicated location picker page flow:
  - `app/location-picker.tsx` (top map + nearby places list)
  - `app/(tabs)/index.tsx` changed from modal picker to route push/return
  - `lib/pending-location.ts` for one-shot location handoff back to journey draft
- Improved location UX and coordinate handling:
  - location selection now uses explicit `WGS84 <-> GCJ-02` conversion utilities in `lib/reverse-geocode.ts`
  - added nearby place query (`/v3/place/around`) and visible failure hints
  - open picker auto-locates with quick last-known fallback then refined current location
- Android AMap stability hardening for native crashes:
  - added `android:allowNativeHeapPointerTagging=\"false\"` in `android/app/src/main/AndroidManifest.xml`
  - hardened picker teardown/timing guards to avoid async updates on inactive map page
- Recap tab crash fix on Android:
  - root cause identified as Google Maps API key missing in `react-native-maps` path
  - `components/track-map.tsx` switched Android rendering to `react-native-amap3d` (iOS/Web unchanged)
- New Architecture warning cleanup:
  - removed `UIManager.setLayoutAnimationEnabledExperimental` no-op call from `app/(tabs)/explore.tsx`
- Track marker visuals:
  - start/end/mid marker icons added in `assets/images/marker-start.png`, `marker-end.png`, `marker-mid.png`
  - Android recap now shows all route waypoints with custom icon set

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
- [Done] Continuous GPS location tracking toggle — background recording during active journey, persisted to `Journey.trackLocations`.
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

1. Verify Android real-device stability for AMap picker across repeated open/cancel/confirm cycles.
2. Verify Android and iOS CI builds on current workflow and confirm release assets naming/retention policy.
3. If not done yet, provision Android keystore in EAS (one-time), then re-run Android preview build.
4. Define release governance:
   - whether every preview run should publish GitHub Release
   - if yes, clean-up/retention strategy for `eas-build-*` tags/releases
5. Add workflow input `publish_release` (boolean) to make Release publishing optional per run.
6. Start P1 smart route analysis (stay-point + segment summary) on top of existing smoothing pipeline.
7. Plan export enhancement phase (PDF template/cover customization) and finalize minimal MVP scope.

## Work Log (2026-03-12)

### Completed
- Added Settings tab and new Settings screen with language selection (system/zh/en).
- Implemented i18n base: locale storage, translator, and locale-aware template defaults.
- Wired i18n into tabs, Journey screen, Review screen, map picker, AMap picker, and track map (web + native).
- Added English + Chinese translation dictionaries and moved default templates per locale.
- Added Settings icon mapping for tab bar.

### TODO / Follow-ups
- Install new dependency `expo-localization` in the workspace.
- Decide whether to deprecate or remove legacy `lib/template-storage.ts` (now replaced by locale-aware storage).
- Run app/build checks to validate i18n flow and tab navigation.

## Work Log (2026-03-13)

### Completed
- Fixed lint errors (invalid character in `components/ui/icon-symbol.tsx`, broken regex in `app/(tabs)/index.tsx`, unused vars).
- Rewrote locale files to UTF-8 and restored Chinese strings to resolve Android bundling error in `locales/zh.ts`.
- Moved theme toggle into Settings and redesigned Settings items as list rows.
- Updated EAS GitHub Action to accept `release_notes` input and write multi-line notes into GitHub Release.

## Working Tree Summary (2026-03-13)

- Added Settings screen and i18n infrastructure: `app/(tabs)/settings.tsx`, `hooks/locale-preference.tsx`, `lib/i18n.ts`, `lib/template-storage-i18n.ts`, `locales/`.
- Updated journey and review tabs to use localized strings and refreshed UI: `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/(tabs)/_layout.tsx`.
- Refined location picker and AMap picker flows: `app/location-picker.tsx`, `components/amap-place-picker.tsx`.
- Adjusted track map rendering for native/web and lint fixes: `components/track-map.tsx`, `components/track-map.web.tsx`, `components/ui/icon-symbol.tsx`.
- Updated workflow to support release notes input: `.github/workflows/eas-build.yml`.
- Updated runtime scripts and dependencies: `package.json`, `package-lock.json`.

## Work Log (2026-03-15)

### Completed
- Fixed map picker nearby-place separator mojibake by replacing corrupted separator with ASCII `-` and ensuring UTF-8 encoding in `app/location-picker.tsx`.
- Kept Android debug `versionNameSuffix` only; removed `applicationIdSuffix` so `expo run:android` can install and launch the same package id reliably.
- Workspace still shows line ending normalization (LF -> CRLF) across multiple files.

### TODO / Follow-ups
- If line ending normalization was unintentional, decide whether to revert or standardize via `.gitattributes`.

## Work Log (2026-03-18)

### Git Record Check
- Recent visible commits stop at `77ecb91 feat: add permissions and licenses pages`; there is no dedicated committed `audio` feature commit yet.
- Current audio capability exists in local uncommitted changes on top of `main`.

### Completed
- Added `expo-audio` dependency for native audio recording/playback support.
- Extended timeline media model to support `audio` items in addition to `photo` and `video`.
- Added journey-page audio recording flow:
  - request microphone permission
  - start/stop recording with `RecordingPresets.HIGH_QUALITY`
  - append recorded clip into draft media list
- Added inline audio playback UI for both draft media and saved timeline entries.

### TODO / Follow-ups
- Verify recording/playback behavior on Android device, especially permission prompts, repeated start/stop, and saved clip replay after app restart.

## Work Log (2026-04-11)

### Completed
- Added continuous GPS location tracking feature:
  - New `trackLocations: TimelineLocation[]` field on `Journey` type (`types/journey.ts`)
  - Storage migration: `lib/journey-storage.ts` normalizes missing `trackLocations` to `[]` for existing journeys
  - Toggle switch UI in active journey card (`app/(tabs)/index.tsx`) — "Track location" / "持续定位"
  - `Location.watchPositionAsync` with `accuracy: Highest`, `timeInterval: 5000`, `distanceInterval: 5`
  - Locations buffered in a ref, batch-synced into the active journey's `trackLocations` array on every render cycle
  - Toggle off stops the watcher and flushes any pending points
  - Added i18n keys: `journey.locationTracking`, `journey.trackingPoints` in both English and Chinese locale files
- Fixed pre-existing `View` style type error (`themed.locationText` was incorrectly applied to a `View`而非 `Text`)

### TODO / Follow-ups
- Wire `Journey.trackLocations` into the recap map (`components/track-map.tsx`) so the continuous track replaces or supplements manual location entries when drawing the route.
- Consider adding a "tracking is active" indicator (e.g., subtle badge or pulsing dot) so users know background tracking is running.
