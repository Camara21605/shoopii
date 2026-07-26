# ResolutionEngine

**Fichier** : `src/modules/resolution-engine/resolution.engine.ts`  
**Module** : `ResolutionEngineModule`

---

## Responsabilités

- Instruire les litiges ouverts par les clients
- Collecter et gérer les preuves (photos, messages, documents)
- Prendre des décisions (REJET, REMBOURSEMENT_PARTIEL, REMBOURSEMENT_TOTAL)
- Déléguer l'exécution financière à EscrowEngine
- Journaliser chaque étape du processus

---

## Types de décision

| Décision | Effet |
|---|---|
| `REJET` | Le litige est rejeté — fonds libérés vers les acteurs |
| `REMBOURSEMENT_PARTIEL` | Remboursement partiel au client, reste aux acteurs |
| `REMBOURSEMENT_TOTAL` | Remboursement intégral au client |

---

## Flux de résolution

```
ResolutionEngine.instruire(disputeId)
  │
  ├─ DisputeManager.getDispute(disputeId)
  ├─ EvidenceManager.collecterPreuves()
  └─ Attente de décision admin

ResolutionEngine.decider(ctx: ResolutionDecisionContext)
  │
  ├─ DecisionManager.valider(ctx)
  ├─ Si REJET:
  │   └─ EscrowEngine.liberer()
  ├─ Si REMBOURSEMENT_PARTIEL:
  │   ├─ EscrowEngine.rembourser(montantClient)
  │   └─ EscrowEngine.liberer(montantRestant)
  ├─ Si REMBOURSEMENT_TOTAL:
  │   └─ EscrowEngine.rembourser(total)
  ├─ ResolutionAudit.logDecision()
  └─ EventBus.emit('resolution.resolved')
```

---

## Services internes

| Service | Rôle |
|---|---|
| `DisputeManager` | CRUD des disputes |
| `EvidenceManager` | Upload et gestion des preuves |
| `DecisionManager` | Validation et enregistrement de la décision |
| `RefundManager` | Calcul des montants à rembourser |
| `ResolutionAudit` | Log d'audit |
| `ResolutionHistory` | Historique paginé |

---

## Événements émis

| Événement | Déclencheur |
|---|---|
| `resolution.dispute.opened` | Litige ouvert |
| `resolution.evidence.added` | Preuve ajoutée |
| `resolution.decision.made` | Décision prise |
| `resolution.resolved` | Litige clos |
