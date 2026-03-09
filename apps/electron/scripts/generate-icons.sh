#!/usr/bin/env bash
# Generates build/icon.png and build/icon.icns from icon.png (512x512 source).
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
SRC="$ROOT/icon.png"
BUILD="$ROOT/build"

mkdir -p "$BUILD"
cp "$SRC" "$BUILD/icon.png"

# macOS only: generate .icns
if [[ "$OSTYPE" == "darwin"* ]]; then
  TMPDIR=$(mktemp -d)
  ICONSET="$TMPDIR/icon.iconset"
  mkdir "$ICONSET"
  sips -z 16   16   "$SRC" --out "$ICONSET/icon_16x16.png"     >/dev/null
  sips -z 32   32   "$SRC" --out "$ICONSET/icon_16x16@2x.png"  >/dev/null
  sips -z 32   32   "$SRC" --out "$ICONSET/icon_32x32.png"     >/dev/null
  sips -z 64   64   "$SRC" --out "$ICONSET/icon_32x32@2x.png"  >/dev/null
  sips -z 128  128  "$SRC" --out "$ICONSET/icon_128x128.png"   >/dev/null
  sips -z 256  256  "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256  256  "$SRC" --out "$ICONSET/icon_256x256.png"   >/dev/null
  sips -z 512  512  "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  cp "$SRC"                     "$ICONSET/icon_512x512.png"
  iconutil -c icns "$ICONSET" -o "$BUILD/icon.icns"
  rm -rf "$TMPDIR"
  echo "Generated build/icon.icns"
fi

echo "Generated build/icon.png"
