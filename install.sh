#!/usr/bin/env bash
#
# Donna installer — no Apple Developer account required.
#
# Why this works: macOS Gatekeeper flags apps that have the
# `com.apple.quarantine` attribute, which is applied by web browsers. This
# script downloads with `curl` (no quarantine) and also strips the attribute
# defensively, so Donna launches without the "unidentified developer" warning.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/alj04ofm-svg/donna/main/install.sh | bash
#
set -euo pipefail

REPO="alj04ofm-svg/donna"
APP_NAME="Donna"
# Override with DONNA_DEST=~/Applications to test without touching /Applications.
DEST_DIR="${DONNA_DEST:-/Applications}"
DEST="${DEST_DIR}/${APP_NAME}.app"

command -v curl >/dev/null || { echo "curl is required."; exit 1; }
command -v hdiutil >/dev/null || { echo "This installer is for macOS."; exit 1; }

echo "→ Looking up the latest Donna release…"
API="https://api.github.com/repos/${REPO}/releases"
DMG_URL="$(curl -fsSL "$API" \
  | grep -oE '"browser_download_url": *"[^"]+\.dmg"' \
  | sed -E 's/.*"(https[^"]+)"/\1/' \
  | head -1)"

if [ -z "${DMG_URL:-}" ]; then
  echo "✗ Could not find a .dmg in the latest releases. See https://github.com/${REPO}/releases"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "→ Downloading $(basename "$DMG_URL")…"
curl -fL "$DMG_URL" -o "$TMP/Donna.dmg"

echo "→ Mounting…"
MOUNT="$TMP/mnt"
mkdir -p "$MOUNT"
hdiutil attach "$TMP/Donna.dmg" -nobrowse -readonly -mountpoint "$MOUNT" >/dev/null

SRC_APP="$(find "$MOUNT" -maxdepth 1 -name "*.app" -type d | head -1)"
if [ -z "$SRC_APP" ]; then
  echo "✗ No .app found inside the disk image."; hdiutil detach "$MOUNT" >/dev/null || true; exit 1
fi

echo "→ Installing to ${DEST_DIR}…"
TARGET_DIR="$DEST_DIR"
if [ ! -w "$TARGET_DIR" ]; then TARGET_DIR="$HOME/Applications"; fi
mkdir -p "$TARGET_DIR"
rm -rf "${TARGET_DIR}/${APP_NAME}.app"
cp -R "$SRC_APP" "${TARGET_DIR}/${APP_NAME}.app"
hdiutil detach "$MOUNT" >/dev/null || true

# Defensive: make sure no quarantine attribute is present.
xattr -dr com.apple.quarantine "${TARGET_DIR}/${APP_NAME}.app" 2>/dev/null || true

# Ad-hoc sign so Apple Silicon is happy even though we have no Developer ID.
# (Harmless if it fails; the app's inner binaries are already signed.)
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "${TARGET_DIR}/${APP_NAME}.app" >/dev/null 2>&1 || true
fi

echo ""
echo "✓ Donna installed to ${TARGET_DIR}/${APP_NAME}.app"
echo "  Open it with:  open -a Donna"
echo "  First run: set your name + API key in the setup wizard. Press ⌘⇧Space to summon Donna."
