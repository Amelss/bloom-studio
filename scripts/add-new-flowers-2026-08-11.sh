#!/usr/bin/env bash
#
# Register the 6 new varieties' 8 assets in one go (2026-08-11 batch).
#
# PREREQUISITE: run scripts/new-varieties-2026-08-11.sql in the Supabase SQL
# editor FIRST — add-asset needs each variety row to already exist.
#
# Usage:
#   export SUPABASE_URL=https://<ref>.supabase.co
#   export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
#   scripts/add-new-flowers-2026-08-11.sh ["/path/to/NEW Flowers"]
#
#   UPLOAD=1 scripts/add-new-flowers-2026-08-11.sh   # also push to the CDN
#
# Each asset is added with --no-manifest; the catalog + manifest are regenerated
# ONCE at the end (faster than 8 rebuilds). Then upload + commit.

set -euo pipefail
cd "$(dirname "$0")/.."

: "${SUPABASE_URL:?Set SUPABASE_URL (e.g. https://<ref>.supabase.co)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY (service-role key — secret)}"

D="${1:-$HOME/Downloads/NEW Flowers}"
[ -d "$D" ] || { echo "✗ Source folder not found: $D" >&2; exit 1; }
echo "Source: $D"
echo

# add <filename> <variety> <colorway> [flags…]
add() {
  local file="$1"; shift
  echo "→ $*"
  npm run --silent assets:add -- "$D/$file" "$@" --no-manifest
}

add "Chrysanthemum - Light Pink.png" chrysanthemum light-pink --name "Light Pink" --petal "#e6a6b6" --accent "#cf8698" --hue 340
add "Chrysanthemum - Orange.png"     chrysanthemum orange     --name "Orange"     --petal "#d9812a" --accent "#b8641a" --hue 30
add "Chrysanthemum Dark Pink.png"    chrysanthemum dark-pink  --name "Dark Pink"  --petal "#bc4b84" --accent "#942f64" --hue 325
add "Green Tassels.png"    amaranthus       green   --name "Green"    --petal "#7e9a3e" --accent "#5f7a2c" --hue 80  --neutral
add "Pampas grass.png"     pampas           natural --name "Natural"  --petal "#d9bc96" --accent "#c2a074" --hue 38  --neutral
add "Scabiosa.png"         scabiosa         lavender --name "Lavender" --petal "#9e8fc0" --accent "#7d6ea0" --hue 265
add "String of Pearls.png" string-of-pearls green   --name "Green"    --petal "#6f8c3f" --accent "#55702f" --hue 85  --neutral
add "Veronica.png"         veronica         purple  --name "Purple"   --petal "#6a5fb0" --accent "#4f4590" --hue 255

echo
echo "Regenerating catalog + manifest from the DB…"
node scripts/generate-catalog.mjs
node scripts/generate-manifest.mjs

if [ "${UPLOAD:-}" = "1" ]; then
  echo
  echo "Uploading to the CDN…"
  node scripts/upload-assets.mjs
  echo
  echo "✓ Done. Now commit: public/flowers/manifest.json, provenance.json, src/data/catalog.data.json"
else
  echo
  echo "✓ Registered 8 assets + regenerated catalog/manifest. Next:"
  echo "   node scripts/upload-assets.mjs        # push PNGs to the CDN (same env)"
  echo "   # …or re-run this with UPLOAD=1 to do it automatically"
  echo "   then commit: public/flowers/manifest.json, provenance.json, src/data/catalog.data.json"
fi
