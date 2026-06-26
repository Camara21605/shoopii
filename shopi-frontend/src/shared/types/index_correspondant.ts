/*
 * ════════════════════════════════════════════════════════
 * FICHIER : src/shared/types/index.ts
 * ORDRE   : 3 — Importé par tous les modules qui ont
 *           besoin de typer leurs données
 * RÔLE    : Centralise tous les types TypeScript partagés
 *           du projet (Colis, Boutique, Livreur, etc.)
 * ════════════════════════════════════════════════════════
 */

export type ToastType = 's' | 'i' | 'w' | 'e';

export type ColisStatus = 'att' | 'stock' | 'dep' | 'livr' | 'ret';

export interface Colis {
  id: string;
  em: string;
  nm: string;
  boutique: string;
  client: string;
  valeur: number;
  date: string;
  status: ColisStatus;
  urgent: boolean;
}

export interface Boutique {
  em: string;
  nm: string;
  cat: string;
  rat: number;
  colis: number;
  pending: number;
  type: string;
  since: string;
}

export interface Livreur {
  em: string;
  nm: string;
  zone: string;
  rat: number;
  missions: number;
  online: boolean;
  pending: number;
}

export interface Client {
  nm: string;
  tel: string;
  colis: number;
  dernier: string;
  val: number;
  status: 'att' | 'ok' | 'retour';
}

export interface Transfert {
  id: string;
  from: string;
  to: string;
  colis: string;
  valeur: number;
  date: string;
  status: 'en-route' | 'livre';
  dist: string;
}

export interface Retour {
  id: string;
  em: string;
  nm: string;
  boutique: string;
  client: string;
  valeur: number;
  motif: string;
  date: string;
  status: 'en-attente' | 'litige';
}

export interface Avis {
  bg: string;
  init: string;
  nm: string;
  stars: number;
  txt: string;
  date: string;
  replied: boolean;
}

export interface RevData {
  j: string;
  v: number;
  today?: boolean;
}

export interface Activity {
  ic: string;
  bg: string;
  c: string;
  msg: string;
  t: string;
}

// Pages disponibles dans le dashboard correspondant
export type PageId =
  | 'overview'
  | 'colis'
  | 'transferts'
  | 'retours'
  | 'boutiques'
  | 'livreurs'
  | 'clients'
  | 'revenus'
  | 'zone'
  | 'evaluation'
  | 'parametres'
  | 'profil';