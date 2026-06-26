/* ============================================================
 * FICHIER : src/services/api/correspondants.api.ts
 *
 * RÔLE    : Couche API côté frontend — fait le lien entre
 *           CorrespondantsPage.tsx et les routes NestJS backend.
 *
 * UTILISE : apiFetch.ts (tokenStorage + gestion erreurs JWT)
 *
 * ─── CORRESPONDANCE ROUTES ───────────────────────────────────
 *
 *  getStats()              → GET  /correspondants/stats
 *  getZones()              → GET  /correspondants/zones
 *  getActiviteRecente()    → GET  /correspondants/activite-recente
 *  getAll(filters)         → GET  /correspondants?type=&status=&search=
 *  getOne(id)              → GET  /correspondants/:id
 *  update(id, dto)         → PATCH /correspondants/:id
 *  suspendre(id, raison?)  → PATCH /correspondants/:id/suspendre
 *  reactiver(id)           → PATCH /correspondants/:id/reactiver
 *  valider(id)             → PATCH /correspondants/:id/valider
 *  inviter(dto)            → POST  /correspondants/inviter
 *  contacter(id, dto)      → POST  /correspondants/:id/contacter
 *
 * ─── UTILISATION DANS CorrespondantsPage.tsx ─────────────────
 *
 *  import { correspondantsApi } from '@/services/api/correspondants.api';
 *
 *  // Au montage du composant
 *  const [stats, zones, data] = await Promise.all([
 *    correspondantsApi.getStats(),
 *    correspondantsApi.getZones(),
 *    correspondantsApi.getAll(),
 *  ]);
 *
 *  // Inviter
 *  const result = await correspondantsApi.inviter({ fullName, email, type });
 *  // result.code = "4892-317-056" → affiché dans ModalInviter étape 3
 *
 * ============================================================ */

import { apiFetch } from '../apiFetch';

// ─────────────────────────────────────────────────────────────
// TYPES — alignés sur les interfaces du backend
// ─────────────────────────────────────────────────────────────

export type CorrespondantStatus = 'active' | 'pending' | 'suspended';
export type CorrespondantType   = 'relais' | 'entrepot' | 'export' | 'principal';

/** Format de réponse d'un correspondant — aligné sur CorrespondantResponse backend */
export interface CorrespondantResponse {
  id:            string;
  fullName:      string;
  email:         string;
  phone:         string | null;
  ville:         string;
  quartier:      string;
  adresse:       string | null;
  type:          CorrespondantType;
  status:        CorrespondantStatus;
  avatarEmoji:   string;
  totalMissions: number;
  thisMonth:     number;
  averageRating: number;
  zone:          string | null;
  joinedAt:      string;
  lastActivity:  string;
  lastActivityAt:string;
  companyId:     string | null;
  userId:        string;
}

/** KPI cards du haut de page */
export interface CorrespondantStats {
  total:     number;
  actifs:    number;
  thisMonth: number;
  villes:    number;
  enAttente: number;
}

/** Barre de couverture du panneau latéral */
export interface ZoneStat {
  zone:   string;
  orders: number;
  pct:    number;
  color:  string;
}

/** Réponse liste avec pagination */
export interface CorrespondantListResponse {
  data:  CorrespondantResponse[];
  total: number;
  page:  number;
  pages: number;
}

/** Résultat d'une invitation — affiché dans ModalInviter étape 3 */
export interface InvitationResponse {
  code:      string;   // format "XXXX-XXX-XXX" — à copier par l'entreprise
  email:     string;
  fullName:  string;
  expiresAt: string;
  codeId:    string;
}

/** Filtres GET /correspondants */
export interface FilterCorrespondantsDto {
  type?:    CorrespondantType;
  status?:  CorrespondantStatus;
  search?:  string;
  page?:    number;
  limit?:   number;
}

/** Corps POST /correspondants/inviter (ModalInviter étape 1) */
export interface InviterDto {
  fullName:  string;
  email:     string;
  type:      CorrespondantType;
  ville?:    string;
  quartier?: string;
  message?:  string;
}

/** Corps POST /correspondants/:id/contacter (ModalContacter) */
export interface ContacterDto {
  sujet:   string;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// API CORRESPONDANTS
// ─────────────────────────────────────────────────────────────

export const correspondantsApi = {

  // ── GET /correspondants/stats ─────────────────────────────
  // Alimente les 4 KPI cards du haut de CorrespondantsPage.tsx
  // Remplace : stats = useMemo(() => ({ total: ... }), [correspondants])
  getStats(): Promise<CorrespondantStats> {
    return apiFetch<CorrespondantStats>('/correspondants/stats');
  },

  // ── GET /correspondants/zones ─────────────────────────────
  // Alimente les barres "Couverture par zone" du panneau latéral
  // Remplace : const ZONES_PERF = [ { zone: 'Conakry Centre'… } ]
  getZones(): Promise<ZoneStat[]> {
    return apiFetch<ZoneStat[]>('/correspondants/zones');
  },

  // ── GET /correspondants/activite-recente ──────────────────
  // Alimente le bloc "Activité récente" du panneau latéral
  // Remplace : correspondants.slice(0, 5)
  getActiviteRecente(): Promise<CorrespondantResponse[]> {
    return apiFetch<CorrespondantResponse[]>('/correspondants/activite-recente');
  },

  // ── GET /correspondants ───────────────────────────────────
  // Alimente la grille et la liste de CorrespondantsPage.tsx
  // Remplace : const MOCK_CORRESPONDANTS = [ … ]
  getAll(filters?: FilterCorrespondantsDto): Promise<CorrespondantListResponse> {
    return apiFetch<CorrespondantListResponse>('/correspondants', {
      params: {
        type:   filters?.type,
        status: filters?.status,
        search: filters?.search,
        page:   filters?.page,
        limit:  filters?.limit,
      },
    });
  },

  // ── GET /correspondants/:id ───────────────────────────────
  // Alimente ModalProfil (profil complet, KPIs, note)
  getOne(id: string): Promise<CorrespondantResponse> {
    return apiFetch<CorrespondantResponse>(`/correspondants/${id}`);
  },

  // ── PATCH /correspondants/:id ─────────────────────────────
  update(id: string, dto: Partial<InviterDto>): Promise<CorrespondantResponse> {
    return apiFetch<CorrespondantResponse>(`/correspondants/${id}`, {
      method: 'PATCH',
      body: dto,
    });
  },

  // ── PATCH /correspondants/:id/suspendre ───────────────────
  // Bouton "Confirmer" dans ModalSuspendre
  // Remplace : setCorrespondants(prev => prev.map(...))
  suspendre(id: string, raison?: string): Promise<CorrespondantResponse> {
    return apiFetch<CorrespondantResponse>(`/correspondants/${id}/suspendre`, {
      method: 'PATCH',
      body: { raison },
    });
  },

  // ── PATCH /correspondants/:id/reactiver ───────────────────
  reactiver(id: string): Promise<CorrespondantResponse> {
    return apiFetch<CorrespondantResponse>(`/correspondants/${id}/reactiver`, {
      method: 'PATCH',
    });
  },

  // ── PATCH /correspondants/:id/valider ─────────────────────
  // Bouton "Valider les en attente" dans Actions rapides
  valider(id: string): Promise<CorrespondantResponse> {
    return apiFetch<CorrespondantResponse>(`/correspondants/${id}/valider`, {
      method: 'PATCH',
    });
  },

  // ── POST /correspondants/inviter ──────────────────────────
  // Bouton "Envoyer l'invitation" dans ModalInviter étape 2
  //
  // IMPORTANT :
  //   Le code d'invitation est GÉNÉRÉ côté backend (pas côté frontend).
  //   La réponse contient { code: "XXXX-XXX-XXX", expiresAt, … }
  //   → afficher result.code dans l'étape 3 de ModalInviter
  //   → supprimer la fonction genererCode() du frontend
  inviter(dto: InviterDto): Promise<InvitationResponse> {
    return apiFetch<InvitationResponse>('/correspondants/inviter', {
      method: 'POST',
      body: dto,
    });
  },

  // ── POST /correspondants/:id/contacter ────────────────────
  // Bouton "Envoyer" dans ModalContacter
  // Remplace : setTimeout(() => { pop('✅ Message envoyé', 's'); }, 1000)
  contacter(id: string, dto: ContacterDto): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/correspondants/${id}/contacter`, {
      method: 'POST',
      body: dto,
    });
  },
};