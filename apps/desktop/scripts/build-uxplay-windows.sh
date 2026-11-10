#!/usr/bin/env bash
# Builds UxPlay (AirPlay receiver, GPL-3.0) for Windows in an MSYS2 UCRT64 shell
# and collects a self-contained runtime (uxplay.exe + GStreamer plugins + DLLs)
# into the folder given as $1. Used by the release workflow on windows-latest.
#
# UxPlay >= 1.74 has its own mDNS implementation: Apple's Bonjour is NOT needed.
set -euo pipefail

UXPLAY_REPO=https://github.com/FDH2/UxPlay
UXPLAY_COMMIT=05b0275cb1b726592700e47a6e0307544b3d3a52 # 1.74 (pinned)
OUT="$1"
P=mingw-w64-ucrt-x86_64

pacman -S --noconfirm --needed git "$P-cmake" "$P-gcc" "$P-ninja" "$P-pkgconf" "$P-libplist" "$P-openssl" \
  "$P-gstreamer" "$P-gst-plugins-base" "$P-gst-plugins-good" "$P-gst-plugins-bad" "$P-gst-libav"

SRC=$(mktemp -d)
git clone --quiet "$UXPLAY_REPO" "$SRC/UxPlay"
git -C "$SRC/UxPlay" checkout --quiet "$UXPLAY_COMMIT"
mkdir -p "$SRC/UxPlay/build"
cd "$SRC/UxPlay/build"
cmake -G Ninja .. >/dev/null
ninja >/dev/null

rm -rf "$OUT"
mkdir -p "$OUT/bin" "$OUT/lib/gstreamer-1.0" "$OUT/libexec/gstreamer-1.0"
cp uxplay.exe "$OUT/bin/"
cp /ucrt64/libexec/gstreamer-1.0/gst-plugin-scanner.exe "$OUT/libexec/gstreamer-1.0/"

# Only the GStreamer plugins UxPlay's mirror/audio pipelines use.
PLUGINS="coreelements app playback typefindfunctions videoparsersbad libav videoconvertscale videoconvert videoscale
  autodetect d3d11 d3d12 audioconvert audioresample audioparsers volume wasapi wasapi2 directsoundsink isomp4"
for p in $PLUGINS; do
  f=/ucrt64/lib/gstreamer-1.0/libgst$p.dll
  if [ -f "$f" ]; then cp "$f" "$OUT/lib/gstreamer-1.0/"; fi
done

# Copy every DLL these binaries depend on (resolved by ldd from /ucrt64/bin).
copy_deps() {
  ldd "$1" | awk '/\/ucrt64\/bin\// {print $3}' | while read -r dll; do
    if [ ! -f "$OUT/bin/$(basename "$dll")" ]; then
      cp "$dll" "$OUT/bin/"
      copy_deps "$dll"
    fi
  done
}
for f in "$OUT"/bin/uxplay.exe "$OUT"/libexec/gstreamer-1.0/*.exe "$OUT"/lib/gstreamer-1.0/*.dll; do copy_deps "$f"; done

cp "$SRC/UxPlay/LICENSE" "$OUT/LICENSE-UxPlay.txt"
cat > "$OUT/SOURCE.txt" <<EOF
UxPlay — AirPlay mirroring server — GNU General Public License v3.0
Source code: $UXPLAY_REPO (commit $UXPLAY_COMMIT)
Built with MSYS2 UCRT64 by MansoMirror's release workflow (apps/desktop/scripts/build-uxplay-windows.sh).
GStreamer and its plugins (LGPL-2.1+): https://gstreamer.freedesktop.org/src/ — MSYS2 packages: https://packages.msys2.org/
EOF

echo "Collected UxPlay runtime:"
du -sh "$OUT"
ls "$OUT/lib/gstreamer-1.0"
