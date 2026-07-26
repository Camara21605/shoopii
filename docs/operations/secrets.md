# Gestion des secrets

## Principes fondamentaux

1. **Les secrets ne sont jamais dans le code source** (ni dans Git)
2. **Chaque environnement a ses propres secrets**
3. **Rotation planifiée** — voir [runbooks/key-rotation.md](./runbooks/key-rotation.md)
4. **Accès minimal** — chaque composant n'accède qu'aux secrets dont il a besoin
5. **Auditabilité** — toute modification de secret est tracée

---

## Inventaire des secrets

### Authentification
| Secret | Usage | Rotation |
|---|---|---|
| `JWT_SECRET` | Signature access token | Trimestrielle |
| `JWT_REFRESH_SECRET` | Signature refresh token | Trimestrielle |

> Ces deux clés doivent être **différentes**. Changer l'une invalide les tokens correspondants.

### Base de données
| Secret | Usage | Rotation |
|---|---|---|
| `DATABASE_URL` | Connexion PostgreSQL complète | Annuelle ou si compromis |

### Cache / Queue
| Secret | Usage | Rotation |
|---|---|---|
| `REDIS_URL` | Connexion Redis avec authentification | Annuelle |

### Email
| Secret | Usage | Rotation |
|---|---|---|
| `SMTP_PASS` | Authentification SMTP | Annuelle |

### Stockage
| Secret | Usage | Rotation |
|---|---|---|
| `CLOUDINARY_API_KEY` | Upload fichiers | Annuelle |
| `CLOUDINARY_API_SECRET` | Signature requêtes Cloudinary | Annuelle |

### Providers de paiement
| Secret | Usage | Rotation |
|---|---|---|
| `ORANGE_MONEY_API_SECRET` | Auth Orange Money | Selon provider |
| `ORANGE_MONEY_WEBHOOK_SECRET` | Validation webhooks | Annuelle |
| `MTN_API_SECRET` | Auth MTN | Selon provider |
| `MTN_WEBHOOK_SECRET` | Validation webhooks | Annuelle |
| `WAVE_WEBHOOK_SECRET` | Validation webhooks | Annuelle |
| `DJOMY_API_SECRET` | Auth Djomy | Selon provider |
| `DJOMY_WEBHOOK_SECRET` | Validation webhooks | Annuelle |

### Super Admin
| Secret | Usage |
|---|---|
| `SUPER_ADMIN_EMAIL` | Email du super administrateur |
| `SUPER_ADMIN_PASSWORD` | Mot de passe initial (à changer immédiatement après déploiement) |

---

## Stockage des secrets par environnement

### Développement local
- Fichier `.env` à la racine de `shopi-backend/`
- **Jamais commité** — `.env` dans `.gitignore`
- Copier `.env.example` (sans valeurs) comme référence

```bash
# Générer des secrets sécurisés en local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Ou
openssl rand -base64 32
```

### CI — GitHub Actions
- **GitHub Secrets** : Settings → Secrets and variables → Actions
- Préfixer par environnement : `JWT_SECRET_PROD`, `JWT_SECRET_TEST`
- Accès via `${{ secrets.NOM_DU_SECRET }}` dans les workflows

### Production — Render
- **Render Dashboard** → Environment Variables
- Variables marquées `sync: false` dans `render.yaml` → à renseigner manuellement
- Ne jamais mettre de secret en clair dans `render.yaml`

---

## .env.example (template à maintenir à jour)

```env
# ── Application ──────────────────────────────────────────
NODE_ENV=development
PORT=3000
APP_VERSION=dev
CORS_ORIGIN=http://localhost:5173

# ── Base de données ───────────────────────────────────────
DATABASE_URL=postgres://USER:PASS@HOST:5432/DBNAME
DB_SSL=false

# ── JWT ───────────────────────────────────────────────────
JWT_SECRET=GENERATE_WITH_openssl_rand_base64_32
JWT_REFRESH_SECRET=GENERATE_WITH_openssl_rand_base64_32_DIFFERENT
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ── Redis ─────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── Email ─────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=YOUR_SMTP_PASSWORD
SMTP_FROM=Shopi <noreply@shopi.com>

# ── Cloudinary ────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ── Super Admin (initial, changer après premier déploiement) ──
SUPER_ADMIN_EMAIL=admin@shopi.com
SUPER_ADMIN_PASSWORD=CHANGE_ME_IMMEDIATELY

# ── Providers de paiement ─────────────────────────────────
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

## Règles de sécurité

- `JWT_SECRET` ≠ `JWT_REFRESH_SECRET` — obligatoire
- Longueur minimale : 32 caractères pour les clés JWT
- Longueur recommandée : 64 caractères (base64)
- Ne jamais logger une variable d'environnement
- Ne jamais retourner un secret dans une réponse API
- Vérifier `.gitignore` avant chaque commit : `.env`, `.env.*`
