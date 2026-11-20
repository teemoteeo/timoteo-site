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
# can_close: no "leave this page?" prompt. The game ignores the mouse, so the
# wheel scrolls the portfolio page instead of being swallowed by the canvas.
WHEEL='addEventListener("wheel", e => { e.stopImmediatePropagation(); e.preventDefault(); parent.scrollBy(e.deltaX, e.deltaY * (e.deltaMode ? 16 : 1)) }, { capture: true, passive: false })'
sed -i '' -e 's/ume_block : 1/ume_block : 0/' -e 's/can_close : 0/can_close : 1/' \
    -e 's/"#7f7f7f"/"#000"/' -e "s|</body>|<script>$WHEEL</script></body>|" "$OUT/index.html"
# Portfolio look: the Python block still waits for a click (MM.UME) even with ume_block 0,
# and the loader is powder blue with a green/blue box. Start at once, dark, quiet loader.
sed -i '' -e 's/    if not platform.window.MM.UME:/    if False:  # portfolio: the game has no sound, start without waiting for a click/' \
    -e 's/background-color:powderblue;/background-color:#000;/' \
    -e 's/            background: green;/            background: transparent;/' \
    -e 's/            color: blue;/            color: #9d9aa3;/' \
    -e 's/            font-weight: bold;$/            font: 12px\/1.4 ui-monospace, monospace; letter-spacing: 1px;/' \
    -e 's/Loading, please wait .../loading pac-man…/' "$OUT/index.html"
