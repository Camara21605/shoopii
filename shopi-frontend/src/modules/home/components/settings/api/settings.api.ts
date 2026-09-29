/* ================================================================
 * src/modules/home/components/settings/api/settings.api.ts
 *
 * Couche API frontend — fait le lien entre les sections
 * et les routes NestJS du ClientParametresController.
 * BASE : /api/client/parametres
 * ================================================================ */

import { apiFetch } from '../../../../../shared/services/apiFetch';
import { getUserIdFromToken } from '../../../../../shared/services/authUtils';

/* ── Lectures partagées (profil, sécurité) ──────────────────────────────
 * OUVERTURE LENTE DES PARAMÈTRES : à chaque ouverture, le même profil était
 * demandé deux fois en parallèle (en-tête + section Profil) et le statut de
 * sécurité deux fois (bandeau + pastille des onglets), puis la page restait
 * sur un indicateur de chargement jusqu'à la réponse — même quand on venait
 * de la quitter.
 *  - Appels simultanés identiques → UNE seule requête partagée.
 *  - Dernière valeur reçue gardée en mémoire (par compte) : la page s'affiche
 *    aussitôt avec elle à la réouverture, puis se met à jour avec la réponse.
 * Les composants redemandent toujours au serveur : la mémoire ne sert qu'au
 * premier affichage, jamais à éviter une mise à jour. */
const enCours  = new Map<string, Promise<unknown>>();
const derniere = new Map<string, { compte: string | null; valeur: unknown }>();

function lecturePartagee<T>(cle: string, charger: () => Promise<T>): Promise<T> {
  const compte = getUserIdFromToken();
  const cleCompte = `${compte ?? ''}:${cle}`;
  const existante = enCours.get(cleCompte);
  if (existante) return existante as Promise<T>;
  const promesse = charger()
    .then((valeur) => { derniere.set(cle, { compte, valeur }); return valeur; })
    .finally(() => enCours.delete(cleCompte));
  enCours.set(cleCompte, promesse);
  return promesse;
}

/** Dernière valeur connue pour le compte connecté (affichage immédiat), ou null. */
function valeurConnue<T>(cle: string): T | null {
  const v = derniere.get(cle);
  return v && v.compte === getUserIdFromToken() ? (v.valeur as T) : null;
}

/** Après une modification : la valeur gardée en mémoire n'est plus à jour. */
function oublier(...cles: string[]) { cles.forEach((c) => derniere.delete(c)); }

/** Oublie la valeur gardée après une écriture réussie (sans changer le résultat de l'appel). */
function puisOublier<T>(p: Promise<T>, ...cles: string[]): Promise<T> {
  return p.then((r) => { oublier(...cles); return r; });
}

/* ── Types ── */
export interface ProfilData {
  id: string; firstName: string; lastName: string;
  email: string; phone: string; username: string;
  emailVerified: boolean; phoneVerified: boolean;
  profilePicture: string | null;
  dateNaissance: string | null; genre: string | null;
  bio: string | null; langue: string;
}

/**
 * Adresse de livraison telle que la commande (panier) la consomme.
 * Alimentée par les adresses RÉELLES du client (/location/addresses) — la même source que
 * la page « Adresses », la carte et les paramètres — via getAdresses() ci-dessous.
 */
export interface AdresseItem {
  id: string; nom: string; fullName: string;
  adresse: string; commune?: string; ville: string;
  phone?: string; isDefault: boolean;
}

/** Réponse de PATCH /client/parametres/coordonnees */
export interface CoordonneesResult {
  message: string;
  emailChanged: boolean; phoneChanged: boolean;
  emailVerified: boolean; phoneVerified: boolean;
  /** true = un code de confirmation vient d'être envoyé au nouvel e-mail */
  emailCodeSent: boolean;
}

export interface PointsData {
  points: number; pointsGagnes: number; pointsUtilises: number;
  niveau: string; prochainNiveau: string | null;
  seuilProchain: number | null; progression: number;
  expirationProchaine: string | null;
  /** false = aucun point n'a encore jamais été attribué (programme pas encore ouvert) */
  actif: boolean;
}

export interface SecuriteData {
  emailVerified: boolean; phoneVerified: boolean;
  twoFaEnabled: boolean; twoFaMethod: string | null;
  /** Codes de secours restants (utiles uniquement avec la 2FA) */
  codesSecours: number;
  dernierChangementMdp: string | null;
}

/** Type d'alerte de sécurité — voir SecurityAlertsService (backend) */
export type AlertType = 'connex' | 'mdp' | 'tentatives' | 'transaction' | 'pays';
export type AlertSettings = Record<AlertType, { email: boolean }>;

export interface SessionItem {
  id: string; device: string; browser: string;
  os: string; ip: string;
  /** Pays résolu depuis l'IP — vide si inconnu */
  location: string;
  /** Code ISO du pays (affiché dans la langue de l'interface) */
  countryCode?: string;
  /** ISO 8601 */
  lastSeen: string; createdAt: string;
  isCurrent: boolean; suspect?: boolean;
}

export interface ActiviteItem {
  /** Code de l'événement — clé de traduction (settingsPage.activite.events.*) */
  code: string;
  type: 'login' | 'order' | 'security' | 'alert' | 'profile';
  /** Libellé français de repli */
  title: string;
  device: string; location: string; ip: string;
  /** Code ISO du pays (affiché dans la langue de l'interface) */
  countryCode?: string;
  /** ISO 8601 */
  time: string; success: boolean;
}

/** Préférences de notification RÉELLES (voir NotifsService côté API) */
export interface NotifsView {
  global: { push: boolean; email: boolean };
  dnd:    { enabled: boolean; start: string; end: string; timezone: string };
  /** commandes | promos | messages | social */
  groups: Record<string, { push: boolean; email: boolean }>;
}

/* ── API ── */
export const settingsApi = {

  /* ── Profil ── */
  getProfil: ()                => lecturePartagee('profil', () => apiFetch<ProfilData>('/client/parametres/profil')),
  /** Dernier profil reçu (affichage immédiat à la réouverture), ou null. */
  profilConnu: ()              => valeurConnue<ProfilData>('profil'),
  updateProfil: (dto: any)     => puisOublier(apiFetch<ProfilData>('/client/parametres/profil', { method:'PATCH', body:dto }), 'profil'),
  updateAvatar: (url: string)  => puisOublier(apiFetch<{profilePicture:string}>('/client/parametres/profil/avatar', { method:'PATCH', body:{ url } }), 'profil'),
  /** Adresses de livraison du client (système réel /location/addresses), au format attendu par la commande. */
  getAdresses: async (): Promise<AdresseItem[]> => {
    const list = await apiFetch<{
      id: string; libelle?: string | null; typeAdresse?: string; rue?: string | null; quartier?: string | null;
      commune?: string | null; ville: string; telephone?: string | null; estDefaut: boolean;
    }[]>('/location/addresses');
    return (Array.isArray(list) ? list : []).map(a => ({
      id:        a.id,
      nom:       a.libelle || (a.typeAdresse ? a.typeAdresse.charAt(0).toUpperCase() + a.typeAdresse.slice(1) : 'Adresse'),
      fullName:  '',
      adresse:   [a.rue, a.quartier].filter(Boolean).join(', '),
      commune:   a.commune ?? undefined,
      ville:     a.ville,
      phone:     a.telephone ?? undefined,
      isDefault: a.estDefaut,
    }));
  },

  /** `currentPassword` est exigé dès que l'e-mail ou le téléphone change réellement. */
  updateCoordonnees: (dto: { email?: string; phone?: string; currentPassword?: string }) =>
    puisOublier(apiFetch<CoordonneesResult>('/client/parametres/coordonnees', { method:'PATCH', body:dto }), 'profil', 'securite'),
  /** Envoie (ou renvoie) le code à 6 chiffres à l'e-mail actuel. */
  sendEmailCode:     ()             => apiFetch<{sent:boolean;message:string}>('/client/parametres/coordonnees/email/code', { method:'POST' }),
  confirmEmailCode:  (code: string) => puisOublier(apiFetch<{message:string;emailVerified:true}>('/client/parametres/coordonnees/email/verifier', { method:'POST', body:{ code } }), 'profil', 'securite'),

  /* ── Points ── */
  getPoints: () => apiFetch<PointsData>('/client/parametres/points'),

  /* ── Sécurité ── */
  getSecurite:          ()         => lecturePartagee('securite', () => apiFetch<SecuriteData>('/client/parametres/securite')),
  /** Dernier statut de sécurité reçu (affichage immédiat à la réouverture), ou null. */
  securiteConnue:       ()         => valeurConnue<SecuriteData>('securite'),
  changePassword:       (dto: any) => puisOublier(apiFetch<{message:string}>('/client/parametres/securite/password', { method:'PATCH', body:dto }), 'securite'),
  update2fa:            (dto: any) => puisOublier(apiFetch<{twoFaEnabled:boolean}>('/client/parametres/securite/2fa', { method:'PATCH', body:dto }), 'securite'),
  genererCodesSecours:  ()         => puisOublier(apiFetch<{codes:string[]}>('/client/parametres/securite/codes-secours', { method:'POST' }), 'securite'),
  getAlertSettings:     ()         => apiFetch<AlertSettings>('/client/parametres/securite/alertes'),
  updateAlertSetting:   (type: AlertType, email: boolean) =>
    apiFetch<AlertSettings>('/client/parametres/securite/alertes', { method:'PATCH', body:{ type, email } }),

  /* ── Sessions ── */
  getSessions:       ()            => apiFetch<SessionItem[]>('/client/parametres/sessions'),
  revoquerSession:   (id: string)  => apiFetch<{message:string}>(`/client/parametres/sessions/${id}/revoquer`, { method:'PATCH' }),
  revoquerToutes:    ()            => apiFetch<{message:string;count:number}>('/client/parametres/sessions/revoquer-toutes', { method:'PATCH' }),

  /* ── Activité ── */
  getActivite:  (limit = 50) => apiFetch<ActiviteItem[]>('/client/parametres/activite', { params: { limit: String(limit) } } as any),

  /* ── Préférences ── */
  getNotifs:     ()        => apiFetch<NotifsView>('/client/parametres/notifs'),
  updateNotifs:  (dto: { global?: NotifsView['global']; dnd?: NotifsView['dnd']; groups?: Record<string, { push?: boolean; email?: boolean }> }) =>
    apiFetch<NotifsView>('/client/parametres/notifs', { method:'PATCH', body:dto }),
  getPrivacy:    ()        => apiFetch<{privacySettings:any}>('/client/parametres/privacy'),
  updatePrivacy: (dto:any) => apiFetch<{privacySettings:any}>('/client/parametres/privacy', { method:'PATCH', body:dto }),
  getApparence:  ()        => apiFetch<{theme:string;textSize:string;imageQuality:string}>('/client/parametres/apparence'),
  updateApparence:(dto:any)=> apiFetch<any>('/client/parametres/apparence', { method:'PATCH', body:dto }),
  getLangue:     ()        => apiFetch<{langue:string;devise:string;timezone:string}>('/client/parametres/langue'),
  updateLangue:  (dto:any) => apiFetch<any>('/client/parametres/langue', { method:'PATCH', body:dto }),

  /* ── Danger ──
   * desactiver/supprimer exigent le mot de passe actuel (confirmation
   * côté serveur) — voir DangerService.verifyPassword (backend). */
  desactiver:      (password: string) => apiFetch<{message:string}>('/client/parametres/danger/desactiver',   { method:'PATCH', body:{ password } }),
  reinitialiser:   ()                 => apiFetch<{message:string}>('/client/parametres/danger/reinitialiser',{ method:'PATCH' }),
  supprimer:       (password: string) => apiFetch<{message:string}>('/client/parametres/danger/supprimer',    { method:'DELETE', body:{ password } }),
};