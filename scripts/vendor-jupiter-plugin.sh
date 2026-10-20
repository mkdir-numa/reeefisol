#!/usr/bin/env bash
# Download a pinned copy of Jupiter Plugin into assets/vendor/ so the site
# never runs swap code straight from Jupiter's servers. See
# assets/vendor/jupiter-plugin/README.md for why and how to review an update.
#
# Usage: scripts/vendor-jupiter-plugin.sh 1.0.16
set -euo pipefail

VERSION="${1:?usage: $0 <version, e.g. 1.0.16>}"
ORIGIN="https://plugin.jup.ag"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REL="assets/vendor/jupiter-plugin/$VERSION"
DEST="$ROOT/$REL"

mkdir -p "$DEST"
cd "$DEST"

# The loader is unversioned upstream, so check it is the version we asked for.
curl -fsSL "$ORIGIN/plugin-v1.js" -o plugin-v1.js
GOT="$(grep -o '"name":"@jup-ag/plugin","version":"[0-9.]*"' plugin-v1.js | sed -E 's/.*"([0-9.]+)"$/\1/' || true)"
if [ "$GOT" != "$VERSION" ]; then
  echo "Upstream loader is version '$GOT', not '$VERSION'. Re-run with $GOT." >&2
  rm -rf "$DEST"
  exit 1
fi

# Everything else the loader fetches (it builds these names from its version).
for f in "plugin-$VERSION-app.js" "plugin-$VERSION-Tailwind.css" "scoped-preflight-v4.css" "plugin-$VERSION-Jupiter.css"; do
  curl -fsSL "$ORIGIN/$f" -o "$f"
done

# Record upstream checksums before patching, so a reviewer can compare.
shasum -a 256 plugin-v1.js "plugin-$VERSION-app.js" "plugin-$VERSION-Tailwind.css" scoped-preflight-v4.css "plugin-$VERSION-Jupiter.css" > SHA256SUMS.upstream

# The one patch: point the loader at our copy instead of plugin.jup.ag.
# It must appear exactly once, or the upstream code has changed shape.
COUNT="$(grep -o "\"$ORIGIN\"" plugin-v1.js | wc -l | tr -d ' ')"
if [ "$COUNT" != "1" ]; then
  echo "Expected the origin string once in plugin-v1.js, found $COUNT. Review by hand." >&2
  exit 1
fi
sed -i.bak "s#\"$ORIGIN\"#\"$REL\"#" plugin-v1.js && rm plugin-v1.js.bak

shasum -a 256 plugin-v1.js "plugin-$VERSION-app.js" "plugin-$VERSION-Tailwind.css" scoped-preflight-v4.css "plugin-$VERSION-Jupiter.css" > SHA256SUMS

echo "Vendored Jupiter Plugin $VERSION into $REL"
echo
echo "Now update the two <script> tags in refisol.html (paths and integrity):"
echo "  $REL/plugin-v1.js"
echo "    integrity=\"sha384-$(openssl dgst -sha384 -binary plugin-v1.js | openssl base64 -A)\""
echo "  $REL/plugin-$VERSION-app.js"
echo "    integrity=\"sha384-$(openssl dgst -sha384 -binary "plugin-$VERSION-app.js" | openssl base64 -A)\""
echo "Then review the update as described in assets/vendor/jupiter-plugin/README.md."
