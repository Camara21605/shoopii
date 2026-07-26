# Gestion des incidents

---

## Niveaux de sévérité

| Niveau | Description | Exemples | Temps de réponse |
|---|---|---|---|
| **P0 — Critique** | Production totalement indisponible | API down, DB inaccessible, paiements impossibles | < 15 min |
| **P1 — Majeur** | Fonctionnalité critique dégradée | Paiements lents, wallets bloqués, escrows figés | < 1h |
| **P2 — Modéré** | Fonctionnalité non critique affectée | Notifications retardées, exports KO, search lent | < 4h |
| **P3 — Mineur** | Bug ou dégradation légère | Typo, performance marginalement dégradée | < 24h |

---

## Processus de gestion d'un incident

```
1. DÉTECTION
   ├── UptimeRobot alerte (downtime)
   ├── Sentry alerte (erreurs critiques)
   ├── Signalement utilisateur
   └── Vérification proactive (/health, logs)

2. QUALIFICATION (5 min)
   ├── Vérifier /health
   ├── Consulter les logs Render
   ├── Identifier le composant affecté
   └── Attribuer un niveau P0/P1/P2/P3

3. COMMUNICATION INITIALE
   ├── P0/P1: Notifier l'équipe immédiatement
   └── Créer un ticket dans le canal incidents

4. INVESTIGATION
   ├── Reproduire le problème
   ├── Identifier la cause racine
   └── Estimer l'impact (utilisateurs, transactions)

5. RÉSOLUTION
   ├── Appliquer le fix ou le rollback
   ├── Vérifier /health après correction
   └── Tester le cas qui a causé l'incident

6. COMMUNICATION FINALE
   └── Informer les parties prenantes

7. POST-MORTEM (pour P0/P1)
   ├── Documenter dans incident-log.md
   ├── Identifier les actions préventives
   └── Mettre à jour les runbooks si nécessaire
```

---

## Runbooks par type d'incident

### API inaccessible (P0)

```
1. Vérifier le status Render : render.com/status
2. Vérifier /health
3. Consulter les logs Render (erreur de démarrage ?)
4. Vérifier DATABASE_URL (test de connexion)
5. Si DB KO → plan de reprise (voir disaster-recovery.md)
6. Si code KO → rollback (Render Dashboard)
7. Si config KO → vérifier les variables d'environnement
```

### Paiements impossibles (P0)

```
1. Vérifier les logs PaymentEngine
2. Tester un ping vers le provider affecté
3. Vérifier les secrets provider (non expirés ?)
4. Si un provider KO → les autres fonctionnent
5. Notifier les utilisateurs de la dégradation
6. Contacter le support du provider
```

### Wallets bloqués / Escrows figés (P1)

```
1. Requête SQL : SELECT * FROM escrow WHERE status='LOCKED' AND updated_at < NOW()-INTERVAL '24h';
2. Identifier la cause (litige non résolu ? Erreur de transition ?)
3. Action SUPER_ADMIN via l'API ResolutionEngine si litige
4. Correction manuelle uniquement si bug avéré (avec backup avant)
5. Documenter l'intervention dans l'audit log
```

### Redis inaccessible (P1)

```
1. Application passe en mode dégradé (cache miss constant)
2. Queues BullMQ arrêtées → jobs non traités
3. Vérifier la connexion Redis (REDIS_URL valide ?)
4. Redémarrer Redis ou basculer sur une nouvelle instance
5. Après restauration Redis, relancer les jobs BullMQ manuellement
```

---

## Journal des incidents

Fichier : `docs/operations/incident-log.md`

Format :

```markdown
## INC-001 — Titre de l'incident

- **Date** : 2026-07-18 14:30 UTC
- **Niveau** : P1
- **Durée** : 45 minutes
- **Composants** : PaymentEngine, Escrow
- **Impact** : 12 utilisateurs, 3 paiements en attente

### Cause racine
Description de la cause.

### Actions prises
1. Action 1 à 14h32
2. Action 2 à 14h45

### Résolution
Ce qui a résolu le problème.

### Actions préventives
- [ ] Action préventive 1
- [ ] Action préventive 2
```
