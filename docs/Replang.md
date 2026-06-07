# 1. Liens des docs

- [[Replang - CDC]]
- [[Replang - Schéma BDD]]
- [[Replang - Flux et communication entre services]]

# 2. Organisation des repos

Un repo-par-service + un repo global :

```
Replang-infra/         ← repo "chef d'orchestre"
  docker-compose.yml      (assemble tous les services)
  docker-compose.prod.yml (variante prod)
  .env.example
  docs/                   (tes fichiers .md, CDC...)
  scripts/                (init BDD, seed data...)
  schema.prisma           (schéma BDD centralisé)

Replang-frontend/      ← Next.js complet
Replang-auth/          ← Node.js + Fastify
Replang-notes/         ← Node.js + Fastify
Replang-audio/         ← Node.js + Fastify
Replang-cards/         ← Node.js + Fastify
Replang-dict/          ← Node.js + Fastify (léger)
Replang-notifications/ ← Node.js + Bull
Replang-ai/            ← Python + FastAPI
```

`Replang-infra` est le seul repo qu'on clones sur le serveur de prod pour déployer. Il référence les images Docker de chaque service via le registry GitHub. Les services Node étant très similaires (Fastify + Prisma + JWT middleware).

Le schéma prisma est centralisé dans le repo infra, c'est la source de vérité. Chaque service qui a besoin du client Prisma génère son client depuis ce schéma partagé. En pratique ça veut dire que le `schema.prisma` est dans `Replang-infra/`, et chaque service Node le copie ou le référence via un package npm privé (simple à mettre en place avec npm workspaces ou un git submodule).

# 3. Roadmap de développement

| **Sprint** | **Objectifs**                                                          | **Livrable**                    |
| ---------- | ---------------------------------------------------------------------- | ------------------------------- |
| S1         | Setup projet : monorepo, Docker Compose, CI, auth basique, BDD schema  | Environnement local fonctionnel |
| S2         | UI multi-panneaux (shell Next.js), Zustand, navigation, layout de base | Interface vide mais navigable   |
| S3         | Module Notes complet (TipTap, CRUD, recherche)                         | Notes fonctionnelles            |
| S4         | Module Audio (MediaRecorder, upload, WaveSurfer player)                | Dictaphone fonctionnel          |
| S5         | Dictionnaire + Traducteur (proxy API, cache Redis, panneau flottant)   | Outils accessibles              |
| S6         | Flashcards (deck CRUD, player SRS FSRS, animation flip)                | Flashcards jouables             |
| S7         | Chatbot IA (Ollama/Mistral, streaming SSE, raccourcis contextuels)     | IA intégrée                     |
| S8         | Notifications push (cron matin/soir, Web Push API)                     | Rappels quotidiens              |
| S9         | Déploiement prod (VPS, Traefik HTTPS, GitHub Actions CI/CD)            | App en ligne                    |
| V2+        | Partage social, app mobile (Expo React Native)                         | Écosystème complet              |
