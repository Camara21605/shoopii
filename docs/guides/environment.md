# Variables d'environnement

Toutes les variables sensibles doivent rester dans `.env` et ne **jamais** être commitées.

---

## Backend (`shopi-backend/.env`)

### Base de données

```env
DATABASE_URL=postgres://user:password@localhost:5432/shopi_dev
```

### JWT

```env
JWT_SECRET=<chaîne-aléatoire-min-32-chars>
JWT_REFRESH_SECRET=<chaîne-aléatoire-différente-min-32-chars>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

> **Règle** : JWT_SECRET ≠ JWT_REFRESH_SECRET. Générer avec `openssl rand -base64 32`.

### Redis

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # Vide en local, requis en production
REDIS_URL=redis://localhost:6379   # Ou redis://:password@host:port
```

### Email

```env
MAIL_TRANSPORT=smtp://user:pass@smtp.example.com:587
MAIL_FROM="Shopi <noreply@shopi.com>"
```

En développement, utiliser Mailtrap ou la valeur `stub` (désactive l'envoi réel).

### Cloudinary (upload fichiers)

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Application

```env
NODE_ENV=development           # development | production | test
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### Providers de paiement

```env
ORANGE_MONEY_API_KEY=
ORANGE_MONEY_API_SECRET=
ORANGE_MONEY_WEBHOOK_SECRET=

MTN_API_KEY=
MTN_API_SECRET=
MTN_WEBHOOK_SECRET=

WAVE_API_KEY=
WAVE_WEBHOOK_SECRET=

DJOMY_API_KEY=
DJOMY_WEBHOOK_SECRET=
```

---

## Frontend (`shopi-frontend/.env`)

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=Shopi
```

---

## Environnement de test

```env
# shopi-backend/.env.test
NODE_ENV=test
DATABASE_URL=postgres://user:password@localhost:5432/shopi_test
JWT_SECRET=shopi-test-jwt-secret-32chars-min
JWT_REFRESH_SECRET=shopi-test-refresh-secret-32chars
REDIS_HOST=localhost
REDIS_PORT=6379
MAIL_TRANSPORT=stub
```

---

## Rotation des secrets

En production :
1. Générer un nouveau secret avec `openssl rand -base64 64`
2. Mettre à jour la variable d'environnement sur le serveur
3. Redémarrer l'application (les tokens existants seront invalidés si JWT_SECRET change)
4. Documenter la rotation dans le journal de maintenance
