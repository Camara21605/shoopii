/* ================================================================
 * FICHIER : src/dashboards/partenaire/hooks/usePartenaireParametres.ts
 *
 * Hook central des paramètres du dashboard partenaire.
 * Connecté à la vraie API (base de données Supabase).
 *
 * Endpoints backend (/api prefix géré par apiFetch) :
 *   GET    /dashboard/partenaire/parametres          → chargement complet
 *   PATCH  /dashboard/partenaire/parametres/profil   → nom, prénom, bio, téléphone
 *   POST   /dashboard/partenaire/parametres/photo    → multipart → User.profilePicture
 *   PATCH  /dashboard/partenaire/parametres/zone     → localisation
 *   GET    /dashboard/partenaire/parametres/securite
 *   PATCH  /dashboard/partenaire/parametres/securite/password
 *   PATCH  /dashboard/partenaire/parametres/securite/2fa
 *   GET    /dashboard/partenaire/parametres/notifications
 *   PATCH  /dashboard/partenaire/parametres/notifications
 *   GET    /dashboard/partenaire/parametres/confidentialite
 *   PATCH  /dashboard/partenaire/parametres/confidentialite
 *   GET    /dashboard/partenaire/parametres/preferences
 *   PATCH  /dashboard/partenaire/parametres/preferences
 *   PATCH  /dashboard/partenaire/parametres/danger/pause
 *   PATCH  /dashboard/partenaire/parametres/danger/desactiver
 *   DELETE /dashboard/partenaire/parametres/danger/supprimer
 *
 * Mapping des champs :
 *   - firstName/lastName/email/profilePicture → entité User (via backend)
 *   - name/phone/bio/zone/localisation → entité Partner
 *   - notifSettings/privacySettings/preferences → colonnes JSON Partner,
 *     aplatissées ici pour simplifier la lecture par les sections
 * ================================================================ */

import { useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

// ─────────────────────────────────────────────────────────────
// INTERFACE — correspond exactement à PartenaireParametresResponse
// du backend, avec les JSON (notifSettings…) aplatis en champs
// individuels pour que les sections les lisent directement.
// ─────────────────────────────────────────────────────────────

export interface PartenaireData {
  /* Identité */
  id:             string;
  userId:         string;
  firstName:      string | null;
  lastName:       string | null;
  email:          string | null;
  phone:          string | null;
  name:           string;           // Partner.name (nom commercial)
  bio:            string | null;
  profilePicture: string | null;

  /* Statut partenaire */
  status:         string;           // 'pending' | 'active' | 'suspended'
  palier:         string;           // 'bronze' | 'silver' | 'gold' | 'platinum'
  isVerified:     boolean;
  memberSince:    string | null;    // ISO date

  /* Zone d'activité / localisation */
  zone:           string | null;
  adresse:        string | null;
  commune:        string | null;
  ville:          string | null;
  region:         string | null;
  pays:           string;
  codePostal:     string | null;
  latitude:       number | null;
  longitude:      number | null;

  /* Stats réseau */
  totalCompanies:     number;
  totalDeliveries:    number;
  totalCorrespondants:number;

  /* Sécurité */
  twoFaEnabled: boolean;
  twoFaMethod:  string | null;

  /* Notifications — aplaties depuis notifSettings (JSON) */
  notifActeurActive:   boolean;
  notifCommission:     boolean;
  notifSignalement:    boolean;
  notifPalier:         boolean;
  notifNews:           boolean;
  canalEmail:          boolean;
  canalSms:            boolean;
  canalWhatsapp:       boolean;
  canalPush:           boolean;

  /* Confidentialité — aplaties depuis privacySettings (JSON) */
  profilPublic:        boolean;
  afficherTelephone:   boolean;
  apparaitreClassement:boolean;

  /* Préférences — aplaties depuis preferences (JSON) */
  langue:    string;
  apparence: string;
}

// ─────────────────────────────────────────────────────────────
// TYPE retourné par GET /dashboard/partenaire/parametres
// (reflect exact de PartenaireParametresResponse backend)
// ─────────────────────────────────────────────────────────────

interface ApiResponse {
  id:             string;
  userId:         string;
  firstName:      string | null;
  lastName:       string | null;
  email:          string | null;
  phone:          string | null;
  name:           string;
  bio:            string | null;
  profilePicture: string | null;
  status:         string;
  palier:         string;
  isVerified:     boolean;
  memberSince:    string | null;
  zone:           string | null;
  adresse:        string | null;
  commune:        string | null;
  ville:          string | null;
  region:         string | null;
  pays:           string;
  codePostal:     string | null;
  latitude:       number | null;
  longitude:      number | null;
  totalCompanies:     number;
  totalDeliveries:    number;
  totalCorrespondants:number;
  twoFaEnabled: boolean;
  twoFaMethod:  string | null;
  /* Les 3 champs JSON retournés déjà parsés en objet ou null */
  notifSettings:   Record<string, boolean> | null;
  privacySettings: Record<string, boolean> | null;
  preferences:     Record<string, string>  | null;
}

// ─────────────────────────────────────────────────────────────
// MAPPING — ApiResponse → PartenaireData (aplatie)
// ─────────────────────────────────────────────────────────────

function mapApiToData(r: ApiResponse): PartenaireData {
  const n  = r.notifSettings   ?? {};
  const pr = r.privacySettings ?? {};
  const pf = r.preferences     ?? {};

  return {
    id:         r.id,
    userId:     r.userId,
    firstName:  r.firstName,
    lastName:   r.lastName,
    email:      r.email,
    phone:      r.phone,
    name:       r.name,
    bio:        r.bio,
    profilePicture: r.profilePicture,
    status:     r.status,
    palier:     r.palier,
    isVerified: r.isVerified,
    memberSince:r.memberSince,
    zone:       r.zone,
    adresse:    r.adresse,
    commune:    r.commune,
    ville:      r.ville,
    region:     r.region,
    pays:       r.pays,
    codePostal: r.codePostal,
    latitude:   r.latitude,
    longitude:  r.longitude,
    totalCompanies:     r.totalCompanies,
    totalDeliveries:    r.totalDeliveries,
    totalCorrespondants:r.totalCorrespondants,
    twoFaEnabled: r.twoFaEnabled,
    twoFaMethod:  r.twoFaMethod,
    /* Notifications */
    notifActeurActive:   n.notifActeurActive   ?? true,
    notifCommission:     n.notifCommission     ?? true,
    notifSignalement:    n.notifSignalement     ?? true,
    notifPalier:         n.notifPalier         ?? true,
    notifNews:           n.notifNews           ?? false,
    canalEmail:          n.canalEmail          ?? true,
    canalSms:            n.canalSms            ?? true,
    canalWhatsapp:       n.canalWhatsapp       ?? true,
    canalPush:           n.canalPush           ?? false,
    /* Confidentialité */
    profilPublic:        pr.profilPublic        ?? true,
    afficherTelephone:   pr.afficherTelephone   ?? true,
    apparaitreClassement:pr.apparaitreClassement ?? false,
    /* Préférences */
    langue:    pf.langue    ?? 'fr',
    apparence: pf.apparence ?? 'light',
  };
}

// ─────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────

export function usePartenaireParametres() {
  const [data,    setData]    = useState<PartenaireData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* ── Chargement depuis la base de données ── */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiFetch<ApiResponse>('/dashboard/partenaire/parametres');
      setData(mapApiToData(raw));
    } catch (err: any) {
      setError(err?.message ?? 'Impossible de charger les paramètres.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* ── Wrapper générique PATCH — retourne ApiResponse complète ── */
  async function patchFull(endpoint: string, body: unknown): Promise<void> {
    setSaving(true);
    try {
      const raw = await apiFetch<ApiResponse>(endpoint, { method: 'PATCH', body });
      setData(mapApiToData(raw));
    } finally {
      setSaving(false);
    }
  }

  /* ── Wrapper PATCH pour les endpoints retournant un objet partiel
     (notifications, confidentialité, préférences).
     Fusionne le résultat dans l'état existant. ── */
  async function patchPartial(
    endpoint: string,
    body: unknown,
    /* clés à fusionner dans data */
    merge: (result: Record<string, unknown>, prev: PartenaireData) => Partial<PartenaireData>,
  ): Promise<void> {
    setSaving(true);
    try {
      const result = await apiFetch<Record<string, unknown>>(endpoint, { method: 'PATCH', body });
      setData(prev => prev ? { ...prev, ...merge(result, prev) } : prev);
    } finally {
      setSaving(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // API : PROFIL
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/profil */
  const saveProfil = (body: Partial<PartenaireData>) =>
    patchFull('/dashboard/partenaire/parametres/profil', body);

  /** POST /dashboard/partenaire/parametres/photo (multipart) */
  const uploadPhoto = useCallback(async (file: File): Promise<void> => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await apiFetch<{ profilePicture: string }>(
        '/dashboard/partenaire/parametres/photo',
        { method: 'POST', body: form },
      );
      setData(prev => prev ? { ...prev, profilePicture: res.profilePicture } : prev);
    } finally {
      setSaving(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────
  // API : ZONE / LOCALISATION
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/zone */
  const saveZone = (body: Partial<PartenaireData>) =>
    patchFull('/dashboard/partenaire/parametres/zone', body);

  // ─────────────────────────────────────────────────────────
  // API : SÉCURITÉ
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/securite/password */
  const changePassword = useCallback(async (
    currentPassword: string, newPassword: string, confirmPassword: string,
  ): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch('/dashboard/partenaire/parametres/securite/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword, confirmPassword },
      });
    } finally {
      setSaving(false);
    }
  }, []);

  /** PATCH /dashboard/partenaire/parametres/securite/2fa */
  const saveSecurite = (body: { twoFaEnabled: boolean; twoFaMethod?: string | null }) =>
    patchPartial(
      '/dashboard/partenaire/parametres/securite/2fa',
      body,
      (result, prev) => ({
        twoFaEnabled: (result.twoFaEnabled as boolean) ?? prev.twoFaEnabled,
        twoFaMethod:  (result.method as string | null) ?? prev.twoFaMethod,
      }),
    );

  // ─────────────────────────────────────────────────────────
  // API : NOTIFICATIONS
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/notifications */
  const saveNotifications = (body: Partial<PartenaireData>) =>
    patchPartial(
      '/dashboard/partenaire/parametres/notifications',
      body,
      (result) => result as Partial<PartenaireData>,
    );

  // ─────────────────────────────────────────────────────────
  // API : CONFIDENTIALITÉ
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/confidentialite */
  const saveConfidentialite = (body: Partial<PartenaireData>) =>
    patchPartial(
      '/dashboard/partenaire/parametres/confidentialite',
      body,
      (result) => result as Partial<PartenaireData>,
    );

  // ─────────────────────────────────────────────────────────
  // API : PRÉFÉRENCES
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/preferences */
  const savePreferences = (body: Partial<PartenaireData>) =>
    patchPartial(
      '/dashboard/partenaire/parametres/preferences',
      body,
      (result) => result as Partial<PartenaireData>,
    );

  // ─────────────────────────────────────────────────────────
  // API : ZONE DANGER
  // ─────────────────────────────────────────────────────────

  /** PATCH /dashboard/partenaire/parametres/danger/pause */
  const suspendreCompte = useCallback(async (password: string): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch('/dashboard/partenaire/parametres/danger/pause', {
        method: 'PATCH', body: { password },
      });
      setData(prev => prev ? { ...prev, status: 'pending' } : prev);
    } finally {
      setSaving(false);
    }
  }, []);

  /** DELETE /dashboard/partenaire/parametres/danger/supprimer */
  const supprimerCompte = useCallback(async (password: string): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch('/dashboard/partenaire/parametres/danger/supprimer', {
        method: 'DELETE', body: { password },
      });
    } finally {
      setSaving(false);
    }
  }, []);

  return {
    data, loading, saving, error, refresh,
    saveProfil,    uploadPhoto,
    saveZone,
    changePassword, saveSecurite,
    saveNotifications,
    saveConfidentialite,
    savePreferences,
    suspendreCompte, supprimerCompte,
  };
}
