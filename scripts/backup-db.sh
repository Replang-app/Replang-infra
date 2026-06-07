#!/usr/bin/env sh
# Sauvegarde PostgreSQL (pg_dump) — à planifier en cron quotidien en prod.
# Usage : ./scripts/backup-db.sh [dossier_sortie]
set -e

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$OUT_DIR/replang_${STAMP}.sql.gz"

# Charge les variables (.env) si présent.
[ -f .env ] && . ./.env

echo "💾 Dump de la base '${POSTGRES_DB:-replang}' → $FILE"
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-replang}" "${POSTGRES_DB:-replang}" \
  | gzip > "$FILE"

echo "✅ Backup créé : $FILE"
# TODO prod : uploader $FILE vers S3 puis purger les dumps > 7 jours.
