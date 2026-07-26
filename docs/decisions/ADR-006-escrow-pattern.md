# ADR-006 — Pattern Escrow pour les transactions

**Statut** : Accepté  
**Date** : 2026

---

## Contexte

Dans le modèle e-commerce de Shopi, le client paie avant de recevoir sa commande. L'entreprise ne doit recevoir les fonds que si la livraison est confirmée. En cas de litige, les fonds doivent être remboursables.

## Problème

Comment sécuriser les fonds entre le paiement et la livraison, tout en permettant des remboursements partiels ou totaux ?

## Options envisagées

### 1. Paiement direct à l'entreprise
Le fonds vont immédiatement dans le wallet de l'entreprise. En cas de remboursement, il faut débiter l'entreprise.

**Risques** : L'entreprise peut ne pas avoir les fonds disponibles au moment du remboursement (retrait entretemps)

### 2. Wallet intermédiaire Shopi
Les fonds transitent par un wallet Shopi central.

**Risques** : Régulation (Shopi détient les fonds), complexité comptable, auditabilité difficile

### 3. Escrow avec machine à états (choisi)
Un enregistrement `Escrow` lie la commande à un montant, avec une machine à états stricte.

## Décision

Pattern **Escrow** avec 10 états et transitions validées :

```
CREATED → FUNDS_RECEIVED → LOCKED → WAITING_VALIDATION
  → RELEASED | DISPUTED → RESOLVED | REFUND_PENDING → REFUNDED
  | FAILED | EXPIRED
```

## Justification

- Les fonds restent dans le **wallet escrow** du client (solde `escrow_balance`) jusqu'à libération
- Chaque transition est journalisée dans `escrow_history`
- Aucune transition non autorisée n'est possible (EscrowValidatorService)
- Les litiges peuvent être ouverts uniquement en état WAITING_VALIDATION
- La libération déclenche automatiquement le calcul des commissions

## Conséquences

✅ Fonds protégés — ni l'entreprise ni le livreur ne peut accéder aux fonds avant validation  
✅ Auditabilité complète via `escrow_history`  
✅ Remboursements totaux ou partiels gérés nativement  
✅ Timeout automatique (expiration de l'escrow configurable)  
⚠️ Machine à états complexe — toute nouvelle transition doit être explicitement autorisée  
⚠️ Le solde escrow du client ne lui est pas accessible pendant la commande
