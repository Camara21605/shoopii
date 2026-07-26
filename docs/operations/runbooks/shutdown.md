# Runbook — Arrêt contrôlé du système

---

## Quand utiliser ce runbook

- Maintenance planifiée nécessitant un arrêt total
- Migration de base de données avec downtime obligatoire
- Remplacement d'infrastructure (changement de provider)

---

## Arrêt sur Render (production)

```
1. Render Dashboard → shopi-backend → Settings
2. "Suspend Service" (arrêt immédiat)
   OU
   Ne pas déployer et attendre que les instances meurent naturellement

3. Vérifier que /health ne répond plus (expected: connection refused)
```

---

## Arrêt local (développement)

```bash
# Si lancé avec npm run start:dev
Ctrl+C dans le terminal

# Si lancé en background
ps aux | grep node
kill -SIGTERM <PID>

# Vérifier l'arrêt propre dans les logs :
# [NestApplication] Nest application closed
```

---

## Vérifications avant arrêt (production uniquement)

Avant d'arrêter le service en production, vérifier :

```bash
# 1. Aucune transaction en cours (wallets)
# Via SQL ou dashboard admin :
# SELECT COUNT(*) FROM wallet_transaction WHERE status='PENDING';

# 2. Aucun job BullMQ critique en traitement
# Dashboard BullMQ ou logs : grep "ACTIVE" dans les queues

# 3. Aucun escrow en transition
# SELECT COUNT(*) FROM escrow WHERE status NOT IN ('RELEASED','REFUNDED','FAILED','EXPIRED','LOCKED');
```

Si des items sont en cours, attendre leur complétion avant l'arrêt, ou accepter la reprise manuelle au redémarrage.

---

## Communication (si maintenance planifiée)

1. Informer les utilisateurs avec un délai de préavis (email, bannière app)
2. Indiquer la durée estimée de la maintenance
3. Mettre à jour le statut sur la page de statut si disponible
4. Notifier les équipes internes dans le canal incidents

---

## Redémarrage après arrêt

Suivre le runbook [startup.md](startup.md).

S'assurer que :
- Les migrations sont à jour avant redémarrage
- Les variables d'environnement n'ont pas changé
- Les jobs BullMQ bloqués sont relancés si nécessaire
