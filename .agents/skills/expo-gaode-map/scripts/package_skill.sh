#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_FILE="${1:-$ROOT_DIR/expo-gaode-map.skill}"
TMP_DIR="$(mktemp -d)"
PKG_DIR="$TMP_DIR/expo-gaode-map"

mkdir -p "$PKG_DIR"

cp "$ROOT_DIR/SKILL.md" "$PKG_DIR/SKILL.md"
cp -R "$ROOT_DIR/references" "$PKG_DIR/"
cp -R "$ROOT_DIR/scripts" "$PKG_DIR/"
cp -R "$ROOT_DIR/assets" "$PKG_DIR/"
if [ -d "$ROOT_DIR/agents" ]; then
  cp -R "$ROOT_DIR/agents" "$PKG_DIR/"
fi

(cd "$TMP_DIR" && zip -qr "$OUT_FILE" expo-gaode-map)

echo "$OUT_FILE"
