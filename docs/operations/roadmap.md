# Roadmap technique — Shopi

> Document vivant. Révision trimestrielle.  
> Les items sont classés par impact métier / effort technique.

---

## Vision court terme (0–3 mois)

### Corrections prioritaires

| Item | Impact | Effort | Statut |
|---|---|---|---|
| Activer les backups automatiques PostgreSQL | Critique | Faible | À faire |
| Configurer UptimeRobot sur `/health` | Critique | Faible | À faire |
| Configurer Sentry (DSN en variable d'env) | Élevé | Faible | À faire |
| Corriger la syntaxe YAML du deploy-pipeline | Élevé | Faible | À faire |
| Tests d'intégration pour WalletEngine | Élevé | Moyen | À faire |
| Tests E2E pour le flux de paiement complet | Élevé | Élevé | À faire |

### Améliorations de stabilité

- **Idempotency clé étendue** : Étendre le mécanisme d'idempotence aux endpoints de paiement webhook pour éviter les doubles traitements lors de ré-émissions par le provider
- **BullMQ dead-letter queue** : Ajouter une DLQ pour les jobs échoués afin d'éviter leur perte silencieuse
- **Health check étendu** : Enrichir `GET /health` avec l'état de Redis et de la connexion DB

---

## Vision moyen terme (3–9 mois)

### Capacités financières

- **Multi-devise** : Support de l'USD en parallèle du GNF (impact : WalletEngine + CommissionEngine)
- **Plafonds de wallet configurables** : Rendre les plafonds par type de wallet configurables via FinancialConfigEngine
- **Rapport financier automatisé** : Envoi hebdomadaire automatique des rapports ReportingEngine aux SUPER_ADMIN par email

### Infrastructure

- **CDN pour les assets** : Passer le frontend par un CDN (Cloudflare) pour réduire la latence en Guinée
- **Read replica PostgreSQL** : Séparer les requêtes de lecture (dashboards, rapports) des écritures transactionnelles pour améliorer les performances sous charge
- **Redis Cluster** : Passer de Redis standalone à un cluster Redis pour la haute disponibilité (si Upstash Pro le permet)

### DX (Developer Experience)

- **SDK client TypeScript** : Générer automatiquement un SDK client depuis les specs OpenAPI/Swagger
- **Environnement de test isolé** : Sandbox avec données faker pour les tests manuels sans impacter la DB de staging

---

## Vision long terme (9–24 mois)

### Architecture évolutive

#### Candidats à l'extraction en microservices

Les modules suivants ont des frontières claires et pourraient devenir des services indépendants si le trafic le justifie :

| Module | Justification | Complexité de migration |
|---|---|---|
| `ReportingEngine` | Read-only, très intensif en CPU, pas de transactions critiques | Faible |
| `NotificationsModule` | Stateless, indépendant des transactions financières | Faible |
| `SupportModule` | Domaine isolé, chatbot potentiel | Moyenne |
| `PaymentEngine` | Provider abstraction déjà en place | Élevée |
| `WalletEngine` | Données critiques, SELECT FOR UPDATE à gérer | Très élevée |

**Recommandation** : Ne pas migrer avant d'avoir > 10 000 transactions/jour. Le monolithe modulaire actuel est la bonne architecture pour l'échelle actuelle.

#### Message broker

Remplacer EventEmitter2 par un broker externe (Redis Streams ou RabbitMQ) si :
- Les événements doivent être consommés par plusieurs instances (auto-scaling)
- La durabilité des événements devient critique (pas de perte d'audit events au restart)

**Trigger** : > 3 instances backend actives simultanément.

### Observabilité

- **OpenTelemetry** : Traces distribuées de bout en bout (requête HTTP → DB → cache → événements)
- **Tableau de bord Grafana** : Métriques financières en temps réel (volume transactions, taux d'escrows libérés, commissions)
- **Alertes prédictives** : Détecter les anomalies financières (volumes inhabituels, patterns de fraude)

---

## Technologies à surveiller

| Technologie | Pertinence Shopi | Maturité | Priorité surveillance |
|---|---|---|---|
| Bun.js | Remplacement Node.js (2–3× plus rapide) | En production | Moyenne |
| NestJS 12 | Impact direct sur le backend | Roadmap NestJS | Haute |
| Drizzle ORM | Alternative TypeORM (meilleur TS, migrations) | Stable | Moyenne |
| Postgres.js | Alternative pg/TypeORM driver | Stable | Faible |
| tRPC | API type-safe sans OpenAPI (si fullstack TS) | Stable | Faible |

---

## Risques de croissance

| Risque | Seuil de déclenchement | Mitigation |
|---|---|---|
| Saturation connexions PostgreSQL | > 80 connexions actives | PgBouncer (connection pooling) |
| Limite mémoire Redis | > 80% RAM Redis | Purge TTL, compression, ou upgrade |
| Temps de migration > 5 min | Tables > 1M lignes | Migrations online (pg_repack) |
| Performances WalletEngine | > 500 tx/min simultanées | Read replica + cache agrégats |
| Dépendance Render single-region | SLA Render < 99.9% | Multi-region ou provider alternatif |

---

## Décisions reportées

Ces décisions ont été volontairement repoussées. Les réévaluer à chaque cycle trimestriel :

1. **CQRS complet** — Séparer les projections de lecture des agrégats d'écriture. Utile si le ReportingEngine devient un goulot d'étranglement.

2. **Authentification OAuth/SSO** — Connexion via Google/Facebook. Utile pour réduire la friction à l'inscription.

3. **Contrats intelligents pour escrow** — Blockchain pour l'escrow (transparence maximale). Coût et complexité trop élevés pour la phase actuelle.

4. **Notification push mobile** — FCM/APNs pour l'app mobile. Dépend de la roadmap produit mobile.
