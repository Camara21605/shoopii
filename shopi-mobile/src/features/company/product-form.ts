/**
 * Formulaire « Ajouter un produit » : état, sections visibles selon le mode,
 * CONTRÔLES de chaque champ et conversion vers CreateProductDto.
 *
 * Les limites reprennent celles du serveur (create-product.dto.ts,
 * produits.service.ts) — longueurs max, entiers ≥ 0, catégorie choisie par
 * l'entreprise, 4 images + 1 vidéo… — plus des règles de cohérence qu'un
 * vendeur attend d'un outil professionnel : prix barré supérieur au prix,
 * paliers de gros sans chevauchement et dégressifs, au moins un mode de
 * livraison, caractéristiques complètes, variantes sans doublon…
 * Une erreur bloque l'envoi ; un avertissement s'affiche sans bloquer.
 */
import type { ProductCategory } from './product-api';

export type Mode = 'rapide' | 'detaille' | 'gros';

export type SectionId =
  | 'medias' | 'infos' | 'organisation' | 'complementaires' | 'livraison'
  | 'garanties' | 'specs' | 'variantes' | 'gros' | 'seo' | 'stories' | 'revenus';

/** Même découpage que la page du site : le mode « rapide » ne garde que l'essentiel. */
export function sectionsFor(mode: Mode): SectionId[] {
  switch (mode) {
    case 'rapide':
      return ['medias', 'infos', 'organisation', 'revenus'];
    case 'gros':
      return ['medias', 'infos', 'gros', 'organisation', 'livraison', 'stories', 'revenus'];
    default:
      return ['medias', 'infos', 'organisation', 'complementaires', 'livraison', 'garanties', 'specs', 'variantes', 'gros', 'seo', 'stories', 'revenus'];
  }
}

/* ── Limites ─────────────────────────────────────────────────────────── */

export const LIMITS = {
  nomMin: 3,
  nomMax: 120,
  description: 5000,
  contenuBoite: 1000,
  marque: 100,
  reference: 100,
  tagMax: 30,
  tagsCount: 15,
  tagsTotal: 500,
  prixMax: 10_000_000_000,
  stockMax: 1_000_000,
  poidsMax: 1000,
  dimMax: 1000,
  fraisMax: 10_000_000,
  specsCount: 30,
  specCle: 150,
  specValeur: 500,
  variantesCount: 6,
  varianteType: 50,
  varianteVals: 500,
  tiersCount: 8,
  delaiGros: 50,
  titreSeo: 70,
  descriptionSeo: 160,
  slug: 255,
  images: 4,
  videos: 1,
  imageBytes: 5 * 1024 * 1024,
  videoBytes: 50 * 1024 * 1024,
  videoSeconds: 180,
} as const;

/* ── Listes de choix (valeurs = celles du serveur) ───────────────────── */

export const VISIBILITES = [
  { value: 'public', label: 'Publique', sub: 'Visible dans votre boutique et la recherche' },
  { value: 'private', label: 'Privée', sub: 'Accessible seulement par son lien' },
  { value: 'draft', label: 'Brouillon', sub: 'Invisible des clients' },
] as const;
export const CONDITIONS = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'reconditionne', label: 'Reconditionné' },
  { value: 'occasion', label: 'Occasion' },
] as const;
export const GARANTIES = ['Sans garantie', '3 mois', '6 mois', '12 mois', '24 mois'] as const;
export const LANGUES = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'Anglais' },
  { value: 'ar', label: 'Arabe' },
] as const;
export const RETOURS = [
  { value: '7j', label: '7 jours — remboursement complet' },
  { value: '14j', label: '14 jours — remboursement ou échange' },
  { value: '30j', label: '30 jours — échange uniquement' },
  { value: 'defect', label: 'Retour seulement si défectueux' },
  { value: 'none', label: 'Aucun retour accepté' },
] as const;
export const PAYS = [
  { value: 'GN', label: '🇬🇳 Guinée (local)' }, { value: 'SN', label: '🇸🇳 Sénégal' }, { value: 'CI', label: '🇨🇮 Côte d’Ivoire' },
  { value: 'ML', label: '🇲🇱 Mali' }, { value: 'CM', label: '🇨🇲 Cameroun' }, { value: 'FR', label: '🇫🇷 France' },
  { value: 'CN', label: '🇨🇳 Chine' }, { value: 'US', label: '🇺🇸 États-Unis' }, { value: 'DE', label: '🇩🇪 Allemagne' },
  { value: 'GB', label: '🇬🇧 Royaume-Uni' }, { value: 'JP', label: '🇯🇵 Japon' }, { value: 'AE', label: '🇦🇪 Émirats arabes unis' },
] as const;
export const DELAIS = ['Même jour', '1-3 jours', '3-7 jours', '7-14 jours', '14-30 jours', 'Sur commande'] as const;
export const VARIANTE_TYPES = ['Couleur', 'Taille', 'Pointure', 'Matière', 'Parfum', 'Saveur', 'Poids', 'Volume', 'Modèle', 'Stockage', 'RAM'] as const;
export const JOURS = [
  { value: 'lun', label: 'Lun' }, { value: 'mar', label: 'Mar' }, { value: 'mer', label: 'Mer' }, { value: 'jeu', label: 'Jeu' },
  { value: 'ven', label: 'Ven' }, { value: 'sam', label: 'Sam' }, { value: 'dim', label: 'Dim' },
] as const;

/* ── État ─────────────────────────────────────────────────────────────── */

export type Spec = { cle: string; valeur: string };
export type Variant = { type: string; vals: string };
export type Tier = { min: string; max: string; prix: string };

export type MediaItem = {
  key: string;
  type: 'image' | 'video';
  /** Aperçu local (file://) ou URL déjà envoyée (brouillon restauré). */
  preview: string;
  url: string | null;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  durationSec?: number;
  /** Photo déjà retouchée (Embellir / Arranger) : « Arranger les photos » ne la refait pas. */
  retouched?: boolean;
  /** Retouche en cours (« Arranger » en un toucher). */
  retouching?: boolean;
};

export type ProductForm = {
  nom: string; description: string; contenuBoite: string;
  prix: string; prixAncien: string; stock: string; seuil: string; reference: string;
  categoryId: string; subCategoryId: string; marque: string; tags: string[];
  visibilite: 'public' | 'private' | 'draft'; langue: string;
  condition: string; garantie: string; politiqueRetour: string; paysOrigine: string;
  poids: string; longueur: string; largeur: string; hauteur: string;
  livraisonStandard: boolean; livraisonLivreur: boolean; livraisonCorrespondant: boolean;
  fraisLivraisonLocal: string; delaiLivraison: string;
  garantiePaiement: boolean; garantieRetour: boolean; garantieAuthentic: boolean; garantieSupport: boolean;
  specs: Spec[];
  variantesOn: boolean; variantes: Variant[];
  venteEnGros: boolean; moq: string; conditionnement: string; delaiPreparationGros: string; tiers: Tier[];
  titreSeo: string; descriptionSeo: string; urlSlug: string;
  storiesOn: boolean; storyDebut: string; storyFin: string; storyJours: string[];
};

export const INITIAL_FORM: ProductForm = {
  nom: '', description: '', contenuBoite: '',
  prix: '', prixAncien: '', stock: '', seuil: '', reference: '',
  categoryId: '', subCategoryId: '', marque: '', tags: [],
  visibilite: 'public', langue: 'fr',
  condition: 'neuf', garantie: 'Sans garantie', politiqueRetour: '7j', paysOrigine: 'GN',
  poids: '', longueur: '', largeur: '', hauteur: '',
  livraisonStandard: true, livraisonLivreur: true, livraisonCorrespondant: false,
  fraisLivraisonLocal: '', delaiLivraison: '1-3 jours',
  garantiePaiement: true, garantieRetour: false, garantieAuthentic: false, garantieSupport: false,
  specs: [{ cle: '', valeur: '' }],
  variantesOn: false, variantes: [{ type: 'Couleur', vals: '' }],
  venteEnGros: false, moq: '', conditionnement: '', delaiPreparationGros: '3-5 jours', tiers: [{ min: '10', max: '49', prix: '' }],
  titreSeo: '', descriptionSeo: '', urlSlug: '',
  storiesOn: false, storyDebut: '08:00', storyFin: '22:00', storyJours: ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'],
};

/* ── Lecture des nombres saisis ──────────────────────────────────────── */

/** « 1 500 000 » → 1500000 ; null si vide ; NaN si invalide (lettres, signe, décimales). */
export function parseIntInput(v: string): number | null {
  const s = v.replace(/[\s  .]/g, '');
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
}
/** « 0,5 » ou « 0.5 » → 0.5 ; null si vide ; NaN si invalide. */
export function parseDecimalInput(v: string): number | null {
  const s = v.replace(/[\s  ]/g, '').replace(',', '.');
  if (!s) return null;
  return /^\d+(\.\d{1,3})?$/.test(s) ? Number(s) : NaN;
}
/** Affichage en direct d'un montant tapé : « 1500000 » → « 1 500 000 ». */
export function formatThousands(v: string): string {
  const digits = v.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
export const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;

/** Même normalisation que le serveur (produits.service.ts › normalizeSlug). */
export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const minutes = (hhmm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return NaN;
  const h = Number(m[1]); const mi = Number(m[2]);
  return h < 24 && mi < 60 ? h * 60 + mi : NaN;
};

/* ── Contrôles ───────────────────────────────────────────────────────── */

/** Clé d'erreur → section (pour faire défiler l'écran jusqu'à la première erreur). */
export function sectionOfError(key: string): SectionId {
  const head = key.split('.')[0];
  const map: Record<string, SectionId> = {
    media: 'medias',
    nom: 'infos', description: 'infos', contenuBoite: 'infos', prix: 'infos', prixAncien: 'infos', stock: 'infos', seuil: 'infos', reference: 'infos',
    categoryId: 'organisation', subCategoryId: 'organisation', marque: 'organisation', tags: 'organisation',
    poids: 'complementaires', longueur: 'complementaires', largeur: 'complementaires', hauteur: 'complementaires',
    livraison: 'livraison', fraisLivraisonLocal: 'livraison',
    specs: 'specs', variantes: 'variantes',
    moq: 'gros', conditionnement: 'gros', delaiPreparationGros: 'gros', tiers: 'gros',
    titreSeo: 'seo', descriptionSeo: 'seo', urlSlug: 'seo',
    stories: 'stories',
  };
  return map[head] ?? 'infos';
}

export type Validation = { errors: Record<string, string>; warnings: string[] };

export function validateProduct(
  form: ProductForm,
  media: MediaItem[],
  mode: Mode,
  ctx: { categories: ProductCategory[]; asDraft: boolean; slugTaken: boolean },
): Validation {
  const e: Record<string, string> = {};
  const warnings: string[] = [];
  const visible = new Set(sectionsFor(mode));
  const full = mode !== 'rapide';

  /* Médias */
  if (media.some((m) => m.status === 'uploading')) e.media = 'Patientez : un média est encore en cours d’envoi.';
  else if (media.some((m) => m.status === 'error')) e.media = 'Un média n’a pas pu être envoyé : renvoyez-le ou retirez-le.';
  else if (!ctx.asDraft && !media.some((m) => m.type === 'image' && m.status === 'done')) {
    e.media = 'Ajoutez au moins une photo : un produit sans photo ne se vend pas (vous pouvez enregistrer en brouillon sans photo).';
  }

  /* Nom */
  const nom = form.nom.trim();
  if (!nom) e.nom = 'Le nom du produit est obligatoire.';
  else if (nom.length < LIMITS.nomMin) e.nom = `Le nom doit contenir au moins ${LIMITS.nomMin} caractères.`;
  else if (nom.length > LIMITS.nomMax) e.nom = `Le nom ne doit pas dépasser ${LIMITS.nomMax} caractères.`;
  else if (/^[\d\s\W]+$/.test(nom)) e.nom = 'Le nom doit contenir des lettres (pas seulement des chiffres ou symboles).';

  /* Prix */
  const prix = parseIntInput(form.prix);
  if (prix === null) e.prix = 'Le prix de vente est obligatoire.';
  else if (Number.isNaN(prix)) e.prix = 'Prix invalide : chiffres uniquement, sans décimales (en GNF).';
  else if (prix <= 0) e.prix = 'Le prix doit être supérieur à 0.';
  else if (prix > LIMITS.prixMax) e.prix = 'Prix trop élevé : vérifiez le nombre de zéros.';

  if (full) {
    const ancien = parseIntInput(form.prixAncien);
    if (ancien !== null) {
      if (Number.isNaN(ancien)) e.prixAncien = 'Prix barré invalide : chiffres uniquement.';
      else if (ancien > LIMITS.prixMax) e.prixAncien = 'Prix barré trop élevé.';
      else if (prix && !Number.isNaN(prix) && ancien <= prix) e.prixAncien = 'Le prix barré doit être supérieur au prix de vente (sinon laissez-le vide).';
      else if (prix && ancien > prix * 10) warnings.push('Le prix barré est plus de 10 fois le prix de vente : vérifiez-le.');
    }
  }

  /* Stock */
  const stock = parseIntInput(form.stock);
  if (stock === null) e.stock = 'La quantité en stock est obligatoire (0 si épuisé).';
  else if (Number.isNaN(stock)) e.stock = 'Stock invalide : nombre entier uniquement.';
  else if (stock > LIMITS.stockMax) e.stock = `Le stock ne peut pas dépasser ${LIMITS.stockMax.toLocaleString('fr-FR')}.`;
  else if (stock === 0 && !ctx.asDraft) warnings.push('Stock à 0 : le produit sera affiché « en rupture ».');

  if (full) {
    const seuil = parseIntInput(form.seuil);
    if (seuil !== null) {
      if (Number.isNaN(seuil)) e.seuil = 'Seuil invalide : nombre entier uniquement.';
      else if (seuil > LIMITS.stockMax) e.seuil = 'Seuil trop élevé.';
      else if (stock !== null && !Number.isNaN(stock) && seuil > stock) warnings.push('Le seuil d’alerte est supérieur au stock : l’alerte « stock bas » se déclenchera tout de suite.');
    }
    if (form.description.length > LIMITS.description) e.description = `Description trop longue (${LIMITS.description} caractères max).`;
    else if (mode === 'detaille' && form.description.trim().length < 100) warnings.push('Description courte : 100 caractères ou plus aident à vendre et au référencement.');
    if (form.contenuBoite.length > LIMITS.contenuBoite) e.contenuBoite = `Texte trop long (${LIMITS.contenuBoite} caractères max).`;
    if (form.reference.trim().length > LIMITS.reference) e.reference = `Référence trop longue (${LIMITS.reference} caractères max).`;
    else if (form.reference.trim() && !/^[\w\-./ ]+$/.test(form.reference.trim())) e.reference = 'Référence : lettres, chiffres, tirets, points ou barres uniquement.';
  }

  /* Catégorie */
  const cat = ctx.categories.find((c) => c.id === form.categoryId);
  if (!form.categoryId) e.categoryId = 'Choisissez une catégorie.';
  else if (!cat) e.categoryId = 'Cette catégorie n’est plus disponible pour votre boutique : choisissez-en une autre.';
  else if (form.subCategoryId && !cat.subCategories.some((s) => s.id === form.subCategoryId)) e.subCategoryId = 'Cette sous-catégorie n’appartient pas à la catégorie choisie.';

  if (full) {
    if (form.marque.trim().length > LIMITS.marque) e.marque = `Marque trop longue (${LIMITS.marque} caractères max).`;
    if (form.tags.length > LIMITS.tagsCount) e.tags = `${LIMITS.tagsCount} mots-clés au maximum.`;
    else if (form.tags.join(',').length > LIMITS.tagsTotal) e.tags = 'Mots-clés trop longs au total.';
  }

  /* Informations complémentaires */
  if (visible.has('complementaires')) {
    const poids = parseDecimalInput(form.poids);
    if (poids !== null && (Number.isNaN(poids) || poids > LIMITS.poidsMax)) e.poids = `Poids invalide (en kg, 0 à ${LIMITS.poidsMax}, ex. 0,5).`;
    for (const k of ['longueur', 'largeur', 'hauteur'] as const) {
      const d = parseDecimalInput(form[k]);
      if (d !== null && (Number.isNaN(d) || d > LIMITS.dimMax)) e[k] = `Valeur invalide (en cm, 0 à ${LIMITS.dimMax}).`;
    }
    const dims = [form.longueur, form.largeur, form.hauteur].filter((x) => x.trim()).length;
    if (dims > 0 && dims < 3 && !e.longueur && !e.largeur && !e.hauteur) e.hauteur = 'Renseignez les trois dimensions, ou aucune.';
  }

  /* Livraison */
  if (visible.has('livraison')) {
    if (!form.livraisonStandard && !form.livraisonLivreur && !form.livraisonCorrespondant) {
      e.livraison = 'Activez au moins un mode de livraison : sinon le client ne pourra pas recevoir ce produit.';
    }
    const frais = parseIntInput(form.fraisLivraisonLocal);
    if (frais !== null && (Number.isNaN(frais) || frais > LIMITS.fraisMax)) e.fraisLivraisonLocal = 'Frais invalides : nombre entier en GNF (0 = gratuit).';
    if (form.livraisonCorrespondant && form.paysOrigine === 'GN' && visible.has('complementaires')) {
      warnings.push('Livraison par correspondant activée pour un produit local : elle sert surtout aux produits venant de l’étranger.');
    }
  }

  /* Caractéristiques */
  if (visible.has('specs')) {
    const seen = new Map<string, number>();
    form.specs.forEach((s, i) => {
      const k = s.cle.trim(); const v = s.valeur.trim();
      if (!k && !v) return;
      if (!k) e[`specs.${i}.cle`] = 'Nom du critère manquant.';
      else if (k.length > LIMITS.specCle) e[`specs.${i}.cle`] = `${LIMITS.specCle} caractères max.`;
      if (!v) e[`specs.${i}.valeur`] = 'Valeur manquante.';
      else if (v.length > LIMITS.specValeur) e[`specs.${i}.valeur`] = `${LIMITS.specValeur} caractères max.`;
      const lk = k.toLowerCase();
      if (k && seen.has(lk)) e[`specs.${i}.cle`] = `« ${k} » est déjà renseigné plus haut.`;
      else if (k) seen.set(lk, i);
    });
    if (form.specs.length > LIMITS.specsCount) e.specs = `${LIMITS.specsCount} caractéristiques au maximum.`;
  }

  /* Variantes */
  if (visible.has('variantes') && form.variantesOn) {
    const types = new Set<string>();
    let valid = 0;
    form.variantes.forEach((v, i) => {
      const t = v.type.trim();
      if (!t) e[`variantes.${i}.type`] = 'Type de variante manquant.';
      else if (t.length > LIMITS.varianteType) e[`variantes.${i}.type`] = `${LIMITS.varianteType} caractères max.`;
      else if (types.has(t.toLowerCase())) e[`variantes.${i}.type`] = `La variante « ${t} » existe déjà.`;
      else types.add(t.toLowerCase());

      const vals = v.vals.split(',').map((x) => x.trim()).filter(Boolean);
      if (!v.vals.trim()) e[`variantes.${i}.vals`] = 'Ajoutez au moins une valeur (ex. Noir, Blanc).';
      else if (v.vals.length > LIMITS.varianteVals) e[`variantes.${i}.vals`] = `${LIMITS.varianteVals} caractères max.`;
      else if (new Set(vals.map((x) => x.toLowerCase())).size !== vals.length) e[`variantes.${i}.vals`] = 'Une même valeur est saisie deux fois.';
      else valid++;
    });
    if (!form.variantes.length || (!valid && !Object.keys(e).some((k) => k.startsWith('variantes.')))) e.variantes = 'Ajoutez une variante ou désactivez les variantes.';
  }

  /* Vente en gros */
  const grosOn = mode === 'gros' || (visible.has('gros') && form.venteEnGros);
  if (grosOn) {
    const moq = parseIntInput(form.moq);
    if (moq === null) e.moq = 'Indiquez la quantité minimum de commande en gros.';
    else if (Number.isNaN(moq) || moq < 1) e.moq = 'Quantité minimum invalide (entier, au moins 1).';
    else if (moq > LIMITS.stockMax) e.moq = 'Quantité minimum trop élevée.';
    else if (stock !== null && !Number.isNaN(stock) && stock > 0 && moq > stock) warnings.push('La quantité minimum en gros dépasse votre stock actuel.');

    const cond = parseIntInput(form.conditionnement);
    if (cond !== null && (Number.isNaN(cond) || cond < 1 || cond > LIMITS.stockMax)) e.conditionnement = 'Unités par carton invalides (entier, au moins 1).';
    if (form.delaiPreparationGros.trim().length > LIMITS.delaiGros) e.delaiPreparationGros = `${LIMITS.delaiGros} caractères max.`;

    const filled = form.tiers.filter((t) => t.min.trim() || t.max.trim() || t.prix.trim());
    if (!filled.length) e.tiers = 'Ajoutez au moins un palier de prix (quantité + prix unitaire).';
    if (form.tiers.length > LIMITS.tiersCount) e.tiers = `${LIMITS.tiersCount} paliers au maximum.`;
    let prevMax: number | null = 0; let prevPrix = Infinity; let prevIdx = -1;
    form.tiers.forEach((t, i) => {
      if (!t.min.trim() && !t.max.trim() && !t.prix.trim()) return;
      const min = parseIntInput(t.min); const max = parseIntInput(t.max); const pu = parseIntInput(t.prix);
      if (min === null || Number.isNaN(min) || min < 1) { e[`tiers.${i}.min`] = 'Quantité « de » invalide.'; return; }
      if (max !== null && (Number.isNaN(max) || max < min)) { e[`tiers.${i}.max`] = 'La quantité « à » doit être ≥ à la quantité « de ».'; return; }
      if (pu === null || Number.isNaN(pu) || pu <= 0) { e[`tiers.${i}.prix`] = 'Prix unitaire invalide.'; return; }
      if (prix && !Number.isNaN(prix) && pu > prix) e[`tiers.${i}.prix`] = 'Le prix de gros ne doit pas dépasser le prix de détail.';
      if (prevIdx === -1 && moq && !Number.isNaN(moq) && min < moq) e[`tiers.${i}.min`] = `Le premier palier doit commencer au minimum de commande (${moq}).`;
      if (prevIdx >= 0) {
        if (prevMax === null) e[`tiers.${prevIdx}.max`] = 'Seul le dernier palier peut rester ouvert (« et plus »).';
        else if (min <= prevMax) e[`tiers.${i}.min`] = `Chevauchement : ce palier doit commencer après ${prevMax}.`;
        if (pu > prevPrix) e[`tiers.${i}.prix`] = 'Le prix unitaire doit baisser (ou rester égal) quand la quantité augmente.';
      }
      prevMax = max; prevPrix = pu; prevIdx = i;
    });
  }

  /* Référencement */
  if (visible.has('seo')) {
    if (form.titreSeo.length > LIMITS.titreSeo) e.titreSeo = `${LIMITS.titreSeo} caractères max (au-delà, Google coupe le titre).`;
    if (form.descriptionSeo.length > LIMITS.descriptionSeo) e.descriptionSeo = `${LIMITS.descriptionSeo} caractères max.`;
    if (form.urlSlug.trim()) {
      const slug = normalizeSlug(form.urlSlug);
      if (!slug) e.urlSlug = 'Adresse invalide : utilisez des lettres et des chiffres.';
      else if (slug.length > LIMITS.slug) e.urlSlug = 'Adresse trop longue.';
      else if (ctx.slugTaken) e.urlSlug = 'Cette adresse est déjà utilisée par un autre produit.';
    }
  }

  /* Stories */
  if (visible.has('stories') && form.storiesOn) {
    if (!media.some((m) => m.type === 'image' && m.status === 'done')) e.stories = 'Ajoutez au moins une photo pour publier une story.';
    else if (!(minutes(form.storyFin) > minutes(form.storyDebut))) e.stories = 'L’heure de fin doit être après l’heure de début.';
    else if (!form.storyJours.length) e.stories = 'Choisissez au moins un jour d’affichage.';
  }

  return { errors: e, warnings };
}

/* ── Conversion vers CreateProductDto ─────────────────────────────────── */

const intOr = (v: string) => { const n = parseIntInput(v); return n === null || Number.isNaN(n) ? undefined : n; };
const decOr = (v: string) => { const n = parseDecimalInput(v); return n === null || Number.isNaN(n) ? undefined : n; };
const txt = (v: string) => v.trim() || undefined;

export function toDto(form: ProductForm, media: MediaItem[], mode: Mode, asDraft: boolean): Record<string, unknown> {
  const visible = new Set(sectionsFor(mode));
  const full = mode !== 'rapide';
  const grosOn = mode === 'gros' || (visible.has('gros') && form.venteEnGros);
  const done = media.filter((m) => m.status === 'done' && m.url);

  return {
    nom: form.nom.trim(),
    categoryId: form.categoryId,
    subCategoryId: form.subCategoryId || undefined,
    prix: intOr(form.prix),
    stock: intOr(form.stock) ?? 0,
    visibilite: asDraft ? 'draft' : form.visibilite,
    images: done.map((m, i) => ({ url: m.url, ordre: i, type: m.type })),
    livraisonStandard: form.livraisonStandard,
    livraisonLivreur: form.livraisonLivreur,
    livraisonCorrespondant: form.livraisonCorrespondant,
    ...(full && {
      description: txt(form.description),
      contenuBoite: txt(form.contenuBoite),
      prixAncien: intOr(form.prixAncien),
      seuil: intOr(form.seuil),
      reference: txt(form.reference),
      marque: txt(form.marque),
      tags: form.tags.length ? form.tags.join(',') : undefined,
      langue: form.langue,
    }),
    ...(visible.has('complementaires') && {
      condition: form.condition,
      garantie: form.garantie,
      politiqueRetour: form.politiqueRetour,
      paysOrigine: form.paysOrigine,
      poids: decOr(form.poids),
      longueur: decOr(form.longueur),
      largeur: decOr(form.largeur),
      hauteur: decOr(form.hauteur),
    }),
    ...(visible.has('livraison') && {
      fraisLivraisonLocal: intOr(form.fraisLivraisonLocal),
      delaiLivraison: form.delaiLivraison,
    }),
    ...(visible.has('garanties') && {
      garantiePaiement: form.garantiePaiement,
      garantieRetour: form.garantieRetour,
      garantieAuthentic: form.garantieAuthentic,
      garantieSupport: form.garantieSupport,
    }),
    ...(visible.has('specs') && {
      specs: form.specs.filter((s) => s.cle.trim() && s.valeur.trim()).map((s, i) => ({ cle: s.cle.trim(), valeur: s.valeur.trim(), ordre: i })),
    }),
    ...(visible.has('variantes') && {
      variantes: form.variantesOn
        ? form.variantes.filter((v) => v.type.trim() && v.vals.trim()).map((v) => ({
            type: v.type.trim(),
            vals: v.vals.split(',').map((x) => x.trim()).filter(Boolean).join(', '),
          }))
        : [],
    }),
    venteEnGros: grosOn,
    ...(grosOn && {
      moq: intOr(form.moq),
      conditionnement: intOr(form.conditionnement),
      delaiPreparationGros: txt(form.delaiPreparationGros),
      wholesaleTiers: form.tiers
        .filter((t) => t.min.trim() && t.prix.trim())
        .map((t, i) => ({ quantiteMin: intOr(t.min), quantiteMax: intOr(t.max), prixUnitaire: intOr(t.prix), ordre: i })),
    }),
    ...(visible.has('seo') && {
      titreSeo: txt(form.titreSeo),
      descriptionSeo: txt(form.descriptionSeo),
      urlSlug: form.urlSlug.trim() ? normalizeSlug(form.urlSlug) : undefined,
    }),
    ...(visible.has('stories') && form.storiesOn && !asDraft && {
      stories: done.filter((m) => m.type === 'image').map((m) => ({
        mediaUrl: m.url, heureDebut: form.storyDebut, heureFin: form.storyFin, jours: form.storyJours,
      })),
    }),
  };
}

/** Score de complétude (mêmes critères que le site) : aide le vendeur à améliorer sa fiche. */
export function completeness(form: ProductForm, media: MediaItem[]) {
  const items = [
    { label: 'Nom de plus de 5 caractères', ok: form.nom.trim().length > 5 },
    { label: 'Description de 100 caractères ou plus', ok: form.description.trim().length >= 100 },
    { label: 'Au moins une photo', ok: media.some((m) => m.type === 'image' && m.status === 'done') },
    { label: 'Prix renseigné', ok: !!form.prix.trim() },
    { label: 'Marque', ok: !!form.marque.trim() },
    { label: 'Mots-clés', ok: form.tags.length > 0 },
    { label: 'Référence (SKU)', ok: !!form.reference.trim() },
    { label: 'Titre SEO', ok: !!form.titreSeo.trim() },
    { label: 'Description SEO', ok: !!form.descriptionSeo.trim() },
    { label: 'Adresse personnalisée', ok: !!form.urlSlug.trim() },
  ];
  return { score: Math.round((items.filter((i) => i.ok).length / items.length) * 100), items };
}
