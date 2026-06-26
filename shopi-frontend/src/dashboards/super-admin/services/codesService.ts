// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/services/codesService.ts
// RÔLE    : Service frontend pour toutes les routes /codes/* du backend.
//           Consommé exclusivement par InvitationsSection.tsx.
//
//   POST /codes/invite          → sendInvitation()
//   POST /codes/bulk            → generateBulkCodes()
//   GET  /codes                 → listCodes()
//   GET  /codes/stats           → getStats()
//   POST /codes/:id/revoke      → revokeCode()
//   POST /codes/validate        → validateCode()  ← aussi dans RegisterForm
//
// NOTE : validateCode() est également utilisé depuis RegisterForm.tsx (module auth).
//        Il est exporté séparément pour permettre cet usage cross-module.
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch } from '../../../shared/services/apiFetch';
import type {
  InvitationCode,
  PaginatedCodes,
  CodeStatsPerRole,
  GenerateAndSendCodePayload,
  GenerateBulkCodesPayload,
  FilterCodesParams,
  ValidateCodePayload,
  ValidateCodeResult,
} from '../types/codes.types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — Mapping réponse backend → InvitationCode frontend
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le backend retourne { code, createdAt, expiresAt, usesCount, ... }
 * Le frontend attend { value, created, expires, uses, ... }
 * Ce mapper assure la cohérence sans modifier le composant existant.
 */
function mapCodeResponse(raw: Record<string, unknown>): InvitationCode {
  return {
    id:          raw.id          as string,
    value:       raw.code        as string,   // "code" → "value"
    role:        raw.role        as string,
    roleLabel:   raw.roleLabel   as string,
    status:      raw.status      as InvitationCode['status'],
    targetEmail: raw.targetEmail as string | null,
    created:     raw.createdAt   as string,   // "createdAt" → "created"
    expires:     raw.expiresAt   as string,   // "expiresAt" → "expires"
    uses:        raw.uses        as number,
    maxUses:     raw.maxUses     as number,
    note:        raw.note        as string | null,
    emailSent:   raw.emailSent   as boolean,
    usedBy:      raw.usedBy      as string | undefined,
    usedAt:      raw.usedAt      as string | undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /codes/invite — Invitation nominative avec email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère un code et envoie un email d'invitation.
 * Bouton "Envoyer l'invitation" dans InvitationsSection.tsx.
 */
export async function sendInvitation(
  payload: GenerateAndSendCodePayload,
): Promise<InvitationCode> {
  const raw = await apiFetch<Record<string, unknown>>('/codes/invite', {
    method: 'POST',
    body:   payload,
  });
  return mapCodeResponse(raw);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /codes/bulk — Génération en lot sans email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère N codes sans envoyer d'email.
 * Modal "✨ Générer" dans InvitationsSection.tsx.
 */
export async function generateBulkCodes(
  payload: GenerateBulkCodesPayload,
): Promise<InvitationCode[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/codes/bulk', {
    method: 'POST',
    body:   payload,
  });
  return raw.map(mapCodeResponse);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /codes — Liste paginée avec filtres
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récupère la liste paginée des codes d'invitation.
 * Appelé au montage et à chaque changement de filtre dans InvitationsSection.tsx.
 */
export async function listCodes(
  filters: FilterCodesParams = {},
): Promise<PaginatedCodes> {
  const raw = await apiFetch<{
    data:  Record<string, unknown>[];
    total: number;
    page:  number;
    pages: number;
  }>('/codes', {
    method: 'GET',
    params: filters as Record<string, string | number | boolean | undefined>,
  });

  return {
    data:  raw.data.map(mapCodeResponse),
    total: raw.total,
    page:  raw.page,
    pages: raw.pages,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /codes/stats — Statistiques par rôle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récupère les métriques agrégées par rôle pour RoleStatsPanel.
 */
export async function getStats(): Promise<CodeStatsPerRole[]> {
  return apiFetch<CodeStatsPerRole[]>('/codes/stats');
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /codes/:id/revoke — Révocation manuelle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Révoque un code valide. Action irréversible.
 * Bouton "🚫 Révoquer" dans InvitationsSection.tsx.
 */
export async function revokeCode(id: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/codes/${id}/revoke`, {
    method: 'POST',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /codes/validate — Vérification publique (aussi utilisée par RegisterForm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Vérifie qu'un code est valide SANS le consommer.
 * Appelé en temps réel depuis CodeBlock.tsx dans RegisterForm.tsx.
 * Route publique (pas de JWT requis).
 */
export async function validateCode(
  payload: ValidateCodePayload,
): Promise<ValidateCodeResult> {
  return apiFetch<ValidateCodeResult>('/codes/validate', {
    method: 'POST',
    body:   payload,
    public: true, // Semi-publique : accessible sans JWT
  });
}

// ── Export groupé ─────────────────────────────────────────────────────────────
export const codesService = {
  sendInvitation,
  generateBulkCodes,
  listCodes,
  getStats,
  revokeCode,
  validateCode,
};