/* ================================================================
 * src/modules/home/components/settings/api/settings.api.ts
 *
 * Couche API frontend — fait le lien entre les sections
 * et les routes NestJS du ClientParametresController.
 * BASE : /api/client/parametres
 * ================================================================ */

import { apiFetch } from '../../../../../shared/services/apiFetch';

/* ── Types ── */
export interface ProfilData {
  id: string; firstName: string; lastName: string;
  email: string; phone: string; username: string;
  emailVerified: boolean; phoneVerified: boolean;
  profilePicture: string | null;
  dateNaissance: string | null; genre: string | null;
  bio: string | null; langue: string;
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
  questionsConfigurees: number; codesSecours: number;
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
  /** ISO 8601 */
  time: string; success: boolean;
}

export interface AppareilConfiance {
  id: string; name: string; type: string;
  location: string; lastUsed: string; addedAt: string;
}

/* ── API ── */
export const settingsApi = {

  /* ── Profil ── */
  getProfil: ()                => apiFetch<ProfilData>('/client/parametres/profil'),
  updateProfil: (dto: any)     => apiFetch<ProfilData>('/client/parametres/profil', { method:'PATCH', body:dto }),
  updateAvatar: (url: string)  => apiFetch<{profilePicture:string}>('/client/parametres/profil/avatar', { method:'PATCH', body:{ url } }),
  /** `currentPassword` est exigé dès que l'e-mail ou le téléphone change réellement. */
  updateCoordonnees: (dto: { email?: string; phone?: string; currentPassword?: string }) =>
    apiFetch<CoordonneesResult>('/client/parametres/coordonnees', { method:'PATCH', body:dto }),
  /** Envoie (ou renvoie) le code à 6 chiffres à l'e-mail actuel. */
  sendEmailCode:     ()             => apiFetch<{sent:boolean;message:string}>('/client/parametres/coordonnees/email/code', { method:'POST' }),
  confirmEmailCode:  (code: string) => apiFetch<{message:string;emailVerified:true}>('/client/parametres/coordonnees/email/verifier', { method:'POST', body:{ code } }),

  /* ── Points ── */
  getPoints: () => apiFetch<PointsData>('/client/parametres/points'),

  /* ── Sécurité ── */
  getSecurite:          ()         => apiFetch<SecuriteData>('/client/parametres/securite'),
  changePassword:       (dto: any) => apiFetch<{message:string}>('/client/parametres/securite/password', { method:'PATCH', body:dto }),
  update2fa:            (dto: any) => apiFetch<{twoFaEnabled:boolean}>('/client/parametres/securite/2fa', { method:'PATCH', body:dto }),
  updateQuestions:      (dto: any) => apiFetch<{message:string}>('/client/parametres/securite/questions', { method:'PATCH', body:dto }),
  genererCodesSecours:  ()         => apiFetch<{codes:string[]}>('/client/parametres/securite/codes-secours', { method:'POST' }),
  getAlertSettings:     ()         => apiFetch<AlertSettings>('/client/parametres/securite/alertes'),
  updateAlertSetting:   (type: AlertType, email: boolean) =>
    apiFetch<AlertSettings>('/client/parametres/securite/alertes', { method:'PATCH', body:{ type, email } }),

  /* ── Sessions ── */
  getSessions:       ()            => apiFetch<SessionItem[]>('/client/parametres/sessions'),
  revoquerSession:   (id: string)  => apiFetch<{message:string}>(`/client/parametres/sessions/${id}/revoquer`, { method:'PATCH' }),
  revoquerToutes:    ()            => apiFetch<{message:string;count:number}>('/client/parametres/sessions/revoquer-toutes', { method:'PATCH' }),

  /* ── Activité ── */
  getActivite:  (limit = 50) => apiFetch<ActiviteItem[]>('/client/parametres/activite', { params: { limit: String(limit) } } as any),

  /* ── Approbations ── */
  getApprobations:  ()             => apiFetch<AppareilConfiance[]>('/client/parametres/approbations'),
  removeAppareil:   (id: string)   => apiFetch<{message:string}>(`/client/parametres/approbations/${id}`, { method:'DELETE' }),

  /* ── Préférences ── */
  getNotifs:     ()        => apiFetch<{notifSettings:any}>('/client/parametres/notifs'),
  updateNotifs:  (dto:any) => apiFetch<{notifSettings:any}>('/client/parametres/notifs', { method:'PATCH', body:dto }),
  getPrivacy:    ()        => apiFetch<{privacySettings:any}>('/client/parametres/privacy'),
  updatePrivacy: (dto:any) => apiFetch<{privacySettings:any}>('/client/parametres/privacy', { method:'PATCH', body:dto }),
  getApparence:  ()        => apiFetch<{theme:string;textSize:string;imageQuality:string}>('/client/parametres/apparence'),
  updateApparence:(dto:any)=> apiFetch<any>('/client/parametres/apparence', { method:'PATCH', body:dto }),
  getLangue:     ()        => apiFetch<{langue:string;devise:string;timezone:string}>('/client/parametres/langue'),
  updateLangue:  (dto:any) => apiFetch<any>('/client/parametres/langue', { method:'PATCH', body:dto }),

  /* ── Données ── */
  exportAll:        () => apiFetch<{message:string}>('/client/parametres/donnees/export',       { method:'POST' }),
  exportCommandes:  () => apiFetch<{message:string}>('/client/parametres/donnees/commandes',    { method:'POST' }),
  exportFactures:   () => apiFetch<{message:string}>('/client/parametres/donnees/factures',     { method:'POST' }),
  getRapport:       () => apiFetch<any>('/client/parametres/donnees/rapport'),
  portabilite:      () => apiFetch<{message:string}>('/client/parametres/donnees/portabilite',  { method:'POST' }),

  /* ── Danger ──
   * desactiver/supprimer exigent le mot de passe actuel (confirmation
   * côté serveur) — voir DangerService.verifyPassword (backend). */
  desactiver:      (password: string) => apiFetch<{message:string}>('/client/parametres/danger/desactiver',   { method:'PATCH', body:{ password } }),
  reinitialiser:   ()                 => apiFetch<{message:string}>('/client/parametres/danger/reinitialiser',{ method:'PATCH' }),
  supprimer:       (password: string) => apiFetch<{message:string}>('/client/parametres/danger/supprimer',    { method:'DELETE', body:{ password } }),
};