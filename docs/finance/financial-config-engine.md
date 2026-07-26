# FinancialConfigEngine

**Fichier** : `src/modules/financial-config-engine/financial-config.engine.ts`  
**Module** : `FinancialConfigModule`

---

## Responsabilités

- Lire et mettre à jour la configuration financière de la plateforme **sans redémarrage**
- Mettre en cache les valeurs dans Redis (TTL configurable)
- Invalider le cache lors d'une mise à jour (`SCAN` par namespace, jamais `KEYS *`)
- Historiser toutes les modifications de configuration
- Valider les nouvelles valeurs avant application

---

## Paramètres configurables

| Paramètre | Description | Défaut |
|---|---|---|
| `tauxCommissionProduit` | % commission sur le sous-total | 10% |
| `tauxCommissionLivraison` | % commission sur la livraison | 15% |
| `delaiValidationCommandeH` | Heures avant validation automatique | 48h |
| `delaiRetrait` | Jours de blocage avant retrait | 7j |
| `montantRetraitMinimum` | Minimum de retrait (GNF) | 50 000 |
| `delaiEscrowExpirationH` | Heures avant expiration escrow | 72h |
| `planMultiplierStandard` | Multiplicateur plan STANDARD | 1.0 |
| `planMultiplierPremium` | Multiplicateur plan PREMIUM | 1.2 |
| `planMultiplierElite` | Multiplicateur plan ELITE | 1.5 |

---

## Pattern Cache-Aside

```
FinancialConfigEngine.getConfig(key)
  │
  ├─ Redis.get('financial-config:' + key)
  │   → Hit → retourner la valeur
  │
  └─ Miss → DB.findOne({ key })
             → Redis.set(key, value, ttl)
             → retourner la valeur

FinancialConfigEngine.updateConfig(key, value)
  │
  ├─ FinancialConfigValidator.valider(key, value)
  ├─ DB.save({ key, value })
  ├─ Redis.SCAN 'financial-config:*' → DEL toutes les clés du namespace
  ├─ FinancialConfigHistory.sauvegarder()
  └─ EventBus.emit('financial-config.updated')
```

> **Pourquoi SCAN et non KEYS \*** : `KEYS *` bloque Redis. `SCAN` itère sans bloquer.

---

## Événements émis

| Événement | Déclencheur |
|---|---|
| `financial-config.updated` | Après toute modification |
| `financial-config.cache.invalidated` | Après invalidation du cache |

---

## Services internes

| Service | Rôle |
|---|---|
| `FinancialConfigReader` | Lecture avec cache-aside |
| `FinancialConfigWriter` | Écriture + invalidation cache |
| `FinancialConfigValidator` | Validation des nouvelles valeurs |
| `FinancialConfigCache` | Wrapper Redis pour le cache |
| `FinancialConfigHistory` | Audit des modifications |
