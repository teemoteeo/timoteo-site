#!/bin/sh
# Builds the 42 Pac-Man for the browser into projects/pac-man/.
# Needs pygbag (pip install pygbag). Usage: tools/pacman-web/build.sh [path/to/PAC-MAN]
set -e
SRC=${1:-$HOME/Desktop/42/quarantadue/milestone_4/PAC-MAN}
HERE=$(cd "$(dirname "$0")" && pwd)
OUT=$HERE/../../projects/pac-man
TMP=$(mktemp -d)/pac-man

mkdir -p "$TMP"
cp -R "$SRC/pacman" "$SRC/config.json" "$HERE/main.py" "$TMP/"
unzip -q -o "$SRC"/packages/mazegen-*.whl mazegen.py -d "$TMP"
find "$TMP" -name __pycache__ -prune -exec rm -rf {} +

pygbag --build --title "Pac-Man" "$TMP"
rm -rf "$OUT" && cp -R "$TMP/build/web" "$OUT"
# The game has no sound: start without pygbag's "click to start" gate.
sed -i '' -e 's/ume_block : 1/ume_block : 0/' -e 's/"#7f7f7f"/"#000"/' "$OUT/index.html"
