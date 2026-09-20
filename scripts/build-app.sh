#!/bin/bash
# build-app.sh — Donna.app as a thin LAUNCHER over the Electron runtime already
# in node_modules.
#
# WHY a launcher, not a self-contained copy: a copied+renamed Electron needs its
# own code signature. Ad-hoc signatures (`codesign -s -`) have no stable
# designated requirement, so macOS TCC fails to reliably match the running
# process to its granted permission entries — result: it re-prompts for
# Screen Recording / Accessibility you've ALREADY granted, over and over.
# Reusing the shared Electron binary means Donna runs under Electron's own
# stable, properly-signed identity and inherits every permission you've already
# given Electron — so it never asks again. Trade-off: the menu-bar app-menu text
# reads "Electron" (cosmetic; window, Dock icon, Spotlight and Finder say Donna).
#
# Real app in every way that matters: double-click, Dock, Spotlight, launch-at-
# login, custom icon. Runs the live repo code in place.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="/Applications/Donna.app"
ELECTRON_BIN="$REPO/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron"
ICNS="$REPO/assets/build/donna.icns"

[ -x "$ELECTRON_BIN" ] || { echo "✗ electron binary missing — run: npm install"; exit 1; }
[ -f "$ICNS" ] || { echo "✗ icon missing — run: npm run icon"; exit 1; }

echo "→ building Donna.app (launcher) for repo: $REPO"
osascript -e 'tell application "Donna" to quit' 2>/dev/null || true
pkill -f "Donna.app/Contents/MacOS/Donna" 2>/dev/null || true
sleep 1

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

cat > "$APP/Contents/MacOS/Donna" <<EOF
#!/bin/bash
cd "$REPO" || exit 1
exec "$ELECTRON_BIN" "$REPO" "\$@"
EOF
chmod +x "$APP/Contents/MacOS/Donna"

cp "$ICNS" "$APP/Contents/Resources/donna.icns"

cat > "$APP/Contents/Info.plist" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Donna</string>
  <key>CFBundleDisplayName</key><string>Donna</string>
  <key>CFBundleIdentifier</key><string>com.alj.donna.launcher</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleExecutable</key><string>Donna</string>
  <key>CFBundleIconFile</key><string>donna</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
EOF

touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" 2>/dev/null || true

echo "✓ built $APP (launcher — inherits Electron's permissions, never re-prompts)"
echo "  open it:  open -a Donna"
