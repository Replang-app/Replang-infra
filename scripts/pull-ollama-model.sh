#!/usr/bin/env sh
# Télécharge le modèle Mistral dans le conteneur Ollama.
# À lancer une fois après `docker compose up -d ollama`.
set -e
MODEL="${OLLAMA_MODEL:-mistral}"
echo "⬇️  Pull du modèle '$MODEL' dans Ollama…"
docker compose exec ollama ollama pull "$MODEL"
echo "✅ Modèle '$MODEL' prêt"
