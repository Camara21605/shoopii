// ─────────────────────────────────────────────────────────────────────────────
// FICHIER : src/dashboards/super-admin/hooks/useInvitations.ts
// RÔLE    : Hook React qui gère tout l'état et la logique de InvitationsSection.tsx.
//           Remplace les appels mockDB par de vraies requêtes API.
//
// USAGE dans InvitationsSection.tsx :
//   const inv = useInvitations(toast);
//   inv.codes           → liste des codes affichés
//   inv.stats           → stats par rôle
//   inv.loading         → spinner
//   inv.handleGenerate  → génération en lot
//   inv.handleRevoke    → révocation
//   inv.handleInvite    → invitation nominative
//   inv.refresh()       → recharge depuis l'API
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { codesService } from '../services/codesService';
import { ApiError } from '../../../shared/services/apiFetch';
import type {
  InvitationCode,
  CodeStatsPerRole,
  FilterCodesParams,
  GenerateBulkCodesPayload,
  GenerateAndSendCodePayload,
  InvitableRole,
} from '../types/codes.types';

// ── Types exposés par le hook ─────────────────────────────────────────────────
export interface UseInvitationsReturn {
  // Données
  codes:        InvitationCode[];
  stats:        CodeStatsPerRole[];
  total:        number;
  pages:        number;

  // État UI
  loading:      boolean;
  statsLoading: boolean;
  error:        string | null;

  // Filtres et pagination
  filters:      FilterCodesParams;
  setFilters:   (f: Partial<FilterCodesParams>) => void;

  // Actions
  refresh:             () => Promise<void>;
  handleGenerate:      (payload: GenerateBulkCodesPayload) => Promise<InvitationCode[]>;
  handleInvite:        (payload: GenerateAndSendCodePayload) => Promise<InvitationCode>;
  handleRevoke:        (id: string) => Promise<void>;
  handleQuickCreate:   (role: InvitableRole) => Promise<InvitationCode[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useInvitations(
  toast: (type: string, msg: string) => void,
): UseInvitationsReturn {

  // ── État ───────────────────────────────────────────────────────────────────
  const [codes,        setCodes]        = useState<InvitationCode[]>([]);
  const [stats,        setStats]        = useState<CodeStatsPerRole[]>([]);
  const [total,        setTotal]        = useState(0);
  const [pages,        setPages]        = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [filters,      setFiltersState] = useState<FilterCodesParams>({
    page:  1,
    limit: 20,
  });

  // ── Chargement des codes ───────────────────────────────────────────────────
  const loadCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await codesService.listCodes(filters);
      setCodes(result.data);
      setTotal(result.total);
      setPages(result.pages);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Erreur de chargement des codes.';
      setError(msg);
      toast('error', `❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // ── Chargement des stats ───────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await codesService.getStats();
      setStats(result);
    } catch {
      // Stats non critiques — on ne bloque pas l'UI
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Chargement initial et à chaque changement de filtres ──────────────────
  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // ── Mise à jour des filtres (réinitialise la page) ─────────────────────────
  const setFilters = useCallback((newFilters: Partial<FilterCodesParams>) => {
    setFiltersState(prev => ({
      ...prev,
      ...newFilters,
      // Retour à la page 1 si le filtre change (sauf changement de page explicite)
      page: 'page' in newFilters ? newFilters.page : 1,
    }));
  }, []);

  // ── Rafraîchissement manuel ────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([loadCodes(), loadStats()]);
  }, [loadCodes, loadStats]);

  // ── Génération en lot ──────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (
    payload: GenerateBulkCodesPayload,
  ): Promise<InvitationCode[]> => {
    const newCodes = await codesService.generateBulkCodes(payload);
    toast('success', `✅ ${newCodes.length} code(s) générés avec succès`);
    // Ajoute les nouveaux codes en tête de liste localement (optimistic update)
    setCodes(prev => [...newCodes, ...prev]);
    // Recharge les stats en arrière-plan
    loadStats();
    return newCodes;
  }, [toast, loadStats]);

  // ── Invitation nominative ──────────────────────────────────────────────────
  const handleInvite = useCallback(async (
    payload: GenerateAndSendCodePayload,
  ): Promise<InvitationCode> => {
    const newCode = await codesService.sendInvitation(payload);
    toast('success', `📧 Invitation envoyée à ${payload.targetEmail}`);
    setCodes(prev => [newCode, ...prev]);
    loadStats();
    return newCode;
  }, [toast, loadStats]);

  // ── Révocation ─────────────────────────────────────────────────────────────
  const handleRevoke = useCallback(async (id: string): Promise<void> => {
    await codesService.revokeCode(id);
    toast('success', '🚫 Code révoqué');
    // Met à jour le statut localement sans recharger toute la liste
    setCodes(prev =>
      prev.map(c => c.id === id ? { ...c, status: 'revoked' as const } : c),
    );
    loadStats();
  }, [toast, loadStats]);

  // ── Création rapide (1 code, 30 jours) ────────────────────────────────────
  const handleQuickCreate = useCallback(async (
    role: InvitableRole,
  ): Promise<InvitationCode[]> => {
    return handleGenerate({
      targetRole:   role,
      quantity:     1,
      validityDays: 30,
      maxUses:      1,
    });
  }, [handleGenerate]);

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    codes,
    stats,
    total,
    pages,
    loading,
    statsLoading,
    error,
    filters,
    setFilters,
    refresh,
    handleGenerate,
    handleInvite,
    handleRevoke,
    handleQuickCreate,
  };
}