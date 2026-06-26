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
}

interface Spec     { cle: string; valeur: string; }
interface Variante { type: string; vals: string; }

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

const VARIANTE_TYPES = ['Couleur', 'Stockage', 'RAM', 'Taille', 'Résolution', 'Matière'];

const PAYS_ORIGINE = [
  { val: 'GN', label: '🇬🇳 Guinée (local)' },
  { val: 'SN', label: '🇸🇳 Sénégal' },
  { val: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { val: 'ML', label: '🇲🇱 Mali' },
  { val: 'CM', label: '🇨🇲 Cameroun' },
  { val: 'FR', label: '🇫🇷 France' },
  { val: 'CN', label: '🇨🇳 Chine' },
  { val: 'US', label: '🇺🇸 États-Unis' },
  { val: 'DE', label: '🇩🇪 Allemagne' },
  { val: 'GB', label: '🇬🇧 Royaume-Uni' },
  { val: 'JP', label: '🇯🇵 Japon' },
  { val: 'AE', label: '🇦🇪 Émirats Arabes Unis' },
];

const RETOUR_OPTIONS = [
  { val: '7j',     label: '7 jours — Remboursement complet' },
  { val: '14j',    label: '14 jours — Remboursement ou échange' },
  { val: '30j',    label: '30 jours — Échange uniquement' },
  { val: 'defect', label: 'Retour uniquement si défectueux' },
  { val: 'none',   label: 'Aucun retour accepté' },
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
  return (
    <div style={{
      background: 'rgba(225,29,72,.08)', border: '1.5px solid rgba(225,29,72,.3)',
      borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 20,
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>❌</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--rose)', marginBottom: 3 }}>
          Une erreur est survenue
        </div>
        <div style={{ fontSize: 12, color: 'var(--rose)', opacity: 0.85, lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rose)', fontSize: 16, padding: 0, flexShrink: 0 }}>
        <i className="fas fa-xmark" />
      </button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--rose)', fontSize: 11.5, marginTop: 5, fontWeight: 600 }}>
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
  marque: '', tags: '', visibilite: 'draft', reference: '', garantie: '12 mois',
  poids: '', condition: 'neuf', categorieId: '', categorie: '', sousCatId: '', sousCat: '',
  titreSeo: '', descriptionSeo: '', urlSlug: '', longueur: '', largeur: '', hauteur: '',
  paysOrigine: 'GN', politiqueRetour: '7j', contenuBoite: '',
  livraisonStandard: true, livraisonLivreur: true, livraisonCorrespondant: false,
  fraisLivraisonLocal: '', delaiLivraison: '1-3 jours',
  garantiePaiement: true, garantieRetour: true, garantieAuthentic: true, garantieSupport: true,
  langue: 'fr',
};

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function AjouterPage({ onNavigate, productId }: AjouterPageProps) {
  const { pop } = useToast();

  // ✅ Mode édition si productId est défini
  const isEditMode = !!productId;

  const [errors,      setErrors]      = useState<FormErrors>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [loadingProd, setLoadingProd] = useState(false); // chargement du produit existant

  // ── Catégories ────────────────────────────────────────────────────────────
  const [categoriesApi,   setCategoriesApi]   = useState<CategorieApi[]>([]);
  const [chargementCats,  setChargementCats]  = useState(true);
  const [erreurCats,      setErreurCats]      = useState<string | null>(null);

  // ── Formulaire ────────────────────────────────────────────────────────────
  const [form,       setForm]       = useState({ ...FORM_INITIAL });
  const [images,     setImages]     = useState<ImageUploaded[]>([]);
  const [specs,      setSpecs]      = useState<Spec[]>([
    { cle: 'Marque', valeur: '' },
    { cle: 'Puce / Processeur', valeur: '' },
    { cle: 'Connectivité', valeur: '' },
  ]);
  const [variantes,    setVariantes]    = useState<Variante[]>([{ type: 'Couleur', vals: '' }]);
  const [variantesOn,  setVariantesOn]  = useState(false);
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
  // useEffect 1 — Charge les catégories depuis l'API
  // ─────────────────────────────────────────────────────────────
 useEffect(() => {
  fetch(`${API}/produits/categories`, {  // ✅ était /categories
    headers: { Authorization: `Bearer ${getToken()}` },
  })
    .then(r => {
      if (!r.ok) {
        if (r.status === 401) throw new Error('Session expirée. Veuillez vous reconnecter.');
        throw new Error(`Erreur serveur (${r.status}) lors du chargement des catégories.`);
      }
      return r.json();
    })
    .then((data: CategorieApi[]) => {
      if (!Array.isArray(data)) throw new Error('Format inattendu.');
      setCategoriesApi(data);
      if (!isEditMode && data.length > 0) {
        setForm(prev => ({ ...prev, categorieId: data[0].id, categorie: data[0].nom }));
      }
    })
    .catch(err => {
      const msg = isNetworkError(err)
        ? 'Impossible de joindre le serveur. Vérifiez que votre backend est démarré sur le port 3001.'
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
        { cle: 'Marque', valeur: '' },
        { cle: 'Puce / Processeur', valeur: '' },
        { cle: 'Connectivité', valeur: '' },
      ]);
      setVariantes([{ type: 'Couleur', vals: '' }]);
      setVariantesOn(false);
      return;
    }

    // Sinon → charge le produit depuis l'API
    setLoadingProd(true);
    fetch(`${API}/produits/${productId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`Erreur ${r.status} lors du chargement du produit.`);
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
        });

        // ✅ Pré-remplit les images existantes (preview = url Cloudinary)
        if (p.images?.length) {
          setImages(p.images.map((img: any) => ({
            url:     img.url,
            ordre:   img.ordre,
            alt:     img.alt ?? null,
            preview: img.url, // ← affiche l'image Cloudinary directement
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

        pop('📝 Données du produit chargées', 'i');
      })
      .catch(err => {
        pop(`❌ Impossible de charger le produit : ${err.message}`, 'e');
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
    if (!form.nom.trim())                                              e.nom         = 'Le nom du produit est obligatoire.';
    else if (form.nom.trim().length < 3)                               e.nom         = 'Le nom doit contenir au moins 3 caractères.';
    if (!form.prix.trim())                                             e.prix        = 'Le prix de vente est obligatoire.';
    else if (isNaN(parseFloat(form.prix)) || parseFloat(form.prix) <= 0) e.prix     = 'Le prix doit être un nombre positif.';
    if (!form.stock.trim())                                            e.stock       = 'La quantité en stock est obligatoire.';
    else if (isNaN(parseInt(form.stock)) || parseInt(form.stock) < 0) e.stock       = 'Le stock doit être un nombre positif ou zéro.';
    if (!form.categorieId)                                             e.categorieId = 'Veuillez sélectionner une catégorie.';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      pop('⚠️ Veuillez corriger les erreurs dans le formulaire.', 'w');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    }
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // UPLOAD IMAGE
  // ─────────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files    = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const aUploader = files.slice(0, 10 - images.length);
    if (!aUploader.length) { pop('⚠️ Maximum 10 images atteint', 'w'); return; }

    setUploadEnCours(true);
    try {
      const nouvelles: ImageUploaded[] = [];
      for (const file of aUploader) {
        if (file.size > 5 * 1024 * 1024) { pop(`⚠️ "${file.name}" dépasse 5 MB — ignoré.`, 'w'); continue; }
        const preview  = URL.createObjectURL(file);
        const formData = new FormData();
        formData.append('file', file);
        let res: Response;
        try {
          res = await fetch(`${API}/upload/image/product`, {
            method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData,
          });
        } catch { throw new Error('Impossible de joindre le serveur. Vérifiez que votre backend est démarré.'); }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(res.status === 401 ? 'Session expirée.' : errData.message ?? `Erreur ${res.status}`);
        }
        const data: { url: string } = await res.json();
        nouvelles.push({ url: data.url, ordre: images.length + nouvelles.length, alt: null, preview });
      }
      if (nouvelles.length) {
        setImages(prev => [...prev, ...nouvelles]);
        pop(`✅ ${nouvelles.length} image(s) uploadée(s)`, 's');
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

  // ─────────────────────────────────────────────────────────────
  // SCORE SEO
  // ─────────────────────────────────────────────────────────────

  const seoScore = useMemo(() => {
    const criteres = [
      { label: 'Nom du produit renseigné',     ok: form.nom.trim().length > 5 },
      { label: 'Description > 100 caractères', ok: form.description.trim().length > 100 },
      { label: 'Titre SEO défini',             ok: form.titreSeo.trim().length > 0 },
      { label: 'Description SEO définie',      ok: form.descriptionSeo.trim().length > 0 },
      { label: 'URL Slug personnalisée',        ok: form.urlSlug.trim().length > 0 },
      { label: 'Tags SEO renseignés',           ok: form.tags.trim().length > 0 },
      { label: 'Marque définie',               ok: form.marque.trim().length > 0 },
      { label: 'Au moins 1 image uploadée',    ok: images.length > 0 },
      { label: 'Prix de vente saisi',          ok: form.prix.trim().length > 0 },
      { label: 'Référence SKU définie',        ok: form.reference.trim().length > 0 },
    ];
    return { score: Math.round((criteres.filter(c => c.ok).length / criteres.length) * 100), criteres };
  }, [form, images]);

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
        images:    images.map(img => ({ url: img.url, ordre: img.ordre, alt: img.alt })),
        specs:     specs.filter(s => s.cle.trim() && s.valeur.trim()).map((s, idx) => ({ ...s, ordre: idx })),
        variantes: variantesOn ? variantes.filter(v => v.vals.trim()) : [],
        stories:   storiesOn
          ? Array.from(storyIndices)
              .filter(i => i < images.length)
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
        throw new Error('Impossible de joindre le serveur. Vérifiez que votre backend NestJS est démarré sur le port 3001.');
      }

      if (!res.ok) {
        let errorMessage = `Erreur serveur (${res.status}).`;
        try {
          const errData = await res.json();
          if      (res.status === 401) errorMessage = 'Votre session a expiré. Veuillez vous reconnecter.';
          else if (res.status === 403) errorMessage = "Vous n'avez pas les droits nécessaires.";
          else if (res.status === 400) {
            errorMessage = Array.isArray(errData.message)
              ? '• ' + errData.message.join('\n• ')
              : errData.message ?? errorMessage;
          }
          else if (res.status === 409) errorMessage = errData.message ?? 'URL slug déjà utilisé. Changez le slug.';
          else if (res.status === 500) errorMessage = 'Erreur interne du serveur. Consultez les logs.';
          else                         errorMessage = errData.message ?? errorMessage;
        } catch { /* body non JSON */ }
        throw new Error(errorMessage);
      }

      // ✅ Succès
      setErrorBanner(null);
      setErrors({});
      pop(
        isEditMode
          ? '✅ Produit mis à jour avec succès !'
          : (draft ? '💾 Brouillon sauvegardé !' : '✅ Produit publié avec succès !'),
        's'
      );
      // Retour à la liste après succès
      setTimeout(() => onNavigate('produits'), 800);

    } catch (err: any) {
      const message = err.message ?? 'Une erreur inattendue est survenue.';
      setErrorBanner(message);
      setErrors(prev => ({ ...prev, general: message }));
      pop(`❌ Échec`, 'e');
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
        <i className="fas fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--blue)' }} />
        <div style={{ fontSize: 14, color: 'var(--t3)' }}>Chargement du produit…</div>
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
            {isEditMode ? 'Modifier le produit' : 'Ajouter un produit'}
          </div>
          <div className="aj-sub">
            {isEditMode
              ? 'Modifiez les informations de votre produit et sauvegardez les changements.'
              : 'Remplissez les informations pour publier votre produit sur la boutique.'}
          </div>
        </div>
        <div className="pf-actions">
          <button className="btn-draft" onClick={() => onNavigate('produits')} disabled={enChargement}>
            <i className="fas fa-arrow-left"></i> Annuler
          </button>
          {/* En mode édition le brouillon garde le même produit */}
          {!isEditMode && (
            <button className="btn-draft" onClick={() => handlePublish(true)} disabled={enChargement}>
              <i className="fas fa-save"></i> {enChargement ? 'Sauvegarde…' : 'Brouillon'}
            </button>
          )}
          <button className="btn-pub" onClick={() => handlePublish(false)} disabled={enChargement}>
            <i className={`fas ${isEditMode ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
            {enChargement
              ? (isEditMode ? 'Mise à jour…' : 'Publication…')
              : (isEditMode ? 'Mettre à jour' : 'Publier le produit')}
          </button>
        </div>
      </div>

      {/* ── Badge mode édition ── */}
      {isEditMode && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--sky)', border: '1px solid var(--sky-3)',
          borderRadius: 'var(--pill)', padding: '6px 14px',
          fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 16,
        }}>
          <i className="fas fa-pen-to-square" />
          Mode édition — vous modifiez un produit existant
        </div>
      )}

      {/* Bannière d'erreur */}
      {errorBanner && <ErrorBanner message={errorBanner} onClose={() => setErrorBanner(null)} />}

      {/* ── Grille ── */}
      <div className="g3r" style={{ alignItems: 'flex-start' }}>

        {/* ════════ COLONNE GAUCHE ════════ */}
        <div>

          {/* Médias produit */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-image"></i> Médias produit</div>
              <span className="ch-badge">{images.length}/10</span>
            </div>
            <div className="cb">
              <div
                className={`pf-drop ${uploadEnCours ? 'pf-drop--loading' : ''}`}
                onClick={() => !uploadEnCours && fileInputRef.current?.click()}
                style={{ cursor: uploadEnCours ? 'wait' : 'pointer' }}
              >
                {uploadEnCours ? (
                  <><i className="fas fa-spinner fa-spin"></i><p><strong>Upload en cours…</strong></p></>
                ) : (
                  <>
                    <i className="fas fa-cloud-arrow-up"></i>
                    <p><strong>Glissez vos images ici</strong><br />ou cliquez pour sélectionner</p>
                    <p style={{ fontSize: 11, marginTop: 6, color: 'var(--t4)' }}>
                      JPG, PNG, WebP · Min. 800×800px · Max. 5 MB/image
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {images.length > 0 && (
                <div className="aj-img-grid">
                  {images.map((img, i) => (
                    <div key={i} className="aj-img-thumb">
                      <img src={img.preview} alt={img.alt ?? `Image ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                      <button className="aj-img-del" onClick={() => supprimerImage(i)}>
                        <i className="fas fa-xmark"></i>
                      </button>
                      {i === 0 && <div className="aj-img-main">Principale</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Stories produit ── */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-circle-play"></i> Stories produit</div>
              <label className="aj-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={storiesOn} onChange={e => { setStoriesOn(e.target.checked); if (!e.target.checked) setStoryIndices(new Set()); }} />
                <span className="aj-toggle-slider"></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: storiesOn ? 'var(--blue)' : 'var(--t3)', whiteSpace: 'nowrap' }}>
                  {storiesOn ? 'Activées' : 'Désactivées'}
                </span>
              </label>
            </div>

            {storiesOn ? (
              <div className="cb">
                {images.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: 12.5 }}>
                    <i className="fas fa-images" style={{ fontSize: 24, display: 'block', marginBottom: 8, opacity: 0.4 }} />
                    Ajoutez d'abord des images produit pour les sélectionner comme stories.
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12, lineHeight: 1.5 }}>
                      <i className="fas fa-circle-info" style={{ color: 'var(--blue)', marginRight: 6 }} />
                      Sélectionnez les images à publier en story (<strong>expire après 24h</strong>). Cliquez sur une image pour la sélectionner.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                      {images.map((img, i) => {
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
                              border: selected ? '2.5px solid var(--blue)' : '2.5px solid transparent',
                              boxShadow: selected ? '0 0 0 3px rgba(59,130,246,.2)' : 'none',
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
                                background: 'rgba(59,130,246,.18)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                <div style={{
                                  width: 24, height: 24, borderRadius: '50%',
                                  background: 'var(--blue)',
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
                          background: 'var(--sky)', borderRadius: 'var(--r-md)',
                          fontSize: 12, color: 'var(--blue)', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <i className="fas fa-circle-play" />
                          {storyIndices.size} image{storyIndices.size > 1 ? 's' : ''} sélectionnée{storyIndices.size > 1 ? 's' : ''} comme story
                        </div>

                        {/* Plage horaire */}
                        <div style={{
                          padding: '14px 14px',
                          background: 'var(--g50)', border: '1.5px solid var(--bdr)',
                          borderRadius: 'var(--r-md)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
                            <i className="fas fa-clock" style={{ color: 'var(--blue)', fontSize: 13 }} />
                            Plage horaire d'affichage (par jour)
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Heure de début */}
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>
                                À partir de
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
                                Jusqu'à
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
                              <i className="fas fa-circle-info" style={{ color: 'var(--blue)', fontSize: 11 }} />
                              {storyHeureFin > storyHeureDebut
                                ? <>De <strong>{storyHeureDebut}</strong> à <strong>{storyHeureFin}</strong></>
                                : <span style={{ color: 'var(--rose)', fontWeight: 600 }}>
                                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 4 }} />
                                    L'heure de fin doit être après l'heure de début.
                                  </span>
                              }
                            </div>
                          )}
                        </div>

                        {/* Jours d'affichage */}
                        {(() => {
                          const JOURS = [
                            { key: 'lun', label: 'Lun' },
                            { key: 'mar', label: 'Mar' },
                            { key: 'mer', label: 'Mer' },
                            { key: 'jeu', label: 'Jeu' },
                            { key: 'ven', label: 'Ven' },
                            { key: 'sam', label: 'Sam' },
                            { key: 'dim', label: 'Dim' },
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
                                  <i className="fas fa-calendar-days" style={{ color: 'var(--blue)', fontSize: 13 }} />
                                  Jours d'affichage
                                </div>
                                <button
                                  onClick={() => setStoryJours(
                                    tousSelectionnes ? new Set() : new Set(JOURS.map(j => j.key))
                                  )}
                                  style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 700,
                                    color: tousSelectionnes ? 'var(--rose)' : 'var(--blue)',
                                    padding: '2px 6px',
                                  }}
                                >
                                  {tousSelectionnes ? 'Tout désélectionner' : 'Tous les jours'}
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
                                          ? `2px solid ${isWeekend ? 'var(--indigo, #4F46E5)' : 'var(--blue)'}`
                                          : '2px solid var(--bdr2)',
                                        background: actif
                                          ? isWeekend ? 'rgba(79,70,229,.1)' : 'var(--sky)'
                                          : 'var(--white)',
                                        color: actif
                                          ? isWeekend ? 'var(--indigo, #4F46E5)' : 'var(--blue)'
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
                                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--rose)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <i className="fas fa-triangle-exclamation" />
                                  Sélectionnez au moins un jour.
                                </div>
                              ) : (
                                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                  <i className="fas fa-circle-check" style={{ color: 'var(--emerald)' }} />
                                  {storyJours.size === 7
                                    ? 'Visible tous les jours'
                                    : storyJours.size === 5 && !storyJours.has('sam') && !storyJours.has('dim')
                                    ? 'Visible du lundi au vendredi'
                                    : storyJours.size === 2 && storyJours.has('sam') && storyJours.has('dim')
                                    ? 'Visible le week-end uniquement'
                                    : `Visible ${storyJours.size} jour${storyJours.size > 1 ? 's' : ''} par semaine`
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
                Activez les stories pour mettre en avant ce produit pendant 24h dans le fil stories de votre boutique.
              </div>
            )}
          </div>

          {/* Organisation */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-tags"></i> Organisation</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">Catégorie *</label>
                {erreurCats ? (
                  <div style={{ padding: '10px 12px', background: 'rgba(225,29,72,.06)', border: '1.5px solid rgba(225,29,72,.25)', borderRadius: 'var(--r-md)', fontSize: 12, color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="fas fa-triangle-exclamation" />
                    {erreurCats}
                    <button onClick={() => { setErreurCats(null); setChargementCats(true); window.location.reload(); }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--rose)', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: 'var(--rose)', cursor: 'pointer' }}>
                      Réessayer
                    </button>
                  </div>
                ) : (
                  <select
                    className={`pf-in ${errors.categorieId ? 'pf-in--error' : ''}`}
                    value={form.categorieId}
                    disabled={chargementCats}
                    onChange={e => handleChangerCategorie(e.target.value)}
                    style={{ borderColor: errors.categorieId ? 'var(--rose)' : undefined }}
                  >
                    {chargementCats ? (
                      <option>Chargement…</option>
                    ) : categoriesApi.length === 0 ? (
                      <option value="">Aucune catégorie disponible</option>
                    ) : (
                      categoriesApi.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)
                    )}
                  </select>
                )}
                <FieldError message={errors.categorieId} />
              </div>

              <div>
                <label className="pf-lbl">Sous-catégorie</label>
                <select className="pf-in" value={form.sousCatId} onChange={e => handleChangerSousCat(e.target.value)}>
                  <option value="">Choisir…</option>
                  {sousCatsOptions.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>

              <div><label className="pf-lbl">Marque</label><input className="pf-in" placeholder="Ex: Apple, Samsung…" value={form.marque} onChange={e => update('marque', e.target.value)} /></div>
              <div><label className="pf-lbl">Tags SEO (séparés par virgule)</label><input className="pf-in" placeholder="smartphone, iphone, apple…" value={form.tags} onChange={e => update('tags', e.target.value)} /></div>
              <div>
                <label className="pf-lbl">Langue</label>
                <select className="pf-in" value={form.langue} onChange={e => update('langue', e.target.value)}>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="en">🇬🇧 Anglais</option>
                  <option value="ar">🇸🇦 Arabe</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">Visibilité</label>
                <select className="pf-in" value={form.visibilite} onChange={e => update('visibilite', e.target.value)}>
                  <option value="public">Public · Visible sur la boutique</option>
                  <option value="draft">Brouillon · Non publié</option>
                  <option value="private">Privé · Lien direct uniquement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Infos complémentaires */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-circle-info"></i> Infos complémentaires</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">État du produit</label>
                <select className="pf-in" value={form.condition} onChange={e => update('condition', e.target.value)}>
                  <option value="neuf">Neuf — jamais utilisé</option>
                  <option value="reconditionne">Reconditionné certifié</option>
                  <option value="occasion">Occasion — Très bon état</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">Garantie</label>
                <select className="pf-in" value={form.garantie} onChange={e => update('garantie', e.target.value)}>
                  <option>3 mois</option><option>6 mois</option><option>12 mois</option><option>24 mois</option><option>Sans garantie</option>
                </select>
              </div>
              <div>
                <label className="pf-lbl">Politique de retour</label>
                <select className="pf-in" value={form.politiqueRetour} onChange={e => update('politiqueRetour', e.target.value)}>
                  {RETOUR_OPTIONS.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="pf-lbl">Pays d'origine</label>
                <select className="pf-in" value={form.paysOrigine} onChange={e => update('paysOrigine', e.target.value)}>
                  {PAYS_ORIGINE.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
                </select>
                {isInternational && (
                  <div className="aj-origin-banner">
                    <span style={{ fontSize: 18 }}>🌍</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--indigo)', marginBottom: 2 }}>Produit international détecté</div>
                      <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>La fiche affichera automatiquement le bandeau international.</div>
                    </div>
                  </div>
                )}
              </div>
              <div><label className="pf-lbl">Poids (kg)</label><input className="pf-in" type="number" step="0.01" placeholder="Ex: 0.5" value={form.poids} onChange={e => update('poids', e.target.value)} /></div>
              <div>
                <label className="pf-lbl">Dimensions physiques (cm)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {(['longueur', 'largeur', 'hauteur'] as const).map(dim => (
                    <div key={dim}>
                      <label style={{ fontSize: 10, color: 'var(--t3)', display: 'block', marginBottom: 3 }}>{dim.charAt(0).toUpperCase() + dim.slice(1)}</label>
                      <input className="pf-in" type="number" placeholder={dim[0].toUpperCase()} value={form[dim]} onChange={e => update(dim, e.target.value)} />
                    </div>
                  ))}
                </div>
                {form.longueur && form.largeur && form.hauteur && (
                  <p style={{ fontSize: 10.5, color: 'var(--emerald)', marginTop: 5 }}>
                    📦 Volume : {(parseFloat(form.longueur) * parseFloat(form.largeur) * parseFloat(form.hauteur) / 1000).toFixed(2)} L
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Livraison */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-truck-fast"></i> Politique de livraison</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'livraisonStandard'      as const, icon: '🚚', label: 'Livraison standard',        sub: 'Gérée par votre boutique' },
                { key: 'livraisonLivreur'       as const, icon: '🛵', label: 'Choisir un livreur',         sub: "L'acheteur sélectionne son livreur" },
                { key: 'livraisonCorrespondant' as const, icon: '🤝', label: 'Via un correspondant Shopi', sub: "Pour les produits venant de l'étranger" },
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
              <div><label className="pf-lbl">Frais de livraison locale (GNF)</label><input className="pf-in" type="number" placeholder="0 = Livraison gratuite" value={form.fraisLivraisonLocal} onChange={e => update('fraisLivraisonLocal', e.target.value)} /></div>
              <div>
                <label className="pf-lbl">Délai de livraison estimé</label>
                <select className="pf-in" value={form.delaiLivraison} onChange={e => update('delaiLivraison', e.target.value)}>
                  <option>Même jour</option><option>1-3 jours</option><option>3-7 jours</option><option>7-14 jours</option><option>14-30 jours</option><option>Sur commande</option>
                </select>
              </div>
            </div>
          </div>

          {/* Garanties */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-shield-check"></i> Garanties affichées sur la fiche</div></div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { key: 'garantiePaiement'  as const, icon: '🔒', label: 'Paiement sécurisé',   sub: 'SSL · Orange Money · Visa' },
                { key: 'garantieRetour'    as const, icon: '↩️', label: 'Retour garanti',        sub: 'Remboursement ou échange' },
                { key: 'garantieAuthentic' as const, icon: '✅', label: 'Produit authentique',  sub: 'Vendeur Shopi certifié' },
                { key: 'garantieSupport'   as const, icon: '📞', label: 'Support 24/7',          sub: 'Chat · WhatsApp · Tél.' },
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

        </div>

        {/* ════════ COLONNE DROITE ════════ */}
        <div>

          {/* Informations produit */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch"><div className="ch-t"><i className="fas fa-file-alt"></i> Informations produit</div></div>
            <div className="cb">
              <div className="pf-grid">
                <div className="pf-full">
                  <label className="pf-lbl">Nom du produit *</label>
                  <input className="pf-in" placeholder="Ex: iPhone 15 Pro 256GB Titanium" value={form.nom} onChange={e => update('nom', e.target.value)} style={{ borderColor: errors.nom ? 'var(--rose)' : undefined }} />
                  <FieldError message={errors.nom} />
                </div>

                <div className="pf-full">
                  <label className="pf-lbl">Description</label>
                  <textarea className="pf-in" rows={4} placeholder="Décrivez votre produit en détail…" value={form.description} onChange={e => update('description', e.target.value)} style={{ resize: 'vertical' }} />
                  <p style={{ fontSize: 10.5, color: form.description.length > 100 ? 'var(--emerald)' : 'var(--t4)', marginTop: 3, textAlign: 'right' }}>
                    {form.description.length} car. {form.description.length < 100 ? '(min. 100 recommandé)' : '✓'}
                  </p>
                </div>

                <div className="pf-full">
                  <label className="pf-lbl">Contenu de la boîte</label>
                  <textarea className="pf-in" rows={3} placeholder="Ex: 1× iPhone 15 Pro, 1× câble USB-C…" value={form.contenuBoite} onChange={e => update('contenuBoite', e.target.value)} style={{ resize: 'vertical' }} />
                </div>

                <div>
                  <label className="pf-lbl">Prix de vente (GNF) *</label>
                  <input className="pf-in" type="number" placeholder="Ex: 12500000" value={form.prix} onChange={e => update('prix', e.target.value)} style={{ borderColor: errors.prix ? 'var(--rose)' : undefined }} />
                  <FieldError message={errors.prix} />
                </div>

                <div>
                  <label className="pf-lbl">Prix barré (GNF)</label>
                  <input className="pf-in" type="number" placeholder="Ex: 14000000" value={form.prixAncien} onChange={e => update('prixAncien', e.target.value)} />
                  {form.prixAncien && form.prix && parseInt(form.prixAncien) > parseInt(form.prix) && (
                    <p style={{ fontSize: 10.5, color: 'var(--emerald)', marginTop: 3 }}>
                      ✓ Réduction de {Math.round((1 - parseInt(form.prix) / parseInt(form.prixAncien)) * 100)}% affichée
                    </p>
                  )}
                </div>

                <div><label className="pf-lbl">Référence / SKU</label><input className="pf-in" placeholder="Ex: APPL-IP15P-256-TIT" value={form.reference} onChange={e => update('reference', e.target.value)} /></div>

                <div>
                  <label className="pf-lbl">Quantité en stock *</label>
                  <input className="pf-in" type="number" placeholder="Ex: 10" value={form.stock} onChange={e => update('stock', e.target.value)} style={{ borderColor: errors.stock ? 'var(--rose)' : undefined }} />
                  <FieldError message={errors.stock} />
                </div>

                <div><label className="pf-lbl">Seuil d'alerte stock</label><input className="pf-in" type="number" placeholder="Ex: 5 unités" value={form.seuil} onChange={e => update('seuil', e.target.value)} /></div>
              </div>
            </div>
          </div>

          {/* Caractéristiques techniques */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-list-check"></i> Caractéristiques techniques</div>
              <span className="ch-badge">{specs.length} critères</span>
            </div>
            <div className="cb">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {specs.map((spec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <div style={{ flex: '0 0 160px' }}>
                      <label className="pf-lbl">Critère</label>
                      <input className="pf-in" placeholder="Ex: Puce" value={spec.cle} onChange={e => updateSpec(i, 'cle', e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="pf-lbl">Valeur</label>
                      <input className="pf-in" placeholder="Ex: A17 Pro (3 nm)" value={spec.valeur} onChange={e => updateSpec(i, 'valeur', e.target.value)} />
                    </div>
                    {specs.length > 1 && (
                      <button onClick={() => removeSpec(i)} style={{ background: 'var(--rs-bg)', border: '1px solid rgba(225,29,72,.2)', borderRadius: 'var(--r-md)', width: 36, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose)', cursor: 'pointer', flexShrink: 0 }}>
                        <i className="fas fa-trash" style={{ fontSize: 11 }}></i>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addSpec} style={{ background: 'var(--sky)', border: '1px solid var(--sky-3)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-plus"></i> Ajouter une caractéristique
              </button>
            </div>
          </div>

          {/* Variantes */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-layer-group"></i> Variantes produit</div>
              <label className="aj-toggle">
                <input type="checkbox" checked={variantesOn} onChange={e => setVariantesOn(e.target.checked)} />
                <span className="aj-toggle-slider"></span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: variantesOn ? 'var(--blue)' : 'var(--t3)', marginLeft: 8 }}>
                  {variantesOn ? 'Activées' : 'Désactivées'}
                </span>
              </label>
            </div>
            {variantesOn ? (
              <div className="cb">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {variantes.map((v, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-end' }}>
                      <div style={{ flex: '0 0 140px' }}>
                        <label className="pf-lbl">Type</label>
                        <select className="pf-in" value={v.type} onChange={e => updateVariante(i, 'type', e.target.value)}>
                          {VARIANTE_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="pf-lbl">Valeurs (séparées par virgule)</label>
                        <input className="pf-in" placeholder="Ex: Noir, Blanc, Bleu…" value={v.vals} onChange={e => updateVariante(i, 'vals', e.target.value)} />
                      </div>
                      {variantes.length > 1 && (
                        <button onClick={() => removeVariante(i)} style={{ background: 'var(--rs-bg)', border: '1px solid rgba(225,29,72,.2)', borderRadius: 'var(--r-md)', width: 36, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose)', cursor: 'pointer', flexShrink: 0 }}>
                          <i className="fas fa-trash" style={{ fontSize: 11 }}></i>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addVariante} style={{ background: 'var(--sky)', border: '1px solid var(--sky-3)', borderRadius: 'var(--pill)', padding: '7px 16px', fontSize: 12, fontWeight: 700, color: 'var(--blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="fas fa-plus"></i> Ajouter un type de variante
                </button>
              </div>
            ) : (
              <div className="cb" style={{ color: 'var(--t3)', fontSize: 12.5, fontStyle: 'italic' }}>
                Activez les variantes pour définir des options comme la couleur, le stockage ou la taille.
              </div>
            )}
          </div>

          {/* SEO */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="ch">
              <div className="ch-t"><i className="fas fa-magnifying-glass-chart"></i> SEO & Référencement</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="aj-seo-ring" style={{ background: `conic-gradient(${seoScore.score >= 80 ? 'var(--emerald)' : seoScore.score >= 50 ? 'var(--amber)' : 'var(--rose)'} 0% ${seoScore.score}%, var(--g200) ${seoScore.score}% 100%)` }}>
                  <span>{seoScore.score}</span>
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: seoScore.score >= 80 ? 'var(--emerald)' : seoScore.score >= 50 ? 'var(--amber)' : 'var(--rose)' }}>Score SEO</span>
              </div>
            </div>
            <div className="cb" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="pf-lbl">Titre SEO</label>
                <input className="pf-in" placeholder="Ex: iPhone 15 Pro 256GB — Shopi Guinée" value={form.titreSeo} onChange={e => update('titreSeo', e.target.value)} maxLength={70} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>Idéal : 50–70 car.</p>
                  <p style={{ fontSize: 10, color: form.titreSeo.length > 50 && form.titreSeo.length <= 70 ? 'var(--emerald)' : 'var(--t3)' }}>{form.titreSeo.length}/70</p>
                </div>
              </div>
              <div>
                <label className="pf-lbl">Description SEO</label>
                <textarea className="pf-in" rows={3} placeholder="120-160 caractères…" value={form.descriptionSeo} onChange={e => update('descriptionSeo', e.target.value)} maxLength={160} style={{ resize: 'vertical' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>Idéal : 120–160 car.</p>
                  <p style={{ fontSize: 10, color: form.descriptionSeo.length >= 120 && form.descriptionSeo.length <= 160 ? 'var(--emerald)' : 'var(--t3)' }}>{form.descriptionSeo.length}/160</p>
                </div>
              </div>
              <div>
                <label className="pf-lbl">URL Slug</label>
                <div style={{ display: 'flex', border: '1.5px solid var(--bdr2)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--g50)' }}>
                  <span style={{ padding: '10px 10px 10px 13px', fontSize: 12, color: 'var(--t3)', borderRight: '1px solid var(--bdr2)', whiteSpace: 'nowrap', background: 'var(--g100)' }}>shopi.gn/p/</span>
                  <input style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '10px 13px', fontSize: 13, color: 'var(--t1)' }} placeholder="iphone-15-pro-256gb" value={form.urlSlug} onChange={e => update('urlSlug', e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))} />
                </div>
              </div>
              <div style={{ background: 'var(--g50)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Critères de qualité</p>
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

          {/* Aperçu revenus */}
          {form.prix && (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="ch"><div className="ch-t"><i className="fas fa-calculator"></i> Aperçu des revenus</div></div>
              <div className="cb">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { l: 'Prix de vente',        v: `${prixNum.toLocaleString('fr-FR')} GNF`, c: 'var(--navy)'    },
                    { l: 'Commission Shopi (3%)', v: `-${Math.round(prixNum * 0.03).toLocaleString('fr-FR')} GNF`, c: 'var(--rose)'    },
                    { l: 'Revenu net estimé',     v: `${Math.round(prixNum * 0.97).toLocaleString('fr-FR')} GNF`,  c: 'var(--emerald)' },
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
                <div style={{ marginBottom: 14, padding: '12px 14px', background: 'rgba(225,29,72,.06)', border: '1.5px solid rgba(225,29,72,.25)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--rose)', marginBottom: 6 }}>
                    <i className="fas fa-triangle-exclamation" style={{ marginRight: 6 }} />
                    Corrigez les erreurs suivantes :
                  </div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--rose)', lineHeight: 1.8 }}>
                    {errors.nom         && <li>{errors.nom}</li>}
                    {errors.prix        && <li>{errors.prix}</li>}
                    {errors.stock       && <li>{errors.stock}</li>}
                    {errors.categorieId && <li>{errors.categorieId}</li>}
                  </ul>
                </div>
              )}
              <div className="pf-actions">
                <button className="btn-draft" onClick={() => onNavigate('produits')} disabled={enChargement}>
                  <i className="fas fa-arrow-left"></i> Retour
                </button>
                {!isEditMode && (
                  <button className="btn-draft" onClick={() => handlePublish(true)} disabled={enChargement}>
                    <i className="fas fa-save"></i> {enChargement ? 'Sauvegarde…' : 'Brouillon'}
                  </button>
                )}
                <button className="btn-pub" style={{ flex: 1, justifyContent: 'center' }} onClick={() => handlePublish(false)} disabled={enChargement}>
                  <i className={`fas ${isEditMode ? 'fa-check' : 'fa-cloud-arrow-up'}`}></i>
                  {enChargement
                    ? (isEditMode ? 'Mise à jour…' : 'Publication en cours…')
                    : (isEditMode ? 'Mettre à jour' : 'Publier le produit')}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}