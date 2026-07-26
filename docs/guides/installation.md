# Installation du projet

## Prérequis

| Outil | Version minimale |
|---|---|
| Node.js | 20.x LTS |
| npm | 10.x |
| PostgreSQL | 15.x |
| Redis | 7.x |
| Git | 2.x |

---

## 1. Cloner le dépôt

```bash
git clone <url-du-repo> shoopii
cd shoopii
```

---

## 2. Backend

```bash
cd shopi-backend

# Installer les dépendances
npm ci

# Copier le fichier d'environnement
cp .env.example .env
# → Éditer .env (voir guides/environment.md)

# Créer la base de données
createdb shopi_dev   # ou via psql / pgAdmin

# Exécuter les migrations
npm run migration:run

# Démarrer en mode développement
npm run start:dev
```

Le serveur écoute sur `http://localhost:3000`.

---

## 3. Frontend

```bash
cd shopi-frontend

# Installer les dépendances
npm ci

# Copier le fichier d'environnement
cp .env.example .env
# → VITE_API_URL=http://localhost:3000

# Démarrer Vite
npm run dev
```

Le frontend écoute sur `http://localhost:5173`.

---

## 4. Redis

```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis

# Windows (via WSL ou Docker)
docker run -d -p 6379:6379 redis:7-alpine
```

---

## 5. Vérifier l'installation

```bash
# Backend health check
curl http://localhost:3000/health
# → { "status": "ok" }

# Swagger (développement)
# http://localhost:3000/api/docs
```

---

## Commandes utiles (backend)

```bash
npm run start:dev         # Développement (watch mode)
npm run build             # Build TypeScript
npm run start:prod        # Production
npm run migration:generate -- --name=<NomMigration>
npm run migration:run
npm run migration:revert
npm run test              # Tests unitaires
npm run test:e2e          # Tests E2E
npm run lint
```
