# Gowherer

Expo/React Native journey tracking app.

## Reference Documentation

- Expo SDK docs: https://docs.expo.dev/llms-full.txt — consult this when implementing features, choosing APIs, or debugging Expo modules
- Expo Router: file-based routing in `app/` directory

## Architecture

- `app/` — Expo Router screens (file-based routing)
- `components/` — shared and screen-specific UI components
- `hooks/` — custom React hooks encapsulating business logic
- `lib/` — utility modules (storage, i18n, logging, background services)
- `types/` — TypeScript type definitions

## Conventions

- Each screen component under `app/` should stay focused on orchestration; extract UI sections into `components/` and business logic into `hooks/`
- Components handle their own theming via `useColorScheme()` and i18n via `useI18n()`
- Async operations use `void` for fire-and-forget calls within event handlers
- State effects use the `active` flag pattern to avoid updates after unmount
