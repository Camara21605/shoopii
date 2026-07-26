# ADR-003 — Redis pour le cache et les queues

**Statut** : Accepté  
**Date** : 2025

---

## Contexte

Plusieurs besoins nécessitent un stockage rapide hors base de données :
1. **Cache** : configuration financière (lue à chaque transaction), platform settings
2. **Queues** : jobs asynchrones (notifications, settlements, emails)
3. **Sessions** : tokens de refresh, codes de vérification

## Décision

**Redis 7** pour le cache (via `@nestjs-modules/ioredis`) et les queues (via **BullMQ**).

## Justification

- Cache en mémoire avec TTL automatique — évite les lectures DB répétées sur la config
- BullMQ offre des queues persistantes avec retry automatique et monitoring
- `lazyConnect: true` — la connexion Redis n'est établie qu'au premier appel (pas au démarrage)
- Pattern Cache-Aside : lecture DB uniquement en cas de cache miss
- Invalidation par namespace avec `SCAN` (jamais `KEYS *` qui bloque Redis)

## Pattern d'invalidation du cache

```typescript
// Jamais :
await redis.keys('financial-config:*');  // Bloque Redis

// Toujours :
const keys = [];
for await (const key of redis.scanIterator({ match: 'financial-config:*' })) {
  keys.push(key);
}
if (keys.length) await redis.del(...keys);
```

## Ordre de déclaration dans app.module.ts

`RedisModule` et `BullModule` doivent être déclarés **avant** tout module qui utilise `@InjectRedis()` ou `@InjectQueue()`. Violation de cette règle → erreur de démarrage (injection non résolue).

## Conséquences

✅ Performances élevées sur les données fréquemment lues (config, settings)  
✅ Jobs asynchrones fiables avec BullMQ (retry, dead letter queue)  
✅ TTL natif Redis → expiration automatique des codes de vérification  
⚠️ Redis est un point de défaillance supplémentaire (configurer la haute disponibilité)  
⚠️ Cache invalidation est toujours un problème difficile — toujours invalider après écriture
