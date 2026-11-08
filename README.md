# Kasa Trading

Application commerciale responsive : clients, catalogue, commandes, administration et authentification. Les données sont stockées dans PostgreSQL (local ou hébergé sur Supabase) via Drizzle. Les commandes conservent un instantané du nom et du prix des articles ; leurs totaux sont recalculés sur le serveur.

## Accès et connexion

Par défaut, **aucune connexion n’est demandée** : l’application s’ouvre directement sur le tableau de bord avec tous les droits (`KASA_AUTH_REQUIRED` absent ou `false`). C’est le mode adapté aux prévisualisations intégrées, qui bloquent souvent les cookies de session.

Pour exiger une connexion (recommandé pour une mise en production accessible publiquement), définir `KASA_AUTH_REQUIRED=true`. Au premier démarrage sur une base sans utilisateur, un compte administrateur est créé :

- E-mail : `admin@kasatrading.ma`
- Mot de passe : `Kasa@2024`

Ces identifiants sont affichés sur la page de connexion **tant que le mot de passe initial n’a pas été modifié**. Modifiez-le dès la première connexion via *Administration → Mon compte*. L’administrateur peut ensuite créer des comptes « Commercial » ou « Administrateur » dans *Administration → Utilisateurs* (onglets visibles uniquement lorsque la connexion est activée).

Sécurité (mode connexion) : mots de passe hachés (scrypt), sessions stockées en base (30 jours) via un cookie `httpOnly` complété par un jeton conservé dans le navigateur (fonctionne même si les cookies tiers sont bloqués), vérification de l’origine des requêtes, limitation des tentatives de connexion, déconnexion des autres appareils après changement de mot de passe.

## Devise

Tous les prix et montants sont exprimés en **euros (€)**, au format français (ex. `1 234,56 €`). La devise est définie à un seul endroit (`CURRENCY` dans `src/components/shared.tsx`).

## Conditionnement : cartons et sachets

Chaque produit a un **prix catalogue par sachet** et un **nombre de sachets par carton** (prix du carton = prix sachet × sachets par carton, calculé automatiquement). Lors d’une commande, le commercial saisit pour chaque produit le nombre de cartons, les sachets en plus et, si besoin, un **prix négocié par sachet** valable uniquement pour cette ligne :

- Total sachets = cartons × sachets par carton + sachets en plus
- Total ligne = total sachets × prix négocié

Chaque ligne de commande enregistre un instantané (sachets par carton, prix catalogue, prix négocié, totaux) : modifier ensuite le catalogue ne change jamais les commandes passées. Les montants sont calculés en centimes entiers côté serveur.

## Développement local

```sh
npx drizzle-kit push
npm run dev
```

Au premier accès à une base vide, un catalogue de démonstration (catégories et produits) est créé une seule fois. Aucun client ni commande n’est créé automatiquement. Pour démarrer sans produits de démonstration, définir `KASA_SEED_DEMO=false` **avant** le premier accès. Les produits de démonstration peuvent être modifiés ou supprimés depuis le Catalogue ou l’Administration.

## Base de données Neon

L’application est connectée au projet Neon `restless-dew-09256450` (branche `production`, base `neondb`) ; le lien est dans `.neon` et les services dans `neon.ts`.

- Variables (fichier `.env`, **jamais** préfixées `NEXT_PUBLIC_`, lues uniquement côté serveur dans `src/db/index.ts`) : `DATABASE_URL` = endpoint **poolé** (`-pooler`) utilisé par l’application ; `DATABASE_URL_UNPOOLED` = endpoint **direct** (même URL sans `-pooler`) utilisé par `drizzle-kit`. `neon env pull` peut les rafraîchir une fois le CLI authentifié (`neon login` ou `NEON_API_KEY`).
- Pilote : sur un hôte Neon, `@neondatabase/serverless` (requêtes simples en HTTP, transactions en WebSocket) ; sur un Postgres classique, `node-postgres`. Choix automatique, Drizzle reste l’unique couche d’accès. `GET /api/health` indique le fournisseur, le pilote, l’endpoint poolé ou non et la latence (sans secret).
- **Branche partagée** : une autre application (`application_name = kasa-trading`) utilise la même branche. Le schéma Drizzle de ce projet reflète exactement les tables partagées ; seules trois colonnes additives avec valeur par défaut ont été ajoutées (`products.unit`, `order_items.unit`, `users.must_change_password`), voir `drizzle/0002_shared_schema_alignment.sql`. `npx drizzle-kit push` doit répondre « No changes detected » : ne jamais utiliser `--force` sur cette branche sans vérifier les instructions générées (`--strict --verbose`).
- Nouvelle base vide : `npx drizzle-kit push` (URL directe) puis démarrer l’application ; le catalogue de démonstration est créé au premier accès si la base est vide.

## Déploiement

0. Installation créée **avant** le conditionnement carton/sachet : exécuter une fois `drizzle/0001_cartons_sachets.sql` sur la base (`psql "$DATABASE_URL" -f drizzle/0001_cartons_sachets.sql`) avant `drizzle-kit push`. Le script est idempotent et conserve les données (les anciennes lignes de commande gardent leur total ; leur quantité est convertie en sachets).
1. Configurer `DATABASE_URL` avec la chaîne de connexion PostgreSQL (par exemple celle d’un projet Supabase ; utiliser le pooler adapté à votre hébergeur si nécessaire).
2. Exécuter `npx drizzle-kit push` sur la base cible avant de démarrer l’application.
3. Déployer, se connecter avec le compte administrateur initial et changer immédiatement son mot de passe.

Les variables serveur doivent être configurées dans l’hébergeur et non placées dans le code source. L’application doit être servie en HTTPS : hors `localhost`/réseau local, le cookie de session est marqué `Secure` et `SameSite=None` automatiquement (forçable avec `KASA_COOKIE_SECURE=true|false`).
