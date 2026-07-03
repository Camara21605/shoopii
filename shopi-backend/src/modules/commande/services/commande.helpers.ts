/* ============================================================
 * FICHIER : src/modules/commande/services/commande.helpers.ts
 *
 * Types et fonctions utilitaires partagés par tous les services
 * de la chaîne de validation des commandes.
 * ============================================================ */

import { randomBytes } from 'crypto';
import { CommandeStatus } from '../../../database/entities/commande/commande.entity';

export const CODE_EXPIRY_MS = 72 * 3600 * 1000;

/* ── Types de réponse pour la page de suivi (miroir du frontend) ── */
export type ActeurRole = 'entreprise' | 'livreur' | 'correspondant' | 'client';

export interface Acteur {
  role: ActeurRole;
  nom: string;
  sousTitre: string;
  initiales: string;
  icone: string;
  action: string;
  valideA?: string;
}

export interface Commission {
  role: ActeurRole | 'shopi';
  nom: string;
  libelle: string;
  montant: number;
  icone: string;
}

export interface CommandeDetailResponse {
  id: string;
  datePaiement: string;
  destination: string;
  acteurs: Acteur[];
  articles: { emoji: string; imageUrl: string | null; nom: string; boutique: string; qty: number; prix: number }[];
  montant: { sousTotal: number; livraison: number; fraisCorrespondant: number; total: number };
  commissions: Commission[];
  codes: Record<ActeurRole, string>;
  currentStep: number;
  times: (string | undefined)[];
}

export interface CommandeListItem {
  id: string;
  uuid: string;
  em: string;
  /** Image principale (snapshot premier article) */
  imageUrl: string | null;
  nm: string;
  vt: string;
  /** Tous les articles de la commande */
  items: { nm: string; imageUrl: string | null; vt: string | null; qty: number }[];
  client: string;
  price: number;
  status: 'new' | 'prep' | 'ship' | 'del' | 'can';
  date: string;
  livreur: string;
  zone: string;
}

/* ── Mission livreur (GET /livreur/missions) ── */
export interface MissionListItem {
  id: string;
  uuid: string;
  em: string;
  nm: string;
  shop: string;
  client: string;
  from: string;
  to: string;
  dist: string;
  fee: number;
  speed: 'eco' | 'std' | 'exp' | 'ult';
  status: 'new' | 'prep' | 'active' | 'done';
  urgent: boolean;
  date: string;
}

/* ── Historique livreur (GET /livreur/historique) ── */
export interface HistListItem {
  id: string;
  uuid: string;
  em: string;
  nm: string;
  shop: string;
  fee: number;
  dist: string;
  speed: 'eco' | 'std' | 'exp' | 'ult';
  status: 'done' | 'iss' | 'can';
  date: string;
  earn: boolean;
}

/* ── Mission en cours du livreur (GET /livreur/encours) ── */
export interface EnCoursStep {
  role: ActeurRole;
  label: string;
  sub: string;
  status: 'done' | 'active' | 'next';
  time: string | null;
}

export interface EnCoursResponse {
  id: string;
  uuid: string;
  em: string;
  nm: string;
  shop: string;
  fee: number;
  speed: 'eco' | 'std' | 'exp' | 'ult';
  client: {
    nom: string;
    telephone: string | null;
    adresse: string;
    instructions: string | null;
  };
  steps: EnCoursStep[];
  etaAt: string | null;
}

/* ── Mapping statut backend → statut historique livreur ── */
export function mapHistStatus(status: CommandeStatus): 'done' | 'iss' | 'can' {
  switch (status) {
    case CommandeStatus.DELIVERED:
    case CommandeStatus.AUTO_DELIVERED:
      return 'done';
    case CommandeStatus.DISPUTED:
      return 'iss';
    default:
      return 'can';
  }
}

/* ── Génération d'un code de validation à 6 caractères (lettres + chiffres) ── */
export function genererCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[bytes[i] % chars.length];
  return s;
}

/* ── Prix d'un produit (bigint stocké en string par le driver) ── */
export function readPrix(p: any): number {
  return Number(p?.prix ?? 0);
}

/* ── Mapping statut backend → statut frontend (dashboard entreprise) ── */
export function mapOrderStatus(status: CommandeStatus): 'new' | 'prep' | 'ship' | 'del' | 'can' {
  switch (status) {
    case CommandeStatus.PENDING:
    case CommandeStatus.PAID:
      return 'new';
    case CommandeStatus.IN_PROGRESS:
      return 'prep';
    case CommandeStatus.AWAITING_CLIENT:
      return 'ship';
    case CommandeStatus.DELIVERED:
    case CommandeStatus.AUTO_DELIVERED:
      return 'del';
    default:
      return 'can';
  }
}

export const ACTEUR_INFO: Record<ActeurRole, { sousTitre: string; icone: string; action: string }> = {
  entreprise:    { sousTitre: 'Vendeur',      icone: 'fa-store',      action: 'Prépare votre commande' },
  livreur:       { sousTitre: 'Livreur',      icone: 'fa-motorcycle', action: 'Livre votre commande' },
  correspondant: { sousTitre: 'Point relais', icone: 'fa-warehouse',  action: 'Réceptionne votre colis' },
  client:        { sousTitre: 'Vous',         icone: 'fa-house',      action: 'Confirmez la réception' },
};

export function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}
