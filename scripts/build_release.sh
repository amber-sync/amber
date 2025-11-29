#!/bin/bash
set -e

echo "🚀 Building Amber (Release)..."
cd amber-swift
swift build -c release

# Create App Bundle Structure
APP_NAME="Amber"
BUNDLE_DIR=".build/release/$APP_NAME.app"
CONTENTS_DIR="$BUNDLE_DIR/Contents"
MACOS_DIR="$CONTENTS_DIR/MacOS"
RESOURCES_DIR="$CONTENTS_DIR/Resources"

mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Copy Binary
cp ".build/release/Amber" "$MACOS_DIR/"

# Create Info.plist
cat > "$CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>Amber</string>
    <key>CFBundleIdentifier</key>
    <string>com.florianmahner.amber</string>
    <key>CFBundleName</key>
    <string>Amber</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>2.0.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# Copy Icon (if exists)
if [ -f "../build/icons/icon.icns" ]; then
    cp "../build/icons/icon.icns" "$RESOURCES_DIR/AppIcon.icns"
fi

echo "✅ App Bundle created at: amber-swift/$BUNDLE_DIR"
echo "   To run: open amber-swift/$BUNDLE_DIR"
