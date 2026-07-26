# PerformanceEngine

**Fichier** : `src/modules/performance-engine/performance.engine.ts`  
**Module** : `PerformanceModule`

---

## Responsabilités

- Mesurer les performances des endpoints via un intercepteur global (`PerformanceInterceptor`)
- Détecter les dégradations de performance (P95, error rate)
- Protéger la plateforme via un **circuit breaker** (CLOSED → OPEN → HALF_OPEN)
- Mettre en cache les entités fréquentes (`PlatformSettings`, réponses Redis)
- Exposer un endpoint de rapport pour le monitoring

---

## Architecture

```
PerformanceEngine (façade)
  ├── PerformanceInterceptor   ← APP_INTERCEPTOR global
  ├── PerformanceProfilerService  ← Mesure P95, error count
  ├── LoadProtectionService    ← Circuit breaker
  ├── RedisCacheService        ← Cache générique Redis
  └── PlatformSettingsCacheService ← Cache PlatformSettings
```

---

## Circuit Breaker

| État | Description | Transition |
|---|---|---|
| `CLOSED` | Normal — requêtes passent | → OPEN après 5 échecs en 60s |
| `OPEN` | Bloqué — toutes les requêtes échouent immédiatement | → HALF_OPEN après 30s de cooldown |
| `HALF_OPEN` | Test — une requête passe | → CLOSED si succès, → OPEN si échec |

```typescript
// Utilisation dans un service
const result = await loadProtection.execute(async () => {
  return await externalProvider.call();
});
```

---

## RedisCacheService — Pattern Cache-Aside

```typescript
// Lire avec TTL automatique
const value = await cache.get<T>(key);

// Écrire
await cache.set(key, value, ttlSeconds);

// Invalider un namespace entier (SCAN, jamais KEYS *)
await cache.flush('financial-config');
```

---

## PerformanceInterceptor

Appliqué globalement via `APP_INTERCEPTOR` dans `PerformanceModule`.

Pour chaque requête :
1. Enregistre le timestamp de début
2. Capture le temps de réponse
3. Transmet à `PerformanceProfilerService` (P95, error count)
4. Notifie `LoadProtectionService` (success/failure pour circuit breaker)

---

## Endpoint de monitoring

```
GET /performance/report   (ADMIN, SUPER_ADMIN)
```

Retourne :
```json
{
  "profiler": { "p95Ms": 145, "errorCount": 2, "requestCount": 1024 },
  "cache": { "hitRate": 0.87, "keyCount": 342 },
  "circuitBreaker": { "state": "CLOSED", "failureCount": 0 }
}
```

---

## PlatformSettings — Cache dédié

`PlatformSettingsCacheService` met en cache les paramètres de la plateforme pendant **5 minutes** (TTL configurable). Invalide automatiquement le cache lors d'une modification via `FinancialConfigEngine`.
