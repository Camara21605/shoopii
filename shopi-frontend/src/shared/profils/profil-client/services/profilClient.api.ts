/* ================================================================
 * FICHIER : src/modules/home/components/profil-client/services/profilClient.api.ts
 *
 * RÔLE : Couche d'accès aux données du profil client (appels API).
 *        Isole tous les appels réseau.
 *
 * ENDPOINTS :
 *   GET /client/profil          → profil complet du client
 *   GET /suivis/mes-abonnements → abonnements groupés par type
 * ================================================================ */

import { apiFetch } from '../../../services/apiFetch';

/* ════════ PROFIL ════════ */

export interface ClientProfilApi {
  id:             string;
  initiales:      string;
  nomComplet:     string;
  email:          string;
  emailVerifie:   boolean;
  telephone:      string | null;
  localisation:   string;
  membreDepuis:   string;
  enLigne:        boolean;
  bio:            string | null;
  genre:          string | null;
  dateNaissance:  string | null;
  langue:         string;
  twoFaEnabled:   boolean;
  status:         string;
  profilePicture: string | null;
  totalOrders:    number;
  totalSpent:     number;
  totalFavorites: number;
  walletSolde:   number;
  shopiPoints:      number;
  pointsGagnesMois: number;
  pointsUtilises:   number;
  pointsExpiration: string | null;
  paymentMethods: any[];
  activityLog:    any[];
}

export function fetchMonProfil(): Promise<ClientProfilApi> {
  return apiFetch<ClientProfilApi>('/client/profil');
}

/* ════════ ABONNEMENTS ════════ */

export interface AbonnementApi {
  id:        string;
  nom:       string;
  categorie: string;
  emoji:     string;
  abonnes:   number;
  note:      number;
  type:      'boutiques' | 'livreurs' | 'correspondants';
  suivi:     boolean;
}
export interface MesAbonnementsApi {
  boutiques:      AbonnementApi[];
  livreurs:       AbonnementApi[];
  correspondants: AbonnementApi[];
}

export function fetchMesAbonnements(): Promise<MesAbonnementsApi> {
  return apiFetch<MesAbonnementsApi>('/suivis/mes-abonnements');
}

/* ════════ COMMANDES ════════ */

export interface CommandeItemApi {
  id:              string;
  nomProduit:      string;        /* snapshot nom produit */
  imageProduit:    string | null; /* snapshot image produit */
  varianteChoisie: string | null;
  quantite:        number;
  prixUnitaire:    number;
  sousTotal:       number;
  productId?:      string | null;
}

export interface CommandeClientApi {
  /* Champs réels de l'entité Commande (NestJS) */
  id:              string;          /* UUID interne */
  numero:          string;          /* CMD-2026-00010 */
  status:          string;          /* pending|paid|in_progress|awaiting_client|delivered|cancelled */
  total:           number;          /* total GNF */
  sousTotal?:      number;
  fraisLivraison?: number;
  createdAt:       string;
  items:           CommandeItemApi[];
  company?: {
    id:          string;
    companyName: string;
    logo:        string | null;
  };
  livreur?: { fullName: string; id: string } | null;
  correspondant?: { fullName?: string; nom?: string; id: string } | null;
  /* Format abrégé renvoyé par /client/commandes */
  uuid?:    string;
  em?:      string;
  nm?:      string;
  vt?:      string;
  price?:   number;
  date?:    string;
  zone?:    string;
}

export function fetchMesCommandes(): Promise<CommandeClientApi[]> {
  return apiFetch<CommandeClientApi[]>('/client/commandes');
}