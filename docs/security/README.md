# Sécurité — Shopi

## Principes fondamentaux

1. **OWASP Top 10** respecté sur chaque endpoint
2. **Pas de stack trace** exposée au client
3. **Clés sensibles** uniquement dans les variables d'environnement
4. **Validation stricte** via `ValidationPipe({ whitelist: true })`
5. **Rate limiting** : 60 req/min/IP global

---

## Authentification et autorisation

- JWT double token (access 15 min, refresh 7 jours) — voir [ADR-007](../decisions/ADR-007-jwt-auth.md)
- `JwtAuthGuard` sur toutes les routes protégées
- `RolesGuard` + `@Roles()` pour le RBAC
- Payload JWT tampering → `401` (signature invalide)
- Token signé avec la mauvaise clé → `401`
- Token expiré → `401`
- Réponses 403 ne révèlent pas les rôles autorisés

---

## Validation des inputs

```typescript
// Global dans main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,              // Supprime les champs non déclarés dans le DTO
  forbidNonWhitelisted: false,  // 400 si champ inconnu
  transform: true,              // Conversion automatique des types
}));
```

- `@IsEnum()` pour les champs enum (jamais `@IsString()`)
- Limites sur les chaînes (`@MaxLength`)
- Limites sur les arrays (`@ArrayMaxSize`)

---

## Protection contre les injections

Tests automatisés dans `test/security/api-injection.security.spec.ts` :
- SQL injection (6 payloads)
- XSS (5 payloads) — l'API retourne du JSON, pas du HTML
- Prototype pollution (3 payloads) — `whitelist: true` supprime `__proto__`
- Path traversal (4 payloads)
- Inputs extrêmes (1 Mo, null byte, type incorrect)

---

## Protection des webhooks

Chaque webhook provider est validé par signature HMAC avant traitement :

```typescript
// PaymentWebhookProcessor.valider()
const expectedSig = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');
if (signature !== expectedSig) throw new UnauthorizedException();
```

---

## Audit log

Toutes les opérations financières sensibles sont enregistrées dans `audit_log` :
- Immuable : INSERT uniquement
- Contient : userId, action, walletId, montant, timestamp, IP
- Accessible uniquement à SUPER_ADMIN

---

## Headers de sécurité

À configurer via Helmet (recommandé) :

```typescript
import helmet from 'helmet';
app.use(helmet());
```

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security` (HTTPS uniquement)
- Pas de `X-Powered-By: Express`
