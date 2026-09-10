/* ============================================================
 * FICHIER : src/dashboards/correspondant/hooks/useCorrespondantParametres.ts
 *
 * Hook React qui reflète exactement l'architecture backend :
 *   - data contient firstName/lastName/email/phone/profilePicture
 *     (viennent de User, fusionnés par getParametres())
 *   - saveProfil() envoie tous ces champs au PATCH /profil
 *     qui les dispatche vers User ou Correspondent côté serveur
 *   - uploadPhoto() met à jour User.profilePicture (via /profil/photo)
 *
 * BUG CORRIGÉ (critique) — ce hook réimplémentait son propre client
 * HTTP avec une URL codée en dur sur 'http://localhost:3001/api' (au
 * lieu de VITE_API_URL) et l'ANCIEN mécanisme d'authentification par
 * en-tête "Authorization: Bearer" lu depuis localStorage — l'app est
 * passée à l'authentification par cookie httpOnly (voir apiFetch.ts) :
 * ce fetch n'envoyait jamais `credentials: 'include'`, donc le cookie
 * n'était jamais transmis, et retombait sur le token Bearer figé sur la
 * toute première connexion (jamais rafraîchi, voir le commentaire de
 * silentRefresh() dans apiFetch.ts) — expiré au bout d'1h (JWT_TTL_ACCESS),
 * plus aucun appel de cette page ne fonctionnait jusqu'à une reconnexion
 * complète. Combiné à l'URL figée sur localhost, TOUTE la page Paramètres
 * du correspondant était donc inutilisable en dehors du dev local, et
 * même en dev local seulement pendant la première heure après connexion.
 * Remplacé par le client HTTP partagé (apiFetch, cookie + silent refresh
 * + VITE_API_URL), utilisé par tous les autres dashboards. */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch as sharedApiFetch } from '../../../shared/services/apiFetch';

const BASE = '/correspondant/parametres';

function apiFetch<T>(endpoint: string, options?: { method?: 'GET'|'POST'|'PATCH'|'PUT'|'DELETE'; body?: unknown }): Promise<T> {
  return sharedApiFetch<T>(endpoint, options);
}

// ─── Types ────────────────────────────────────────────────────

export interface HoraireItem {
  jour: string; ouverture: string; fermeture: string; actif: boolean;
}

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
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
  depotLatitude:   number | null; depotLongitude:  number | null;
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
  /** Session réellement active (device/navigateur/IP/date) — null si
   *  indisponible. Une seule session peut être active à la fois sur
   *  Shoneya (voir SessionService), voir SecSecurite.tsx. */
  currentSession: CurrentSessionInfo | null;

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
      const result = await apiFetch<CorrespondantData>(BASE);
      setData(result);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Helper PATCH/PUT — fusionne la réponse dans le state local.
   * apiFetch (partagé) stringify le body automatiquement — ne JAMAIS
   * repasser JSON.stringify() ici (double-encodage). */
  const doSave = useCallback(async (
    endpoint: string,
    body: object,
    method: 'PATCH'|'PUT'|'POST'|'DELETE' = 'PATCH',
  ) => {
    setSaving(true);
    try {
      const result = await apiFetch<Partial<CorrespondantData>>(endpoint, { method, body });
      setData(prev => prev ? { ...prev, ...result } : prev);
      return result;
    } finally { setSaving(false); }
  }, []);

  /* Helper upload multipart — apiFetch (partagé) détecte FormData
   * automatiquement (pas de Content-Type JSON, pas de stringify). */
  const doUpload = useCallback(async (
    endpoint: string,
    fieldName: string,
    file: File,
  ) => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append(fieldName, file);
      return await apiFetch<Record<string, unknown>>(endpoint, { method: 'POST', body: form });
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

  /* BUG CORRIGÉ — ZoneService.updateHoraires() renvoie un TABLEAU
   * (CorrespondantHoraire[]), pas un Correspondent partiel : doSave()
   * ci-dessus fait `{...prev, ...result}`, et spreader un tableau
   * injecte des clés numériques fantômes ("0","1"...) dans `data` sans
   * jamais rafraîchir le vrai champ `data.horaires` (resté périmé).
   * Appel direct + fusion ciblée sur la bonne clé, comme pour les
   * dashboards entreprise/livreur (voir leurs hooks respectifs). */
  const saveHoraires = useCallback(async (horaires: HoraireItem[]): Promise<void> => {
    setSaving(true);
    try {
      const updated = await apiFetch<HoraireItem[]>('/correspondant/parametres/zone/horaires', { method: 'PUT', body: { horaires } });
      setData(prev => prev ? { ...prev, horaires: updated } : prev);
    } finally { setSaving(false); }
  }, []);

  // ── §4 Entités ────────────────────────────────────────────
  const regenererCode = useCallback(async (type: 'boutique' | 'livreur') => {
    setSaving(true);
    try {
      const r = await apiFetch<{ code: string; expiry: string; max: number }>(
        `/correspondant/parametres/entites/codes/${type}`,
        { method: 'POST' },
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
  /* SÉCURITÉ (backend) — l'API ne renvoie plus l'URL des documents
   * officiels après upload (CNI, bail, assurance, casier judiciaire,
   * registre), seulement `{present:true}` (voir DocumentsService.
   * uploadDocument côté backend) : ce sont des pièces sensibles, elles
   * n'ont rien à faire dans une réponse JSON visible depuis les DevTools,
   * alors que l'UI ne s'est jamais servie que de la présence/absence. On
   * marque donc juste le champ comme "présent" avec une valeur locale
   * factice plutôt que de dépendre d'une URL qui n'existe plus. */
  const uploadDocument = useCallback(async (type: string, file: File) => {
    const res = await doUpload(`/correspondant/parametres/documents/${type}`, 'document', file);
    const map: Record<string, keyof CorrespondantData> = {
      cni: 'documentCni', bail: 'documentBail', assurance: 'documentAssurance',
      casier: 'documentCasier', registre: 'documentRegistre',
    };
    if (map[type] && res.present) {
      setData(prev => prev ? { ...prev, [map[type]]: 'uploaded' } : prev);
    }
  }, [doUpload]);

  /* SÉCURITÉ (backend) — plus d'URL statique stockée pour ces documents
   * sensibles : "Voir le document" doit maintenant demander une URL
   * signée fraîche à chaque clic (voir GET .../documents/:type/url côté
   * backend), plutôt que de dépendre d'un lien permanent stocké côté
   * client. */
  const getDocumentUrl = useCallback(async (type: string): Promise<string> => {
    const res = await apiFetch<{ url: string }>(`/correspondant/parametres/documents/${type}/url`);
    return res.url;
  }, []);

  const deleteDocument = useCallback(async (type: string) => {
    await apiFetch(`/correspondant/parametres/documents/${type}`, { method: 'DELETE' });
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
    method: 'POST', body,
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
  const suspendreCompte  = useCallback(() => apiFetch('/correspondant/parametres/danger/suspendre',  { method:'POST'   }), []);
  const desactiverCompte = useCallback(() => apiFetch('/correspondant/parametres/danger/desactiver', { method:'POST'   }), []);
  const supprimerCompte  = useCallback(() => apiFetch('/correspondant/parametres/danger/supprimer',  { method:'DELETE' }), []);

  return {
    data, loading, saving, error, refresh: load,
    saveProfil, uploadPhoto,
    saveDepot,
    saveZone, saveHoraires,
    regenererCode, saveEntites,
    saveColis,
    savePaiement,
    uploadDocument, deleteDocument, getDocumentUrl,
    saveSecurite, changePassword,
    saveNotifications,
    saveConfidentialite,
    suspendreCompte, desactiverCompte, supprimerCompte,
  };
}