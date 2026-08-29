/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/pages/AjouterPage.tsx
 *
 * ✅ MODE CRÉATION  : productId absent → formulaire vide
 * ✅ MODE ÉDITION   : productId fourni → données chargées depuis l'API
 *                     → bouton "Mettre à jour" → PATCH /produits/:id
 * ============================================================
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import type { EntreprisePage } from '../types';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface AjouterPageProps {
  onNavigate: (page: EntreprisePage, productId?: string) => void;
  productId?: string; // ✅ Si défini → mode ÉDITION, sinon mode CRÉATION
}

interface CategorieApi {
  id:            string;
  nom:           string;
  subCategories: { id: string; nom: string }[];
}

interface ImageUploaded {
  url:     string;
  ordre:   number;
  alt:     string | null;
  preview: string; // URL.createObjectURL pour nouvelles, url Cloudinary pour existantes
  type:    'image' | 'video';
}

/* Quota médias d'une fiche produit : 4 images + 1 vidéo max (5 au total) — voir produits.service.ts */
const MAX_MEDIA_TOTAL  = 5;
const MAX_MEDIA_IMAGES = 4;
const MAX_MEDIA_VIDEOS = 1;

interface Spec     { cle: string; valeur: string; }
interface Variante { type: string; vals: string; }
interface WholesaleTier { quantiteMin: string; quantiteMax: string; prixUnitaire: string; }

interface FormErrors {
  nom?:         string;
  prix?:        string;
  stock?:       string;
  categorieId?: string;
  general?:     string;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

/* Les valeurs elles-mêmes (VARIANTE_TYPES) restent en français : ce sont
   des données métier stockées telles quelles (v.type === 'Couleur'...),
   seul leur AFFICHAGE est traduit via ajouter.constants.varianteTypes.* */
const VARIANTE_TYPES = ['Couleur', 'Stockage', 'RAM', 'Taille', 'Résolution', 'Matière'];

/* label = clé de traduction (ajouter.constants.paysOrigine.<val> / retourOptions.<val>) */
const PAYS_ORIGINE = [
  { val: 'GN', label: 'ajouter.constants.paysOrigine.GN' },
  { val: 'SN', label: 'ajouter.constants.paysOrigine.SN' },
  { val: 'CI', label: 'ajouter.constants.paysOrigine.CI' },
  { val: 'ML', label: 'ajouter.constants.paysOrigine.ML' },
  { val: 'CM', label: 'ajouter.constants.paysOrigine.CM' },
  { val: 'FR', label: 'ajouter.constants.paysOrigine.FR' },
  { val: 'CN', label: 'ajouter.constants.paysOrigine.CN' },
  { val: 'US', label: 'ajouter.constants.paysOrigine.US' },
  { val: 'DE', label: 'ajouter.constants.paysOrigine.DE' },
  { val: 'GB', label: 'ajouter.constants.paysOrigine.GB' },
  { val: 'JP', label: 'ajouter.constants.paysOrigine.JP' },
  { val: 'AE', label: 'ajouter.constants.paysOrigine.AE' },
];

const RETOUR_OPTIONS = [
  { val: '7j',     label: 'ajouter.constants.retourOptions.7j' },
  { val: '14j',    label: 'ajouter.constants.retourOptions.14j' },
  { val: '30j',    label: 'ajouter.constants.retourOptions.30j' },
  { val: 'defect', label: 'ajouter.constants.retourOptions.defect' },
  { val: 'none',   label: 'ajouter.constants.retourOptions.none' },
];

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

function getToken(): string {
  return localStorage.getItem('shopi_access_token') ?? '';
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError &&
    (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed'));
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div style={{
      background: 'var(--rs-bg)', border: '1.5px solid rgba(220,38,38,.3)',
      borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>❌</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>
          {t('ajouter.errorBanner.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--red)', opacity: 0.85, lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 16, padding: 0, flexShrink: 0 }}>
        <i className="fas fa-xmark" />
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--red)', fontSize: 11.5, marginTop: 5, fontWeight: 600 }}>
      <i className="fas fa-circle-exclamation" style={{ fontSize: 11 }} />
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// VALEUR INITIALE DU FORMULAIRE
// ─────────────────────────────────────────────────────────────

const FORM_INITIAL = {
  nom: '', description: '', prix: '', prixAncien: '', stock: '', seuil: '',
  marque: '', tags: '', visibilite: 'public', reference: '', garantie: '12 mois',
  poids: '', condition: 'neuf', categorieId: '', categorie: '', sousCatId: '', sousCat: '',
  titreSeo: '', descriptionSeo: '', urlSlug: '', longueur: '', largeur: '', hauteur: '',
  paysOrigine: 'GN', politiqueRetour: '7j', contenuBoite: '',
  livraisonStandard: true, livraisonLivreur: true, livraisonCorrespondant: false,
  fraisLivraisonLocal: '', delaiLivraison: '1-3 jours',
  garantiePaiement: true, garantieRetour: true, garantieAuthentic: true, garantieSupport: true,
  langue: 'fr',
  moq: '', conditionnement: '', delaiPreparationGros: '3-5 jours',
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function AjouterPage({ onNavigate, productId }: AjouterPageProps) {
  const { t } = useTranslation();
  const { pop } = useToast();

  // ✅ Mode édition si productId est défini
  const isEditMode = !!productId;

  const [errors,      setErrors]      = useState<FormErrors>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [loadingProd, setLoadingProd] = useState(false); // chargement du produit existant

  // ── Taux de commission plateforme (chargé depuis l'API) ──────────────────
  const [commissionPct, setCommissionPct] = useState<number>(3); // défaut 3 % en attendant

  // ── Catégories ────────────────────────────────────────────────────────────
  const [categoriesApi,   setCategoriesApi]   = useState<CategorieApi[]>([]);
  const [chargementCats,  setChargementCats]  = useState(true);
  const [erreurCats,      setErreurCats]      = useState<string | null>(null);

  // ── Formulaire ────────────────────────────────────────────────────────────
  const [form,       setForm]       = useState({ ...FORM_INITIAL });
  const [images,     setImages]     = useState<ImageUploaded[]>([]);
  const [specs,      setSpecs]      = useState<Spec[]>([
    { cle: t('ajouter.specs.defaultMarque'), valeur: '' },
    { cle: t('ajouter.specs.defaultPuce'), valeur: '' },
    { cle: t('ajouter.specs.defaultConnectivite'), valeur: '' },
  ]);
  const [variantes,    setVariantes]    = useState<Variante[]>([{ type: 'Couleur', vals: '' }]);
  const [variantesOn,  setVariantesOn]  = useState(false);
  const [venteEnGrosOn, setVenteEnGrosOn] = useState(false);
  const [wholesaleTiers, setWholesaleTiers] = useState<WholesaleTier[]>([
    { quantiteMin: '10', quantiteMax: '49', prixUnitaire: '' },
  ]);
  // ── Mode d'ajout : détermine quelles sections du formulaire sont affichées.
  // null = aucun onglet choisi (état initial en création) → seules les 3
  // cartes sont visibles, le formulaire se déplie seulement après un choix. ──
  const [productMode, setProductMode] = useState<'detaille' | 'gros' | 'rapide' | null>(null);

  function handleChangeMode(mode: 'detaille' | 'gros' | 'rapide') {
    setProductMode(mode);
    if (mode === 'gros')   { setVenteEnGrosOn(true); }
    if (mode === 'rapide') { setVenteEnGrosOn(false); setVariantesOn(false); }
  }

  const [storiesOn,       setStoriesOn]       = useState(false);
  const [storyIndices,    setStoryIndices]    = useState<Set<number>>(new Set());
  const [storyHeureDebut, setStoryHeureDebut] = useState('08:00');
  const [storyHeureFin,   setStoryHeureFin]   = useState('22:00');
  const [storyJours,      setStoryJours]      = useState<Set<string>>(
    new Set(['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim']),
  );
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [enChargement,  setEnChargement] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─────────────────────────────────────────────────────────────
  // useEffect 0 — Charge le taux de commission plateforme
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${API}/dashboard/entreprise/commission-rate`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { percentage: number } | null) => {
        if (data?.percentage != null) setCommissionPct(data.percentage);
      })
      .catch(() => { /* garde la valeur par défaut 3 % */ });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // useEffect 1 — Charge les catégories depuis l'API
  // ─────────────────────────────────────────────────────────────
 useEffect(() => {
  fetch(`${API}/produits/categories`, {  // ✅ était /categories
    headers: { Authorization: `Bearer ${getToken()}` },
  })
    .then(r => {
      if (!r.ok) {
        if (r.status === 401) throw new Error(t('ajouter.toasts.sessionExpiredReconnect'));
        throw new Error(t('ajouter.toasts.categoriesServerError', { status: r.status }));
      }
      return r.json();
    })
    .then((data: CategorieApi[]) => {
      if (!Array.isArray(data)) throw new Error(t('ajouter.toasts.unexpectedFormat'));
      setCategoriesApi(data);
      if (!isEditMode && data.length > 0) {
        setForm(prev => ({ ...prev, categorieId: data[0].id, categorie: data[0].nom }));
      }
    })
    .catch(err => {
      const msg = isNetworkError(err)
        ? t('ajouter.toasts.networkErrorBackend')
        : err.message;
      setErreurCats(msg);
      pop(`⚠️ ${msg}`, 'e');
    })
    .finally(() => setChargementCats(false));
}, []);

  // ─────────────────────────────────────────────────────────────
  // useEffect 2 — ✅ MODE ÉDITION : charge le produit existant
  // Se déclenche quand productId change (passage création → édition)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    // Si pas d'ID → mode création, on réinitialise le formulaire
    if (!productId) {
      setForm({ ...FORM_INITIAL });
      setImages([]);
      setSpecs([
        { cle: t('ajouter.specs.defaultMarque'), valeur: '' },
        { cle: t('ajouter.specs.defaultPuce'), valeur: '' },
        { cle: t('ajouter.specs.defaultConnectivite'), valeur: '' },
      ]);
      setVariantes([{ type: 'Couleur', vals: '' }]);
      setVariantesOn(false);
      setProductMode(null);
      return;
    }

    // Sinon → charge le produit depuis l'API
    setLoadingProd(true);
    fetch(`${API}/produits/${productId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(t('ajouter.toasts.productLoadServerError', { status: r.status }));
        return r.json();
      })
      .then(p => {
        // ✅ Pré-remplit tous les champs avec les données du produit existant
        setForm({
          nom:          p.nom              ?? '',
          description:  p.description      ?? '',
          prix:         p.prix != null ? String(p.prix) : '',
          prixAncien:   p.prixAncien != null ? String(p.prixAncien) : '',
          stock:        p.stock != null ? String(p.stock) : '',
          seuil:        p.seuil != null ? String(p.seuil) : '',
          marque:       p.marque           ?? '',
          tags:         p.tags             ?? '',
          visibilite:   p.visibilite       ?? 'draft',
          reference:    p.reference        ?? '',
          garantie:     p.garantie         ?? '12 mois',
          poids:        p.poids != null ? String(p.poids) : '',
          condition:    p.condition        ?? 'neuf',
          categorieId:  p.category?.id     ?? '',
          categorie:    p.category?.nom    ?? '',
          sousCatId:    p.subCategory?.id  ?? '',
          sousCat:      p.subCategory?.nom ?? '',
          titreSeo:       p.titreSeo       ?? '',
          descriptionSeo: p.descriptionSeo ?? '',
          urlSlug:        p.urlSlug        ?? '',
          longueur: p.longueur != null ? String(p.longueur) : '',
          largeur:  p.largeur  != null ? String(p.largeur)  : '',
          hauteur:  p.hauteur  != null ? String(p.hauteur)  : '',
          paysOrigine:     p.paysOrigine      ?? 'GN',
          politiqueRetour: p.politiqueRetour  ?? '7j',
          contenuBoite:    p.contenuBoite     ?? '',
          livraisonStandard:      p.livraisonStandard      ?? true,
          livraisonLivreur:       p.livraisonLivreur        ?? true,
          livraisonCorrespondant: p.livraisonCorrespondant  ?? false,
          fraisLivraisonLocal:    p.fraisLivraisonLocal != null ? String(p.fraisLivraisonLocal) : '',
          delaiLivraison:         p.delaiLivraison     ?? '1-3 jours',
          garantiePaiement:  p.garantiePaiement  ?? true,
          garantieRetour:    p.garantieRetour     ?? true,
          garantieAuthentic: p.garantieAuthentic  ?? true,
          garantieSupport:   p.garantieSupport    ?? true,
          langue: p.langue ?? 'fr',
          moq:                  p.moq != null ? String(p.moq) : '',
          conditionnement:      p.conditionnement != null ? String(p.conditionnement) : '',
          delaiPreparationGros: p.delaiPreparationGros ?? '3-5 jours',
        });

        // ✅ Pré-remplit les images existantes (preview = url Cloudinary)
        if (p.images?.length) {
          setImages(p.images.map((img: any) => ({
            url:     img.url,
            ordre:   img.ordre,
            alt:     img.alt ?? null,
            preview: img.url, // ← affiche le média Cloudinary directement
            type:    img.type === 'video' ? 'video' : 'image',
          })));
        }

        // ✅ Pré-remplit les specs (si vides, garde les défauts)
        if (p.specs?.length) {
          setSpecs(p.specs.map((s: any) => ({ cle: s.cle, valeur: s.valeur })));
        }

        // ✅ Pré-remplit les variantes
        if (p.variantes?.length) {
          setVariantesOn(true);
          setVariantes(p.variantes.map((v: any) => ({ type: v.type, vals: v.vals })));
        }

        // ✅ Pré-remplit la vente en gros
        if (p.venteEnGros && p.wholesaleTiers?.length) {
          setVenteEnGrosOn(true);
          setWholesaleTiers(p.wholesaleTiers.map((t: any) => ({
            quantiteMin:  String(t.quantiteMin),
            quantiteMax:  t.quantiteMax != null ? String(t.quantiteMax) : '',
            prixUnitaire: String(t.prixUnitaire),
          })));
        }

        // ✅ Onglet initial déduit du produit — ne jamais ouvrir "rapide" par
        // défaut en édition, pour ne cacher aucune donnée déjà renseignée.
        setProductMode(p.venteEnGros ? 'gros' : 'detaille');

        pop(t('ajouter.toasts.productDataLoaded'), 'i');
      })
      .catch(err => {
        pop(t('ajouter.toasts.productLoadError', { message: err.message }), 'e');
        setErrorBanner(err.message);
      })
      .finally(() => setLoadingProd(false));
  }, [productId]); // ← se redéclenche si productId change

  // ─────────────────────────────────────────────────────────────
  // HELPERS FORMULAIRE
  // ─────────────────────────────────────────────────────────────

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (key in errors) {
      setErrors(prev => { const n = { ...prev }; delete n[key as keyof FormErrors]; return n; });
    }
  }

  function handleChangerCategorie(categorieId: string) {
    const cat = categoriesApi.find(c => c.id === categorieId);
    setForm(prev => ({ ...prev, categorieId, categorie: cat?.nom ?? '', sousCatId: '', sousCat: '' }));
    setErrors(prev => { const n = { ...prev }; delete n.categorieId; return n; });
  }

  function handleChangerSousCat(sousCatId: string) {
    const cat    = categoriesApi.find(c => c.id === form.categorieId);
    const subCat = cat?.subCategories.find(s => s.id === sousCatId);
    setForm(prev => ({ ...prev, sousCatId, sousCat: subCat?.nom ?? '' }));
  }

  // ─────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────

  function validateForm(): boolean {
    const e: FormErrors = {};
    if (!form.nom.trim())                                              e.nom         = t('ajouter.validation.nomRequired');
    else if (form.nom.trim().length < 3)                               e.nom         = t('ajouter.validation.nomMinLength');
    if (!form.prix.trim())                                             e.prix        = t('ajouter.validation.prixRequired');
    else if (isNaN(parseFloat(form.prix)) || parseFloat(form.prix) <= 0) e.prix     = t('ajouter.validation.prixPositive');
    if (!form.stock.trim())                                            e.stock       = t('ajouter.validation.stockRequired');
    else if (isNaN(parseInt(form.stock)) || parseInt(form.stock) < 0) e.stock       = t('ajouter.validation.stockPositive');
    if (!form.categorieId)                                             e.categorieId = t('ajouter.validation.categorieRequired');
    setErrors(e);
    if (Object.keys(e).length > 0) {
      pop(t('ajouter.validation.fixErrors'), 'w');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOAD IMAGE
  // ─────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    /* ── Quotas : 4 images + 1 vidéo max, 5 médias au total ── */
    let videoCount = images.filter(i => i.type === 'video').length;
    let imageCount = images.length - videoCount;
    const placesRestantes = MAX_MEDIA_TOTAL - images.length;
    if (placesRestantes <= 0) { pop(t('ajouter.toasts.maxMedia', { count: MAX_MEDIA_TOTAL }), 'w'); return; }

    const aUploader: File[] = [];
    for (const file of files) {
      if (aUploader.length >= placesRestantes) { pop(t('ajouter.toasts.maxMediaRestIgnored', { count: MAX_MEDIA_TOTAL }), 'w'); break; }
      const estVideo = file.type.startsWith('video/');
      if (estVideo) {
        if (videoCount >= MAX_MEDIA_VIDEOS) { pop(t('ajouter.toasts.maxVideo', { count: MAX_MEDIA_VIDEOS, name: file.name }), 'w'); continue; }
        videoCount++;
      } else {
        if (imageCount >= MAX_MEDIA_IMAGES) { pop(t('ajouter.toasts.maxImages', { count: MAX_MEDIA_IMAGES, name: file.name }), 'w'); continue; }
        imageCount++;
      }
      aUploader.push(file);
    }
    if (!aUploader.length) return;

    setUploadEnCours(true);
    try {
      const nouvelles: ImageUploaded[] = [];
      for (const file of aUploader) {
        const estVideo = file.type.startsWith('video/');
        const maxSize  = estVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
        if (file.size > maxSize) {
          pop(t('ajouter.toasts.fileTooLarge', { name: file.name, max: estVideo ? '50 MB' : '5 MB' }), 'w');
          continue;
        }
        const preview  = URL.createObjectURL(file);
        const formData = new FormData();
        formData.append('file', file);
        let res: Response;
        try {
          res = await fetch(`${API}/upload/${estVideo ? 'video' : 'image/product'}`, {
            method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
          });
        } catch { throw new Error(t('ajouter.toasts.networkError')); }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(res.status === 401 ? t('ajouter.toasts.sessionExpired') : errData.message ?? `Erreur ${res.status}`);
        }
        const data: { url: string } = await res.json();
        nouvelles.push({
          url:    data.url,
          ordre:  images.length + nouvelles.length,
          alt:    null,
          preview,
          type:   estVideo ? 'video' : 'image',
        });
      }
      if (nouvelles.length) {
        setImages(prev => [...prev, ...nouvelles]);
        pop(t('ajouter.toasts.mediaUploaded', { count: nouvelles.length }), 's');
      }
    } catch (err: any) {
      setErrorBanner(err.message);
      pop(`❌ ${err.message}`, 'e');
    } finally {
      setUploadEnCours(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function supprimerImage(index: number) {
    setImages(prev => {
      if (prev[index].preview.startsWith('blob:')) URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index).map((img, i) => ({ ...img, ordre: i }));
    });
    /* Reindexe les indices stories : supprime l'index retiré, décrémente ceux au-dessus */
    setStoryIndices(prev => {
      const next = new Set<number>();
      prev.forEach(i => {
        if (i < index)  next.add(i);
        if (i > index)  next.add(i - 1);
        // i === index → supprimé
      });
      return next;
    });
  }

  function toggleStoryIndex(index: number) {
    setStoryIndices(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // SPECS & VARIANTES
  // ─────────────────────────────────────────────────────────────

  function addVariante()                                     { setVariantes(prev => [...prev, { type: VARIANTE_TYPES[0], vals: '' }]); }
  function removeVariante(i: number)                         { setVariantes(prev => prev.filter((_, idx) => idx !== i)); }
  function updateVariante(i: number, k: keyof Variante, v: string) { setVariantes(prev => prev.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }
  function addSpec()                                         { setSpecs(prev => [...prev, { cle: '', valeur: '' }]); }
  function removeSpec(i: number)                             { setSpecs(prev => prev.filter((_, idx) => idx !== i)); }
  function updateSpec(i: number, k: keyof Spec, v: string)  { setSpecs(prev => prev.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }
  function addTier()                                          { setWholesaleTiers(prev => [...prev, { quantiteMin: '', quantiteMax: '', prixUnitaire: '' }]); }
  function removeTier(i: number)                              { setWholesaleTiers(prev => prev.filter((_, idx) => idx !== i)); }
  function updateTier(i: number, k: keyof WholesaleTier, v: string) { setWholesaleTiers(prev => prev.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

  // ─────────────────────────────────────────────────────────────
  // SCORE SEO
  // ─────────────────────────────────────────────────────────────

  const seoScore = useMemo(() => {
    const criteres = [
      { label: t('ajouter.seo.criteres.nom'),           ok: form.nom.trim().length > 5 },
      { label: t('ajouter.seo.criteres.description'),   ok: form.description.trim().length > 100 },
      { label: t('ajouter.seo.criteres.titreSeo'),      ok: form.titreSeo.trim().length > 0 },
      { label: t('ajouter.seo.criteres.descriptionSeo'), ok: form.descriptionSeo.trim().length > 0 },
      { label: t('ajouter.seo.criteres.urlSlug'),       ok: form.urlSlug.trim().length > 0 },
      { label: t('ajouter.seo.criteres.tags'),          ok: form.tags.trim().length > 0 },
      { label: t('ajouter.seo.criteres.marque'),        ok: form.marque.trim().length > 0 },
      { label: t('ajouter.seo.criteres.image'),         ok: images.length > 0 },
      { label: t('ajouter.seo.criteres.prix'),          ok: form.prix.trim().length > 0 },
      { label: t('ajouter.seo.criteres.reference'),     ok: form.reference.trim().length > 0 },
    ];
    return { score: Math.round((criteres.filter(c => c.ok).length / criteres.length) * 100), criteres };
  }, [form, images, t]);

  // ─────────────────────────────────────────────────────────────
  // ✅ SOUMISSION — POST (création) ou PATCH (édition)
  // ─────────────────────────────────────────────────────────────

  async function handlePublish(draft = false) {
    if (!validateForm()) return;
    setEnChargement(true);
    setErrorBanner(null);

    try {
      const dto = {
        nom:          form.nom.trim(),
        description:  form.description.trim()  || undefined,
        contenuBoite: form.contenuBoite.trim()  || undefined,
        marque:       form.marque.trim()         || undefined,
        tags:         form.tags.trim()           || undefined,
        reference:    form.reference.trim()      || undefined,
        garantie:     form.garantie,
        condition:    form.condition,
        langue:       form.langue,
        categoryId:    form.categorieId,
        subCategoryId: form.sousCatId || undefined,
        prix:       parseFloat(form.prix),
        prixAncien: form.prixAncien ? parseFloat(form.prixAncien) : undefined,
        stock:      parseInt(form.stock || '0'),
        seuil:      form.seuil ? parseInt(form.seuil) : undefined,
        visibilite: draft ? 'draft' : form.visibilite,
        paysOrigine: form.paysOrigine,
        poids:    form.poids    ? parseFloat(form.poids)    : undefined,
        longueur: form.longueur ? parseFloat(form.longueur) : undefined,
        largeur:  form.largeur  ? parseFloat(form.largeur)  : undefined,
        hauteur:  form.hauteur  ? parseFloat(form.hauteur)  : undefined,
        politiqueRetour: form.politiqueRetour,
        livraisonStandard:      form.livraisonStandard,
        livraisonLivreur:       form.livraisonLivreur,
        livraisonCorrespondant: form.livraisonCorrespondant,
        fraisLivraisonLocal: form.fraisLivraisonLocal ? parseFloat(form.fraisLivraisonLocal) : undefined,
        delaiLivraison: form.delaiLivraison,
        garantiePaiement:  form.garantiePaiement,
        garantieRetour:    form.garantieRetour,
        garantieAuthentic: form.garantieAuthentic,
        garantieSupport:   form.garantieSupport,
        titreSeo:       form.titreSeo.trim()       || undefined,
        descriptionSeo: form.descriptionSeo.trim() || undefined,
        urlSlug:        form.urlSlug.trim()         || undefined,
        images:    images.map(img => ({ url: img.url, ordre: img.ordre, alt: img.alt, type: img.type })),
        specs:     specs.filter(s => s.cle.trim() && s.valeur.trim()).map((s, idx) => ({ ...s, ordre: idx })),
        variantes: variantesOn ? variantes.filter(v => v.vals.trim()) : [],
        venteEnGros: venteEnGrosOn,
        moq:                  venteEnGrosOn && form.moq ? parseInt(form.moq) : undefined,
        conditionnement:      venteEnGrosOn && form.conditionnement ? parseInt(form.conditionnement) : undefined,
        delaiPreparationGros: venteEnGrosOn ? form.delaiPreparationGros : undefined,
        wholesaleTiers: venteEnGrosOn
          ? wholesaleTiers
              .filter(t => t.quantiteMin.trim() && t.prixUnitaire.trim())
              .map((t, idx) => ({
                quantiteMin:  parseInt(t.quantiteMin),
                quantiteMax:  t.quantiteMax.trim() ? parseInt(t.quantiteMax) : undefined,
                prixUnitaire: parseFloat(t.prixUnitaire),
                ordre:        idx,
              }))
          : [],
        stories:   storiesOn
          ? Array.from(storyIndices)
              .filter(i => i < images.length && images[i].type === 'image')
              .map(i => ({
                mediaUrl:   images[i].url,
                heureDebut: storyHeureDebut,
                heureFin:   storyHeureFin,
                jours:      Array.from(storyJours),
              }))
          : [],
      };

      // ✅ POST en création, PATCH en édition
      let res: Response;
      try {
        res = await fetch(
          isEditMode ? `${API}/produits/${productId}` : `${API}/produits`,
          {
            method:  isEditMode ? 'PATCH' : 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
            body: JSON.stringify(dto),
          }
        );
      } catch {
        throw new Error(t('ajouter.toasts.networkErrorNest'));
      }

      if (!res.ok) {
        let errorMessage = t('ajouter.toasts.serverErrorGeneric', { status: res.status });
        try {
          const errData = await res.json();
          if      (res.status === 401) errorMessage = t('ajouter.toasts.sessionExpiredFull');
          else if (res.status === 403) errorMessage = t('ajouter.toasts.forbidden');
          else if (res.status === 400) {
            errorMessage = Array.isArray(errData.message)
              ? '• ' + errData.message.join('\n• ')
              : errData.message ?? errorMessage;
          }
          else if (res.status === 409) errorMessage = errData.message ?? t('ajouter.toasts.slugTaken');
          else if (res.status === 500) errorMessage = t('ajouter.toasts.serverError500');
          else                         errorMessage = errData.message ?? errorMessage;
        } catch { /* body non JSON */ }
        throw new Error(errorMessage);
      }

      // ✅ Succès
      setErrorBanner(null);
      setErrors({});
      pop(
        isEditMode
          ? t('ajouter.toasts.updateSuccess')
          : (draft ? t('ajouter.toasts.draftSaved') : t('ajouter.toasts.publishSuccess')),
        's'
      );
      // Retour à la liste après succès
      setTimeout(() => onNavigate('produits'), 800);

    } catch (err: any) {
      const message = err.message ?? t('ajouter.toasts.unexpectedError');
      setErrorBanner(message);
      setErrors(prev => ({ ...prev, general: message }));
      pop(t('ajouter.toasts.publishFailed'), 'e');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setEnChargement(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // DÉRIVÉS
  // ─────────────────────────────────────────────────────────────

  const sousCatsOptions = categoriesApi.find(c => c.id === form.categorieId)?.subCategories ?? [];
  const isInternational = form.paysOrigine !== 'GN';
  const prixNum         = parseInt(form.prix || '0');

  // ─────────────────────────────────────────────────────────────
  // RENDU — Indicateur de chargement en mode édition
  // ─────────────────────────────────────────────────────────────

  if (loadingProd) {
    return (
      <div className="page on" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--t2)' }} />
        <div style={{ fontSize: 14, color: 'var(--t3)' }}>{t('ajouter.loadingProduct')}</div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // RENDU PRINCIPAL
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="page on" id="p-ajouter">

      {/* ── En-tête ── */}
      <div className="aj-header">
        <div>
          {/* ✅ Titre dynamique selon le mode */}
          <div className="aj-title">
            <i className={`fas ${isEditMode ? 'fa-pen' : 'fa-plus-circle'}`}></i>
            {isEditMode ? t('ajouter.header.editTitle') : t('ajouter.header.createTitle')}
          </div>
          <div className="aj-sub">
            {isEditMode
              ? t('ajouter.header.editSubtitle')
              : t('ajouter.header.createSubtitle')}
          </div>
        </div>
        <div className="pf-actions">
          <button className="btn-draft" onClick={() => onNavigate('produits')} disabled={enChargement}>
            <i className="fas fa-arrow-left"></i> {t('ajouter.header.cancel')}
          </button>
          {/* En mode édition le brouillon garde le même produit */}
          {!isEditMode && (
            <button className="btn-draft" onClick={() => handlePublish(true)} disabled={enChargement || productMode === null} title={productMode === null ? t('ajouter.header.chooseModeFirst') : undefined}>
              <i className="fas fa-save"></i> {enChargement ? t('ajouter.header.saving') : t('ajouter.header.draft')}
            </button>
          )}
          <button className="btn-pub" onClick={() => handlePublish(false)} disabled={enChargement || productMode === null} title={productMode === null ? t('ajouter.header.chooseModeFirst') : undefined}>
            <i className={`fas ${isEditMode ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
            {enChargement
              ? (isEditMode ? t('ajouter.header.updating') : t('ajouter.header.publishing'))
              : (isEditMode ? t('ajouter.header.update') : t('ajouter.header.publish'))}
          </button>
        </div>
      </div>

      {/* ── Badge mode édition ── */}
      {isEditMode && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--g100)', border: '1px solid var(--bdr2)',
          borderRadius: 'var(--pill)', padding: '6px 14px',
          fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 16,
        }}>
          <i className="fas fa-pen-to-square" />
          {t('ajouter.header.editModeBadge')}
        </div>
      )}

      {/* ── Sélecteur de mode d'ajout ── */}
      <div className="aj-mode-grid">
        {([
          { key: 'detaille' as const, icon: 'fa-file-lines',    label: t('ajouter.mode.detaille.label'),  desc: t('ajouter.mode.detaille.desc')  },
          { key: 'gros'     as const, icon: 'fa-boxes-stacked', label: t('ajouter.mode.gros.label'),      desc: t('ajouter.mode.gros.desc')      },
          { key: 'rapide'   as const, icon: 'fa-bolt',          label: t('ajouter.mode.rapide.label'),    desc: t('ajouter.mode.rapide.desc')    },
        ]).map(m => (
          <button
            key={m.key}
            type="button"
            className={`aj-mode-card ${productMode === m.key ? 'aj-mode-card--active' : ''}`}
            onClick={() => handleChangeMode(m.key)}
          >
            <i className={`fas ${m.icon}`} />
            <div>
              <div className="aj-mode-card-label">{m.label}</div>
              <div className="aj-mode-card-desc">{m.desc}</div>
            </div>
            {productMode === m.key && <i className="fas fa-circle-check aj-mode-card-check" />}
          </button>
        ))}
      </div>

      {/* Bannière d'erreur */}
      {errorBanner && <ErrorBanner message={errorBanner} onClose={() => setErrorBanner(null)} />}

      {/* ── Grille ── */}
      {/* Le formulaire ne se déplie qu'après avoir choisi un mode d'ajout —
          tant que productMode est null, seules les 3 cartes ci-dessus
          sont visibles. */}
      {productMode !== null && (
      <div key={productMode} className="g3r aj-unfold" style={{ alignItems: 'flex-start' }}>

        {/* ════════ COLONNE GAUCHE ════════ */}
        <div>

          {/* Médias produit */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-image"></i> {t('ajouter.medias.title')}</div>
              <span className="ch-badge">{images.length}/{MAX_MEDIA_TOTAL}</span>
            </div>
            <div className="cb">
              <div
                className={`pf-drop ${uploadEnCours ? 'pf-drop--loading' : ''}`}
                onClick={() => !uploadEnCours && fileInputRef.current?.click()}
                style={{ cursor: uploadEnCours ? 'wait' : 'pointer' }}
              >
                {uploadEnCours ? (
                  <><i className="fas fa-spinner fa-spin"></i><p><strong>{t('ajouter.medias.loading')}</strong></p></>
                ) : (
                  <>
                    <i className="fas fa-cloud-arrow-up"></i>
                    <p><strong>{t('ajouter.medias.dropTitle')}</strong><br />{t('ajouter.medias.dropSub')}</p>
                    <p style={{ fontSize: 11, marginTop: 6, color: 'var(--t4)' }}>
                      {t('ajouter.medias.quota', { images: MAX_MEDIA_IMAGES, videos: MAX_MEDIA_VIDEOS })}
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {images.length > 0 && (
                <div className="aj-img-grid">
                  {images.map((img, i) => (
                    <div key={i} className="aj-img-thumb">
                      {img.type === 'video' ? (
                        <video src={img.preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      ) : (
                        <img src={img.preview} alt={img.alt ?? `Image ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      )}
                      {img.type === 'video' && (
                        <div className="aj-img-main" style={{ left: 6, right: 'auto' }}>
                          <i className="fas fa-video"></i>
                        </div>
                      )}
                      <button className="aj-img-del" onClick={() => supprimerImage(i)}>
                        <i className="fas fa-xmark"></i>
                      </button>
                      {i === 0 && <div className="aj-img-main">{t('ajouter.medias.principale')}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Stories produit ── */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-circle-play"></i> {t('ajouter.stories.title')}</div>
              <label className="aj-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={storiesOn} onChange={e => { setStoriesOn(e.target.checked); if (!e.target.checked) setStoryIndices(new Set()); }} />
                <span className="aj-toggle-slider"></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: storiesOn ? 'var(--t2)' : 'var(--t3)', whiteSpace: 'nowrap' }}>
                  {storiesOn ? t('ajouter.stories.activees') : t('ajouter.stories.desactivees')}
                </span>
              </label>
            </div>

            {storiesOn ? (
              <div className="cb">
                {images.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: 12.5 }}>
                    <i className="fas fa-images" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                    {t('ajouter.stories.addImagesFirst')}
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12, lineHeight: 1.5 }}>
                      <i className="fas fa-circle-info" style={{ color: 'var(--t2)', marginRight: 6 }} />
                      {t('ajouter.stories.selectHint')}
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                      {images.map((img, i) => {
                        if (img.type === 'video') return null; // stories = images uniquement
                        const selected = storyIndices.has(i);
                        return (
                          <div
                            key={i}
                            onClick={() => toggleStoryIndex(i)}
                            style={{
                              position: 'relative',
                              aspectRatio: '9/16',
                              borderRadius: 10,
                              overflow: 'hidden',
                              cursor: 'pointer',
                              border: selected ? '2.5px solid var(--t2)' : '2.5px solid transparent',
                              boxShadow: selected ? '0 0 0 3px rgba(128,128,128,.2)' : 'none',
                              transition: 'border-color .15s, box-shadow .15s',
                            }}
                          >
                            <img
                              src={img.preview}
                              alt={`Image ${i + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {/* Overlay sélectionné */}
                            {selected && (
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: 'rgba(0,0,0,.35)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'var(--btn, #111113)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <i className="fas fa-check" style={{ color: '#fff', fontSize: 11 }} />
                                </div>
                              </div>
                            )}
                            {/* Numéro */}
                            <div style={{
                              position: 'absolute', top: 4, left: 5,
                              background: 'rgba(0,0,0,.5)', color: '#fff',
                              borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700,
                            }}>
                              {i + 1}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {storyIndices.size > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Récapitulatif */}
                        <div style={{
                          padding: '8px 12px',
                          background: 'var(--g100)', borderRadius: 'var(--r-md)',
                          fontSize: 12, color: 'var(--t2)', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <i className="fas fa-circle-play" />
                          {t('ajouter.stories.selected', { count: storyIndices.size })}
                        </div>

                        {/* Plage horaire */}
                        <div style={{
                          padding: '14px 14px',
                          background: 'var(--g50)', border: '1.5px solid var(--bdr)',
                          borderRadius: 'var(--r-md)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <i className="fas fa-clock" style={{ color: 'var(--t2)', fontSize: 13 }} />
                            {t('ajouter.stories.plageHoraire')}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Heure de début */}
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>
                                {t('ajouter.stories.aPartirDe')}
                              </label>
                              <input
                                type="time"
                                className="pf-in"
                                value={storyHeureDebut}
                                onChange={e => setStoryHeureDebut(e.target.value)}
                                style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                              />
                            </div>

                            <div style={{ flexShrink: 0, color: 'var(--t3)', fontSize: 13, fontWeight: 700, paddingTop: 18 }}>→</div>

                            {/* Heure de fin */}
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>
                                {t('ajouter.stories.jusquA')}
                              </label>
                              <input
                                type="time"
                                className="pf-in"
                                value={storyHeureFin}
                                onChange={e => setStoryHeureFin(e.target.value)}
                                style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                              />
                            </div>
                          </div>

                          {/* Résumé horaire */}
                          {storyHeureDebut && storyHeureFin && (
                            <div style={{
                              marginTop: 10, fontSize: 11.5, color: 'var(--t2)',
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                              <i className="fas fa-circle-info" style={{ color: 'var(--t2)', fontSize: 11 }} />
                              {storyHeureFin > storyHeureDebut
                                ? t('ajouter.stories.deA', { debut: storyHeureDebut, fin: storyHeureFin })
                                : <span style={{ color: 'var(--t2)', fontWeight: 600 }}>
                                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 4 }} />
                                    {t('ajouter.stories.heureInvalide')}
                                  </span>
                              }
                            </div>
                          )}
                        </div>

                        {/* Jours d'affichage */}
                        {(() => {
                          const JOURS = [
                            { key: 'lun', label: t('ajouter.stories.jours.lun') },
                            { key: 'mar', label: t('ajouter.stories.jours.mar') },
                            { key: 'mer', label: t('ajouter.stories.jours.mer') },
                            { key: 'jeu', label: t('ajouter.stories.jours.jeu') },
                            { key: 'ven', label: t('ajouter.stories.jours.ven') },
                            { key: 'sam', label: t('ajouter.stories.jours.sam') },
                            { key: 'dim', label: t('ajouter.stories.jours.dim') },
                          ];
                          const tousSelectionnes = storyJours.size === JOURS.length;
                          const toggleJour = (key: string) => setStoryJours(prev => {
                            const next = new Set(prev);
                            next.has(key) ? next.delete(key) : next.add(key);
                            return next;
                          });
                          return (
                            <div style={{
                              padding: '14px',
                              background: 'var(--g50)', border: '1.5px solid var(--bdr)',
                              borderRadius: 'var(--r-md)',
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 7 }}>
                                  <i className="fas fa-calendar-days" style={{ color: 'var(--t2)', fontSize: 13 }} />
                                  {t('ajouter.stories.joursAffichage')}
                                </div>
                                <button
                                  onClick={() => setStoryJours(
                                    tousSelectionnes ? new Set() : new Set(JOURS.map(j => j.key))
                                  )}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 700,
                                    color: tousSelectionnes ? 'var(--t2)' : 'var(--t2)',
                                    padding: '2px 6px',
                                  }}
                                >
                                  {tousSelectionnes ? t('ajouter.stories.toutDeselectionner') : t('ajouter.stories.tousLesJours')}
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {JOURS.map(j => {
                                  const actif = storyJours.has(j.key);
                                  const isWeekend = j.key === 'sam' || j.key === 'dim';
                                  return (
                                    <button
                                      key={j.key}
                                      onClick={() => toggleJour(j.key)}
                                      style={{
                                        flex: '1 1 auto',
                                        minWidth: 36,
                                        padding: '7px 4px',
                                        borderRadius: 'var(--r-md)',
                                        border: actif
                                          ? `2px solid ${isWeekend ? 'var(--t2)' : 'var(--t2)'}`
                                          : '2px solid var(--bdr2)',
                                        background: actif
                                          ? isWeekend ? 'rgba(128,128,128,.1)' : 'var(--sky)'
                                          : 'var(--white)',
                                        color: actif
                                          ? isWeekend ? 'var(--t2)' : 'var(--t2)'
                                          : 'var(--t3)',
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all .15s',
                                        textAlign: 'center',
                                      }}
                                    >
                                      {j.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Récapitulatif jours */}
                              {storyJours.size === 0 ? (
                                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--t2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <i className="fas fa-triangle-exclamation" />
                                  {t('ajouter.stories.selectAuMoinsUnJour')}
                                </div>
                              ) : (
                                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <i className="fas fa-circle-check" style={{ color: 'var(--emerald)' }} />
                                  {storyJours.size === 7
                                    ? t('ajouter.stories.visibleTousLesJours')
                                    : storyJours.size === 5 && !storyJours.has('sam') && !storyJours.has('dim')
                                    ? t('ajouter.stories.visibleLunVen')
                                    : storyJours.size === 2 && storyJours.has('sam') && storyJours.has('dim')
                                    ? t('ajouter.stories.visibleWeekend')
                                    : t('ajouter.stories.visibleNJours', { count: storyJours.size })
                                  }
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="cb" style={{ color: 'var(--t3)', fontSize: 12.5, fontStyle: 'italic' }}>
                {t('ajouter.stories.disabledHint')}
              </div>
            )}
          </div>

          {/* Organisation */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-tags"></i> {t('ajouter.organisation.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">{t('ajouter.organisation.categorie')}</label>
                {erreurCats ? (
                  <div style={{ padding: '10px 12px', background: 'rgba(128,128,128,.06)', border: '1.5px solid rgba(128,128,128,.25)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-triangle-exclamation" />
                    {erreurCats}
                    <button onClick={() => { setErreurCats(null); setChargementCats(true); window.location.reload(); }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--t2)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--t2)', cursor: 'pointer' }}>
                      {t('ajouter.organisation.retry')}
                    </button>
                  </div>
                ) : (
                  <select
                    className={`pf-in ${errors.categorieId ? 'pf-in--error' : ''}`}
                    value={form.categorieId}
                    disabled={chargementCats}
                    onChange={e => handleChangerCategorie(e.target.value)}
                    style={{ borderColor: errors.categorieId ? 'var(--red)' : undefined }}
                  >
                    {chargementCats ? (
                      <option>{t('ajouter.organisation.loadingCats')}</option>
                    ) : categoriesApi.length === 0 ? (
                      <option value="">{t('ajouter.organisation.noCategorie')}</option>
                    ) : (
                      categoriesApi.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)
                    )}
                  </select>
                )}
                <FieldError message={errors.categorieId} />
              </div>

              <div>
                <label className="pf-lbl">{t('ajouter.organisation.sousCategorie')}</label>
                <select className="pf-in" value={form.sousCatId} onChange={e => handleChangerSousCat(e.target.value)}>
                  <option value="">{t('ajouter.organisation.choisir')}</option>
                  {sousCatsOptions.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>

              <div><label className="pf-lbl">{t('ajouter.organisation.marque')}</label><input className="pf-in" placeholder={t('ajouter.organisation.marquePlaceholder')} value={form.marque} onChange={e => update('marque', e.target.value)} /></div>
              <div><label className="pf-lbl">{t('ajouter.organisation.tagsSeo')}</label><input className="pf-in" placeholder={t('ajouter.organisation.tagsPlaceholder')} value={form.tags} onChange={e => update('tags', e.target.value)} /></div>
              <div>
                <label className="pf-lbl">{t('ajouter.organisation.langue')}</label>
                <select className="pf-in" value={form.langue} onChange={e => update('langue', e.target.value)}>
                  <option value="fr">{t('ajouter.organisation.langueFr')}</option>
                  <option value="en">{t('ajouter.organisation.langueEn')}</option>
                  <option value="ar">{t('ajouter.organisation.langueAr')}</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouter.organisation.visibilite')}</label>
                <select className="pf-in" value={form.visibilite} onChange={e => update('visibilite', e.target.value)}>
                  <option value="public">{t('ajouter.organisation.optPublic')}</option>
                  <option value="draft">{t('ajouter.organisation.optDraft')}</option>
                  <option value="private">{t('ajouter.organisation.optPrivate')}</option>
                </select>
              </div>
            </div>
          </div>

          {/* Infos complémentaires — mode détaillé uniquement */}
          {productMode === 'detaille' && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-circle-info"></i> {t('ajouter.infosComplementaires.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">{t('ajouter.infosComplementaires.etat')}</label>
                <select className="pf-in" value={form.condition} onChange={e => update('condition', e.target.value)}>
                  <option value="neuf">{t('ajouter.infosComplementaires.etatNeuf')}</option>
                  <option value="reconditionne">{t('ajouter.infosComplementaires.etatReconditionne')}</option>
                  <option value="occasion">{t('ajouter.infosComplementaires.etatOccasion')}</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouter.infosComplementaires.garantie')}</label>
                <select className="pf-in" value={form.garantie} onChange={e => update('garantie', e.target.value)}>
                  <option value="3 mois">{t('ajouter.infosComplementaires.garantieOptions.3m')}</option>
                  <option value="6 mois">{t('ajouter.infosComplementaires.garantieOptions.6m')}</option>
                  <option value="12 mois">{t('ajouter.infosComplementaires.garantieOptions.12m')}</option>
                  <option value="24 mois">{t('ajouter.infosComplementaires.garantieOptions.24m')}</option>
                  <option value="Sans garantie">{t('ajouter.infosComplementaires.garantieOptions.aucune')}</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouter.infosComplementaires.politiqueRetour')}</label>
                <select className="pf-in" value={form.politiqueRetour} onChange={e => update('politiqueRetour', e.target.value)}>
                  {RETOUR_OPTIONS.map(r => <option key={r.val} value={r.val}>{t(r.label)}</option>)}
                </select>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouter.infosComplementaires.paysOrigine')}</label>
                <select className="pf-in" value={form.paysOrigine} onChange={e => update('paysOrigine', e.target.value)}>
                  {PAYS_ORIGINE.map(p => <option key={p.val} value={p.val}>{t(p.label)}</option>)}
                </select>
                {isInternational && (
                  <div className="aj-origin-banner">
                    <span style={{ fontSize: 18 }}>🌍</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', marginBottom: 2 }}>{t('ajouter.infosComplementaires.internationalTitle')}</div>
                      <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>{t('ajouter.infosComplementaires.internationalSub')}</div>
                    </div>
                  </div>
                )}
              </div>
              <div><label className="pf-lbl">{t('ajouter.infosComplementaires.poids')}</label><input className="pf-in" type="number" step="0.01" placeholder="Ex: 0.5" value={form.poids} onChange={e => update('poids', e.target.value)} /></div>
              <div>
                <label className="pf-lbl">{t('ajouter.infosComplementaires.dimensions')}</label>
                <div className="gridR3" style={{ gap: 8 }}>
                  {(['longueur', 'largeur', 'hauteur'] as const).map(dim => (
                    <div key={dim}>
                      <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>{t(`ajouter.infosComplementaires.${dim}`)}</label>
                      <input className="pf-in" type="number" placeholder={dim[0].toUpperCase()} value={form[dim]} onChange={e => update(dim, e.target.value)} />
                    </div>
                  ))}
                </div>
                {form.longueur && form.largeur && form.hauteur && (
                  <p style={{ fontSize: 10.5, color: 'var(--t2)', marginTop: 5 }}>
                    {t('ajouter.infosComplementaires.volume', { volume: (parseFloat(form.longueur) * parseFloat(form.largeur) * parseFloat(form.hauteur) / 1000).toFixed(2) })}
                  </p>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Livraison — masquée en mode rapide (et tant qu'aucun mode n'est choisi) */}
          {(productMode === 'detaille' || productMode === 'gros') && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-truck-fast"></i> {t('ajouter.livraison.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'livraisonStandard'      as const, icon: '🚚', label: t('ajouter.livraison.standard'),      sub: t('ajouter.livraison.standardSub') },
                { key: 'livraisonLivreur'       as const, icon: '🛵', label: t('ajouter.livraison.choisirLivreur'), sub: t('ajouter.livraison.choisirLivreurSub') },
                { key: 'livraisonCorrespondant' as const, icon: '🤝', label: t('ajouter.livraison.correspondant'), sub: t('ajouter.livraison.correspondantSub') },
              ].map(item => (
                <label key={item.key} className="aj-toggle-row">
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)' }}>{item.icon} {item.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{item.sub}</div>
                  </div>
                  <label className="aj-toggle">
                    <input type="checkbox" checked={form[item.key]} onChange={e => update(item.key, e.target.checked)} />
                    <span className="aj-toggle-slider"></span>
                  </label>
                </label>
              ))}
              <div><label className="pf-lbl">{t('ajouter.livraison.fraisLocal')}</label><input className="pf-in" type="number" placeholder={t('ajouter.livraison.fraisPlaceholder')} value={form.fraisLivraisonLocal} onChange={e => update('fraisLivraisonLocal', e.target.value)} /></div>
              <div>
                <label className="pf-lbl">{t('ajouter.livraison.delai')}</label>
                <select className="pf-in" value={form.delaiLivraison} onChange={e => update('delaiLivraison', e.target.value)}>
                  <option value="Même jour">{t('ajouter.livraison.delaiOptions.jour')}</option>
                  <option value="1-3 jours">{t('ajouter.livraison.delaiOptions.d1_3')}</option>
                  <option value="3-7 jours">{t('ajouter.livraison.delaiOptions.d3_7')}</option>
                  <option value="7-14 jours">{t('ajouter.livraison.delaiOptions.d7_14')}</option>
                  <option value="14-30 jours">{t('ajouter.livraison.delaiOptions.d14_30')}</option>
                  <option value="Sur commande">{t('ajouter.livraison.delaiOptions.surCommande')}</option>
                </select>
              </div>
            </div>
          </div>
          )}

          {/* Garanties — mode détaillé uniquement */}
          {productMode === 'detaille' && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-shield-check"></i> {t('ajouter.garanties.title')}</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'garantiePaiement'  as const, icon: '🔒', label: t('ajouter.garanties.paiement'),    sub: t('ajouter.garanties.paiementSub') },
                { key: 'garantieRetour'    as const, icon: '↩️', label: t('ajouter.garanties.retour'),      sub: t('ajouter.garanties.retourSub') },
                { key: 'garantieAuthentic' as const, icon: '✅', label: t('ajouter.garanties.authentique'), sub: t('ajouter.garanties.authentiqueSub') },
                { key: 'garantieSupport'   as const, icon: '📞', label: t('ajouter.garanties.support'),     sub: t('ajouter.garanties.supportSub') },
              ].map(g => (
                <label key={g.key} className="aj-toggle-row" style={{ padding: '10px 12px', background: 'var(--g50)', borderRadius: 'var(--r-md)', border: '1px solid var(--bdr)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{g.icon}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{g.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--t3)' }}>{g.sub}</div>
                    </div>
                  </div>
                  <label className="aj-toggle">
                    <input type="checkbox" checked={form[g.key]} onChange={e => update(g.key, e.target.checked)} />
                    <span className="aj-toggle-slider"></span>
                  </label>
                </label>
              ))}
            </div>
          </div>
          )}

        </div>

        {/* ════════ COLONNE DROITE ════════ */}
        <div>

          {/* Informations produit */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-file-alt"></i> {t('ajouter.infosProduit.title')}</div></div>
            <div className="cb">
              <div className="pf-grid">
                <div className="pf-full">
                  <label className="pf-lbl">{t('ajouter.infosProduit.nom')}</label>
                  <input className="pf-in" placeholder={t('ajouter.infosProduit.nomPlaceholder')} value={form.nom} onChange={e => update('nom', e.target.value)} style={{ borderColor: errors.nom ? 'var(--red)' : undefined }} />
                  <FieldError message={errors.nom} />
                </div>

                {productMode !== 'rapide' && (
                <div className="pf-full">
                  <label className="pf-lbl">{t('ajouter.infosProduit.description')}</label>
                  <textarea className="pf-in" rows={4} placeholder={t('ajouter.infosProduit.descriptionPlaceholder')} value={form.description} onChange={e => update('description', e.target.value)} style={{ resize: 'vertical' }} />
                  <p style={{ fontSize: 10.5, color: form.description.length > 100 ? 'var(--emerald)' : 'var(--t4)', marginTop: 3, textAlign: 'right' }}>
                    {t('ajouter.infosProduit.descCounter', { count: form.description.length, status: form.description.length < 100 ? t('ajouter.infosProduit.descMinRecommande') : '✓' })}
                  </p>
                </div>
                )}

                {productMode !== 'rapide' && (
                <div className="pf-full">
                  <label className="pf-lbl">{t('ajouter.infosProduit.contenuBoite')}</label>
                  <textarea className="pf-in" rows={3} placeholder={t('ajouter.infosProduit.contenuBoitePlaceholder')} value={form.contenuBoite} onChange={e => update('contenuBoite', e.target.value)} style={{ resize: 'vertical' }} />
                </div>
                )}

                <div>
                  <label className="pf-lbl">{t('ajouter.infosProduit.prixVente')}</label>
                  <input className="pf-in" type="number" placeholder={t('ajouter.infosProduit.prixPlaceholder')} value={form.prix} onChange={e => update('prix', e.target.value)} style={{ borderColor: errors.prix ? 'var(--red)' : undefined }} />
                  <FieldError message={errors.prix} />
                </div>

                {productMode !== 'rapide' && (
                <div>
                  <label className="pf-lbl">{t('ajouter.infosProduit.prixBarre')}</label>
                  <input className="pf-in" type="number" placeholder={t('ajouter.infosProduit.prixBarrePlaceholder')} value={form.prixAncien} onChange={e => update('prixAncien', e.target.value)} />
                  {form.prixAncien && form.prix && parseInt(form.prixAncien) > parseInt(form.prix) && (
                    <p style={{ fontSize: 10.5, color: 'var(--t2)', marginTop: 3 }}>
                      {t('ajouter.infosProduit.reduction', { pct: Math.round((1 - parseInt(form.prix) / parseInt(form.prixAncien)) * 100) })}
                    </p>
                  )}
                </div>
                )}

                {productMode !== 'rapide' && (
                <div><label className="pf-lbl">{t('ajouter.infosProduit.reference')}</label><input className="pf-in" placeholder={t('ajouter.infosProduit.referencePlaceholder')} value={form.reference} onChange={e => update('reference', e.target.value)} /></div>
                )}

                <div>
                  <label className="pf-lbl">{t('ajouter.infosProduit.stock')}</label>
                  <input className="pf-in" type="number" placeholder={t('ajouter.infosProduit.stockPlaceholder')} value={form.stock} onChange={e => update('stock', e.target.value)} style={{ borderColor: errors.stock ? 'var(--red)' : undefined }} />
                  <FieldError message={errors.stock} />
                </div>

                {productMode !== 'rapide' && (
                <div><label className="pf-lbl">{t('ajouter.infosProduit.seuil')}</label><input className="pf-in" type="number" placeholder={t('ajouter.infosProduit.seuilPlaceholder')} value={form.seuil} onChange={e => update('seuil', e.target.value)} /></div>
                )}
              </div>
            </div>
          </div>

          {/* Caractéristiques techniques — mode détaillé uniquement */}
          {productMode === 'detaille' && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-list-check"></i> {t('ajouter.specs.title')}</div>
              <span className="ch-badge">{t('ajouter.specs.critereCount', { count: specs.length })}</span>
            </div>
            <div className="cb">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {specs.map((spec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: '0 0 160px' }}>
                      <label className="pf-lbl">{t('ajouter.specs.critere')}</label>
                      <input className="pf-in" placeholder={t('ajouter.specs.criterePlaceholder')} value={spec.cle} onChange={e => updateSpec(i, 'cle', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="pf-lbl">{t('ajouter.specs.valeur')}</label>
                      <input className="pf-in" placeholder={t('ajouter.specs.valeurPlaceholder')} value={spec.valeur} onChange={e => updateSpec(i, 'valeur', e.target.value)} />
                    </div>
                    {specs.length > 1 && (
                      <button onClick={() => removeSpec(i)} style={{ background: 'var(--g100)', border: '1px solid rgba(128,128,128,.2)', borderRadius: 'var(--r-md)', width: 36, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', cursor: 'pointer', flexShrink: 0 }}>
                        <i className="fas fa-trash" style={{ fontSize: 11 }}></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addSpec} style={{ background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-plus"></i> {t('ajouter.specs.add')}
              </button>
            </div>
          </div>
          )}

          {/* Variantes — mode détaillé uniquement */}
          {productMode === 'detaille' && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-layer-group"></i> {t('ajouter.variantes.title')}</div>
              <label className="aj-toggle">
                <input type="checkbox" checked={variantesOn} onChange={e => setVariantesOn(e.target.checked)} />
                <span className="aj-toggle-slider"></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: variantesOn ? 'var(--t2)' : 'var(--t3)', marginLeft: 8 }}>
                  {variantesOn ? t('ajouter.variantes.activees') : t('ajouter.variantes.desactivees')}
                </span>
              </label>
            </div>
            {variantesOn ? (
              <div className="cb">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {variantes.map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
                      <div style={{ flex: '0 0 140px' }}>
                        <label className="pf-lbl">{t('ajouter.variantes.type')}</label>
                        <select className="pf-in" value={v.type} onChange={e => updateVariante(i, 'type', e.target.value)}>
                          {VARIANTE_TYPES.map(vt => <option key={vt} value={vt}>{t(`ajouter.constants.varianteTypes.${vt}`)}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="pf-lbl">{t('ajouter.variantes.valeurs')}</label>
                        <input className="pf-in" placeholder={t('ajouter.variantes.valeursPlaceholder')} value={v.vals} onChange={e => updateVariante(i, 'vals', e.target.value)} />
                      </div>
                      {variantes.length > 1 && (
                        <button onClick={() => removeVariante(i)} style={{ background: 'var(--g100)', border: '1px solid rgba(128,128,128,.2)', borderRadius: 'var(--r-md)', width: 36, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', cursor: 'pointer', flexShrink: 0 }}>
                          <i className="fas fa-trash" style={{ fontSize: 11 }}></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addVariante} style={{ background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-plus"></i> {t('ajouter.variantes.add')}
                </button>
              </div>
            ) : (
              <div className="cb" style={{ color: 'var(--t3)', fontSize: 12.5, fontStyle: 'italic' }}>
                {t('ajouter.variantes.disabledHint')}
              </div>
            )}
          </div>
          )}

          {/* Vente en gros — masquée en mode rapide (et tant qu'aucun mode n'est
              choisi) ; toggle masqué (forcé actif) en mode gros, libre en détaillé */}
          {(productMode === 'detaille' || productMode === 'gros') && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-boxes-stacked"></i> {t('ajouter.venteEnGros.title')}</div>
              {productMode !== 'gros' && (
              <label className="aj-toggle">
                <input type="checkbox" checked={venteEnGrosOn} onChange={e => setVenteEnGrosOn(e.target.checked)} />
                <span className="aj-toggle-slider"></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: venteEnGrosOn ? 'var(--t2)' : 'var(--t3)', marginLeft: 8 }}>
                  {venteEnGrosOn ? t('ajouter.venteEnGros.activee') : t('ajouter.venteEnGros.desactivee')}
                </span>
              </label>
              )}
            </div>
            {venteEnGrosOn ? (
              <div className="cb">
                {/* MOQ, conditionnement, délai */}
                <div className="gridR3" style={{ gap: 10, marginBottom: 16 }}>
                  <div>
                    <label className="pf-lbl">{t('ajouter.venteEnGros.moq')}</label>
                    <input className="pf-in" type="number" placeholder={t('ajouter.venteEnGros.moqPlaceholder')} value={form.moq} onChange={e => update('moq', e.target.value)} />
                  </div>
                  <div>
                    <label className="pf-lbl">{t('ajouter.venteEnGros.conditionnement')}</label>
                    <input className="pf-in" type="number" placeholder={t('ajouter.venteEnGros.conditionnementPlaceholder')} value={form.conditionnement} onChange={e => update('conditionnement', e.target.value)} />
                  </div>
                  <div>
                    <label className="pf-lbl">{t('ajouter.venteEnGros.delaiPreparation')}</label>
                    <input className="pf-in" placeholder={t('ajouter.venteEnGros.delaiPlaceholder')} value={form.delaiPreparationGros} onChange={e => update('delaiPreparationGros', e.target.value)} />
                  </div>
                </div>

                {/* Paliers de prix dégressifs */}
                <label className="pf-lbl">{t('ajouter.venteEnGros.paliers')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6, marginBottom: 12 }}>
                  {wholesaleTiers.map((tier, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ flex: '0 0 110px' }}>
                        <label className="pf-lbl">{t('ajouter.venteEnGros.qteMin')}</label>
                        <input className="pf-in" type="number" placeholder="10" value={tier.quantiteMin} onChange={e => updateTier(i, 'quantiteMin', e.target.value)} />
                      </div>
                      <div style={{ flex: '0 0 110px' }}>
                        <label className="pf-lbl">{t('ajouter.venteEnGros.qteMax')}</label>
                        <input className="pf-in" type="number" placeholder={t('ajouter.venteEnGros.qteMaxPlaceholder')} value={tier.quantiteMax} onChange={e => updateTier(i, 'quantiteMax', e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="pf-lbl">{t('ajouter.venteEnGros.prixUnitaire')}</label>
                        <input className="pf-in" type="number" placeholder={t('ajouter.venteEnGros.prixUnitairePlaceholder')} value={tier.prixUnitaire} onChange={e => updateTier(i, 'prixUnitaire', e.target.value)} />
                      </div>
                      {wholesaleTiers.length > 1 && (
                        <button onClick={() => removeTier(i)} style={{ background: 'var(--g100)', border: '1px solid rgba(128,128,128,.2)', borderRadius: 'var(--r-md)', width: 36, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t2)', cursor: 'pointer', flexShrink: 0 }}>
                          <i className="fas fa-trash" style={{ fontSize: 11 }}></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addTier} style={{ background: 'var(--g100)', border: '1px solid var(--bdr2)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-plus"></i> {t('ajouter.venteEnGros.add')}
                </button>
              </div>
            ) : (
              <div className="cb" style={{ color: 'var(--t3)', fontSize: 12.5, fontStyle: 'italic' }}>
                {t('ajouter.venteEnGros.disabledHint')}
              </div>
            )}
          </div>
          )}

          {/* SEO — mode détaillé uniquement */}
          {productMode === 'detaille' && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-magnifying-glass-chart"></i> {t('ajouter.seo.title')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="aj-seo-ring" style={{ background: `conic-gradient(${seoScore.score >= 80 ? 'var(--t2)' : seoScore.score >= 50 ? 'var(--t2)' : 'var(--t2)'} 0% ${seoScore.score}%, var(--g200) ${seoScore.score}% 100%)` }}>
                  <span>{seoScore.score}</span>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: seoScore.score >= 80 ? 'var(--t2)' : seoScore.score >= 50 ? 'var(--t2)' : 'var(--t2)' }}>{t('ajouter.seo.score')}</span>
              </div>
            </div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">{t('ajouter.seo.titreSeo')}</label>
                <input className="pf-in" placeholder={t('ajouter.seo.titrePlaceholder')} value={form.titreSeo} onChange={e => update('titreSeo', e.target.value)} maxLength={70} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>{t('ajouter.seo.titreIdeal')}</p>
                  <p style={{ fontSize: 10, color: form.titreSeo.length > 50 && form.titreSeo.length <= 70 ? 'var(--emerald)' : 'var(--t3)' }}>{form.titreSeo.length}/70</p>
                </div>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouter.seo.descriptionSeo')}</label>
                <textarea className="pf-in" rows={3} placeholder={t('ajouter.seo.descriptionPlaceholder')} value={form.descriptionSeo} onChange={e => update('descriptionSeo', e.target.value)} maxLength={160} style={{ resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>{t('ajouter.seo.descriptionIdeal')}</p>
                  <p style={{ fontSize: 10, color: form.descriptionSeo.length >= 120 && form.descriptionSeo.length <= 160 ? 'var(--emerald)' : 'var(--t3)' }}>{form.descriptionSeo.length}/160</p>
                </div>
              </div>
              <div>
                <label className="pf-lbl">{t('ajouter.seo.urlSlug')}</label>
                <div style={{ display: 'flex', border: '1.5px solid var(--bdr2)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--g50)' }}>
                  <span style={{ padding: '10px 10px 10px 13px', fontSize: 12, color: 'var(--t3)', borderRight: '1px solid var(--bdr2)', whiteSpace: 'nowrap', background: 'var(--g100)' }}>shopi.gn/p/</span>
                  <input style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 13px', fontSize: 13, color: 'var(--t1)' }} placeholder="iphone-15-pro-256gb" value={form.urlSlug} onChange={e => update('urlSlug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))} />
                </div>
              </div>
              <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>{t('ajouter.seo.qualite')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {seoScore.criteres.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--t2)' }}>
                      <i className={`fas ${c.ok ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ fontSize: 13, color: c.ok ? 'var(--emerald)' : 'var(--t4)', width: 14 }}></i>
                      {c.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Aperçu revenus */}
          {form.prix && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="ch"><div className="ch-t"><i className="fas fa-calculator"></i> {t('ajouter.revenus.title')}</div></div>
              <div className="cb">
                <div className="gridR3" style={{ gap: 10 }}>
                  {[
                    { l: t('ajouter.revenus.prixVente'),        v: `${prixNum.toLocaleString('fr-FR')} GNF`, c: 'var(--navy)'    },
                    { l: t('ajouter.revenus.commission', { pct: commissionPct }), v: `-${Math.round(prixNum * commissionPct / 100).toLocaleString('fr-FR')} GNF`, c: 'var(--t2)'    },
                    { l: t('ajouter.revenus.revenuNet'),                    v: `${Math.round(prixNum * (1 - commissionPct / 100)).toLocaleString('fr-FR')} GNF`,  c: 'var(--t2)' },
                  ].map((s, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }}>{s.l}</div>
                      <div style={{ fontFamily: 'var(--fd)', fontSize: 13, fontWeight: 800, color: s.c }}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions bas de page */}
          <div className="card" style={{ background: 'var(--g50)', border: '1.5px solid var(--bdr)' }}>
            <div className="cb">
              {Object.keys(errors).filter(k => k !== 'general').length > 0 && (
                <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(128,128,128,.06)', border: '1.5px solid rgba(128,128,128,.25)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--t2)', marginBottom: 6 }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    {t('ajouter.actions.fixErrorsTitle')}
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--t2)', lineHeight: 1.8 }}>
                    {errors.nom         && <li>{errors.nom}</li>}
                    {errors.prix        && <li>{errors.prix}</li>}
                    {errors.stock       && <li>{errors.stock}</li>}
                    {errors.categorieId && <li>{errors.categorieId}</li>}
                  </ul>
                </div>
              )}
              <div className="pf-actions">
                <button className="btn-draft" onClick={() => onNavigate('produits')} disabled={enChargement}>
                  <i className="fas fa-arrow-left"></i> {t('ajouter.actions.retour')}
                </button>
                {!isEditMode && (
                  <button className="btn-draft" onClick={() => handlePublish(true)} disabled={enChargement}>
                    <i className="fas fa-save"></i> {enChargement ? t('ajouter.header.saving') : t('ajouter.header.draft')}
                  </button>
                )}
                <button className="btn-pub" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handlePublish(false)} disabled={enChargement}>
                  <i className={`fas ${isEditMode ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
                  {enChargement
                    ? (isEditMode ? t('ajouter.header.updating') : t('ajouter.header.publishing'))
                    : (isEditMode ? t('ajouter.header.update') : t('ajouter.header.publish'))}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      )}
    </div>
  );
}