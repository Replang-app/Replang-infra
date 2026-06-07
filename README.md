# Replang — Infra

Repo **chef d'orchestre** de Replang. C'est le seul repo cloné sur le serveur de prod pour déployer, et la **source de vérité** du schéma de base de données.

## Contenu

```
Replang-infra/
├── docker-compose.yml        # Stack de dev (postgres, redis, minio, ollama + services)
├── docker-compose.prod.yml   # Variante prod (images registry + Traefik)
├── .env.example              # Toutes les variables d'environnement
├── docs/                     # CDC, schéma BDD, flux inter-services
├── scripts/                  # init BDD, seed
└── packages/
    ├── db/                   # @replang-app/db  — schema.prisma + client Prisma partagé
    └── shared/               # @replang-app/shared — middleware auth, config, erreurs
```

## Architecture (poly-repo)

Un repo par service + ce repo infra. Le code commun est publié sur **GitHub Packages** (registre npm privé) sous le scope `@replang` :

- `@replang-app/db` — schéma Prisma centralisé + client généré. Chaque service Node l'installe.
- `@replang-app/shared` — middleware d'authentification (Better-Auth), validation Zod, helpers.

Quand le schéma change : on bumpe la version de `@replang-app/db`, on republie, et les services suivent.

| Service | Repo | Port | Stack |
|---|---|---|---|
| Frontend | `Replang-frontend` | 3000 | Next.js 14 |
| Auth | `Replang-auth` | 3001 | Fastify + Better-Auth |
| Notes | `Replang-notes` | 3002 | Fastify + Prisma |
| Audio | `Replang-audio` | 3003 | Fastify + S3/MinIO |
| Cards | `Replang-cards` | 3004 | Fastify + FSRS |
| Dict/Translate | `Replang-dict` | 3005 | Fastify + cache Redis |
| Notifications | `Replang-notifications` | 3006 | Node + Bull |
| AI | `Replang-ai` | 8000 | Python + FastAPI + Ollama |

## Démarrage rapide (dev)

```bash
# 1. Variables d'environnement
cp .env.example .env        # puis adapter les secrets

# 2. Installer + générer le client Prisma
npm install
npm run db:generate

# 3. Lancer l'infra de base (BDD, cache, stockage, IA)
docker compose up -d postgres redis minio ollama

# 4. Appliquer le schéma
npm run db:migrate

# (les services applicatifs s'activent au fur et à mesure de leur dev)
```

## Publication des packages (`@replang-app/db`, `@replang-app/shared`)

Les packages sont publiés sur **GitHub Packages** (registre npm privé de l'orga
`Replang-app`). Le scope **doit** être `@replang-app` (= nom de l'orga).

### Automatique (CI — recommandé)

Le workflow `.github/workflows/publish-packages.yml` publie à chaque push sur
`main` touchant `packages/**`. Il ne publie qu'un package dont la **version a
changé** : pour livrer une nouvelle version, bump le champ `version` du
`package.json` concerné, commit, push.

> Utilise le `GITHUB_TOKEN` intégré (permission `packages: write`) — aucun
> secret à configurer.

### Manuelle (premier coup / dépannage)

```bash
# 1. Créer un PAT GitHub (classic) avec le scope write:packages
cp .npmrc.example .npmrc
export NPM_TOKEN=ghp_xxx        # le PAT
# 2. Publier
sh scripts/publish-packages.sh
```

### Installer les packages dans un service

Le service a besoin d'un `.npmrc` (token avec `read:packages`) :

```bash
cp .npmrc.example .npmrc        # dans le repo du service
export NPM_TOKEN=ghp_xxx
npm install
```

> En dev local, les services peuvent aussi référencer les packages en `file:`
> vers `../Replang-infra/packages/*` (cas actuel de `Replang-auth`), ce qui
> évite d'avoir à publier pendant le développement.

## Documentation

- [Cahier des charges](docs/Replang%20-%20CDC.md)
- [Schéma BDD](docs/Replang%20-%20Sch%C3%A9ma%20BDD.md)
- [Flux et communication entre services](docs/Replang%20-%20Flux%20et%20communication%20entre%20services.md)
