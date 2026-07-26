/* ============================================================
 * FICHIER : src/modules/commission/commission.engine.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Orchestrateur principal du moteur de commissions Shopi.
 *
 * Ce service coordonne tous les sous-services dans le bon ordre
 * et garantit qu'un calcul de commission est :
 *   1. Validé avant exécution (CommissionValidatorService)
 *   2. Calculé mathématiquement (CommissionCalculatorService)
 *   3. Distribué aux acteurs corrects (CommissionDistributorService)
 *   4. Tracé dans les logs d'audit (CommissionAuditService)
 *   5. Propagé via des événements asynchrones (EventEmitter2)
 *
 * PIPELINE
 * ─────────────────────────────────────────────────────────────
 *  calculer(context)
 *    │
 *    ├─ 1. CommissionConfigService.getActiveRule()    [DB read]
 *    ├─ 2. CommissionValidatorService.validerTout()   [DB read × 1]
 *    ├─ 3. CommissionHierarchyService.resolveAll()    [DB reads × 4]
 *    ├─ 4. CommissionCalculatorService.calculer()     [pure math]
 *    ├─ 5. CommissionDistributorService.preparer()    [pure transform]
 *    ├─ 6. CommissionAuditService.logCalculReussi()   [DB write, non-bloquant]
 *    └─ 7. EventEmitter2.emit('commission.calculated')
 *
 * GESTION DES ERREURS
 * ─────────────────────────────────────────────────────────────
 *  Les CommissionErreur sont capturées, loggées dans l'audit,
 *  puis re-propagées vers le service appelant.
 *  Les erreurs système inattendues sont wrappées en CommissionErreur.
 *
 * INDÉPENDANCE
 * ─────────────────────────────────────────────────────────────
 *  Ce module est autonome et ne dépend PAS de PaiementModule.
 *  PaiementWebhookService IMPORTE et UTILISE CommissionEngine,
 *  pas l'inverse.
 *
 * DÉPENDANCES
 * ─────────────────────────────────────────────────────────────
 *  CommissionConfigService
 *  CommissionValidatorService
 *  CommissionHierarchyService
 *  CommissionCalculatorService
 *  CommissionDistributorService
 *  CommissionAuditService
 *  EventEmitter2
 * ============================================================ */

import { Injectable, Logger } from '@nestjs/common';

import { CommissionConfigService }      from './services/commission-config.service';
import { CommissionValidatorService }   from './services/commission-validator.service';
import { CommissionHierarchyService }   from './services/commission-hierarchy.service';
import { CommissionCalculatorService }  from './services/commission-calculator.service';
import { CommissionDistributorService } from './services/commission-distributor.service';
import { CommissionAuditService }       from './services/commission-audit.service';
import { CommissionEventBus }           from './events/commission-event-bus.service';

import {
  CommissionContext,
  CommissionResult,
  CommissionSnapshot,
  CommissionErreur,
  CommissionErreurType,
} from './types/commission.types';
import {
  CommissionCalculatedEvent,
  CommissionFailedEvent,
  COMMISSION_EVENTS,
} from './events/commission.events';

@Injectable()
export class CommissionEngine {

  private readonly logger = new Logger(CommissionEngine.name);

  constructor(
    private readonly configSvc:      CommissionConfigService,
    private readonly validatorSvc:   CommissionValidatorService,
    private readonly hierarchySvc:   CommissionHierarchyService,
    private readonly calculatorSvc:  CommissionCalculatorService,
    private readonly distributorSvc: CommissionDistributorService,
    private readonly auditSvc:       CommissionAuditService,
    private readonly events:         CommissionEventBus,
  ) {}

  /* ════════════════════════════════════════════════════════
   * calculer() — point d'entrée principal
   ════════════════════════════════════════════════════════ */

  /**
   * Calcule et distribue les commissions pour une commande.
   *
   * @param context Données de la commande (IDs des acteurs + montants)
   * @param skipDoublonCheck true pour les re-calculs / corrections
   * @returns CommissionResult complet avec toutes les parts
   *
   * @throws CommissionErreur si une validation critique échoue
   */
  async calculer(
    context:          CommissionContext,
    skipDoublonCheck: boolean = false,
  ): Promise<CommissionResult> {

    this.logger.log(
      `[Engine] Calcul commande ${context.commandeNumero} (${context.commandeId}) ` +
      `— sousTotal: ${context.sousTotal} | fraisLiv: ${context.fraisLivraison} | total: ${context.total}`,
    );

    try {

      /* ── 1. Charger la règle active ─────────────────────── */

      const rule = await this.configSvc.getActiveRule();

      /* ── 2. Validation complète ─────────────────────────── */

      await this.validatorSvc.validerTout(context, rule, skipDoublonCheck);

      /* ── 3. Résoudre la hiérarchie des acteurs ──────────── */

      const hierarchy = await this.hierarchySvc.resolveAll(context, rule!);

      /* Avertissements non-bloquants sur la hiérarchie */
      this.validatorSvc.validerHierarchie(
        context.commandeId,
        hierarchy.entreprise.partenaireUserId,
        hierarchy.entreprise.adminUserId,
        'entreprise',
      );
      if (hierarchy.livreur) {
        this.validatorSvc.validerHierarchie(
          context.commandeId,
          hierarchy.livreur.partenaireUserId,
          hierarchy.livreur.adminUserId,
          'livreur',
        );
      }
      if (hierarchy.correspondant) {
        this.validatorSvc.validerHierarchie(
          context.commandeId,
          hierarchy.correspondant.partenaireUserId,
          hierarchy.correspondant.adminUserId,
          'correspondant',
        );
      }

      /* ── 4. Calcul mathématique pur ─────────────────────── */

      const amounts = this.calculatorSvc.calculer(
        context,
        rule!,
        hierarchy.entreprise,
        hierarchy.livreur,
        hierarchy.correspondant,
      );

      /* ── 5. Préparer la liste des parts ─────────────────── */

      const parts = this.distributorSvc.preparer(context, amounts, hierarchy);

      /* ── 6. Construire le snapshot d'audit ──────────────── */

      const snapshotTaux: CommissionSnapshot = {
        ruleId:                  rule?.id     ?? null,
        ruleVersion:             rule?.version ?? null,
        tauxCommissionProduit:   Number(rule?.tauxCommissionProduit   ?? 0),
        tauxEffectifProduit:     amounts.tauxEffectifProduit,
        planEntreprise:          hierarchy.entreprise.plan,
        planMultiplier:          hierarchy.entreprise.planMultiplier,
        ratioShopiProduit:       Number(rule?.ratioShopiProduit       ?? 0),
        ratioPartenaireProduit:  Number(rule?.ratioPartenaireProduit  ?? 0),
        ratioAdminProduit:       Number(rule?.ratioAdminProduit       ?? 0),
        tauxCommissionLivraison: Number(rule?.tauxCommissionLivraison ?? 0),
        ratioShopiLivraison:     Number(rule?.ratioShopiLivraison     ?? 0),
        ratioPartenaireLivraison:Number(rule?.ratioPartenaireLivraison ?? 0),
        ratioAdminLivraison:     Number(rule?.ratioAdminLivraison     ?? 0),
        calculatedAt:            new Date().toISOString(),
      };

      /* ── 7. Assembler le résultat ───────────────────────── */

      const result: CommissionResult = {
        rule:                    rule,
        snapshotTaux,
        tauxEffectifProduit:     amounts.tauxEffectifProduit,
        tauxEffectifLivraison:   amounts.tauxEffectifLivraison,
        commissionProduitBrute:  amounts.commissionProduitBrute,
        commissionLivraisonBrute:amounts.commissionLivraisonBrute,
        totalDistribue:          amounts.totalDistribue,
        parts,
        hierarchy,
        amounts,
        calculatedAt:            new Date(),
      };

      /* ── 8. Audit (non-bloquant) ────────────────────────── */

      this.auditSvc.logCalculReussi(context, result).catch(err =>
        this.logger.error('[Engine] Erreur audit calculReussi:', err),
      );

      /* ── 9. Événement asynchrone ────────────────────────── */

      this.events.emit(
        COMMISSION_EVENTS.CALCULATED,
        new CommissionCalculatedEvent(context, result),
      );

      this.logger.log(
        `[Engine] ✅ Commande ${context.commandeNumero} — ` +
        `${parts.length} parts | total: ${amounts.totalDistribue} GNF`,
      );

      return result;

    } catch (err) {

      /* ── Gestion des erreurs ────────────────────────────── */

      const commissionErreur =
        err instanceof CommissionErreur
          ? err
          : new CommissionErreur(
              CommissionErreurType.ERREUR_INTERNE,
              `Erreur inattendue dans CommissionEngine: ${(err as Error).message}`,
              { originalError: (err as Error).message },
            );

      this.logger.error(
        `[Engine] ❌ Commande ${context.commandeNumero} — Erreur: ${commissionErreur.message}`,
      );

      /* Audit erreur (non-bloquant) */
      this.auditSvc.logErreur(context, commissionErreur).catch(auditErr =>
        this.logger.error('[Engine] Erreur audit logErreur:', auditErr),
      );

      /* Événement erreur */
      this.events.emit(
        COMMISSION_EVENTS.FAILED,
        new CommissionFailedEvent(
          context,
          commissionErreur.type,
          commissionErreur.message,
          commissionErreur.context,
        ),
      );

      throw commissionErreur;
    }
  }

  /* ════════════════════════════════════════════════════════
   * Délégations vers les sous-services (API publique)
   ════════════════════════════════════════════════════════ */

  /**
   * Expose getActiveRule() pour les modules qui ont besoin
   * de connaître la règle sans lancer un calcul complet.
   */
  getActiveRule() {
    return this.configSvc.getActiveRule();
  }

  /**
   * Expose createOrUpdateRule() pour le module Admin.
   */
  createOrUpdateRule(changedByUserId: string, note?: string) {
    return this.configSvc.createOrUpdateRule(changedByUserId, note);
  }

  /**
   * Expose getRuleHistory() pour le dashboard admin.
   */
  getRuleHistory() {
    return this.configSvc.getRuleHistory();
  }
}
