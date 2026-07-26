# ADR-004 — Architecture en moteurs financiers isolés

**Statut** : Accepté  
**Date** : 2026

---

## Contexte

Shopi gère des flux financiers complexes : paiements multi-providers, séquestre, commissions hiérarchiques, retraits vers mobile money. Ces flux impliquent plusieurs acteurs (client, entreprise, livreur, partenaire, correspondant, Shopi) et doivent être fiables, auditables et extensibles.

## Problème

Comment organiser la logique financière pour qu'elle soit :
- **Fiable** : pas de perte de fonds, pas de double débit
- **Auditable** : traçabilité complète de chaque opération
- **Extensible** : ajouter un nouveau provider ou une nouvelle règle sans toucher aux autres
- **Testable** : tester chaque domaine isolément

## Options envisagées

### 1. Service monolithique PaiementService
Tout dans un seul service qui gère wallet, escrow, commission, settlement.

**Inconvénients** : Couplage fort, difficile à tester, impossible à maintenir à l'échelle

### 2. Services distincts sans façade
Chaque service expose directement ses méthodes, les controllers les appellent dans l'ordre.

**Inconvénients** : La logique d'orchestration se retrouve dans les controllers, pas de garantie d'ordre

### 3. Moteurs financiers avec façade unique (choisi)
Chaque domaine = un Engine (façade) + des sous-services spécialisés + un EventBus.

## Décision

**Architecture en 9 moteurs financiers isolés** :
- WalletEngine, CommissionEngine, EscrowEngine, PaymentEngine
- ResolutionEngine, SettlementEngine, FinancialConfigEngine
- ReportingEngine, PerformanceEngine

## Justification

- **Façade unique** : chaque engine est le seul point d'entrée → pas de bypass possible
- **Responsabilité unique** : chaque sous-service fait une seule chose
- **Erreurs typées** : `WalletErreur`, `CommissionErreur`… permettent d'identifier précisément l'origine
- **Audit fire-and-forget** : l'audit n'est jamais dans le chemin critique
- **Tests** : les services purs (WalletValidatorService, CommissionCalculatorService) sont testables sans mock
- **Dépendances claires** : `PaymentEngine → EscrowEngine → WalletEngine` (direction unique)

## Conséquences

✅ Chaque moteur peut être déployé, testé et évolué indépendamment  
✅ Traçabilité complète (audit log sur chaque opération)  
✅ Idempotence gérée à la couche WalletEngine (clé unique)  
✅ Événements asynchrones permettent la réaction sans couplage  
⚠️ Plus de fichiers et de structure à comprendre pour un nouveau développeur  
⚠️ La cascade d'appels (Payment → Escrow → Wallet) génère plusieurs transactions DB
