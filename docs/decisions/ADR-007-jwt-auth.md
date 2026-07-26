# ADR-007 — JWT avec access + refresh tokens

**Statut** : Accepté  
**Date** : 2025

---

## Contexte

Shopi a 7 rôles d'utilisateurs avec des niveaux d'accès différents. L'authentification doit être stateless (pas de session serveur) tout en permettant la révocation des tokens.

## Décision

**JWT double token** :
- **Access token** : courte durée (15 min), signé avec `JWT_SECRET`
- **Refresh token** : longue durée (7 jours), signé avec `JWT_REFRESH_SECRET` (clé différente)

## Justification

- Access token court → fenêtre d'exploitation limitée si compromis
- Refresh token séparé → peut être révoqué sans invalider tous les access tokens
- Deux clés différentes → impossible d'utiliser un refresh token comme access token
- RBAC via `role` dans le payload JWT → `RolesGuard` lit le rôle sans appel DB

## Implémentation

```typescript
// JwtAuthGuard vérifie la signature et l'expiration
// RolesGuard lit request.user.role (extrait du payload JWT)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
getAdminData() { ... }
```

## Sécurité

- Les clés JWT sont dans les variables d'environnement (jamais dans le code)
- `JWT_SECRET ≠ JWT_REFRESH_SECRET`
- Les refresh tokens sont stockés en DB pour permettre la révocation
- Les tokens expirés retournent toujours `401 Unauthorized`
- Les tokens signés avec la mauvaise clé retournent `401 Unauthorized`
- Payload tampering → signature invalide → `401 Unauthorized`

## Conséquences

✅ Stateless — pas de session serveur à gérer  
✅ RBAC sans appel DB sur chaque requête  
✅ Révocation possible via invalidation du refresh token en DB  
⚠️ Access token ne peut pas être révoqué avant expiration (15 min max)  
⚠️ Rotation des clés JWT → invalidation de tous les tokens actifs
