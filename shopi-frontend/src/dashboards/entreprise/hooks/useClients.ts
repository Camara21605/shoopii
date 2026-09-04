/* ============================================================
 * FICHIER : hooks/useClients.ts
 *
 * RÔLE : Charge et filtre les clients de l'entreprise.
 *        Source : GET /dashboard/entreprise/clients
 *
 * DEUX SOURCES FUSIONNÉES CÔTÉ BACKEND :
 *   1. Acheteurs  → clients ayant passé au moins une commande
 *   2. Abonnés    → clients qui suivent la boutique (Follow)
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch, tokenStorage, BASE_URL } from '../../../shared/services/apiFetch';

/* ── Actions CRM ── */

export type CrmCampaignType = 'newsletter' | 'fidelite' | 'relance';

export interface CrmPreview {
  count:            number;
  sample:           { fullName: string; email: string }[];
  suggestedSubject: string;
  suggestedMessage: string;
}

export interface CrmSendResult {
  sent:   number;
  failed: number;
  total:  number;
}

/* ── Types ── */

export type ClientSegment = 'VIP' | 'Fidèle' | 'Régulier' | 'Nouveau' | 'Abonné';

export interface ClientRow {
  id:             string;
  userId:         string;
  fullName:       string;
  email:          string;
  profilePicture: string | null;
  totalOrders:    number;
  totalSpent:     number;    // GNF
  lastOrderAt:    string | null;
  isSuivi:        boolean;
  segment:        ClientSegment;
  createdAt:      string;
}

export interface ClientsStats {
  total:       number;
  buyers:      number;
  abonnes:     number;
  vip:         number;
  fideles:     number;
  reguliers:   number;
  nouveaux:    number;
  caTotal:     number;
  panierMoyen: number;
}

export interface ClientsResult {
  data:  ClientRow[];
  total: number;
  page:  number;
  pages: number;
  stats: ClientsStats;
}

export interface ClientsFilters {
  search?:    string;
  segment?:   ClientSegment | 'all';
  source?:    'buyers' | 'abonnes' | 'all';
  page?:      number;
  limit?:     number;
  sortBy?:    'totalSpent' | 'totalOrders' | 'lastOrderAt' | 'createdAt';
  sortOrder?: 'ASC' | 'DESC';
}

/* ── Hook principal ── */

export function useClients() {
  const [result,  setResult]  = useState<ClientsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [filters, setFilters] = useState<ClientsFilters>({
    segment:   'all',
    source:    'all',
    page:      1,
    limit:     20,
    sortBy:    'totalSpent',
    sortOrder: 'DESC',
  });

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    /* Construire les query params */
    const params = new URLSearchParams();
    if (filters.search?.trim()) params.set('search',    filters.search.trim());
    if (filters.segment && filters.segment !== 'all') params.set('segment', filters.segment);
    if (filters.source  && filters.source  !== 'all') params.set('source',  filters.source);
    if (filters.sortBy)    params.set('sortBy',    filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    params.set('page',  String(filters.page  ?? 1));
    params.set('limit', String(filters.limit ?? 20));

    apiFetch<ClientsResult>(`/dashboard/entreprise/clients?${params}`)
      .then(data => setResult(data))
      .catch(e => setError(e?.message ?? 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  /* Mettre à jour un filtre (reset page à 1) */
  const applyFilter = useCallback((patch: Partial<ClientsFilters>) => {
    setFilters(prev => ({ ...prev, ...patch, page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  /* ── Actions CRM — aperçu avant envoi, jamais d'envoi direct ── */
  const crmPreview = useCallback((type: CrmCampaignType) =>
    apiFetch<CrmPreview>(`/dashboard/entreprise/clients/crm/${type}/preview`), []);

  const crmSend = useCallback((type: CrmCampaignType, subject: string, message: string) =>
    apiFetch<CrmSendResult>(`/dashboard/entreprise/clients/crm/${type}/send`, {
      method: 'POST',
      body:   { subject, message },
    }), []);

  /* Téléchargement du rapport PDF — apiFetch ne gère pas les réponses
   * binaires (elle retomberait sur response.text(), qui corromprait le
   * PDF) : fetch direct avec les mêmes en-têtes d'authentification. */
  const downloadRapportPdf = useCallback(async (): Promise<void> => {
    const headers: Record<string, string> = {};
    const bearer = tokenStorage.get();
    if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

    const res = await fetch(`${BASE_URL}/dashboard/entreprise/clients/rapport/pdf`, {
      credentials: 'include',
      headers,
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);

    const blob = await res.blob();
    const a = Object.assign(document.createElement('a'), {
      href:     URL.createObjectURL(blob),
      download: 'rapport-clients.pdf',
    });
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  return {
    clients:  result?.data    ?? [],
    stats:    result?.stats   ?? null,
    total:    result?.total   ?? 0,
    pages:    result?.pages   ?? 0,
    loading,
    error,
    filters,
    applyFilter,
    setPage,
    reload: load,
    crmPreview,
    crmSend,
    downloadRapportPdf,
  };
}
