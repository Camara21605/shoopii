/**
 * Formulaire de promotion : état, CONTRÔLES de chaque champ et conversion
 * vers CreatePromotionDto (promotion.dto.ts du serveur).
 *
 * Reprend les règles du site (nom, code A-Z 0-9 _ -, portée produits avec au
 * moins un produit, réduction > 0 et ≤ 100 %, utilisations entières, date
 * d'expiration future) et ajoute celles qu'attend un outil professionnel :
 * début avant fin, plafond seulement pour un pourcentage, limite par client
 * ≤ limite totale, lot cohérent (offerts ≤ achetés), réduction fixe
 * inférieure au panier minimum…
 *
 * Le serveur ne sait pas « vider » un champ déjà rempli (PATCH garde l'ancienne
 * valeur) : les seuils remis à 0 sont envoyés à 0 (= aucun), les limites qui
 * ne peuvent pas valoir 0 sont signalées clairement plutôt qu'ignorées en silence.
 */
import type { Promo, PromoScope, PromoType, ValueType } from './api';

export type PromoForm = {
  type: PromoType;
  valueType: Exclude<ValueType, 'free'>;
  nom: string;
  code: string;
  valeur: string;
  scope: PromoScope;
  productIds: string[];
  maxUtilisations: string;
  maxParClient: string;
  montantMinimum: string;
  plafondReduction: string;
  startDate: string; // JJ/MM/AAAA
  endDate: string;
  flashStock: string;
  bundleQuantiteMin: string;
  bundleQuantiteOfferte: string;
  freeShipSeuil: string;
  description: string;
};

export const EMPTY_FORM: PromoForm = {
  type: 'discount', valueType: 'percent', nom: '', code: '', valeur: '', scope: 'global', productIds: [],
  maxUtilisations: '', maxParClient: '1', montantMinimum: '', plafondReduction: '', startDate: '', endDate: '',
  flashStock: '', bundleQuantiteMin: '', bundleQuantiteOfferte: '', freeShipSeuil: '', description: '',
};

/** Modèles « Créer rapidement » du site (+ réduction fixe réellement en GNF). */
export const TEMPLATES: { icon: string; label: string; sub: string; patch: Partial<PromoForm> }[] = [
  { icon: '🏷️', label: 'Réduction en %', sub: 'Ex. -20 % sur tout le catalogue', patch: { type: 'discount', valueType: 'percent' } },
  { icon: '💰', label: 'Réduction fixe', sub: 'Ex. -5 000 GNF dès 50 000 GNF d’achat', patch: { type: 'discount', valueType: 'fixed' } },
  { icon: '🚚', label: 'Livraison offerte', sub: 'Au-delà d’un montant de commande', patch: { type: 'free-ship' } },
  { icon: '🎁', label: 'Lot 2 + 1', sub: '2 achetés, 1 offert', patch: { type: 'bundle', valueType: 'fixed', bundleQuantiteMin: '2', bundleQuantiteOfferte: '1' } },
  { icon: '⚡', label: 'Vente flash', sub: 'Stock et durée limités', patch: { type: 'flash', valueType: 'percent' } },
];

/* ── Saisie ──────────────────────────────────────────────────────── */

const intOf = (v: string): number | null => {
  const s = v.replace(/[\s  ]/g, '');
  if (!s) return null;
  return /^\d+$/.test(s) ? Number(s) : NaN;
};
const decOf = (v: string): number | null => {
  const s = v.replace(/[\s  ]/g, '').replace(',', '.');
  if (!s) return null;
  return /^\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
};
export const digits = (v: string) => v.replace(/\D/g, '');
export const thousands = (v: string) => digits(v).replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** « 31/12/2026 » → Date locale (00:00) ; null si vide ; undefined si invalide. */
export function parseDate(v: string): Date | null | undefined {
  const s = v.trim();
  if (!s) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return undefined;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getDate() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 ? d : undefined;
}
export const fmtDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
/** Saisie guidée : ajoute les « / » au fil de la frappe. */
export function maskDate(v: string): string {
  const d = digits(v).slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}
const today0 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };

/* ── Contrôles ───────────────────────────────────────────────────── */

export type Check = { errors: Partial<Record<keyof PromoForm, string>>; warnings: string[] };

export function validatePromo(f: PromoForm, opts: { draft: boolean; original?: Promo | null }): Check {
  const e: Check['errors'] = {};
  const warnings: string[] = [];
  const orig = opts.original;
  const pct = f.type !== 'free-ship' && f.valueType === 'percent';

  /* Identité */
  if (!f.nom.trim()) e.nom = 'Le nom de la promotion est obligatoire.';
  else if (f.nom.trim().length < 3) e.nom = 'Nom trop court (3 caractères minimum).';
  else if (f.nom.trim().length > 255) e.nom = '255 caractères maximum.';

  const code = f.code.trim();
  if (!code) e.code = 'Le code promo est obligatoire.';
  else if (code.length < 3) e.code = 'Code trop court (3 caractères minimum).';
  else if (code.length > 50) e.code = '50 caractères maximum.';
  else if (!/^[A-Z0-9_-]+$/.test(code)) e.code = 'Lettres majuscules, chiffres, « - » et « _ » uniquement (sans espace ni accent).';

  /* Portée */
  if (f.scope === 'products' && !f.productIds.length) e.productIds = 'Choisissez au moins un produit, ou appliquez la promotion à toute la boutique.';

  /* Valeur */
  if (f.type !== 'free-ship') {
    const v = pct ? decOf(f.valeur) : intOf(f.valeur);
    if (v === null) { if (!opts.draft) e.valeur = pct ? 'Indiquez le pourcentage de réduction.' : 'Indiquez le montant de la réduction.'; }
    else if (Number.isNaN(v) || v <= 0) e.valeur = pct ? 'Pourcentage invalide (ex. 15 ou 12,5).' : 'Montant invalide (GNF, chiffres uniquement).';
    else if (pct && v > 100) e.valeur = 'Une réduction ne peut pas dépasser 100 %.';
    else if (pct && v > 90) warnings.push(`Réduction très forte (-${v} %) : vérifiez qu’elle est voulue.`);
    else if (!pct && v > 1_000_000_000) e.valeur = 'Montant trop élevé.';
  }

  /* Plafond (pourcentage seulement) */
  const plafond = intOf(f.plafondReduction);
  if (plafond !== null && (Number.isNaN(plafond) || plafond > 1_000_000_000)) e.plafondReduction = 'Montant invalide (GNF).';

  /* Panier minimum */
  const mini = intOf(f.montantMinimum);
  if (mini !== null && (Number.isNaN(mini) || mini > 10_000_000_000)) e.montantMinimum = 'Montant invalide (GNF).';
  else if (!pct && f.type !== 'free-ship' && mini && !e.valeur) {
    const v = intOf(f.valeur);
    if (v && !Number.isNaN(v) && v >= mini) e.valeur = `La réduction (${v.toLocaleString('fr-FR')} GNF) doit être inférieure au panier minimum (${mini.toLocaleString('fr-FR')} GNF).`;
  }

  /* Utilisations */
  const maxU = intOf(f.maxUtilisations);
  if (maxU !== null && (Number.isNaN(maxU) || maxU < 1 || maxU > 10_000_000)) e.maxUtilisations = 'Nombre entier d’au moins 1.';
  else if (maxU === null && orig?.maxUtilisations != null) e.maxUtilisations = `Limite déjà fixée à ${orig.maxUtilisations} : elle ne peut pas être retirée, seulement modifiée.`;
  else if (maxU !== null && orig && maxU < orig.uses) e.maxUtilisations = `Déjà ${orig.uses} utilisation(s) : la limite ne peut pas être inférieure.`;

  const perClient = intOf(f.maxParClient);
  if (perClient === null || Number.isNaN(perClient) || perClient < 1) e.maxParClient = 'Au moins 1 utilisation par client.';
  else if (maxU && !Number.isNaN(maxU) && perClient > maxU) e.maxParClient = 'Ne peut pas dépasser la limite totale d’utilisations.';

  /* Dates */
  const start = parseDate(f.startDate);
  const end = parseDate(f.endDate);
  if (start === undefined) e.startDate = 'Date invalide (JJ/MM/AAAA).';
  if (end === undefined) e.endDate = 'Date invalide (JJ/MM/AAAA).';
  if (end && end < today0()) e.endDate = 'La date de fin est déjà passée.';
  if (start && end && end < start) e.endDate = 'La date de fin doit être après la date de début.';
  if (start && !orig && start < today0()) e.startDate = 'La date de début est déjà passée (laissez vide pour commencer tout de suite).';
  if (!f.endDate.trim() && orig?.endDate) e.endDate = 'Date de fin déjà fixée : elle ne peut pas être retirée, seulement modifiée.';
  if (!f.startDate.trim() && orig?.startDate) e.startDate = 'Date de début déjà fixée : elle ne peut pas être retirée, seulement modifiée.';
  if (start && start > today0() && !opts.draft) warnings.push(`La promotion sera planifiée et ne démarrera que le ${fmtDate(start)}.`);

  /* Spécifique au type */
  if (f.type === 'flash') {
    const st = intOf(f.flashStock);
    if (st !== null && (Number.isNaN(st) || st < 1)) e.flashStock = 'Stock flash invalide (entier, au moins 1).';
    else if (st === null && orig?.flashStock != null) e.flashStock = 'Stock flash déjà fixé : il ne peut pas être retiré.';
    if (!end && !opts.draft) warnings.push('Une vente flash sans date de fin reste active indéfiniment.');
  }
  if (f.type === 'bundle') {
    const a = intOf(f.bundleQuantiteMin);
    const o = intOf(f.bundleQuantiteOfferte);
    if (a !== null && (Number.isNaN(a) || a < 1)) e.bundleQuantiteMin = 'Quantité invalide (au moins 1).';
    if (o !== null && (Number.isNaN(o) || o < 1)) e.bundleQuantiteOfferte = 'Quantité invalide (au moins 1).';
    if ((a === null) !== (o === null) && !e.bundleQuantiteMin && !e.bundleQuantiteOfferte) e.bundleQuantiteOfferte = 'Renseignez les deux quantités (achetées et offertes), ou aucune.';
    else if (a && o && !Number.isNaN(a) && !Number.isNaN(o) && o > a) e.bundleQuantiteOfferte = 'On ne peut pas offrir plus d’articles que le client n’en achète.';
  }
  if (f.type === 'free-ship') {
    const s = intOf(f.freeShipSeuil);
    if (s !== null && (Number.isNaN(s) || s > 10_000_000_000)) e.freeShipSeuil = 'Montant invalide (GNF, 0 = sans minimum).';
  }

  if (f.description.length > 1000) e.description = '1 000 caractères maximum.';
  return { errors: e, warnings };
}

/* ── DTO ─────────────────────────────────────────────────────────── */

/** Fin de journée locale pour la date de fin, début de journée pour la date de début. */
const iso = (d: Date, endOfDay: boolean) => {
  const x = new Date(d);
  if (endOfDay) x.setHours(23, 59, 59, 0);
  return x.toISOString();
};

export function toDto(f: PromoForm, original?: Promo | null): Record<string, unknown> {
  const free = f.type === 'free-ship';
  const pct = !free && f.valueType === 'percent';
  const val = free ? null : pct ? decOf(f.valeur) : intOf(f.valeur);
  const n = (v: string) => { const x = intOf(v); return x === null || Number.isNaN(x) ? undefined : x; };
  /* Seuil vidé après coup : 0 = aucun (le serveur garde sinon l'ancienne valeur). */
  const threshold = (v: string, before: number | null | undefined) => n(v) ?? (before ? 0 : undefined);
  const start = parseDate(f.startDate);
  const end = parseDate(f.endDate);

  return {
    nom: f.nom.trim(),
    code: f.code.trim().toUpperCase(),
    type: f.type,
    scope: f.scope,
    valueType: free ? 'free' : f.valueType,
    valeur: val === null || Number.isNaN(val) ? undefined : val,
    productIds: f.scope === 'products' ? f.productIds : original?.scope === 'products' ? [] : undefined,
    maxUtilisations: n(f.maxUtilisations),
    maxParClient: n(f.maxParClient) ?? 1,
    montantMinimum: threshold(f.montantMinimum, original?.montantMinimum),
    plafondReduction: pct ? threshold(f.plafondReduction, original?.plafondReduction) : (original?.plafondReduction ? 0 : undefined),
    startDate: start ? iso(start, false) : undefined,
    endDate: end ? iso(end, true) : undefined,
    flashStock: f.type === 'flash' ? n(f.flashStock) : undefined,
    bundleQuantiteMin: f.type === 'bundle' ? n(f.bundleQuantiteMin) : undefined,
    bundleQuantiteOfferte: f.type === 'bundle' ? n(f.bundleQuantiteOfferte) : undefined,
    freeShipSeuil: free ? threshold(f.freeShipSeuil, original?.freeShipSeuil) : undefined,
    description: f.description.trim() || undefined,
  };
}

/** Promotion existante → formulaire (modification). */
export function fromPromo(p: Promo): PromoForm {
  const s = (v: number | null) => (v == null ? '' : String(v));
  return {
    type: p.type,
    valueType: p.valueType === 'fixed' ? 'fixed' : 'percent',
    nom: p.nom,
    code: p.code,
    valeur: s(p.valeur),
    scope: p.scope,
    productIds: p.productIds,
    maxUtilisations: s(p.maxUtilisations),
    maxParClient: String(p.maxParClient || 1),
    montantMinimum: p.montantMinimum ? String(p.montantMinimum) : '',
    plafondReduction: p.plafondReduction ? String(p.plafondReduction) : '',
    startDate: p.startDate ? fmtDate(new Date(p.startDate)) : '',
    endDate: p.endDate ? fmtDate(new Date(p.endDate)) : '',
    flashStock: s(p.flashStock),
    bundleQuantiteMin: s(p.bundleQuantiteMin),
    bundleQuantiteOfferte: s(p.bundleQuantiteOfferte),
    freeShipSeuil: p.freeShipSeuil ? String(p.freeShipSeuil) : '',
    description: p.description ?? '',
  };
}

/** Code proposé à partir du nom : « Soldes de Noël -20 » → « SOLDESNOEL20 ». */
export function suggestCode(nom: string): string {
  return nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
}
