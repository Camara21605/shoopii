# CommissionEngine

**Fichier** : `src/modules/commission/commission.engine.ts`  
**Module** : `CommissionModule`

---

## Responsabilités

Calculer et distribuer les commissions Shopi à chaque étape de la transaction :

1. Récupérer la règle de commission active (taux, répartition)
2. Résoudre la hiérarchie des acteurs (entreprise, livreur, partenaire, correspondant)
3. Calculer les montants (mathématique pure, arrondi `Math.floor`)
4. Préparer les instructions de distribution vers les wallets
5. Auditer et émettre l'événement `commission.calculated`

> Le CommissionEngine est **indépendant** du PaiementModule. C'est PaiementModule qui appelle CommissionEngine, jamais l'inverse.

---

## Pipeline

```
CommissionEngine.calculer(context: CommissionContext)
  │
  ├─ 1. CommissionConfigService.getActiveRule()
  │     → Règle active en DB (taux produit, taux livraison, répartitions)
  │
  ├─ 2. CommissionValidatorService.validerTout()
  │     → Commande existante, montants cohérents, wallets présents
  │
  ├─ 3. CommissionHierarchyService.resolveAll()
  │     → Résoudre les 4 wallets : entreprise, livreur, partenaire, correspondant
  │
  ├─ 4. CommissionCalculatorService.calculer()
  │     → PURE MATH — aucune IO
  │     → floor() sur chaque montant, Admin absorbe les résidus d'arrondi
  │
  ├─ 5. CommissionDistributorService.preparer()
  │     → Construit la liste des WalletTransferInstruction
  │
  ├─ 6. CommissionAuditService.logCalculReussi()   [fire-and-forget]
  │
  └─ 7. EventEmitter2.emit('commission.calculated')
        → CommissionCalculatedEvent { commandeId, montants, acteurs }
```

---

## Formule de calcul

### Commission produit

```
commissionBrute = floor(sousTotal × tauxProduit × planMultiplier)
partShopi       = floor(commissionBrute × repartitionShopi / 100)
partAdmin       = commissionBrute - partShopi - partPartenaire   ← absorbe l'arrondi
partEntreprise  = sousTotal - commissionBrute
```

### Commission livraison

```
commissionLivBrute = floor(fraisLivraison × tauxLivraison × planMultiplier)
partLivreur        = floor(commissionLivBrute × repartitionLivreur / 100)
partCorrespondant  = commissionLivBrute - partLivreur - partShopiLiv   ← absorbe
```

### Invariant d'intégrité

```
|totalDistribue - totalCommande| ≤ 1 GNF
```

Testé sur 6 types de commandes différents dans `commission-calculator.service.spec.ts`.

---

## Plans de commission (`planMultiplier`)

| Plan | Multiplicateur | Effet sur une commande de 100 000 GNF (taux 10%) |
|---|---|---|
| `STANDARD` | × 1.0 | Commission = 10 000 GNF |
| `PREMIUM` | × 1.2 | Commission = 12 000 GNF |
| `ELITE` | × 1.5 | Commission = 15 000 GNF |

---

## CommissionContext

```typescript
interface CommissionContext {
  commandeId:       string;
  sousTotal:        number;   // Montant produits (GNF, entier)
  fraisLivraison:   number;   // Frais de livraison (GNF, entier)
  total:            number;   // = sousTotal + fraisLivraison
  currency:         string;   // 'GNF'
  entrepriseId:     string;
  livreurId?:       string | null;
  partnerId?:       string | null;
  correspondantId?: string | null;
}
```

---

## Erreurs (`CommissionErreurType`)

| Code | Cause |
|---|---|
| `COMMANDE_INTROUVABLE` | commandeId inconnu |
| `REGLE_INTROUVABLE` | aucune règle active en DB |
| `MONTANT_INVALIDE` | total ≤ 0 ou incohérent |
| `WALLET_INTROUVABLE` | wallet d'un acteur manquant |
| `CALCUL_ECHOUE` | overflow ou NaN dans le calcul |
| `DISTRIBUTION_ECHOUEE` | erreur lors de la construction des instructions |
| `ERREUR_INTERNE` | erreur système non anticipée |

---

## Événements émis

| Événement | Classe | Contenu |
|---|---|---|
| `commission.calculated` | `CommissionCalculatedEvent` | commandeId, snapshot complet |
| `commission.failed` | `CommissionFailedEvent` | commandeId, erreur |

---

## Services internes

| Service | Rôle |
|---|---|
| `CommissionConfigService` | Lit `CommissionRule` active en DB |
| `CommissionValidatorService` | Valide commande + acteurs + montants |
| `CommissionHierarchyService` | Résout les wallets de tous les acteurs |
| `CommissionCalculatorService` | Mathématiques pures (testable sans DB) |
| `CommissionDistributorService` | Construit les instructions de virement |
| `CommissionAuditService` | Log d'audit `commission_audit_log` |
| `CommissionHistoryService` | Lecture historique paginé |
