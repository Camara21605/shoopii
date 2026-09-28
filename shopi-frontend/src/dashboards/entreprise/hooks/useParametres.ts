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

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../../../shared/services/apiFetch';
import { pickIdentity, publishIdentity } from './boutiqueIdentity';

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

export interface CurrentSessionInfo {
  device:         string;
  browser:        string;
  ipAddress:      string | null;
  connectedSince: string;
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
  /** Modèle économique fixé à l'inscription (produits OU services). */
  businessModel?: 'products' | 'services';
  companyType?:  { id: string; nom: string; icone: string | null };
  /** Prénom/nom du propriétaire (User lié) — lecture seule, voir
   *  BoutiqueSection.tsx "Responsable & Propriétaire". */
  ownerFirstName: string | null;
  ownerLastName:  string | null;
  /** Statut du COMPTE propriétaire (validation / suspension par l'administration).
   *  'active' = le propriétaire peut rendre sa boutique visible ou la mettre en pause. */
  ownerStatus?:   'active' | 'pending' | 'suspended' | 'banned' | 'inactive' | null;
  /** Nombre réel de produits de la boutique. */
  productCount?:  number;
  quartier?:      string | null;
  /** Fin d'une désactivation temporaire (30 j) — réactivation automatique. */
  suspendedUntil?: string | null;

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
  /** Session réellement active (device/navigateur/IP/date) — null si
   *  indisponible. Une seule session peut être active à la fois sur
   *  Shoneya (voir SessionService), voir SecuriteSection.tsx. */
  currentSession: CurrentSessionInfo | null;

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

  /* ── Enregistrements EN SÉRIE, section par section ─────────────
   * BUG CORRIGÉ — « je coche, ça se décoche » : quand le serveur répond
   * lentement (plusieurs secondes), cliquer plusieurs interrupteurs de suite
   * lançait plusieurs enregistrements EN PARALLÈLE. Leurs réponses arrivaient
   * en retard et dans le désordre : l'écran se réalignait sur la réponse d'une
   * requête PLUS ANCIENNE (la case revenait en arrière), et côté serveur une
   * ancienne requête pouvait finir après une récente et écraser en base le
   * dernier choix. Désormais, par section (clé) :
   *   - une seule requête à la fois, dans l'ordre des clics ;
   *   - seule la réponse de la DERNIÈRE requête met l'écran à jour ;
   *   - `coalesce` (corps = état complet, ex. horaires) : une requête dépassée
   *     par une plus récente n'est même pas envoyée ;
   *   - si la dernière requête échoue, on recharge les vraies valeurs. */
  const chainsRef   = useRef<Record<string, Promise<unknown>>>({});
  const seqRef      = useRef<Record<string, number>>({});
  const inFlightRef = useRef(0);
  const serial = useCallback(<T,>(key: string, run: () => Promise<T>, apply: (res: T) => void, coalesce = false): Promise<T | undefined> => {
    const seq = (seqRef.current[key] = (seqRef.current[key] ?? 0) + 1);
    const isLatest = () => seqRef.current[key] === seq;
    const job = (chainsRef.current[key] ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        if (coalesce && !isLatest()) return undefined;     // dépassée : la plus récente enverra l'état complet
        inFlightRef.current += 1;
        setSaving(true);
        try {
          const res = await run();
          if (!isLatest()) return undefined;              // une requête plus récente fera foi
          apply(res);
          return res;
        } catch (err) {
          if (isLatest()) void reloadRef.current();          // l'écran revient à ce qui est vraiment enregistré
          throw err;
        } finally {
          inFlightRef.current -= 1;
          if (inFlightRef.current === 0) setSaving(false);
        }
      });
    chainsRef.current[key] = job;
    return job;
  }, []);

  // ── Chargement (initial + rechargement manuel) ──────────────
  const reload = useCallback(() => {
    return apiFetch<ParametresData>(BASE)
      .then(d  => { setData(d); setError(null); })
      .catch(() => setError('Impossible de charger les paramètres.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);
  const reloadRef = useRef(reload);   // reload est stable (useCallback sans dépendance)

  /* Fermer ou recharger l'onglet pendant un enregistrement le perdrait :
   * le navigateur demande confirmation tant qu'une requête est en cours. */
  useEffect(() => {
    if (!saving) return;
    const avertir = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avertir);
    return () => window.removeEventListener('beforeunload', avertir);
  }, [saving]);

  /* Nom, logo, statut… modifiés ou rechargés ici : le shell (barre latérale, barre du haut) et la mémoire
   * du navigateur suivent aussitôt — plus besoin de recharger la page pour voir le nouveau nom. */
  useEffect(() => {
    if (data?.id && data.companyName) {
      publishIdentity(pickIdentity({ ...data, businessModel: data.businessModel ?? 'products' }));
    }
  }, [data?.id, data?.companyName, data?.logo, data?.status, data?.businessEmail, data?.ville, data?.pays, data?.businessModel]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helper PATCH JSON ──────────────────────────────────────
  // apiFetch stringify body automatiquement si ce n'est pas FormData
  //
  // BUG CORRIGÉ — remplaçait tout `data` par la réponse PATCH brute. Or
  // seuls les endpoints boutique/contact attachent ownerFirstName/
  // ownerLastName/currentSession (voir BoutiqueParametresService) : après
  // n'importe quelle AUTRE sauvegarde (catalogue, livraison, paiement,
  // commissions — dont la réponse est un Company brut sans ces 3 champs
  // additionnels), ces valeurs auraient disparu de l'écran jusqu'au
  // prochain rechargement complet. Fusionner au lieu de remplacer :
  // un champ absent de la réponse garde sa valeur déjà en mémoire.
  const patch = useCallback((endpoint: string, body: unknown): Promise<void> =>
    serial(endpoint,
      () => apiFetch<ParametresData>(`${BASE}/${endpoint}`, { method: 'PATCH', body }),
      updated => setData(prev => prev ? { ...prev, ...updated } : updated),
    ).then(() => undefined), [serial]);

  /* ── Helper PATCH pour les endpoints qui renvoient un objet PARTIEL
   * (juste le blob JSON, pas un ParametresData complet) — notifications
   * et confidentialité, voir Notifs/PrivacyParametresService.updateX()
   * qui renvoient `company.notifSettings`/`company.privacySettings`
   * seuls, jamais l'entité Company entière.
   *
   * BUG CORRIGÉ — saveNotifs/savePrivacy réutilisaient patch() ci-dessus,
   * qui traitait ce blob partiel comme un ParametresData complet : avant
   * le correctif de fusion ci-dessus, ça REMPLAÇAIT tout `data` par les
   * 14 (ou 7) booléens seuls — plus aucune autre section n'avait de
   * données jusqu'au prochain rechargement complet. Même après la
   * fusion, le blob aurait atterri à plat sur `data` (`data.newOrder`…)
   * au lieu de `data.notifSettings`, jamais relu par personne. On range
   * maintenant explicitement le résultat dans la bonne clé imbriquée. */
  const patchNested = useCallback(async (
    endpoint: string, body: unknown, dataKey: 'notifSettings' | 'privacySettings',
  ): Promise<void> =>
    serial(endpoint,
      () => apiFetch<Record<string, boolean>>(`${BASE}/${endpoint}`, { method: 'PATCH', body }),
      updated => setData(prev => prev ? { ...prev, [dataKey]: updated } : prev),
    ).then(() => undefined), [serial]);

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
  /* BUG CORRIGÉ — « je coche, ça se décoche » : PATCH horaires renvoie la
   * LISTE des jours (pas la fiche entreprise). patch() la fusionnait comme un
   * objet (`{ ...prev, ...[jours] }` → clés "0", "1"…) : data.horaires restait
   * l'ANCIENNE semaine et la section Horaires se réalignait dessus juste après
   * chaque enregistrement — l'écran revenait en arrière alors que le serveur
   * avait bien enregistré (visible seulement après rechargement). */
  /** Renvoie la semaine enregistrée (réponse de la DERNIÈRE requête), ou undefined si dépassée. */
  const saveHoraires = useCallback((horaires: HoraireJour[]): Promise<HoraireJour[] | undefined> =>
    serial('horaires',
      () => apiFetch<HoraireJour[]>(`${BASE}/horaires`, {
        method: 'PATCH',
        body: {
          horaires: horaires.map(({ jour, ouverture, fermeture, actif }) => ({
            jour,
            ouverture: ouverture ? ouverture.slice(0, 5) : ouverture,
            fermeture: fermeture ? fermeture.slice(0, 5) : fermeture,
            actif,
          })),
        },
      }),
      list => { if (Array.isArray(list)) setData(prev => (prev ? { ...prev, horaires: list } : prev)); },
      true,   // la semaine complète part à chaque fois : seule la plus récente compte
    ), [serial]);

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

  const save2FA = useCallback((body: { twoFaEnabled: boolean; twoFaMethod?: string; currentPassword?: string; code?: string }) =>
    patch('securite/2fa', body), [patch]);

  const savePassword = useCallback((body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    patch('securite/password', body), [patch]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 10 — Notifications
  // ─────────────────────────────────────────────────────────────

  const saveNotifs = useCallback((body: Record<string, boolean>) =>
    patchNested('notifications', body, 'notifSettings'), [patchNested]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 11 — Confidentialité
  // ─────────────────────────────────────────────────────────────

  const savePrivacy = useCallback((body: Record<string, boolean>) =>
    patchNested('confidentialite', body, 'privacySettings'), [patchNested]);

  // ─────────────────────────────────────────────────────────────
  // SECTION 12 — Zone sensible
  //
  // BUG CORRIGÉ — DangerSection.tsx (pause/désactiver/supprimer) n'appelait
  // jamais l'API : les 3 boutons se contentaient d'un toast générique
  // "confirmation requise" sans rien faire, alors que les 3 endpoints
  // backend (PATCH danger/pause, PATCH danger/desactiver, DELETE
  // danger/supprimer — mot de passe requis, voir DangerParametresService)
  // sont réels et complets depuis le début, juste jamais câblés.
  //
  // Réponses différentes de `patch()` (pas un ParametresData complet) →
  // fonctions dédiées plutôt que réutiliser patch(). pause/desactiver
  // rechargent les données ensuite (le badge de statut dans la sidebar,
  // sbcStatus, doit refléter le nouveau Company.status) ; supprimer ne
  // recharge pas — le profil Company n'existe plus, l'appelant (
  // ParametresPage) doit déconnecter l'utilisateur.
  // ─────────────────────────────────────────────────────────────

  const pauseBoutique = useCallback(async (password: string): Promise<{ message: string }> => {
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string }>(`${BASE}/danger/pause`, {
        method: 'PATCH', body: { password },
      });
      await reload();
      return res;
    } finally {
      setSaving(false);
    }
  }, [reload]);

  const desactiverCompte = useCallback(async (password: string): Promise<{ message: string; reactivationAt: string }> => {
    setSaving(true);
    try {
      const res = await apiFetch<{ message: string; reactivationAt: string }>(`${BASE}/danger/desactiver`, {
        method: 'PATCH', body: { password },
      });
      await reload();
      return res;
    } finally {
      setSaving(false);
    }
  }, [reload]);

  const supprimerBoutique = useCallback(async (password: string): Promise<{ message: string }> => {
    setSaving(true);
    try {
      return await apiFetch<{ message: string }>(`${BASE}/danger/supprimer`, {
        method: 'DELETE', body: { password },
      });
    } finally {
      setSaving(false);
    }
  }, []);

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

    // Section 12
    pauseBoutique, desactiverCompte, supprimerBoutique,
  };
}