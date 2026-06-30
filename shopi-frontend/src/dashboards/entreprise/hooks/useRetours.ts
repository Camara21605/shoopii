/* ============================================================
 * FICHIER : hooks/useRetours.ts
 * RÔLE    : Chargement + actions des demandes de retour.
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

/* ── Types ── */

export type ReturnReason =
  | 'defective' | 'not_matching' | 'change_of_mind'
  | 'wrong_item' | 'damaged' | 'expired' | 'other';

export type ReturnStatus =
  | 'pending' | 'accepted' | 'refused' | 'in_transit'
  | 'received' | 'refunded' | 'exchanged' | 'closed';

export type ReturnType   = 'refund' | 'exchange' | 'repair' | 'credit';
export type ReturnPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ReturnSummary {
  id:             string;
  reference:      string;
  commandeId:     string | null;
  productName:    string;
  productImage:   string | null;
  productVariant: string | null;
  quantity:       number;
  reason:         ReturnReason;
  returnType:     ReturnType;
  status:         ReturnStatus;
  priority:       ReturnPriority;
  montantDemande: number;
  montantAccorde: number | null;
  evidenceCount:  number;
  clientName:     string;
  clientAvatar:   string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface ReturnEvidence {
  id:          string;
  url:         string;
  type:        'image' | 'video' | 'document';
  filename:    string | null;
  size:        number | null;
  uploadedBy:  string;
  createdAt:   string;
}

export interface ReturnHistoryEntry {
  id:        string;
  action:    string;
  metadata:  Record<string, unknown> | null;
  actorName: string | null;
  actorRole: string;
  createdAt: string;
}

export interface ReturnDetail extends ReturnSummary {
  description:  string;
  noteInterne:  string | null;
  noteClient:   string | null;
  acceptedAt:   string | null;
  refusedAt:    string | null;
  receivedAt:   string | null;
  refundedAt:   string | null;
  evidences:    ReturnEvidence[];
  history:      ReturnHistoryEntry[];
  commande:     { id: string; numero: string; total: number; createdAt: string } | null;
}

export interface ReturnStats {
  total:                  number;
  today:                  number;
  thisWeek:               number;
  thisMonth:              number;
  pending:                number;
  accepted:               number;
  refused:                number;
  refunded:               number;
  totalMontantRembourse:  number;
  tauxAcceptation:        number;
  delaiMoyenHeures:       number;
  topMotifs:              { reason: ReturnReason; count: number; percentage: number }[];
  topProduits:            { productName: string; count: number; montantTotal: number }[];
  evolutionMensuelle:     { month: string; total: number; accepted: number; refused: number }[];
}

export interface ReturnsFilters {
  status?:   ReturnStatus;
  reason?:   ReturnReason;
  priority?: ReturnPriority;
  search?:   string;
  dateFrom?: string;
  dateTo?:   string;
  page?:     number;
  limit?:    number;
  sortBy?:   string;
  sortOrder?: 'ASC' | 'DESC';
}

/* ── Hook ── */

export function useRetours() {
  const [returns, setReturns]     = useState<ReturnSummary[]>([]);
  const [stats,   setStats]       = useState<ReturnStats | null>(null);
  const [total,   setTotal]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error,   setError]       = useState<string | null>(null);
  const [filters, setFilters]     = useState<ReturnsFilters>({ page: 1, limit: 20 });

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    apiFetch<ReturnStats>('/dashboard/entreprise/returns/stats')
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const loadReturns = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    apiFetch<{ data: ReturnSummary[]; total: number; page: number; pages: number }>(
      `/dashboard/entreprise/returns?${params.toString()}`,
    )
      .then(d => { setReturns(d.data); setTotal(d.total); })
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadReturns(); }, [loadReturns]);

  const applyFilter = useCallback((patch: Partial<ReturnsFilters>) => {
    setFilters(prev => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  const accept = useCallback(async (id: string, montantAccorde: number, noteClient?: string) => {
    const updated = await apiFetch<ReturnDetail>(
      `/dashboard/entreprise/returns/${id}/accept`,
      { method: 'PATCH', body: { montantAccorde, noteClient } },
    );
    setReturns(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    loadStats();
    return updated;
  }, [loadStats]);

  const refuse = useCallback(async (id: string, noteClient?: string) => {
    const updated = await apiFetch<ReturnDetail>(
      `/dashboard/entreprise/returns/${id}/refuse`,
      { method: 'PATCH', body: { noteClient } },
    );
    setReturns(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    loadStats();
    return updated;
  }, [loadStats]);

  const refund = useCallback(async (id: string, montantAccorde?: number) => {
    const updated = await apiFetch<ReturnDetail>(
      `/dashboard/entreprise/returns/${id}/refund`,
      { method: 'PATCH', body: { montantAccorde } },
    );
    setReturns(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    loadStats();
    return updated;
  }, [loadStats]);

  const addNote = useCallback(async (id: string, content: string) => {
    return apiFetch(`/dashboard/entreprise/returns/${id}/notes`, {
      method: 'POST', body: { content },
    });
  }, []);

  const updatePriority = useCallback(async (id: string, priority: ReturnPriority) => {
    await apiFetch(`/dashboard/entreprise/returns/${id}/priority`, {
      method: 'PATCH', body: { priority },
    });
    setReturns(prev => prev.map(r => r.id === id ? { ...r, priority } : r));
  }, []);

  return {
    returns, stats, total, loading, statsLoading, error,
    filters, setPage, applyFilter,
    accept, refuse, refund, addNote, updatePriority,
    reload: loadReturns,
  };
}

/* ── Hook détail ── */
export function useRetourDetail(id: string | null) {
  const [detail,  setDetail]  = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiFetch<ReturnDetail>(`/dashboard/entreprise/returns/${id}`)
      .then(d => setDetail(d))
      .catch(e => setError(e?.message ?? 'Erreur'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { detail, loading, error, reload: load, setDetail };
}
