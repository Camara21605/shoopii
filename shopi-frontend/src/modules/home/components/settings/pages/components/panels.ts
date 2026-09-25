/* ================================================================
 * src/modules/home/components/settings/pages/components/panels.ts
 * Identifiants des panneaux de la page « Paramètres du compte ».
 * ================================================================ */

export type PanelId =
  | 'profil' | 'adresses' | 'paiement' | 'points'
  | 'confidentialiteSecurite'
  | 'sessions' | 'activite'
  | 'notifs' | 'confidentialite' | 'apparence' | 'langue'
  | 'donnees' | 'danger';

/** Même liste que PanelId, mais lisible à l'exécution — utile pour valider
 *  un identifiant reçu depuis l'URL (voir SettingsPage : ?panel=xyz porté
 *  par l'historique du navigateur en mode téléphone). */
export const PANEL_IDS: PanelId[] = [
  'profil', 'adresses', 'paiement', 'points',
  'confidentialiteSecurite',
  'sessions', 'activite',
  'notifs', 'confidentialite', 'apparence', 'langue',
  'donnees', 'danger',
];

export function isPanelId(value: string | null): value is PanelId {
  return !!value && (PANEL_IDS as string[]).includes(value);
}
