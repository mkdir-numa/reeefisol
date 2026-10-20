#!/bin/bash
# Regenerates the link-preview images in assets/og/ from scripts/og-card.html.
# Needs Google Chrome and a local server running in the repo root:
#   python3 -m http.server 8765    (in another terminal)
#   scripts/make-og-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
BASE="http://localhost:8765/scripts/og-card.html"
PROFILE="$(mktemp -d)"
mkdir -p assets/og

card() { # name, kicker, title, art
  local url="$BASE?kicker=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$2")&title=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$3")&art=$4"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$PROFILE" --window-size=1200,630 --virtual-time-budget=4000 \
    --screenshot="assets/og/$1.png" "$url" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 82 "assets/og/$1.png" --out "assets/og/$1.jpg" >/dev/null
  rm "assets/og/$1.png"
  echo "assets/og/$1.jpg"
}

card home         "ReFi Hub staking"        "Stake SOL. Plant corals and mangroves." reef
card institutions "Managed staking"         "Stake your treasury. Report the impact." plate
card refisol      "refiSOL"                 "Liquid staking that plants corals."      pollen
card delegation   "For delegation programs" "The only validator in Argentina."        current
card audit        "Audit our numbers"       "Every number, with its source."          plate

rm -rf "$PROFILE"
