/* ================================================================
 * FICHIER : src/shared/services/client-returns.api.ts
 *
 * Appels API pour les demandes de retour côté client.
 *
 * ENDPOINTS :
 *   POST /client/returns            → créer une demande de retour
 *   GET  /client/returns            → mes demandes de retour
 *   GET  /client/returns/:id        → détail d'une de mes demandes
 *   POST /client/returns/:id/upload → joindre une preuve (photo/vidéo/doc)
 * ================================================================ */

import { apiFetch } from './apiFetch';

export type ReturnReason =
  | 'defective' | 'not_matching' | 'change_of_mind'
  | 'wrong_item' | 'damaged' | 'expired' | 'other';

export type ReturnStatus =
  | 'pending' | 'accepted' | 'refused'
  | 'in_transit' | 'received' | 'refunded' | 'exchanged' | 'closed';

export interface CreateReturnPayload {
  commandeId:  string;
  productId:   string;
  quantity:    number;
  reason:      ReturnReason;
  description: string;
}

export interface ClientReturnApi {
  id:             string;
  reference:      string;
  commandeId:     string;
  productId:      string | null;
  productName:    string;
  productImage:   string | null;
  productVariant: string | null;
  quantity:       number;
  reason:         ReturnReason;
  returnType:     string;
  status:         ReturnStatus;
  montantDemande: number;
  montantAccorde: number | null;
  noteClient:     string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface ClientReturnDetailApi extends ClientReturnApi {
  description: string;
  history: { action: string; actorRole: string; createdAt: string }[];
  evidences: { id: string; url: string; type: string; createdAt: string }[];
}

export function createReturnRequest(payload: CreateReturnPayload): Promise<ClientReturnApi> {
  return apiFetch<ClientReturnApi>('/client/returns', { method: 'POST', body: payload });
}

export function fetchMesRetours(params?: { status?: ReturnStatus; page?: number; limit?: number }) {
  return apiFetch<{ data: ClientReturnApi[]; total: number; page: number; pages: number }>(
    '/client/returns', { params },
  );
}

export function fetchRetourDetail(id: string): Promise<ClientReturnDetailApi> {
  return apiFetch<ClientReturnDetailApi>(`/client/returns/${id}`);
}
