/*
 * FICHIER : src/dashboards/entreprise/hooks/useParametres.ts
 *
 * Hook central de la page paramètres entreprise.
 *
 * Adapté à ton apiFetch existant :
 *   - body JSON  → { method, body: objetJS }  (apiFetch stringify automatiquement)
 *   - body upload → { method, body: formData } (apiFetch détecte FormData automatiquement)
 *   - Pas besoin de flag isFormData
 */

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';

// ─────────────────────────────────────────────────────────────
// TYPE — aligne sur entreprise-profile.entity.ts
// ─────────────────────────────────────────────────────────────

export interface HoraireJour {
  id:        string;
  jour:      string;
  ouverture: string | null;
  fermeture: string | null;
  actif:     boolean;
}

export interface ParametresData {
  // Section 1 — Boutique & Identité
  id:            string;
  companyName:   string;
  description:   string | null;
  logo:          string | null;
  coverImage:    string | null;
  status:        string;
  slogan:        string | null;
  tags:          string | null;
  website:       string | null;
  companyTypeId: string | null;
  companyType?:  { id: string; nom: string; icone: string | null };

  // Section 2 — Contact & Localisation
  businessPhone: string | null;
  businessEmail: string | null;
  whatsapp:      string | null;
  adresse:       string | null;
  commune:       string | null;
  ville:         string | null;
  region:        string | null;
  pays:          string;
  codePostal:    string | null;
  repere:        string | null;
  latitude:      number | null;
  longitude:     number | null;

  // Section 3 — Horaires
  horaires?: HoraireJour[];

  // Section 4 — Catalogue
  showOutOfStock:  boolean;
  autoPublish:     boolean;
  showStrikePrice: boolean;
  allowReviews:    boolean;
  devise:          string;
  returnPolicy:    string | null;

  // Section 5 — Livraison
  livraisonStandard: boolean;
  livraisonShopi:    boolean;
  livraisonCorresp:  boolean;
  clickCollect:      boolean;
  livraisonExpress:  boolean;
  zonesLivraison:    string[] | null;

  // Section 6 — Paiement
  paymentMethods:  Record<string, unknown>[] | null;
  receptionMethod: string | null;
  receptionNumber: string | null;
  payoutFrequency: string;
  payoutMinAmount: number;
  nif:             string | null;
  rccm:            string | null;
  raisonSociale:   string | null;

  // Section 7 — Plan
  plan: string;

  // Section 8 — Documents
  ownerIdDocument:    string | null;
  documentRccm:       string | null;
  documentBancaire:   string | null;
  documentPhoto:      string | null;
  documentNif:        string | null;
  verificationStatus: string;

  // Section 9 — Sécurité
  twoFaEnabled: boolean;
  twoFaMethod:  string | null;

  // Section 10 — Notifications
  notifSettings: Record<string, boolean> | null;

  // Section 11 — Confidentialité
  privacySettings: Record<string, boolean> | null;

  // Statistiques
  averageRating: number;
  totalOrders:   number;
  totalRevenue:  number;
}

// ─────────────────────────────────────────────────────────────
// BASE URL des endpoints paramètres
// ─────────────────────────────────────────────────────────────

const BASE = '/dashboard/entreprise/parametres';

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────

export function useParametres() {
  const [data,    setData]    = useState<ParametresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  // ── Chargement (initial + rechargement manuel) ──────────────
  const reload = useCallback(() => {
    return apiFetch<ParametresData>(BASE)
      .then(d  => { setData(d); setError(null); })
      .catch(() => setError('Impossible de charger les paramètres.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  // ── Helper PATCH JSON ──────────────────────────────────────
  // apiFetch stringify body automatiquement si ce n'est pas FormData
  const patch = useCallback(async (endpoint: string, body: unknown): Promise<void> => {
    setSaving(true);
    try {
      const updated = await apiFetch<ParametresData>(`${BASE}/${endpoint}`, {
        method: 'PATCH',
        body,
      });
      setData(updated);
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Helper POST FormData (uploads) ─────────────────────────
  // apiFetch détecte instanceof FormData → pas de Content-Type JSON, pas de stringify
  const postFile = useCallback(async (endpoint: string, file: File): Promise<unknown> => {
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file); // nom du champ attendu par FileInterceptor('file')

      return await apiFetch(`${BASE}/${endpoint}`, {
        method: 'POST',
        body:   form, // ← FormData détecté automatiquement par apiFetch
      });
    } finally {
      setSaving(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SECTION 1+2 — Boutique, Contact, Logo, Cover
  // ─────────────────────────────────────────────────────────────

  const saveBoutique = useCallback((body: Partial<ParametresData>) =>
    patch('boutique', body), [patch]);

  const saveContact = useCallback((body: Partial<ParametresData>) =>
    patch('contact', body), [patch]);

  const uploadLogo = useCallback(async (file: File): Promise<void> => {
    const res = await postFile('logo', file) as { logo: string };
    // Mise à jour locale immédiate sans recharger
    setData(prev => prev ? { ...prev, logo: res.logo } : prev);
  }, [postFile]);

  const uploadCover = useCallback(async (file: File): Promise<void> => {
    const res = await postFile('cover', file) as { coverImage: string };
    setData(prev => prev ? { ...prev, coverImage: res.coverImage } : prev);
  }, [postFile]);

  const deleteLogo = useCallback(async (): Promise<void> => {
    setSaving(true);
    try {
      await apiFetch(`${BASE}/logo`, { method: 'DELETE' });
      setData(prev => prev ? { ...prev, logo: null } : prev);
    } finally {
      setSaving(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────
  // SECTION 3 — Horaires
  // ─────────────────────────────────────────────────────────────

  /* BUG CORRIGÉ — `horaires` vient de l'état local de HorairesSection,
   * initialisé depuis les données GET (qui incluent le vrai `id` de
   * chaque ligne CompanyHoraire). Le DTO backend (HoraireJourDto) ne
   * déclare pas `id` et rejette toute propriété non attendue
   * (whitelist strict) → PATCH échouait systématiquement en 400
   * ("property id should not exist"), pour TOUTE modification
   * d'horaires depuis toujours. On n'envoie que les champs que le DTO
   * accepte réellement — l'upsert backend se fait par jour, pas par id. */
  /* BUG CORRIGÉ (2/2) — la colonne Postgres `time` renvoie "HH:MM:SS"
   * (ex: "08:00:00"), pas "HH:MM" — le DTO backend exige strictement
   * "HH:MM". Un jour jamais retouché dans l'UI (qui garde alors la valeur
   * telle que chargée depuis le GET) échouait donc aussi la validation,
   * même une fois le bug `id` ci-dessus corrigé. On tronque aux 5
   * premiers caractères avant l'envoi — <input type="time"> produit déjà
   * "HH:MM" nativement, ça ne change donc rien pour un jour retouché. */
  const saveHoraires = useCallback((horaires: HoraireJour[]) =>
    patch('horaires', {
      horaires: horaires.map(({ jour, ouverture, fermeture, actif }) => ({
        jour,
        ouverture: ouverture ? ouverture.slice(0, 5) : ouverture,
        fermeture: fermeture ? fermeture.slice(0, 5) : fermeture,
        actif,
      })),
    }), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 4 — Catalogue
  // ─────────────────────────────────────────────────────────────

  const saveCatalogue = useCallback((body: Partial<ParametresData>) =>
    patch('catalogue', body), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 5 — Livraison
  // ─────────────────────────────────────────────────────────────

  const saveLivraison = useCallback((body: Partial<ParametresData>) =>
    patch('livraison', body), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 6 — Paiement
  // ─────────────────────────────────────────────────────────────

  const savePaiement = useCallback((body: Partial<ParametresData>) =>
    patch('paiement', body), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 7 — Plan de commissions
  // ─────────────────────────────────────────────────────────────

  const savePlan = useCallback((plan: string) =>
    patch('commissions', { plan }), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 8 — Documents
  // uploadDocument : POST multipart → apiFetch détecte FormData
  // ─────────────────────────────────────────────────────────────

  /* SÉCURITÉ (backend) — l'API ne renvoie plus l'URL des 4 documents
   * sensibles (CNI/RCCM/bancaire/NIF) après upload, seulement
   * `{present:true}` (voir DocumentsParametresService.uploadDocument) :
   * une pièce d'identité/relevé bancaire n'a rien à faire dans une
   * réponse JSON visible depuis les DevTools, alors que l'UI n'a jamais
   * utilisé que la présence/absence (DocumentsSection.tsx, isPresent).
   * On recharge donc les paramètres plutôt que de deviner une valeur
   * locale à partir d'un champ qui n'existe plus dans la réponse. */
  const uploadDocument = useCallback(async (type: string, file: File): Promise<void> => {
    await postFile(`documents/${type}`, file);
    await reload();
  }, [postFile, reload]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 9 — Sécurité
  // ─────────────────────────────────────────────────────────────

  const save2FA = useCallback((body: { twoFaEnabled: boolean; twoFaMethod?: string }) =>
    patch('securite/2fa', body), [patch]);

  const savePassword = useCallback((body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    patch('securite/password', body), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 10 — Notifications
  // ─────────────────────────────────────────────────────────────

  const saveNotifs = useCallback((body: Record<string, boolean>) =>
    patch('notifications', body), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 11 — Confidentialité
  // ─────────────────────────────────────────────────────────────

  const savePrivacy = useCallback((body: Record<string, boolean>) =>
    patch('confidentialite', body), [patch]);

  // ─────────────────────────────────────────────────────────────

  return {
    // État
    data, loading, error, saving, reload,

    // Sections 1+2
    saveBoutique, saveContact,
    uploadLogo, uploadCover, deleteLogo,

    // Section 3
    saveHoraires,

    // Section 4
    saveCatalogue,

    // Section 5
    saveLivraison,

    // Section 6
    savePaiement,

    // Section 7
    savePlan,

    // Section 8
    uploadDocument,

    // Section 9
    save2FA, savePassword,

    // Section 10
    saveNotifs,

    // Section 11
    savePrivacy,
  };
}