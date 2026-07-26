# APIs REST — Vue d'ensemble

Toutes les APIs sont préfixées `/api` et documentées via Swagger à `/api/docs` (en développement).

---

## Authentification

Toutes les routes protégées requièrent :
```
Authorization: Bearer <accessToken>
```

Les tokens d'accès expirent en **15 minutes**. Le refresh token (7 jours) permet d'en obtenir un nouveau.

---

## Modules d'API

### Auth (`/auth`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Inscription |
| POST | `/auth/login` | Public | Connexion → `{ accessToken, refreshToken }` |
| POST | `/auth/refresh` | Public (avec refreshToken) | Renouvellement du token |
| POST | `/auth/logout` | Authentifié | Révocation du refresh token |
| POST | `/auth/request-code` | Public | Envoi code de vérification |
| POST | `/auth/verify-code` | Public | Vérification du code |

### Wallet (`/wallet`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/wallet` | Authentifié | Mon wallet (solde, statut) |
| GET | `/wallet/history` | Authentifié | Historique paginé des transactions |
| POST | `/wallet/deposit` | ADMIN, SUPER_ADMIN | Dépôt manuel |
| POST | `/wallet/withdraw` | Authentifié | Initier un retrait |
| GET | `/wallet/:id` | ADMIN, SUPER_ADMIN | Wallet d'un utilisateur |

### Commandes (`/commandes`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/commandes` | CLIENT | Créer une commande |
| GET | `/commandes` | Authentifié | Mes commandes (filtrées par rôle) |
| GET | `/commandes/:id` | Propriétaire ou ADMIN | Détail d'une commande |
| PATCH | `/commandes/:id/valider` | CLIENT | Valider la réception |
| PATCH | `/commandes/:id/annuler` | CLIENT, COMPANY | Annuler |
| POST | `/commandes/:id/litige` | CLIENT | Ouvrir un litige |

### Paiement (`/paiement`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/paiement/initier` | CLIENT | Initier un paiement |
| POST | `/paiement/webhook/:provider` | Public (signature vérifiée) | Webhook provider |
| GET | `/paiement/:sessionId` | Authentifié | Statut d'une session |

### Dashboard (`/dashboard`)

Routes dynamiques par rôle — chaque rôle n'accède qu'à son dashboard :

| Rôle | Préfixe |
|---|---|
| Client | `/dashboard/client/*` |
| Entreprise | `/dashboard/entreprise/*` |
| Livreur | `/dashboard/delivery/*` |
| Partenaire | `/dashboard/partner/*` |
| Admin | `/dashboard/admin/*` |
| Super Admin | `/dashboard/super-admin/*` |

### Notifications (`/notifications`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/notifications` | Liste mes notifications |
| PATCH | `/notifications/:id/read` | Marquer comme lu |
| GET | `/notifications/stream` | SSE (Server-Sent Events) |
| GET | `/notifications/preferences` | Mes préférences |
| PATCH | `/notifications/preferences` | Mettre à jour les préférences |

### Support (`/support`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/support/client` | Authentifié | Créer un ticket |
| GET | `/support/client/mes-tickets` | Authentifié | Mes tickets |
| GET | `/support/agent/tickets` | ADMIN, SUPER_ADMIN | File d'attente agent |
| PATCH | `/support/agent/:id/clore` | ADMIN, SUPER_ADMIN | Clore un ticket |

### Help Center (`/help`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/help/articles` | Public | Liste des articles |
| GET | `/help/articles/:slug` | Public | Article par slug |
| GET | `/help/categories` | Public | Catégories |
| GET | `/help/search?q=` | Public | Recherche full-text |
| GET | `/help/faq` | Public | FAQ |

### Performance (`/performance`)

| Méthode | Route | Accès | Description |
|---|---|---|---|
| GET | `/performance/report` | ADMIN, SUPER_ADMIN | Rapport de performance |

---

## Format des erreurs

Toutes les erreurs retournent :

```json
{
  "statusCode": 400,
  "message": "Description lisible de l'erreur",
  "error": "Bad Request"
}
```

> Aucune stack trace n'est exposée au client. Les erreurs internes sont loggées côté serveur.

---

## Rate limiting

- **60 requêtes / minute / IP** (global, via ThrottlerModule)
- Headers de réponse : `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- Dépassement → `429 Too Many Requests`

---

## Swagger

En développement (`NODE_ENV=development`), accéder à :
```
http://localhost:3000/api/docs
```

Configurer via `SwaggerModule.setup('api/docs', app, document)` dans `main.ts`.
