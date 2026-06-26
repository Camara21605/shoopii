/* ============================================================
 * FICHIER : src/dashboards/correspondant/hooks/useCorrespondantParametres.ts
 *
 * Hook React qui reflète exactement l'architecture backend :
 *   - data contient firstName/lastName/email/phone/profilePicture
 *     (viennent de User, fusionnés par getParametres())
 *   - saveProfil() envoie tous ces champs au PATCH /profil
 *     qui les dispatche vers User ou Correspondent côté serveur
 *   - uploadPhoto() met à jour User.profilePicture (via /profil/photo)
 * ============================================================ */

import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'shopi_access_token';
const BASE_URL  = 'http://localhost:3001/api';

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────

export interface HoraireItem {
  jour: string; ouverture: string; fermeture: string; actif: boolean;
}

export interface CorrespondantData {
  /* ── Depuis User (identité de base) ── */
  firstName:      string;
  lastName:       string;
  email:          string;
  phone:          string | null;
  profilePicture: string | null;   // ← User.profilePicture, pas Correspondent

  /* ── Depuis Correspondent (propre au rôle) ── */
  id:             string;
  fullName:       string;          // cache = firstName + " " + lastName
  bio:            string | null;
  langues:        string | null;
  typeCorrespondant: string;

  /* §2 Dépôt */
  depotNom:        string | null; depotAdresse:    string | null;
  depotCommune:    string | null; depotVille:      string | null;
  depotRepere:     string | null;
  depotPhone:      string | null; // ≠ User.phone (numéro public du relais)
  depotCapacite:   string | null; depotTypeLocal:  string | null;
  depotAcces:      string | null; depotAccessOptions: Record<string, boolean> | null;

  /* §3 Zone & Horaires */
  zonesActives:   string[] | null;
  zoneAutoRules:  Record<string, boolean> | null;
  horaires:       HoraireItem[];

  /* §4 Entités */
  codeBoutique:       string | null; codeBoutiqueExpiry: string | null;
  codeBoutiqueUsages: number;        codeBoutiqueMax:    number;
  codeLivreur:        string | null; codeLivreurExpiry:  string | null;
  codeLivreurUsages:  number;        codeLivreurMax:     number;
  colabSettings:      Record<string, boolean> | null;

  /* §5 Colis */
  colisDelaiMax:    number; colisCapaciteMax:    number; colisValeurMax: number;
  colisPoids:       string | null;
  colisTypesAcceptes: number[] | null;
  colisIncidentRules: Record<string, boolean> | null;

  /* §6 Paiement */
  paiementMethodes:  Record<string, unknown>[] | null;
  virementFrequence: string; virementSeuil: number;

  /* §7 Documents */
  documentCni: string|null; documentBail: string|null; documentAssurance: string|null;
  documentCasier: string|null; documentPhotos: string[]|null; documentRegistre: string|null;
  verificationStatus: string;

  /* §8 Sécurité */
  twoFaEnabled: boolean; twoFaMethod: string | null;

  /* §9-10 */
  notifSettings:   Record<string, Record<string, boolean>> | null;
  privacySettings: Record<string, Record<string, boolean>> | null;

  /* Général */
  status: string; totalMissions: number; averageRating: number;
}

// ─────────────────────────────────────────────────────────────

export function useCorrespondantParametres() {
  const [data,    setData]    = useState<CorrespondantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await apiFetch<CorrespondantData>('/correspondant/parametres');
      setData(result);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Helper PATCH/PUT — fusionne la réponse dans le state local */
  const doSave = useCallback(async (
    endpoint: string,
    body: object,
    method: 'PATCH'|'PUT'|'POST'|'DELETE' = 'PATCH',
  ) => {
    setSaving(true);
    try {
      const result = await apiFetch<Partial<CorrespondantData>>(endpoint, {
        method, body: JSON.stringify(body),
      });
      setData(prev => prev ? { ...prev, ...result } : prev);
      return result;
    } finally { setSaving(false); }
  }, []);

  /* Helper upload multipart */
  const doUpload = useCallback(async (
    endpoint: string,
    fieldName: string,
    file: File,
  ) => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append(fieldName, file);
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ''}` },
        body: form,
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Upload échoué');
      return res.json() as Promise<Record<string, unknown>>;
    } finally { setSaving(false); }
  }, []);

  // ── §1 Profil ─────────────────────────────────────────────
  /**
   * Envoie firstName, lastName, email, phone (→ User)
   * + bio, langues, typeCorrespondant (→ Correspondent).
   * Le serveur dispatche vers les bonnes tables.
   */
  const saveProfil = useCallback((body: Partial<CorrespondantData>) =>
    doSave('/correspondant/parametres/profil', body), [doSave]);

  /**
   * Upload photo → User.profilePicture côté serveur.
   * Met à jour data.profilePicture dans le state.
   */
  const uploadPhoto = useCallback(async (file: File) => {
    const res = await doUpload('/correspondant/parametres/profil/photo', 'photo', file);
    if (res.profilePicture) {
      setData(prev => prev ? { ...prev, profilePicture: res.profilePicture as string } : prev);
    }
  }, [doUpload]);

  // ── §2 Dépôt ──────────────────────────────────────────────
  const saveDepot = useCallback((body: Partial<CorrespondantData>) =>
    doSave('/correspondant/parametres/depot', body), [doSave]);

  // ── §3 Zone & Horaires ────────────────────────────────────
  const saveZone = useCallback((body: {
    zonesActives?: string[]; zoneAutoRules?: Record<string, boolean>;
  }) => doSave('/correspondant/parametres/zone', body), [doSave]);

  const saveHoraires = useCallback((horaires: HoraireItem[]) =>
    doSave('/correspondant/parametres/zone/horaires', { horaires }, 'PUT'), [doSave]);

  // ── §4 Entités ────────────────────────────────────────────
  const regenererCode = useCallback(async (type: 'boutique' | 'livreur') => {
    setSaving(true);
    try {
      const r = await apiFetch<{ code: string; expiry: string; max: number }>(
        `/correspondant/parametres/entites/codes/${type}`,
        { method: 'POST', body: '{}' },
      );
      setData(prev => {
        if (!prev) return prev;
        return type === 'boutique'
          ? { ...prev, codeBoutique: r.code, codeBoutiqueExpiry: r.expiry, codeBoutiqueUsages: 0 }
          : { ...prev, codeLivreur:  r.code, codeLivreurExpiry:  r.expiry, codeLivreurUsages:  0 };
      });
      return r;
    } finally { setSaving(false); }
  }, []);

  const saveEntites = useCallback((body: { colabSettings?: Record<string, boolean> }) =>
    doSave('/correspondant/parametres/entites', body), [doSave]);

  // ── §5 Colis ──────────────────────────────────────────────
  const saveColis = useCallback((body: Partial<CorrespondantData>) =>
    doSave('/correspondant/parametres/colis', body), [doSave]);

  // ── §6 Paiement ───────────────────────────────────────────
  const savePaiement = useCallback((body: Partial<CorrespondantData>) =>
    doSave('/correspondant/parametres/paiement', body), [doSave]);

  // ── §7 Documents ──────────────────────────────────────────
  const uploadDocument = useCallback(async (type: string, file: File) => {
    const res = await doUpload(`/correspondant/parametres/documents/${type}`, 'document', file);
    const map: Record<string, keyof CorrespondantData> = {
      cni: 'documentCni', bail: 'documentBail', assurance: 'documentAssurance',
      casier: 'documentCasier', registre: 'documentRegistre',
    };
    if (map[type] && res.url) {
      setData(prev => prev ? { ...prev, [map[type]]: res.url } : prev);
    }
  }, [doUpload]);

  const deleteDocument = useCallback(async (type: string) => {
    await apiFetch(`/correspondant/parametres/documents/${type}`, { method: 'DELETE', body: '{}' });
    const map: Record<string, keyof CorrespondantData> = {
      cni: 'documentCni', bail: 'documentBail', assurance: 'documentAssurance',
      casier: 'documentCasier', registre: 'documentRegistre',
    };
    if (map[type]) setData(prev => prev ? { ...prev, [map[type]]: null } : prev);
  }, []);

  // ── §8 Sécurité ───────────────────────────────────────────
  const saveSecurite = useCallback((body: { twoFaEnabled?: boolean; twoFaMethod?: string }) =>
    doSave('/correspondant/parametres/securite', body), [doSave]);

  /** Vérifie User.password → met à jour User.password + User.lastPasswordChangedAt */
  const changePassword = useCallback((body: {
    currentPassword: string; newPassword: string;
  }) => apiFetch<{ message: string }>('/correspondant/parametres/securite/password', {
    method: 'POST', body: JSON.stringify(body),
  }), []);

  // ── §9 Notifications ──────────────────────────────────────
  const saveNotifications = useCallback((
    notifSettings: Record<string, Record<string, boolean>>,
  ) => doSave('/correspondant/parametres/notifications', { notifSettings }), [doSave]);

  // ── §10 Confidentialité ───────────────────────────────────
  const saveConfidentialite = useCallback((
    privacySettings: Record<string, Record<string, boolean>>,
  ) => doSave('/correspondant/parametres/confidentialite', { privacySettings }), [doSave]);

  // ── §11 Zone sensible ─────────────────────────────────────
  const suspendreCompte  = useCallback(() => apiFetch('/correspondant/parametres/danger/suspendre',  { method:'POST',   body:'{}' }), []);
  const desactiverCompte = useCallback(() => apiFetch('/correspondant/parametres/danger/desactiver', { method:'POST',   body:'{}' }), []);
  const supprimerCompte  = useCallback(() => apiFetch('/correspondant/parametres/danger/supprimer',  { method:'DELETE', body:'{}' }), []);

  return {
    data, loading, saving, error, refresh: load,
    saveProfil, uploadPhoto,
    saveDepot,
    saveZone, saveHoraires,
    regenererCode, saveEntites,
    saveColis,
    savePaiement,
    uploadDocument, deleteDocument,
    saveSecurite, changePassword,
    saveNotifications,
    saveConfidentialite,
    suspendreCompte, desactiverCompte, supprimerCompte,
  };
}