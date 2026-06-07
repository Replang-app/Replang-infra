## Sommaire

1. [Vue d'ensemble de l'architecture](#1-vue-densemble-de-larchitecture)
2. [Flux d'authentification](#2-flux-dauthentification)
3. [Flux — Enregistrement vocal](#3-flux--enregistrement-vocal)
4. [Flux — Chatbot IA (streaming)](#4-flux--chatbot-ia-streaming)
5. [Flux — Flashcards & algorithme SRS](#5-flux--flashcards--algorithme-srs)
6. [Flux — Dictionnaire & Traducteur](#6-flux--dictionnaire--traducteur)
7. [Flux — Notifications push](#7-flux--notifications-push)
8. [Flux — Partage social (V2)](#8-flux--partage-social-v2)
9. [Communication inter-services](#9-communication-inter-services)
10. [Légende des protocoles](#10-l%C3%A9gende-des-protocoles)

---

## 1. Vue d'ensemble de l'architecture

Tous les services tournent dans le même réseau Docker interne. Traefik est le seul point d'entrée exposé publiquement — il route les requêtes vers le bon service selon le path de l'URL.

```mermaid
graph TB
    subgraph Clients
        WEB[Next.js Web App]
        MOB[App Mobile V2]
    end

    subgraph Docker Network
        TRAEFIK[Traefik\nReverse proxy + HTTPS]

        subgraph Services Node.js
            AUTH[Auth Service\n:3001]
            NOTES[Notes Service\n:3002]
            AUDIO[Audio Service\n:3003]
            CARDS[Cards Service\n:3004]
            DICT[Dict/Translate Service\n:3005]
            NOTIF[Notification Service\n:3006]
        end

        subgraph Service Python
            AI[AI Service\n:8000\nFastAPI + Ollama]
        end

        subgraph Stockage
            PG[(PostgreSQL\n:5432)]
            REDIS[(Redis\n:6379)]
            MINIO[(MinIO / S3\nfichiers audio)]
            OLLAMA[Ollama\n:11434\nMistral 7B]
        end
    end

    subgraph APIs Externes
        FREEDICT[Free Dictionary API]
        LIBRETRANS[LibreTranslate]
    end

    WEB -->|HTTPS| TRAEFIK
    MOB -->|HTTPS| TRAEFIK

    TRAEFIK -->|/api/auth| AUTH
    TRAEFIK -->|/api/notes| NOTES
    TRAEFIK -->|/api/audio| AUDIO
    TRAEFIK -->|/api/cards| CARDS
    TRAEFIK -->|/api/dict| DICT
    TRAEFIK -->|/api/ai| AI

    AUTH --> PG
    AUTH --> REDIS
    NOTES --> PG
    AUDIO --> PG
    AUDIO --> MINIO
    CARDS --> PG
    CARDS --> REDIS
    DICT --> REDIS
    NOTIF --> REDIS
    NOTIF --> PG

    AI --> OLLAMA
    AI --> PG

    DICT -->|HTTP| FREEDICT
    DICT -->|HTTP| LIBRETRANS
```

---

## 2. Flux d'authentification

L'auth utilise un double token : un JWT court (15 min) pour les requêtes API, et un refresh token long (7 jours) en cookie HttpOnly pour renouveler le JWT sans redemander le mot de passe.

### 2.1 Inscription / Connexion

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend (Next.js)
    participant T as Traefik
    participant A as Auth Service
    participant DB as PostgreSQL
    participant R as Redis

    U->>F: Remplit le formulaire login
    F->>T: POST /api/auth/login
    T->>A: Route la requête

    A->>DB: SELECT user WHERE email = ?
    DB-->>A: Retourne l'utilisateur

    A->>A: Vérifie bcrypt(password)

    alt Mot de passe valide
        A->>A: Génère JWT (15 min)
        A->>A: Génère refresh token (7 jours)
        A->>R: SETEX session:{userId} refresh_token 7d
        A-->>T: 200 + JWT dans body\n+ refresh token en cookie HttpOnly
        T-->>F: Réponse
        F->>F: Stocke JWT en mémoire (Zustand)
        F-->>U: Redirige vers l'app
    else Mot de passe invalide
        A-->>F: 401 Unauthorized
        F-->>U: Affiche erreur
    end
```

### 2.2 Renouvellement du JWT (refresh)

```mermaid
sequenceDiagram
    participant F as Frontend (Next.js)
    participant T as Traefik
    participant A as Auth Service
    participant R as Redis

    Note over F: JWT expiré (15 min écoulées)
    F->>T: POST /api/auth/refresh\n(cookie HttpOnly envoyé automatiquement)
    T->>A: Route la requête

    A->>A: Lit le refresh token du cookie
    A->>R: GET session:{userId}
    R-->>A: Refresh token stocké

    alt Tokens correspondent
        A->>A: Génère nouveau JWT (15 min)
        A-->>F: 200 + nouveau JWT
        F->>F: Met à jour Zustand
    else Token invalide ou expiré
        A-->>F: 401 — session expirée
        F->>F: Redirige vers /login
    end
```

### 2.3 Middleware d'authentification sur chaque service

Chaque service Node.js applique ce middleware sur toutes ses routes protégées.

```mermaid
flowchart LR
    REQ[Requête entrante] --> MW{JWT présent\ndans header ?}
    MW -->|Non| R401[401 Unauthorized]
    MW -->|Oui| VERIFY{JWT valide\nnon expiré ?}
    VERIFY -->|Non| R401
    VERIFY -->|Oui| INJECT[Injecte userId\ndans req.user]
    INJECT --> HANDLER[Handler métier]
    HANDLER --> RES[Réponse]
```

---

## 3. Flux — Enregistrement vocal

Le flux audio est en deux temps : upload immédiat après l'enregistrement, puis lecture via URL signée.

### 3.1 Enregistrement et upload

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant A as Audio Service
    participant DB as PostgreSQL
    participant S3 as MinIO / S3

    U->>F: Clique "Démarrer l'enregistrement"
    F->>F: MediaRecorder.start()
    Note over F: Enregistrement jusqu'à 5 min max

    U->>F: Clique "Arrêter"
    F->>F: MediaRecorder.stop()\nBlob audio en mémoire

    F->>A: POST /api/audio/upload\n(multipart/form-data + JWT)
    A->>A: Valide JWT, génère filename unique
    A->>S3: PutObject(filename, blob)
    S3-->>A: OK + file key

    A->>DB: INSERT recording\n(user_id, title, file_key, duration)
    DB-->>A: recording_id

    A-->>F: 201 + { recording_id, title }
    F->>F: Affiche dans la liste des enregistrements
    F-->>U: Notification "Enregistrement sauvegardé"
```

### 3.2 Réécoute (session du soir)

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant A as Audio Service
    participant S3 as MinIO / S3

    U->>F: Clique sur un enregistrement
    F->>A: GET /api/audio/{recording_id}

    A->>A: Vérifie que recording.user_id == req.user.id
    A->>S3: GeneratePresignedUrl(file_key, expires=3600s)
    S3-->>A: URL signée temporaire

    A-->>F: 200 + { url_signée, metadata }
    F->>F: WaveSurfer.load(url_signée)
    F-->>U: Affiche le player + zone de notes

    Note over U,F: L'utilisateur réécoute, écrit ses notes
    U->>F: Sauvegarde les notes
    F->>A: PATCH /api/audio/{recording_id}\n{ note_content: "..." }
    A-->>F: 200 OK
```

---

## 4. Flux — Chatbot IA (streaming)

Le point le plus technique de l'app. La réponse de l'IA arrive token par token via SSE (Server-Sent Events), ce qui donne l'effet "frappe en direct".

### 4.1 Message simple

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant AI as AI Service (FastAPI)
    participant OL as Ollama
    participant LLM as Mistral 7B

    U->>F: Envoie un message dans le chat
    F->>F: Ajoute le message à l'historique (Zustand)

    F->>AI: POST /api/ai/chat\n{ messages: [...historique], message: "..." }
    Note over F,AI: Connexion SSE ouverte (EventSource)

    AI->>AI: Construit le prompt avec\nle system prompt + historique
    AI->>OL: POST /api/chat (stream=true)
    OL->>LLM: Inférence Mistral

    loop Chaque token généré
        LLM-->>OL: Token
        OL-->>AI: Token
        AI-->>F: SSE: data: {"token": "Bon..."}
        F->>F: Affiche le token (effet frappe)
    end

    AI-->>F: SSE: data: [DONE]
    F->>F: Finalise le message dans Zustand
    F-->>U: Réponse complète affichée
```

### 4.2 Raccourci contextuel — "Analyser cette note"

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant N as Notes Service
    participant AI as AI Service

    U->>F: Clique "Analyser avec l'IA"\nsur une note ouverte

    F->>F: Récupère le contenu de la note\ndepuis Zustand (déjà chargé)

    F->>AI: POST /api/ai/chat\n{ context_type: "note",\n  context: "contenu de la note",\n  message: "Analyse mon vocabulaire" }

    AI->>AI: Injecte le contenu dans\nle system prompt :
    Note over AI: "Tu es un coach anglais.\nVoici les notes de l'utilisateur :\n[contenu]. Analyse le vocabulaire..."

    AI-->>F: SSE stream de la réponse
    F-->>U: Analyse affichée dans le panneau chat
```

### 4.3 Génération d'un deck de flashcards par l'IA

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant AI as AI Service
    participant C as Cards Service
    participant DB as PostgreSQL

    U->>F: Clique "Générer un deck depuis ma note"
    F->>AI: POST /api/ai/generate-deck\n{ note_content: "..." }

    AI->>AI: Prompt structuré demandant\nun JSON de cartes
    AI->>AI: Appelle Ollama en mode\nnon-streaming (JSON forcé)

    AI->>AI: Parse la réponse JSON\n[{ front, back }, ...]

    AI->>C: POST /api/cards/decks\n(appel interne service-to-service)\n{ title, cards[], generated_by: "ai" }
    C->>DB: INSERT deck + cards
    DB-->>C: deck_id

    AI-->>F: 201 + { deck_id, card_count }
    F-->>U: "Deck de 12 cartes créé !"
```

---

## 5. Flux — Flashcards & algorithme SRS

L'algorithme FSRS calcule la prochaine date de révision en fonction de la note donnée (1 à 4) et de l'historique de la carte.

### 5.1 Session de révision

```mermaid
sequenceDiagram
    actor U as Utilisateur
    participant F as Frontend
    participant C as Cards Service
    participant DB as PostgreSQL

    U->>F: Ouvre une session de révision
    F->>C: GET /api/cards/due?deck_id={id}

    C->>DB: SELECT cards WHERE\nnext_review_at <= NOW()\nORDER BY next_review_at ASC
    DB-->>C: Liste des cartes à revoir

    C-->>F: 200 + [cartes dues]
    F-->>U: Affiche la première carte (recto)

    loop Pour chaque carte
        U->>F: Retourne la carte (voit le verso)
        U->>F: Note sa performance : 1-Raté / 2-Difficile / 3-Bien / 4-Facile

        F->>C: POST /api/cards/{card_id}/review\n{ rating: 3 }

        C->>DB: SELECT dernière review de cette carte
        DB-->>C: stability, difficulty actuels

        C->>C: Calcule FSRS :\n- Nouveau stability\n- Nouveau difficulty\n- next_review_at

        C->>DB: INSERT card_review\nUPDATE next_review_at

        C-->>F: 200 + { next_review_at, message }
        F-->>U: Carte suivante
    end

    F-->>U: "Session terminée — X cartes révisées"
```

---

## 6. Flux — Dictionnaire & Traducteur

Ces services sont de simples proxies vers des APIs externes, avec un cache Redis pour éviter les requêtes redondantes.

```mermaid
sequenceDiagram
    participant F as Frontend
    participant D as Dict/Translate Service
    participant R as Redis
    participant EXT as API Externe\n(Free Dictionary / LibreTranslate)

    F->>D: GET /api/dict/search?word=ephemeral

    D->>R: GET cache:dict:ephemeral
    R-->>D: Cache hit ou miss

    alt Cache HIT (mot déjà cherché récemment)
        D-->>F: 200 + résultat depuis Redis
    else Cache MISS
        D->>EXT: GET https://api.dictionaryapi.dev/\napi/v2/entries/en/ephemeral
        EXT-->>D: Définitions, exemples, audio

        D->>R: SETEX cache:dict:ephemeral 86400s résultat
        D-->>F: 200 + résultat enrichi
    end

    Note over F: Même logique pour le traducteur\n(cache:translate:{lang}:{text})
```

---

## 7. Flux — Notifications push

Un cron job tourne chaque jour dans le service de notifications et envoie deux rappels : le matin pour enregistrer, le soir pour réécouter.

```mermaid
flowchart TB
    subgraph Notification Service
        CRON[Cron Job\n07h00 et 20h00]
        WORKER[Bull Worker]
        PUSH[Web Push API]
    end

    subgraph Redis
        QUEUE[Bull Queue\nnotification-jobs]
    end

    subgraph PostgreSQL
        USERS[users\n+ push_subscriptions]
    end

    CRON -->|Toutes les nuits à 07h00| JOB1[Enfile job\ntype: morning_reminder]
    CRON -->|Toutes les nuits à 20h00| JOB2[Enfile job\ntype: evening_reminder]

    JOB1 --> QUEUE
    JOB2 --> QUEUE

    QUEUE --> WORKER
    WORKER -->|Lit les abonnements actifs| USERS
    USERS --> WORKER
    WORKER -->|Envoie notif push| PUSH
    PUSH -->|HTTPS| BROWSER[Navigateur\nde l'utilisateur]
```

---

## 8. Flux — Partage social (V2)

Le partage se fait en mode "push" : l'expéditeur envoie un item, le destinataire le reçoit dans une boîte de réception.

```mermaid
sequenceDiagram
    actor A as Utilisateur A
    actor B as Utilisateur B
    participant F as Frontend
    participant S as Social/Sharing Service
    participant DB as PostgreSQL
    participant N as Notification Service

    Note over A,B: A et B sont amis (friendship.status = accepted)

    A->>F: Clique "Partager ce deck" avec B
    F->>S: POST /api/social/share\n{ to_user_id: B, item_type: "deck", item_id: "..." }

    S->>DB: Vérifie friendship(A, B) == accepted
    S->>DB: Vérifie que B n'a pas bloqué A
    DB-->>S: OK

    S->>DB: INSERT shared_items\n{ from: A, to: B, type: "deck", item_id }
    S->>N: Enfile notification\n"A a partagé un deck avec toi"
    N-->>B: Push notification

    B->>F: Ouvre sa boîte de réception
    F->>S: GET /api/social/inbox
    S->>DB: SELECT shared_items WHERE to_user_id = B
    DB-->>S: Items reçus + métadonnées

    S-->>F: 200 + [items avec auteur, date]
    F-->>B: Affiche les items reçus

    B->>F: Clique "Ajouter ce deck à ma bibliothèque"
    F->>S: POST /api/social/accept/{shared_item_id}
    S->>DB: Copie le deck dans la bibliothèque de B\n(nouvelles lignes deck + cards avec user_id = B)
    S-->>F: 200 + { new_deck_id }
```

---

## 9. Communication inter-services

### 9.1 Règles de communication

```mermaid
graph LR
    subgraph Appels synchrones REST
        F[Frontend] -->|HTTP/HTTPS| T[Traefik]
        T --> S1[Service Node.js]
        S1 -->|HTTP interne| S2[Autre service]
    end

    subgraph Appels asynchrones
        S3[Service] -->|Bull job| Q[(Redis Queue)]
        Q --> W[Worker]
    end

    subgraph Streaming
        F2[Frontend] -->|SSE EventSource| AI[AI Service]
    end
```

### 9.2 Matrice de communication complète

| Service émetteur | Service destinataire | Protocole         | Cas d'usage                          |
| ---------------- | -------------------- | ----------------- | ------------------------------------ |
| Frontend         | Tous les services    | HTTPS via Traefik | Toutes les requêtes utilisateur      |
| Auth Service     | PostgreSQL           | TCP (Prisma)      | Lecture/écriture utilisateurs        |
| Auth Service     | Redis                | TCP               | Stockage sessions & refresh tokens   |
| Notes Service    | PostgreSQL           | TCP (Prisma)      | CRUD notes et cahiers                |
| Audio Service    | PostgreSQL           | TCP (Prisma)      | Métadonnées enregistrements          |
| Audio Service    | MinIO/S3             | HTTP (AWS SDK)    | Upload et presigned URLs             |
| Cards Service    | PostgreSQL           | TCP (Prisma)      | Decks, cartes, reviews FSRS          |
| Cards Service    | Redis                | TCP               | Cache decks fréquents                |
| Dict Service     | Redis                | TCP               | Cache résultats dictionnaire         |
| Dict Service     | Free Dictionary API  | HTTPS externe     | Recherche de mots                    |
| Dict Service     | LibreTranslate       | HTTPS externe     | Traductions                          |
| AI Service       | Ollama               | HTTP local        | Inférence Mistral (streaming)        |
| AI Service       | Cards Service        | HTTP interne      | Création de decks générés par IA     |
| AI Service       | PostgreSQL           | TCP               | Historique conversations (optionnel) |
| Notif Service    | Redis/Bull           | TCP               | File d'attente des notifications     |
| Notif Service    | PostgreSQL           | TCP (Prisma)      | Récupération abonnements push        |

### 9.3 Gestion des erreurs inter-services

```mermaid
flowchart TD
    REQ[Service A appelle Service B] --> TRY{Service B répond ?}
    TRY -->|Oui, 2xx| OK[Traite la réponse]
    TRY -->|Non, timeout\nou 5xx| RETRY{Retry possible ?}
    RETRY -->|Oui, max 3 fois\navec backoff exponentiel| REQ
    RETRY -->|Non, max atteint| FALLBACK{Fallback disponible ?}
    FALLBACK -->|Oui ex: cache Redis| CACHE[Retourne données en cache]
    FALLBACK -->|Non| ERROR[Retourne erreur propre\n503 Service Unavailable]
    ERROR --> LOG[Log l'erreur\n+ alerte si critique]
```

---

## 10. Légende des protocoles

| Protocole          | Usage dans Replang                    | Sens                    |
| ------------------ | ------------------------------------- | ----------------------- |
| **HTTPS**          | Toutes les requêtes clients → Traefik | Client → Serveur        |
| **HTTP interne**   | Communication entre services Docker   | Service → Service       |
| **TCP (Prisma)**   | Services → PostgreSQL                 | Service → BDD           |
| **TCP (ioredis)**  | Services → Redis                      | Service → Cache         |
| **HTTP (AWS SDK)** | Audio Service → MinIO/S3              | Service → Stockage      |
| **SSE**            | Frontend → AI Service (streaming IA)  | Serveur → Client (push) |
| **Web Push**       | Notification Service → Navigateur     | Serveur → Client (push) |
| **HTTP local**     | AI Service → Ollama                   | Interne conteneur IA    |

---

> **Note :** Tous les appels HTTP internes (service-to-service) se font sur le réseau Docker privé, sans passer par Traefik. Ils ne sont jamais exposés à l'extérieur. Seul Traefik est accessible depuis internet (ports 80 et 443).
