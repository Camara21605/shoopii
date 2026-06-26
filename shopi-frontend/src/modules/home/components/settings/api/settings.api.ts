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

export interface AdresseItem {
  id: string; nom: string; fullName: string;
  adresse: string; commune?: string; ville: string;
  phone?: string; isDefault: boolean;
}

export interface PaymentItem {
  id: string; type: string; numero: string;
  isDefault: boolean; addedAt: string;
}

export interface PointsData {
  points: number; pointsGagnes: number; pointsUtilises: number;
  niveau: string; prochainNiveau: string | null;
  seuilProchain: number | null; progression: number;
  expirationProchaine: string | null;
}

export interface SecuriteData {
  emailVerified: boolean; phoneVerified: boolean;
  twoFaEnabled: boolean; twoFaMethod: string | null;
  questionsConfigurees: number; codesSecours: number;
  dernierChangementMdp: string | null;
}

export interface SessionItem {
  id: string; device: string; browser: string;
  os: string; ip: string; location: string;
  lastSeen: string; isCurrent: boolean; suspect?: boolean;
}

export interface ActiviteItem {
  type: 'login' | 'order' | 'security' | 'alert' | 'profile';
  title: string; meta: string[];
  ip?: string; time: string;
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
  updateCoordonnees: (dto:any) => apiFetch<{message:string}>('/client/parametres/coordonnees', { method:'PATCH', body:dto }),

  /* ── Adresses ── */
  getAdresses:     ()              => apiFetch<AdresseItem[]>('/client/parametres/adresses'),
  createAdresse:   (dto: any)      => apiFetch<AdresseItem[]>('/client/parametres/adresses', { method:'POST', body:dto }),
  updateAdresse:   (id:string, dto:any) => apiFetch<AdresseItem[]>(`/client/parametres/adresses/${id}`, { method:'PATCH', body:dto }),
  setDefaultAddr:  (id: string)    => apiFetch<AdresseItem[]>(`/client/parametres/adresses/${id}/default`, { method:'PATCH' }),
  deleteAdresse:   (id: string)    => apiFetch<AdresseItem[]>(`/client/parametres/adresses/${id}`, { method:'DELETE' }),

  /* ── Paiement ── */
  getPaiement:     ()              => apiFetch<PaymentItem[]>('/client/parametres/paiement'),
  addPaiement:     (dto: any)      => apiFetch<PaymentItem[]>('/client/parametres/paiement', { method:'POST', body:dto }),
  setDefaultPay:   (id: string)    => apiFetch<PaymentItem[]>(`/client/parametres/paiement/${id}/default`, { method:'PATCH' }),
  deletePaiement:  (id: string)    => apiFetch<PaymentItem[]>(`/client/parametres/paiement/${id}`, { method:'DELETE' }),

  /* ── Points ── */
  getPoints: () => apiFetch<PointsData>('/client/parametres/points'),

  /* ── Sécurité ── */
  getSecurite:          ()         => apiFetch<SecuriteData>('/client/parametres/securite'),
  changePassword:       (dto: any) => apiFetch<{message:string}>('/client/parametres/securite/password', { method:'PATCH', body:dto }),
  update2fa:            (dto: any) => apiFetch<{twoFaEnabled:boolean}>('/client/parametres/securite/2fa', { method:'PATCH', body:dto }),
  updateQuestions:      (dto: any) => apiFetch<{message:string}>('/client/parametres/securite/questions', { method:'PATCH', body:dto }),
  genererCodesSecours:  ()         => apiFetch<{codes:string[]}>('/client/parametres/securite/codes-secours', { method:'POST' }),

  /* ── Sessions ── */
  getSessions:       ()            => apiFetch<SessionItem[]>('/client/parametres/sessions'),
  revoquerSession:   (id: string)  => apiFetch<{message:string}>(`/client/parametres/sessions/${id}/revoquer`, { method:'PATCH' }),
  revoquerToutes:    ()            => apiFetch<{message:string}>('/client/parametres/sessions/revoquer-toutes', { method:'PATCH' }),

  /* ── Activité ── */
  getActivite:  () => apiFetch<ActiviteItem[]>('/client/parametres/activite'),
  exportJournal:() => apiFetch<{message:string}>('/client/parametres/activite/export'),

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

  /* ── Danger ── */
  desactiver:      () => apiFetch<{message:string}>('/client/parametres/danger/desactiver',   { method:'PATCH' }),
  revoquerTiers:   () => apiFetch<{message:string}>('/client/parametres/danger/revoquer',     { method:'PATCH' }),
  reinitialiser:   () => apiFetch<{message:string}>('/client/parametres/danger/reinitialiser',{ method:'PATCH' }),
  supprimer:       () => apiFetch<{message:string}>('/client/parametres/danger/supprimer',    { method:'DELETE' }),
};