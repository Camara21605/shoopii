/* ============================================================
 * FICHIER : src/shared/services/api/livreurs.api.ts
 *
 * RÔLE    : Couche API côté frontend — fait le lien entre
 *           LivreursPage.tsx et les routes NestJS backend.
 *
 * UTILISE : apiFetch.ts (tokenStorage + gestion erreurs JWT)
 *
 * ─── CORRESPONDANCE ROUTES ───────────────────────────────────
 *
 *  getStats()              → GET  /livreurs/stats
 *  getZones()              → GET  /livreurs/zones
 *  getActiviteRecente()    → GET  /livreurs/activite-recente
 *  getAll(filters)         → GET  /livreurs?availability=&status=&search=
 *  getOne(id)              → GET  /livreurs/:id
 *  update(id, dto)         → PATCH /livreurs/:id
 *  suspendre(id, raison?)  → PATCH /livreurs/:id/suspendre
 *  reactiver(id)           → PATCH /livreurs/:id/reactiver
 *  valider(id)             → PATCH /livreurs/:id/valider
 *  inviter(dto)            → POST  /livreurs/inviter
 *  contacter(id, dto)      → POST  /livreurs/:id/contacter
 *
 * ============================================================ */

import { apiFetch } from '../apiFetch';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type Availability  = 'available' | 'on_delivery' | 'offline';
export type LivreurStatus = 'active' | 'pending' | 'suspended' | 'banned';
export type VehicleType   = 'moto' | 'voiture' | 'velo' | 'tricycle' | 'camion' | 'pieton';

export interface LivreurResponse {
  id:                   string;
  fullName:             string;
  email:                string;
  phone:                string | null;
  zone:                 string | null;
  vehicleType:          VehicleType;
  vehiclePlate:         string | null;
  vehicleEmoji:         string;
  status:               LivreurStatus;
  availability:         Availability;
  avatarEmoji:          string;
  averageRating:        number;
  totalDeliveries:      number;
  successfulDeliveries: number;
  todayDeliveries:      number;
  totalEarnings:        number;
  joinedAt:             string;
  lastActivity:         string;
  lastActivityAt:       string;
  companyId:            string | null;
  userId:               string;
}

export interface LivreurStats {
  total:       number;
  actifs:      number;
  disponibles: number;
  enCourse:    number;
  horsLigne:   number;
  enAttente:   number;
  livrAuj:     number;
}

export interface ZoneStat {
  zone:   string;
  orders: number;
  pct:    number;
  color:  string;
}

export interface LivreurListResponse {
  data:  LivreurResponse[];
  total: number;
  page:  number;
  pages: number;
}

export interface InvitationLivreurResponse {
  code:      string;    // XXXX-XXXX-XX — affiché dans ModalInviter étape 3
  email:     string;
  fullName:  string;
  expiresAt: string;
  codeId:    string;
}

export interface FilterLivreursDto {
  availability?: Availability;
  status?:       LivreurStatus;
  search?:       string;
  page?:         number;
  limit?:        number;
}

export interface InviterDto {
  fullName:    string;
  email:       string;
  vehicleType: VehicleType;
  zone?:       string;
  message?:    string;
}

export interface ContacterDto {
  sujet:   string;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// API LIVREURS
// ─────────────────────────────────────────────────────────────

export const livreursApi = {

  // ── GET /livreurs/stats ────────────────────────────────
  // 4 KPI cards de LivreursPage.tsx
  getStats(): Promise<LivreurStats> {
    return apiFetch<LivreurStats>('/livreurs/stats');
  },

  // ── GET /livreurs/zones ────────────────────────────────
  // Barres de couverture du panneau latéral
  getZones(): Promise<ZoneStat[]> {
    return apiFetch<ZoneStat[]>('/livreurs/zones');
  },

  // ── GET /livreurs/activite-recente ─────────────────────
  // Bloc "Activité récente" du panneau latéral
  getActiviteRecente(): Promise<LivreurResponse[]> {
    return apiFetch<LivreurResponse[]>('/livreurs/activite-recente');
  },

  // ── GET /livreurs ──────────────────────────────────────
  // Grille et liste de LivreursPage.tsx
  getAll(filters?: FilterLivreursDto): Promise<LivreurListResponse> {
    return apiFetch<LivreurListResponse>('/livreurs', {
      params: {
        availability: filters?.availability,
        status:       filters?.status,
        search:       filters?.search,
        page:         filters?.page,
        limit:        filters?.limit,
      },
    });
  },

  // ── GET /livreurs/:id ──────────────────────────────────
  // Profil complet pour ModalProfil
  getOne(id: string): Promise<LivreurResponse> {
    return apiFetch<LivreurResponse>(`/livreurs/${id}`);
  },

  // ── PATCH /livreurs/:id ────────────────────────────────
  update(id: string, dto: Partial<InviterDto & { availability: Availability; vehiclePlate: string }>): Promise<LivreurResponse> {
    return apiFetch<LivreurResponse>(`/livreurs/${id}`, { method: 'PATCH', body: dto });
  },

  // ── PATCH /livreurs/:id/suspendre ──────────────────────
  // ModalSuspendre → bouton "Confirmer"
  suspendre(id: string, raison?: string): Promise<LivreurResponse> {
    return apiFetch<LivreurResponse>(`/livreurs/${id}/suspendre`, {
      method: 'PATCH',
      body:   { raison },
    });
  },

  // ── PATCH /livreurs/:id/reactiver ──────────────────────
  reactiver(id: string): Promise<LivreurResponse> {
    return apiFetch<LivreurResponse>(`/livreurs/${id}/reactiver`, { method: 'PATCH' });
  },

  // ── PATCH /livreurs/:id/valider ────────────────────────
  // Bouton "Valider les en attente" → actions rapides
  valider(id: string): Promise<LivreurResponse> {
    return apiFetch<LivreurResponse>(`/livreurs/${id}/valider`, { method: 'PATCH' });
  },

  // ── POST /livreurs/inviter ─────────────────────────────
  // ModalInviter étape 2 → "Envoyer l'invitation"
  // Retourne { code: "XXXX-XXXX-XX", ... } affiché à l'étape 3
  inviter(dto: InviterDto): Promise<InvitationLivreurResponse> {
    return apiFetch<InvitationLivreurResponse>('/livreurs/inviter', {
      method: 'POST',
      body:   dto,
    });
  },

  // ── POST /livreurs/:id/contacter ───────────────────────
  // ModalContacter → bouton "Envoyer"
  contacter(id: string, dto: ContacterDto): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/livreurs/${id}/contacter`, {
      method: 'POST',
      body:   dto,
    });
  },
};