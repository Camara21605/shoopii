# ReportingEngine

**Fichier** : `src/modules/reporting-engine/reporting.engine.ts`  
**Module** : `ReportingModule`

---

## Responsabilités

- Calculer les KPI financiers (volume, commissions, retraits…)
- Fournir des analytics par période, par acteur, par zone géographique
- Générer des rapports exportables (CSV, JSON)
- Détecter des anomalies et déclencher des alertes
- Mettre en cache les données de dashboard (Redis, TTL configurable)

---

## Services internes

| Service | Rôle |
|---|---|
| `KpiEngine` | Calcul des indicateurs clés de performance |
| `AnalyticsService` | Agrégations multi-dimensionnelles |
| `StatisticsService` | Statistiques descriptives (moyenne, médiane, P95…) |
| `DashboardService` | Composition des données pour les dashboards |
| `ReportGenerator` | Génération de rapports structurés |
| `ExportService` | Export CSV/JSON avec permissions |
| `AlertService` | Détection d'anomalies + alertes |
| `ReportingCache` | Cache Redis pour les données lourdes |
| `AuditReport` | Rapports d'audit réglementaire |

---

## KPI calculés

| KPI | Description |
|---|---|
| `volumeTotal` | Montant total des transactions sur la période |
| `commissionsGenerees` | Total des commissions collectées |
| `commandesValidees` | Nombre de commandes validées |
| `tauxLitige` | % de commandes ayant généré un litige |
| `retraitsEffectues` | Total des retraits versés |
| `walletActifs` | Nombre de wallets avec activité |
| `delaiMoyen` | Délai moyen de validation des commandes (heures) |

---

## Permissions sur les exports

Chaque rôle n'accède qu'aux données autorisées :

| Rôle | Scope des exports |
|---|---|
| `SUPER_ADMIN` | Toutes les données, tous les acteurs |
| `ADMIN` | Données agrégées de la plateforme |
| `COMPANY` | Ses propres commandes et commissions |
| `DELIVERY` | Ses propres livraisons |
| `PARTNER` | Ses propres données |

---

## Événements consommés

| Événement | Action |
|---|---|
| `payment.confirmed` | Incrémente le volume et les commissions |
| `wallet.operation.success` | Met à jour les agrégats wallet |
| `escrow.released` | Comptabilise la commande comme terminée |
| `resolution.resolved` | Comptabilise le litige résolu |
