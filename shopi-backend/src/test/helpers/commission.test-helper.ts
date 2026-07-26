/* ============================================================
 * FICHIER : src/test/helpers/commission.test-helper.ts
 *
 * RÔLE
 * ─────────────────────────────────────────────────────────────
 * Factories de données de test pour le moteur de commissions.
 * Utilisé dans tous les tests unitaires impliquant
 * CommissionCalculatorService, CommissionEngine, etc.
 *
 * CONVENTIONS
 * ─────────────────────────────────────────────────────────────
 *   - makeCommissionRule()      → CommissionRule en base active
 *   - makeCommissionContext()   → Commande type 50 000 + 5 000 GNF
 *   - makeEntrepriseHierarchy() → Hiérarchie STANDARD sans partenaire
 *   - makeLivraisonHierarchy()  → Hiérarchie livreur standard
 * ============================================================ */

import { CommissionRule } from '../../database/entities/paiement/commission-rule.entity';
import {
  CommissionContext,
  ActeurEntrepriseHierarchy,
  ActeurLivraisonHierarchy,
} from '../../modules/commission/types/commission.types';

/* ============================================================
 * FACTORY — COMMISSION RULE
 * ============================================================ */

export function makeCommissionRule(overrides: Partial<CommissionRule> = {}): CommissionRule {
  const rule = new CommissionRule();
  rule.id       = overrides.id       ?? 'rule-uuid-001';
  rule.version  = overrides.version  ?? 1;
  rule.isActive = overrides.isActive ?? true;

  /* Taux produit : 10% réparti 60/20/20 */
  rule.tauxCommissionProduit   = overrides.tauxCommissionProduit   ?? 10;
  rule.ratioShopiProduit       = overrides.ratioShopiProduit       ?? 60;
  rule.ratioPartenaireProduit  = overrides.ratioPartenaireProduit  ?? 20;
  rule.ratioAdminProduit       = overrides.ratioAdminProduit       ?? 20;

  /* Taux livraison : 15% réparti 50/30/20 */
  rule.tauxCommissionLivraison  = overrides.tauxCommissionLivraison  ?? 15;
  rule.ratioShopiLivraison      = overrides.ratioShopiLivraison      ?? 50;
  rule.ratioPartenaireLivraison = overrides.ratioPartenaireLivraison ?? 30;
  rule.ratioAdminLivraison      = overrides.ratioAdminLivraison      ?? 20;

  /* Multiplicateurs plan (Standard / Pro / Premium) */
  rule.planMultiplierStandard = overrides.planMultiplierStandard ?? 1.0;
  rule.planMultiplierPro      = overrides.planMultiplierPro      ?? 1.2;
  rule.planMultiplierPremium  = overrides.planMultiplierPremium  ?? 0.85;

  rule.createdByUserId = overrides.createdByUserId ?? 'admin-uuid-001';
  rule.note            = overrides.note            ?? 'Règle de test';
  rule.createdAt       = overrides.createdAt       ?? new Date('2025-01-01');

  return rule;
}

/* ============================================================
 * FACTORY — COMMISSION CONTEXT
 * ============================================================ */

export function makeCommissionContext(
  overrides: Partial<CommissionContext> = {},
): CommissionContext {
  return {
    commandeId:      overrides.commandeId      ?? 'cmd-uuid-001',
    commandeNumero:  overrides.commandeNumero  ?? 'CMD-2025-001',
    companyId:       overrides.companyId       ?? 'company-uuid-001',
    livreurId:       overrides.livreurId       ?? 'livr-uuid-001',
    correspondantId: overrides.correspondantId ?? null,
    sousTotal:       overrides.sousTotal       ?? 50_000,
    fraisLivraison:  overrides.fraisLivraison  ?? 5_000,
    total:           overrides.total           ?? 55_000,
    devise:          overrides.devise          ?? 'GNF',
  };
}

/* ============================================================
 * FACTORY — HIÉRARCHIE ENTREPRISE
 * ============================================================ */

export function makeEntrepriseHierarchy(
  overrides: Partial<ActeurEntrepriseHierarchy> = {},
): ActeurEntrepriseHierarchy {
  return {
    profileId:           overrides.profileId           ?? 'company-profile-001',
    userId:              overrides.userId              ?? 'ent-uuid-001',
    nom:                 overrides.nom                 ?? 'Boutique Test',
    partenaireProfileId: overrides.partenaireProfileId ?? null,
    partenaireUserId:    overrides.partenaireUserId    ?? null,
    partenaireNom:       overrides.partenaireNom       ?? null,
    adminProfileId:      overrides.adminProfileId      ?? null,
    adminUserId:         overrides.adminUserId         ?? null,
    adminNom:            overrides.adminNom            ?? null,
    plan:                overrides.plan                ?? 'STANDARD',
    planMultiplier:      overrides.planMultiplier      ?? 1.0,
  };
}

/* ============================================================
 * FACTORY — HIÉRARCHIE LIVRAISON
 * ============================================================ */

export function makeLivraisonHierarchy(
  overrides: Partial<ActeurLivraisonHierarchy> = {},
): ActeurLivraisonHierarchy {
  return {
    profileId:           overrides.profileId           ?? 'livr-profile-001',
    userId:              overrides.userId              ?? 'livr-uuid-001',
    nom:                 overrides.nom                 ?? 'Livreur Test',
    partenaireProfileId: overrides.partenaireProfileId ?? null,
    partenaireUserId:    overrides.partenaireUserId    ?? null,
    partenaireNom:       overrides.partenaireNom       ?? null,
    adminProfileId:      overrides.adminProfileId      ?? null,
    adminUserId:         overrides.adminUserId         ?? null,
    adminNom:            overrides.adminNom            ?? null,
  };
}
