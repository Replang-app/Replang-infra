#!/usr/bin/env sh
# Publication MANUELLE des packages sur GitHub Packages (depuis ta machine).
#
# Pré-requis :
#   1. Un Personal Access Token GitHub (classic) avec le scope `write:packages`.
#   2. cp .npmrc.example .npmrc
#   3. export NPM_TOKEN=ghp_xxx   (le PAT)
#
# Astuce : pour publier une NOUVELLE version, bump d'abord le champ "version"
# dans le package.json concerné (la CI et npm refusent de réécrire une version
# déjà publiée).
set -e

if [ -z "$NPM_TOKEN" ]; then
  echo "❌ NPM_TOKEN manquant. export NPM_TOKEN=<ton_PAT_write:packages>"
  exit 1
fi
if [ ! -f .npmrc ]; then
  echo "❌ .npmrc absent. Lance : cp .npmrc.example .npmrc"
  exit 1
fi

npm ci

for NAME in @replang-app/db @replang-app/shared; do
  echo "📦 Publication de $NAME…"
  npm publish -w "$NAME" || echo "⚠️  Échec/skip pour $NAME (version déjà publiée ?)"
done

echo "✅ Terminé"
