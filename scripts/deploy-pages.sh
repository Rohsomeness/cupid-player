#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (GitHub Pages).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export VITE_BASE="${VITE_BASE:-/cupid-player/}"
# Optional: export VITE_SPOTIFY_CLIENT_ID=... before running for a permanent client id in the build

npm run build
cp dist/index.html dist/404.html

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
cd "$TMP"
git init -q
git checkout -b gh-pages
git add -A
git -c user.email="deploy@localhost" -c user.name="cupid-deploy" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git remote add origin "https://github.com/Rohsomeness/cupid-player.git"
git push -u origin gh-pages --force
echo "Deployed → https://rohsomeness.github.io/cupid-player/"
