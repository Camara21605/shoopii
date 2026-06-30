/* ================================================================
 * FICHIER : src/shared/services/authUtils.ts
 *
 * Fonctions utilitaires auth déplacées hors de router.tsx.
 * Raison : router.tsx ne peut pas exporter à la fois des composants
 * React ET des fonctions — Vite Fast Refresh l'interdit.
 * ================================================================ */

import { tokenStorage } from './apiFetch';

/** Vérifie que le token JWT n'est pas expiré */
export function isTokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Date.now() / 1000;
  } catch { return false; }
}

/** Extrait le rôle depuis le token JWT */
export function getRoleFromToken(): string | null {
  const token = tokenStorage.get();
  if (!isTokenValid(token)) return null;
  try {
    return JSON.parse(atob(token!.split('.')[1])).role ?? null;
  } catch { return null; }
}

/**
 * Retourne le chemin du dashboard selon le rôle.
 * 'client' et les rôles inconnus renvoient '/home' — le dashboard
 * client (/dashboard/client) n'est qu'un stub technique (portefeuille
 * autonome), la vraie destination du client est toujours la home.
 */
export function getDashboardPath(role: string | null): string {
  switch (role) {
    case 'super_admin':   return '/dashboard/super-admin';
    case 'admin':         return '/dashboard/admin';
    case 'company':       return '/dashboard/entreprise';
    case 'partner':       return '/dashboard/partenaire';
    case 'delivery':      return '/dashboard/livreur';
    case 'correspondent': return '/dashboard/correspondant';
    default:              return '/home';
  }
}