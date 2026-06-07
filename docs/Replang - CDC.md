# 1. Présentation du projet

## 1.1 Contexte et problématique

Les méthodes d'apprentissage de l'anglais disponibles sur le marché (Duolingo, Babbel, Memrise) se concentrent sur la gamification et les exercices guidés. Elles ne supportent pas les techniques d'apprentissage actif basées sur la pratique orale personnelle, la prise de notes organisée et l'introspection sur ses propres lacunes.

Replang vise à combler ce manque en proposant un outil de pratique autonome, centré sur l'expression orale quotidienne et la mémorisation active.

## 1.2 Vision produit

> « Un compagnon d'apprentissage de l'anglais qui s'adapte à ma routine, m'aide à identifier mes lacunes et mémorise ce que j'apprends au fil des jours. »

## 1.3 Objectifs

•       Permettre à l'utilisateur de pratiquer l'anglais oral chaque jour via des enregistrements vocaux
•       Centraliser ses notes, vocabulaire et flashcards dans un seul outil
•       Intégrer une IA générative locale (Mistral/Ollama) pour l'assistance contextuelle
•       Proposer une expérience multi-panneaux fluide permettant de travailler plusieurs outils simultanément
•       Permettre le partage de contenus entre utilisateurs (phase 2)

## 1.4 Positionnement concurrentiel

| **App**             | **Dictaphone** | **Notes libres** | **IA locale** | **Panneaux flottants** |
| ------------------- | -------------- | ---------------- | ------------- | ---------------------- |
| Duolingo            | Non            | Non              | Non           | Non                    |
| Babbel              | Non            | Non              | Non           | Non                    |
| Notion + plugins    | Partiel        | Oui              | Non           | Non                    |
| Replang (notre app) | Oui            | Oui              | Oui           | Oui                    |

# 2. Périmètre fonctionnel

## 2.1 Tableau des fonctionnalités

| **Fonctionnalité**   | **Description courte**                           | **Phase** | **Priorité** |
| -------------------- | ------------------------------------------------ | --------- | ------------ |
| Enregistrement vocal | Dictaphone 5 min, réécoute, annotations          | MVP       | P0           |
| Système de notes     | Note rapide + bibliothèque de cahiers (TipTap)   | MVP       | P0           |
| Flashcards (SRS)     | Cartes recto/verso avec algo FSRS, génération IA | MVP       | P0           |
| Dictionnaire EN/FR   | API externe, mots + expressions                  | MVP       | P1           |
| Traducteur           | Texte EN<->FR, lecture image (v2)                | MVP       | P1           |
| Chatbot IA           | Mistral via Ollama, accès global + raccourcis    | MVP       | P1           |
| UI multi-panneaux    | Panneaux flottants, mémoire cache par panneau    | MVP       | P0           |
| Notifications push   | Rappel matin (enreg.) + soir (réécoute)          | MVP       | P2           |
| Partage social       | Système d'amis, partage notes/decks, signalement | V2        | P3           |
| App mobile           | iOS / Android — même back que le web             | V2        | P3           |

## 2.2 Fonctionnalités hors périmètre (V1)

•       Système de paiement / monétisation
•       Cours structurés (type Duolingo)
•       Reconnaissance automatique de la parole (Speech-to-Text)
•       Correction grammaticale automatique en temps réel

# 3. Spécifications fonctionnelles

## 3.1 Module Enregistrement Vocal

### Description

Le module de dictaphone suit une méthode d'apprentissage en deux temps : un enregistrement libre le matin, puis une session de révision le soir pour identifier les lacunes et re-pratiquer.

### Comportement attendu

•       L'utilisateur peut lancer un enregistrement audio jusqu'à 5 minutes maximum
•       Une barre de progression visuelle indique le temps restant
•       L'enregistrement est nommé automatiquement avec la date/heure, modifiable en titre libre
•       L'utilisateur peut réécouter avec : lecture/pause, vitesse x1/x1.5/x2, seek 10s avant/arrière
•       Un éditeur de texte s'affiche en parallèle de l'écoute pour la prise de notes simultanée, sa fait que chaque enregistrement contient son texte perso
•       Les enregistrements sont listés dans un historique trié par date

### Contraintes techniques

•       Format audio : WebM (navigateur) — transcodé en MP3 si nécessaire
•       Stockage : upload vers S3/MinIO après enregistrement, URL signée pour lecture
•       Taille estimée : ~1–2 Mo par enregistrement de 5 min
•       API utilisée : MediaRecorder API (natif navigateur) + WaveSurfer.js pour le player

## 3.2 Module Notes

### Description

Deux niveaux de prise de notes : une « Note rapide » toujours accessible en un clic, et une « Bibliothèque » de cahiers structurés pour organiser l'apprentissage sur la durée.

### Comportement attendu

•       La note rapide est accessible depuis n'importe quel écran de l'app via un bouton persistant
•       L'éditeur rich-text (gras, italique, titres, listes) basé sur TipTap
•       La bibliothèque permet de créer/renommer/supprimer des cahiers
•       Chaque cahier contient plusieurs pages, ordonnables par l'utilisateur
•       Recherche plein texte dans toutes les notes
•       Les notes sont accessibles depuis les panneaux flottants
•       sync en temps-réel

## 3.3 Dictionnaire EN/FR

### Description

Un dictionnaire bilingue anglais-français intégré à l'app, accessible en panneau flottant pendant une session de travail.

### Comportement attendu

•       Recherche instantanée d'un mot ou d'une expression
•       Affichage : définition, traduction, exemples d'usage, prononciation (audio si disponible)
•       API source : Free Dictionary API (en) + MyMemory pour les traductions FR
•       Historique des 20 derniers mots recherchés
•       Bouton « Ajouter à mes notes » pour copier un mot dans la note rapide

## 3.4 Traducteur

### Comportement attendu

•       Zone de saisie source (EN ou FR) avec détection automatique de la langue
•       Traduction affichée en temps réel ou sur déclenchement manuel
•       API : LibreTranslate (auto-hébergé, open source) ou DeepL API (free tier 500k car/mois)
•       Lecture OCR d'image (V2) : envoi d'une photo, extraction du texte, traduction

## 3.5 Module IA (Chatbot Mistral)

### Description

Un assistant IA basé sur Mistral 7B via Ollama, accessible globalement et contextuellement depuis les autres modules.

### Comportement attendu

•       Chatbot accessible depuis un panneau flottant dans toute l'app
•       Conversation multi-tours avec historique maintenu en mémoire session
•       Raccourcis contextuels depuis les autres modules :
◦       Analyser cette note (inject le contenu dans le prompt)
◦       Corriger mon enregistrement (résumé des notes + idées de correction)
◦       Générer un deck de flashcards depuis ma note
•       Réponse en streaming (affichage token par token)

### Contraintes et risques

> Point critique : Mistral 7B nécessite minimum 8 Go de RAM GPU en production. Pour la phase de développement, Ollama tourne en local sur la machine du développeur. Pour le déploiement, prévoir un VPS GPU dédié (RunPod / Vast.ai) ou basculer sur l'API Mistral cloud en fallback.

## 3.6 Flashcards

### Comportement attendu

•       Deux types de decks : pré-chargés par l'app et créés par l'utilisateur
•       Format carte : recto (mot/question), verso (traduction/réponse)
•       Animation de retournement de carte (CSS flip animation)
•       Algorithme de répétition espacée FSRS (plus performant que SM-2)
•       L'IA peut générer un deck depuis une note : extraction automatique de vocabulaire
•       Statistiques de progression par deck (cartes maîtrisées / à revoir)

## 3.7 Interface multi-panneaux

### Concept

L'interface principale est composée d'écrans primaires (dictaphone, flashcards) affichés en plein écran, et de panneaux secondaires (notes, chat IA, dictionnaire, traducteur) ouverts en superposition via une barre d'outils flottante.

### Comportement attendu

•       Barre d'outils flottante (côté droit ou bas de l'écran) avec 4 boutons : Notes, IA, Dictionnaire, Traducteur
•       Chaque panneau s'ouvre en superposition (drawer ou modal), sans quitter l'écran primaire
•       L'état de chaque panneau est mis en cache (conversation IA conservée, note draft sauvegardée)
•       Les panneaux peuvent être ouverts simultanément (ex : dictionnaire + notes en même temps)
•       Sur mobile (V2) : bottom sheet coulissante en remplacement des panneaux

# 4. Spécifications techniques

## 4.1 Architecture générale

L'application suit une architecture orientée services (approche microservices légers). Chaque domaine fonctionnel est encapsulé dans un service indépendant, communiquant via des APIs REST ou des évènements. Cette approche permet de faire évoluer chaque composant indépendamment et de préparer le passage à l'échelle.

| **Service**          | **Responsabilité**        | **Techno envisagée**  | **Notes**             |
| -------------------- | ------------------------- | --------------------- | --------------------- |
| API Gateway          | Routage, auth, rate limit | Nginx / Traefik       | Point d'entrée unique |
| Auth Service         | Inscription, login, JWT   | Node.js + Better-Auth | Gestion sessions      |
| Audio Service        | Upload, stockage, stream  | Node.js + S3/MinIO    | Fichiers audio        |
| Notes Service        | CRUD notes & cahiers      | Node.js / Python      | Rich text (JSON)      |
| Flashcard Service    | Decks, cartes, SRS FSRS   | Node.js               | Algo FSRS intégré     |
| AI Service           | Chat Mistral, prompts     | Python + Ollama       | Streaming SSE         |
| Dictionary Service   | Proxy API externe         | Node.js léger         | Cache Redis           |
| Notification Service | Cron + Web Push           | Node.js + Bull        | File de tâches        |

## 4.2 Stack technique

| **Couche**         | **Techno**                  | **Justification**                                       |
| ------------------ | --------------------------- | ------------------------------------------------------- |
| Frontend web       | Next.js 14 (App Router)     | SSR, routing, ecosystem React, futur app mobile (Expo)  |
| State management   | Zustand                     | Léger, simple, persistance optionnelle (panels cache)   |
| Editeur rich-text  | TipTap                      | Extension, open source, React natif                     |
| Player audio       | WaveSurfer.js               | Waveform, seek, vitesse, React hook disponible          |
| Backend (services) | Node.js + Fastify           | Rapide, typage TypeScript, ecosystem riche              |
| Service IA         | Python + FastAPI + Ollama   | Ollama SDK Python, streaming natif, LangChain optionnel |
| Base de données    | PostgreSQL + Prisma         | Relations, fiabilité, Prisma pour l'ORM TypeScript      |
| Cache              | Redis                       | Sessions, cache API dict., file notifications           |
| Stockage fichiers  | MinIO (dev) / AWS S3 (prod) | Compatible S3, auto-hébergeable en local                |
| Authentification   | Better-Auth (Node)          | Moderne, JWT + sessions, OAuth prêt                     |
| Conteneurisation   | Docker + Docker Compose     | Dév local reproductible, base pour Kubernetes plus tard |
| Reverse proxy      | Traefik                     | Auto-config Docker, HTTPS auto (Let's Encrypt)          |

## 4.3 Modèle de base de données (entités principales)

| **Table**    | **Champs principaux**                                                            |
| ------------ | -------------------------------------------------------------------------------- |
| users        | id, email, password_hash, created_at, settings (JSON)                            |
| recordings   | id, user_id, title, file_url, duration_s, created_at, note_content               |
| notebooks    | id, user_id, title, position, created_at                                         |
| notes        | id, user_id, notebook_id (null = note rapide), title, content (JSON), updated_at |
| decks        | id, user_id, title, is_public, created_by (IA ou user), created_at               |
| cards        | id, deck_id, front, back, created_at                                             |
| card_reviews | id, card_id, user_id, rating (1-4), next_review_at, stability, difficulty        |
| friendships  | id, requester_id, addressee_id, status, created_at                               |
| shared_items | id, from_user_id, to_user_id, item_type, item_id, created_at                     |

# 5. Sécurité

## 5.1 Authentification et autorisations

•       JWT avec durée de vie courte (15 min) + refresh token (7 jours) en cookie HttpOnly
•       Toutes les routes API protégées par middleware d'authentification
•       Principe du moindre privilège : chaque service ne peut accéder qu'à ses propres données
•       Rate limiting sur toutes les routes publiques (authentification, recherche)

## 5.2 Protection des données

•       Mots de passe hashés avec bcrypt (cost factor 12 minimum)
•       URLs d'accès aux fichiers audio : signées et expirantes (presigned URLs S3, valid 1h)
•       Chiffrement TLS en transit sur toutes les communications (HTTPS obligatoire)
•       Validation et sanitisation de toutes les entrées utilisateur (Zod côté back)
•       Protection CSRF sur les mutations (SameSite cookies + CSRF token)

## 5.3 Sécurité du partage social (V2)

•       Système de blocage : un utilisateur bloqué ne peut ni envoyer ni voir le contenu
•       Système de signalement avec file de modération (stockage en base, traitement manuel V1)
•       Permissions granulaires sur les decks partagés : lecture seule par défaut

# 6. Déploiement et infrastructure

## 6.1 Stratégie en trois phases

> Objectif : développer localement dans des conditions identiques à la production, puis déployer progressivement sans refondre l'architecture.

### Phase 1 — Développement local (maintenant)

•       Docker Compose avec tous les services (front, back, BDD, Redis, MinIO, Ollama)
•       Chaque service dans son propre conteneur, volumes persistés
•       Ollama + Mistral 7B en local pour l'IA
•       Hot reload activé sur le front (Next.js) et les services back

### Phase 2 — Déploiement personnel (quelques utilisateurs)

•       VPS classique (Hetzner CX22 ~5€/mois, 4 vCPU / 8 Go RAM)
•       Docker Compose en production (même config, variables d'environnement différentes)
•       Traefik comme reverse proxy avec HTTPS automatique (Let's Encrypt)
•       Mistral via API cloud Mistral (fallback économique) ou VPS GPU séparé si budget
•       CI/CD basique : GitHub Actions → build image → push registry → deploy SSH
•       Backups PostgreSQL automatiques (pg_dump + upload S3 quotidien)

### Phase 3 — Mise à l'échelle (si croissance)

•       Migration Docker Compose → Kubernetes (K3s pour commencer, ou service managé)
•       Horizontal scaling des services sans état (front, notes, dict)
•       PostgreSQL managé (Supabase, Neon, ou RDS)
•       CDN pour les assets statiques et les fichiers audio (CloudFront ou Cloudflare R2)
•       La migration est facilitatrice car les services sont déjà conteneurisés et indépendants

# 7. Glossaire

| **Terme**      | **Définition**                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| SRS            | Spaced Repetition System — algorithme de révision espacée optimisant la rétention mémoire             |
| FSRS           | Free Spaced Repetition Scheduler — algorithme SRS open source de nouvelle génération (2023)           |
| SSE            | Server-Sent Events — protocole HTTP pour le streaming de données serveur → client (utilisé pour l'IA) |
| JWT            | JSON Web Token — standard de jetons d'authentification sans état                                      |
| MinIO          | Serveur de stockage objet compatible S3, auto-hébergeable                                             |
| Ollama         | Outil permettant de faire tourner des LLM open source en local via Docker                             |
| TipTap         | Editeur rich-text headless basé sur ProseMirror, compatible React                                     |
| Traefik        | Reverse proxy et load balancer auto-configuré pour Docker                                             |
| Presigned URL  | URL temporaire et signée permettant l'accès sécurisé à un fichier S3 sans credentials                 |
| Panel flottant | Fenêtre secondaire superposée à l'écran principal, sans navigation vers une nouvelle page             |
