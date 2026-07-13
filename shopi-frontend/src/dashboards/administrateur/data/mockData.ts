/**
 * @file   mockData.ts
 * @module administrateur/data
 *
 * Données fictives utilisées le temps que l'API admin soit disponible.
 * Chaque constante reflète la structure exacte des types admin.types.ts.
 */

import type { AdminUser, AdminStat, ActivityItem, LogEntry, SysNote } from '../types/admin.types';

/* ─────────────────────────────────────────────────────────────
 * STATISTIQUES — 4 cartes du tableau de bord
 * ─────────────────────────────────────────────────────────────
 */
export const MOCK_STATS: AdminStat[] = [
  {
    label:       'Commandes ce mois',
    value:       '1 284',
    trend:       '+18 % vs mois dernier',
    trendUp:     true,
    iconVariant: 'blue',
    icon:        'shopping-bag',
  },
  {
    label:       'Utilisateurs actifs',
    value:       '3 942',
    trend:       '+5 % cette semaine',
    trendUp:     true,
    iconVariant: 'emerald',
    icon:        'users',
  },
  {
    label:       'Revenus bruts',
    value:       '24 M GNF',
    trend:       '+9 % ce trimestre',
    trendUp:     true,
    iconVariant: 'violet',
    icon:        'credit-card',
  },
  {
    label:       'Taux de validation',
    value:       '87 %',
    trend:       '-2 % vs semaine passée',
    trendUp:     false,
    iconVariant: 'amber',
    icon:        'check-circle',
  },
];

/* ─────────────────────────────────────────────────────────────
 * DONNÉES GRAPHIQUE EN BARRES — 7 derniers jours
 * Pourcentages de l'activité quotidienne (0–100)
 * ─────────────────────────────────────────────────────────────
 */
export const MOCK_BAR_DATA = [
  { day: 'Lun', pct: 52 },
  { day: 'Mar', pct: 68 },
  { day: 'Mer', pct: 45 },
  { day: 'Jeu', pct: 87 },  // jour le plus actif (peak)
  { day: 'Ven', pct: 73 },
  { day: 'Sam', pct: 60 },
  { day: 'Dim', pct: 38 },
];

/* ─────────────────────────────────────────────────────────────
 * TABLEAU UTILISATEURS — derniers inscrits
 * ─────────────────────────────────────────────────────────────
 */
export const MOCK_USERS: AdminUser[] = [
  { id: '1', name: 'Mamadou Diallo',   email: 'm.diallo@email.com',   type: 'entreprise',   status: 'actif',   date: '2025-06-01' },
  { id: '2', name: 'Fatoumata Bah',    email: 'f.bah@email.com',      type: 'livreur',      status: 'attente', date: '2025-06-02' },
  { id: '3', name: 'Ibrahima Camara',  email: 'i.camara@email.com',   type: 'partenaire',   status: 'actif',   date: '2025-06-03' },
  { id: '4', name: 'Aissatou Sow',     email: 'a.sow@email.com',      type: 'entreprise',   status: 'bloque',  date: '2025-06-04' },
  { id: '5', name: 'Oumar Kouyaté',    email: 'o.kouyate@email.com',  type: 'correspondant',status: 'actif',   date: '2025-06-05' },
];

/* ─────────────────────────────────────────────────────────────
 * ACTIVITÉ RÉCENTE — flux du panneau latéral
 * ─────────────────────────────────────────────────────────────
 */
export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    avatarLetter:  'M',
    avatarVariant: 'default',
    text:          '<strong>Mamadou Diallo</strong> a ouvert une boutique « Boutique Diallo »',
    time:          'il y a 5 min',
  },
  {
    avatarLetter:  'F',
    avatarVariant: 'emerald',
    text:          '<strong>Fatoumata Bah</strong> a soumis son dossier livreur',
    time:          'il y a 22 min',
  },
  {
    avatarLetter:  'I',
    avatarVariant: 'amber',
    text:          '<strong>Ibrahima Camara</strong> a lancé une promotion −15 %',
    time:          'il y a 1 h',
  },
  {
    avatarLetter:  'A',
    avatarVariant: 'violet',
    text:          '<strong>Aissatou Sow</strong> a été bloquée suite à 3 signalements',
    time:          'il y a 2 h',
  },
];

/* ─────────────────────────────────────────────────────────────
 * JOURNAL ADMIN — logs d'actions récentes
 * ─────────────────────────────────────────────────────────────
 */
export const MOCK_LOGS: LogEntry[] = [
  { time: '09:41', label: 'Entreprise #47 validée manuellement' },
  { time: '09:15', label: 'Rapport d\'activité hebdo exporté' },
  { time: '08:50', label: 'Signalement #12 traité — compte suspendu' },
  { time: '08:30', label: 'Mise à jour des tarifs de commission' },
  { time: '07:59', label: 'Connexion depuis 192.168.1.42' },
];

/* ─────────────────────────────────────────────────────────────
 * NOTIFICATIONS SYSTÈME
 * ─────────────────────────────────────────────────────────────
 */
export const MOCK_SYS_NOTES: SysNote[] = [
  {
    type:    'info',
    message: 'Mise à jour de la plateforme prévue le 10 juillet à 02h00.',
  },
  {
    type:    'warning',
    message: '3 entreprises attendent validation KYC depuis plus de 48 h.',
  },
];
