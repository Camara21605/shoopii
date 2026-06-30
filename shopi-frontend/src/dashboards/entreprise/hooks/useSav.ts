/* ============================================================
 * FICHIER : hooks/useSav.ts
 * RÔLE    : Chargement + actions des tickets SAV.
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import type { ReturnPriority } from './useRetours';

export type SavStatus =
  | 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';

export interface SavMessage {
  id:          string;
  content:     string;
  senderRole:  'client' | 'enterprise' | 'admin';
  senderId:    string;
  senderName:  string;
  senderAvatar: string | null;
  attachments: { url: string; name: string; type: string; size?: number }[] | null;
  isRead:      boolean;
  createdAt:   string;
}

export interface SavTicketSummary {
  id:              string;
  reference:       string;
  subject:         string;
  status:          SavStatus;
  priority:        ReturnPriority;
  messageCount:    number;
  unreadCount:     number;
  productName:     string | null;
  assigneeId:      string | null;
  clientName:      string;
  firstResponseAt: string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface SavTicketDetail extends SavTicketSummary {
  firstMessage:   string;
  commandeNumero: string | null;
  messages:       SavMessage[];
  resolvedAt:     string | null;
  closedAt:       string | null;
}

export interface SavStats {
  total:              number;
  open:               number;
  inProgress:         number;
  waitingClient:      number;
  resolved:           number;
  closed:             number;
  avgResponseMinutes: number;
}

export interface SavFilters {
  status?:   SavStatus;
  priority?: ReturnPriority;
  search?:   string;
  page?:     number;
  limit?:    number;
}

export function useSav() {
  const [tickets,     setTickets]     = useState<SavTicketSummary[]>([]);
  const [stats,       setStats]       = useState<SavStats | null>(null);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(false);
  const [statsLoading,setStatsLoading]= useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [filters,     setFilters]     = useState<SavFilters>({ page: 1, limit: 20 });

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    apiFetch<SavStats>('/dashboard/entreprise/sav/stats')
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const loadTickets = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v));
    });
    apiFetch<{ data: SavTicketSummary[]; total: number }>(
      `/dashboard/entreprise/sav?${params.toString()}`,
    )
      .then(d => { setTickets(d.data); setTotal(d.total); })
      .catch(e => setError(e?.message ?? 'Erreur'))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadTickets(); }, [loadTickets]);

  const applyFilter = (patch: Partial<SavFilters>) =>
    setFilters(prev => ({ ...prev, ...patch, page: 1 }));

  const setPage = (page: number) =>
    setFilters(prev => ({ ...prev, page }));

  const reply = useCallback(async (ticketId: string, content: string) => {
    const msg = await apiFetch<SavMessage>(
      `/dashboard/entreprise/sav/${ticketId}/reply`,
      { method: 'POST', body: { content } },
    );
    loadTickets();
    return msg;
  }, [loadTickets]);

  const close = useCallback(async (ticketId: string) => {
    await apiFetch(`/dashboard/entreprise/sav/${ticketId}/close`, { method: 'PATCH' });
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'closed' as SavStatus } : t));
    loadStats();
  }, [loadStats]);

  const resolve = useCallback(async (ticketId: string) => {
    await apiFetch(`/dashboard/entreprise/sav/${ticketId}/resolve`, { method: 'PATCH' });
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: 'resolved' as SavStatus } : t));
    loadStats();
  }, [loadStats]);

  return {
    tickets, stats, total, loading, statsLoading, error,
    filters, setPage, applyFilter,
    reply, close, resolve,
    reload: loadTickets,
  };
}

export function useSavDetail(id: string | null) {
  const [detail,  setDetail]  = useState<SavTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<SavTicketDetail>(`/dashboard/entreprise/sav/${id}`)
      .then(d => setDetail(d))
      .catch(e => setError(e?.message ?? 'Erreur'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const addMessage = (msg: SavMessage) => {
    setDetail(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
  };

  return { detail, loading, error, reload: load, addMessage, setDetail };
}
