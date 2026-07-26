# Plan de Reprise d'Activité (PRA)

---

## Objectifs de reprise

| Objectif | Valeur cible |
|---|---|
| **RTO** (Recovery Time Objective) — temps max d'indisponibilité | 4 heures |
| **RPO** (Recovery Point Objective) — perte de données max acceptable | 24 heures (durée entre 2 backups) |

---

## Scénarios couverts

### Scénario 1 — Panne serveur (Render)

**Probabilité** : Faible · **Impact** : Critique

```
1. Vérifier render.com/status pour confirmer la panne
2. Attendre si panne Render globale (généralement < 1h)
3. Si panne prolongée (> 2h) :
   a. Exporter les derniers logs Render
   b. Provisionner un VPS alternatif (Railway, Heroku, DigitalOcean)
   c. Configurer les variables d'environnement
   d. Déployer depuis le dernier tag stable Git
   e. Mettre à jour les DNS (API_URL)
   f. Vérifier /health sur le nouveau serveur
4. Communiquer la migration aux utilisateurs
```

**Temps estimé** : 1–3 heures

### Scénario 2 — Perte ou corruption de base de données

**Probabilité** : Très faible · **Impact** : Critique

```
1. ARRÊTER l'application immédiatement (éviter d'écrire sur une DB corrompue)
2. Identifier le backup le plus récent
3. Sur l'environnement staging : tester la restauration d'abord
4. Sur production :
   a. Créer un backup de la DB actuelle (même corrompue, pour analyse)
   b. Restaurer depuis le backup validé
   c. Exécuter les migrations manquantes
   d. Vérifier l'intégrité :
      SELECT COUNT(*) FROM wallet WHERE status='ACTIVE';
      SELECT COUNT(*) FROM escrow WHERE status NOT IN ('RELEASED','REFUNDED','FAILED','EXPIRED');
      SELECT SUM(balance) FROM wallet; -- Vérifier la cohérence des soldes
5. Redémarrer l'application
6. Activer la surveillance intensive pendant 24h
```

**Perte de données** : Entre 0 et 24h selon la fréquence des backups

**Temps estimé** : 2–4 heures

### Scénario 3 — Indisponibilité d'un provider de paiement

**Probabilité** : Modérée · **Impact** : Important

```
1. Identifier le provider KO (logs PaymentEngine)
2. Désactiver le provider dans la config (FinancialConfigEngine)
3. Informer les utilisateurs : "Paiement X temporairement indisponible"
4. Les paiements en cours (statut PENDING) sont bloqués :
   - Ne pas les annuler automatiquement
   - Attendre la restauration du provider
5. Contacter le support du provider
6. Quand le provider est restauré :
   - Réactiver dans la config
   - Traiter les webhooks en attente si le provider les réémet
   - Annuler manuellement les sessions expirées
```

**Temps estimé** : Dépend du provider (minutes à heures)

### Scénario 4 — Redis inaccessible

**Probabilité** : Faible · **Impact** : Important

```
1. L'application passe en mode dégradé automatiquement
   (lazyConnect: true — pas de crash au démarrage)
2. Impacts immédiats :
   - Cache miss constant → DB sollicitée à chaque requête
   - BullMQ jobs non traités (notifications, settlements)
   - Sessions peuvent expirer
3. Actions :
   a. Vérifier l'instance Redis (Upstash, Railway dashboard)
   b. Tester la connexion : redis-cli -u $REDIS_URL ping
   c. Si instance KO : créer une nouvelle instance Redis
   d. Mettre à jour REDIS_URL dans Render
   e. Redémarrer l'application
4. Après restauration :
   - Relancer les jobs BullMQ bloqués manuellement
   - Les settlements en attente peuvent nécessiter une intervention admin
```

**Temps estimé** : 30 minutes à 2 heures

### Scénario 5 — Incident réseau (DDoS ou saturation)

**Probabilité** : Modérée · **Impact** : Important

```
1. ThrottlerModule bloque les IPs abusives automatiquement (60 req/min)
2. Si dépassement : Render peut auto-scaler (selon le plan)
3. Actions manuelles :
   a. Identifier les IPs sources dans les logs
   b. Bloquer les IPs via le pare-feu Render ou Cloudflare
   c. Augmenter temporairement le plan Render si nécessaire
4. Si attaque persistante : activer Cloudflare comme proxy CDN
```

---

## Responsabilités

| Rôle | Responsabilité | Contact |
|---|---|---|
| Lead technique (Shopi03) | Coordination incident P0/P1, décision rollback | Voir canal incidents |
| SUPER_ADMIN | Actions en production (DB, wallets, config) | Via dashboard admin |
| Support | Communication utilisateurs | Via email/notifications |

---

## Contacts d'urgence

| Service | Support |
|---|---|
| Render | render.com/support |
| PostgreSQL (Neon/Supabase) | Dashboard provider |
| Redis (Upstash) | upstash.com/support |
| Orange Money Guinée | Contrat commercial |
| MTN Guinée | Contrat commercial |

---

## Priorités de reprise

En cas d'incident majeur, l'ordre de priorité de restauration est :

1. **Base de données** (données financières critiques)
2. **API principale** (authentification + wallets)
3. **Paiements** (Orange Money, MTN)
4. **Notifications** (emails, push)
5. **Messaging / Support** (conversations, tickets)
6. **Dashboard / Reporting** (non critique en urgence)
