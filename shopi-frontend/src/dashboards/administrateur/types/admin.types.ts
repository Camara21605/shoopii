/**
 * @file   admin.types.ts
 * @module administrateur/types
 *
 * Tous les types TypeScript du dashboard Administrateur.
 * Organisé de la même façon que codes.types.ts dans super-admin.
 */

/* ─────────────────────────────────────────────────────────────
 * PAGES DU DASHBOARD
 * ─────────────────────────────────────────────────────────────
 * Union string-littérale qui identifie chacune des pages.
 * Utilisée pour l'état activePage dans AdministrateurApp.
 */
export type AdminPage =
  | 'overview'        // Vue d'ensemble (stats, graphiques, table users)
  | 'utilisateurs'    // Gestion des utilisateurs (entreprises, livreurs…)
  | 'commandes'       // Suivi des commandes
  | 'signalements'    // Modération et signalements
  | 'portefeuille'    // Finances et portefeuille
  | 'parametres';     // Paramètres du compte admin

/* ─────────────────────────────────────────────────────────────
 * UTILISATEURS
 * ─────────────────────────────────────────────────────────────
 */
export type AdminUserType   = 'entreprise' | 'livreur' | 'partenaire' | 'correspondant';
export type AdminUserStatus = 'actif' | 'attente' | 'bloque';

export interface AdminUser {
  id:     string;
  name:   string;
  email:  string;
  type:   AdminUserType;
  status: AdminUserStatus;
  date:   string;        // Date d'inscription ISO
}

/* ─────────────────────────────────────────────────────────────
 * STATISTIQUES (cartes du tableau de bord)
 * ─────────────────────────────────────────────────────────────
 */
export interface AdminStat {
  label:       string;
  value:       string;
  trend:       string;       // ex: "+12% ce mois"
  trendUp:     boolean;      // true = vert, false = rouge
  iconVariant: 'blue' | 'emerald' | 'violet' | 'amber';
  icon:        string;       // Nom SVG interne
}

/* ─────────────────────────────────────────────────────────────
 * ACTIVITÉ RÉCENTE (flux latéral)
 * ─────────────────────────────────────────────────────────────
 */
export interface ActivityItem {
  avatarLetter: string;
  avatarVariant: 'default' | 'emerald' | 'amber' | 'violet';
  text:          string;        // HTML ou texte libre
  time:          string;        // "il y a 5 min"
}

/* ─────────────────────────────────────────────────────────────
 * LOG ADMIN
 * ─────────────────────────────────────────────────────────────
 */
export interface LogEntry {
  time:  string;   // "09:41"
  label: string;
}

/* ─────────────────────────────────────────────────────────────
 * NOTIFICATION SYSTÈME
 * ─────────────────────────────────────────────────────────────
 */
export interface SysNote {
  type:    'info' | 'warning';
  message: string;
}
