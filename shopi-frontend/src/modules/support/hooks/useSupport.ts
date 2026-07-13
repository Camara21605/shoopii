/* ============================================================
 * FICHIER  : src/modules/support/hooks/useSupport.ts
 * MODULE   : Support
 * ROLE     : Hooks React pour la gestion des tickets de support.
 *
 * RESPONSABILITES :
 *   - useSupportList : liste paginée + filtre statut, rechargeable.
 *   - useTicketDetail : détail d'un ticket (messages + pièces jointes).
 *   - Exposer `refresh` pour forcer le rechargement après mutation.
 *
 * DEPENDANCES :
 *   - supportApi (src/modules/support/services/support.api.ts)
 *
 * AUTEUR : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-03
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';
import { supportApi } from '../services/support.api';
import type { SupportTicketSummary, SupportTicketDetail } from '../services/support.api';

export function useSupportList(statusFilter?: string) {
  const [tickets, setTickets]  = useState<SupportTicketSummary[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supportApi.listTickets({ status: statusFilter, page });
      setTickets(res.data);
      setTotal(res.total);
    } catch (e: any) {
      setError(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => { load(); }, [load]);

  return { tickets, total, page, setPage, loading, error, refresh: load };
}

export function useTicketDetail(id: string | undefined) {
  const [detail, setDetail]   = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await supportApi.getTicket(id);
      setDetail(res);
    } catch (e: any) {
      setError(e.message ?? 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return { detail, loading, error, refresh: load };
}
