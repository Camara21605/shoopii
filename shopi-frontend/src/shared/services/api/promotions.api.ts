/* ============================================================
 * FICHIER : src/services/api/promotions.api.ts
 *
 * RÔLE :
 * Couche API frontend pour la gestion des promotions.
 *
 * Cette couche communique avec les routes NestJS :
 *
 *  GET    /promotions
 *  GET    /promotions/stats
 *  GET    /promotions/:id
 *  POST   /promotions
 *  PATCH  /promotions/:id
 *  DELETE /promotions/:id
 *  PATCH  /promotions/:id/activate
 *  PATCH  /promotions/:id/pause
 *  PATCH  /promotions/:id/end
 *  POST   /promotions/validate-code
 *
 * ============================================================
 */

import {
  apiFetch,
} from '../../../shared/services/apiFetch';

/* ============================================================
 * TYPES
 * ============================================================
 */

export type PromoStatus =
  | 'active'
  | 'scheduled'
  | 'draft'
  | 'paused'
  | 'ended';

export type PromoScope =
  | 'global'
  | 'products';

export type PromoType =
  | 'discount'
  | 'free-ship'
  | 'bundle'
  | 'flash';

/* ============================================================
 * PROMOTION RESPONSE
 * ============================================================
 */

export interface PromoResponse {

  id: string;

  nom: string;

  code: string;

  type: PromoType;

  typeL: string;

  scope: PromoScope;

  status: PromoStatus;

  valueType: string;

  valeur: number | null;

  montantMinimum: number | null;

  plafondReduction: number | null;

  maxUtilisations: number | null;

  maxParClient: number;

  uses: number;

  max: number;

  revenue: string;

  caGenere: number;

  startDate: string | null;

  endDate: string | null;

  expire: string;

  flashStock: number | null;

  bundleQuantiteMin: number | null;

  bundleQuantiteOfferte: number | null;

  freeShipSeuil: number | null;

  description: string | null;

  companyId: string;

  productIds: string[];

  produits: {
    id: string;
    productId: string;
  }[];

  createdAt: string;

  updatedAt: string;
}

/* ============================================================
 * STATISTIQUES
 * ============================================================
 */

export interface PromoStats {

  total: number;

  actives: number;

  planifiees: number;

  brouillons: number;

  totalUses: number;

  totalCa: number;
}

/* ============================================================
 * DTOs
 * ============================================================
 */

export interface CreatePromoDto {

  nom: string;

  code: string;

  type: PromoType;

  scope?: PromoScope;

  valueType?: string;

  valeur?: number;

  productIds?: string[];

  montantMinimum?: number;

  plafondReduction?: number;

  maxUtilisations?: number;

  maxParClient?: number;

  startDate?: string;

  endDate?: string;

  flashStock?: number;

  bundleQuantiteMin?: number;

  bundleQuantiteOfferte?: number;

  freeShipSeuil?: number;

  description?: string;
}

export interface ValidateCodeDto {

  code: string;

  companyId: string;

  cartTotal: number;

  productIds?: string[];

  clientId?: string;
}

export interface ValidateCodeResponse {

  valid: boolean;

  discount: number;

  newTotal: number;

  freeShipping: boolean;

  label: string;

  promo: Pick<
    PromoResponse,
    | 'id'
    | 'nom'
    | 'code'
    | 'type'
    | 'scope'
    | 'valeur'
    | 'valueType'
  >;
}

export interface FilterPromosDto {

  status?: PromoStatus;

  type?: PromoType;

  scope?: PromoScope;

  search?: string;

  page?: number;

  limit?: number;
}

export interface PromoListResponse {

  data: PromoResponse[];

  total: number;

  page: number;

  pages: number;
}

/* ============================================================
 * API PROMOTIONS
 * ============================================================
 */

export const promotionsApi = {

  /* ==========================================================
   * GET /promotions/stats
   * Charge les statistiques du dashboard
   * ========================================================== */
  getStats(): Promise<PromoStats> {

    return apiFetch<PromoStats>(
      '/promotions/stats',
    );
  },

  /* ==========================================================
   * GET /promotions
   * Liste paginée + filtres
   * ========================================================== */
  getAll(
    filters?: FilterPromosDto,
  ): Promise<PromoListResponse> {

    return apiFetch<PromoListResponse>(
      '/promotions',
      {
        params: {

          status:
            filters?.status,

          type:
            filters?.type,

          scope:
            filters?.scope,

          search:
            filters?.search,

          page:
            filters?.page,

          limit:
            filters?.limit,
        },
      },
    );
  },

  /* ==========================================================
   * GET /promotions/:id
   * Récupérer une promotion
   * ========================================================== */
  getOne(
    id: string,
  ): Promise<PromoResponse> {

    return apiFetch<PromoResponse>(
      `/promotions/${id}`,
    );
  },

  /* ==========================================================
   * POST /promotions
   * Création promotion
   * ========================================================== */
  create(
    dto: CreatePromoDto,
  ): Promise<PromoResponse> {

    return apiFetch<PromoResponse>(
      '/promotions',
      {
        method: 'POST',
        body: dto,
      },
    );
  },

  /* ==========================================================
   * PATCH /promotions/:id
   * Modifier une promotion
   * ========================================================== */
  update(
    id: string,
    dto: Partial<CreatePromoDto>,
  ): Promise<PromoResponse> {

    return apiFetch<PromoResponse>(
      `/promotions/${id}`,
      {
        method: 'PATCH',
        body: dto,
      },
    );
  },

  /* ==========================================================
   * DELETE /promotions/:id
   * Supprimer une promotion
   * ========================================================== */
  remove(
    id: string,
  ): Promise<{ message: string }> {

    return apiFetch<{ message: string }>(
      `/promotions/${id}`,
      {
        method: 'DELETE',
      },
    );
  },

  /* ==========================================================
   * PATCH /promotions/:id/activate
   * Activer une promotion
   * ========================================================== */
  activate(
    id: string,
  ): Promise<PromoResponse> {

    return apiFetch<PromoResponse>(
      `/promotions/${id}/activate`,
      {
        method: 'PATCH',
      },
    );
  },

  /* ==========================================================
   * PATCH /promotions/:id/pause
   * Mettre en pause une promotion
   * ========================================================== */
  pause(
    id: string,
  ): Promise<PromoResponse> {

    return apiFetch<PromoResponse>(
      `/promotions/${id}/pause`,
      {
        method: 'PATCH',
      },
    );
  },

  /* ==========================================================
   * PATCH /promotions/:id/end
   * Terminer une promotion
   * ========================================================== */
  end(
    id: string,
  ): Promise<PromoResponse> {

    return apiFetch<PromoResponse>(
      `/promotions/${id}/end`,
      {
        method: 'PATCH',
      },
    );
  },

  /* ==========================================================
   * POST /promotions/validate-code
   * Validation d'un code promo au checkout
   * ========================================================== */
  validateCode(
    dto: ValidateCodeDto,
  ): Promise<ValidateCodeResponse> {

    return apiFetch<ValidateCodeResponse>(
      '/promotions/validate-code',
      {
        method: 'POST',
        body: dto,
      },
    );
  },
};