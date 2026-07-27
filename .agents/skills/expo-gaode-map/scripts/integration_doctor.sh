#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${1:-$(pwd)}"
cd "$APP_ROOT"

echo "[doctor] app root: $APP_ROOT"

ok(){ echo "[ok] $*"; }
warn(){ echo "[warn] $*"; }
miss(){ echo "[missing] $*"; }

if [ -f package.json ]; then
  ok "package.json found"
else
  miss "package.json not found"
  exit 2
fi

if node -e "const p=require('./package.json'); const d=p.dependencies||{}; const pd=p.peerDependencies||{}; process.exit((d['expo-gaode-map']||d['expo-gaode-map-navigation']||d['expo-gaode-map-web-api']||pd['expo-gaode-map']||pd['expo-gaode-map-navigation']||pd['expo-gaode-map-web-api'])?0:1)"; then
  ok "expo-gaode-map package detected"
else
  miss "expo-gaode-map package missing"
fi

if [ -f app.json ]; then
  if grep -q 'expo-gaode-map' app.json; then
    ok "app.json references expo-gaode-map"
  else
    warn "app.json found but no expo-gaode-map plugin detected"
  fi
fi

if [ -f app.config.ts ] || [ -f app.config.js ] || [ -f app.config.mjs ] || [ -f app.config.cjs ]; then
  if grep -R --line-number 'expo-gaode-map' app.config.* >/dev/null 2>&1; then
    ok "app config references expo-gaode-map"
  else
    warn "app config found but no expo-gaode-map plugin detected"
  fi
fi

if [ -f app.json ] && { [ -f app.config.ts ] || [ -f app.config.js ] || [ -f app.config.mjs ] || [ -f app.config.cjs ]; }; then
  warn "both app.json and app.config.* exist; do not create app.config.* just to add expo-gaode-map"
fi

if node -e "const p=require('./package.json'); const d=p.dependencies||{}; process.exit((d['expo-gaode-map']&&d['expo-gaode-map-navigation'])?0:1)"; then
  warn "both expo-gaode-map and expo-gaode-map-navigation detected; choose one"
fi

if [ -d ios ]; then
  if [ -f ios/Podfile ]; then
    ok "ios/Podfile found"
  else
    warn "ios exists but Podfile missing"
  fi
fi

if [ -d android ]; then
  ok "android project found"
fi

echo "[doctor] done"
