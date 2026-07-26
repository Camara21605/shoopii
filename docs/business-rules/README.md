# Règles Métier — Shopi

Référentiel des règles métier de la plateforme. Ces règles sont **configurables** via `FinancialConfigEngine` sauf mention contraire.

---

## Commissions

### Règle générale

Pour chaque commande validée, Shopi prélève une commission sur :
1. Le **sous-total produits** (taux configurable, défaut : 10%)
2. Les **frais de livraison** (taux configurable, défaut : 15%)

### Répartition de la commission produit (défaut)

| Part | % de la commission |
|---|---|
| Shopi | 60% |
| Admin local | 20% |
| Partenaire | 20% |

### Répartition de la commission livraison (défaut)

| Part | % de la commission |
|---|---|
| Livreur | 50% |
| Correspondant | 30% |
| Shopi | 20% |

### Plans de commission

Les entreprises peuvent être sur des plans différents qui modifient le taux via un multiplicateur :

| Plan | Multiplicateur |
|---|---|
| STANDARD | × 1.0 |
| PREMIUM | × 1.2 |
| ELITE | × 1.5 |

### Règle d'intégrité

La somme de toutes les parts distribuées doit être égale au total de la commande **à 1 GNF près** (résidu d'arrondi `Math.floor`). L'administrateur Shopi absorbe le résidu.

---

## Cycle d'une commande

```
1. Client crée la commande → statut EN_ATTENTE_PAIEMENT
2. Paiement initié → PAIEMENT_EN_COURS
3. Webhook confirmation → PAYEE
   → EscrowEngine.recevoirFonds()
   → CommissionEngine.calculer()
4. Entreprise prépare → EN_PREPARATION
5. Livreur récupère → EN_LIVRAISON
6. Livreur livre → LIVREE
7. Client valide (ou timeout 48h) → VALIDEE
   → EscrowEngine.liberer() (fonds distribués)
```

### Validation automatique

Si le client ne valide pas dans **48 heures** après la livraison (configurable), la commande est automatiquement validée via `CommandeScheduler`.

### Annulation

- CLIENT peut annuler avant `EN_PREPARATION`
- COMPANY peut annuler à `EN_ATTENTE_PAIEMENT` uniquement
- Annulation après paiement → remboursement automatique

---

## Wallets

### Types de wallet

| Type | Titulaire |
|---|---|
| `CLIENT` | Compte client |
| `COMPANY` | Entreprise |
| `DELIVERY` | Livreur |
| `PARTNER` | Partenaire |
| `CORRESPONDENT` | Correspondant |
| `ADMIN` | Administrateur |
| `PLATFORM` | Wallet principal Shopi |

### Statuts

| Statut | Description |
|---|---|
| `ACTIVE` | Opérationnel |
| `FROZEN` | Gelé (litige, fraude) — aucune opération possible |
| `CLOSED` | Fermé définitivement |

### Limites de retrait

- Montant minimum : **50 000 GNF** (configurable)
- Délai de blocage des fonds après réception : **7 jours** (configurable)
- Limite journalière : configurable par wallet (`dailyWithdrawLimit`)

---

## Cycle d'un paiement

```
1. Client initie le paiement → session créée, statut PENDING
2. Client paie sur l'interface du provider
3. Provider envoie un webhook → validation de signature
4. Si CONFIRMED:
   → EscrowEngine.recevoirFonds()
   → CommissionEngine.calculer()
   → Statut commande → PAYEE
5. Si FAILED ou timeout:
   → Statut commande → EN_ATTENTE_PAIEMENT (retry possible)
```

---

## Règles des remboursements

| Scénario | Règle |
|---|---|
| Annulation avant paiement | Aucun remboursement (pas de fonds) |
| Annulation après paiement | Remboursement total automatique |
| Litige résolu REJET | Fonds libérés vers acteurs |
| Litige résolu REMBOURSEMENT_PARTIEL | Proportionnel au montant accordé |
| Litige résolu REMBOURSEMENT_TOTAL | Client remboursé intégralement |
| Commande expirée (escrow timeout) | Remboursement automatique client |

---

## Règles des retraits

1. Le wallet doit être en statut `ACTIVE`
2. Le solde doit être ≥ montant minimum de retrait
3. Les fonds doivent avoir dépassé le délai de blocage (7j par défaut)
4. Le KYC doit être validé (pour les montants importants)
5. L'opération passe d'abord par `WITHDRAWAL_PENDING` puis `WITHDRAWAL_CONFIRMED`

---

## Rôles et permissions

| Rôle | Peut voir | Peut faire |
|---|---|---|
| `CLIENT` | Ses commandes, son wallet, ses notifications | Commander, payer, valider, ouvrir un litige |
| `COMPANY` | Ses produits, ses commandes, son wallet | Gérer catalogue, préparer commandes, retrait |
| `DELIVERY` | Ses livraisons, son wallet | Confirmer livraison, retrait |
| `PARTNER` | Ses statistiques, son wallet | Retrait |
| `ADMIN` | Tout sauf config système | Gérer tickets, modérer, voir rapports |
| `SUPER_ADMIN` | Tout | Configuration, suppressions, ajustements |

---

## Délais configurables

Tous via `FinancialConfigEngine` / table `platform_settings` :

| Paramètre | Défaut | Description |
|---|---|---|
| `delaiValidationCommandeH` | 48h | Validation automatique après livraison |
| `delaiRetraitJ` | 7j | Blocage fonds avant retrait |
| `delaiEscrowExpirationH` | 72h | Expiration de l'escrow |
| `delaiSupportSlaH` | 24h | SLA de réponse support |
