/**
 * « Intelligence » de la comparaison — même calcul que compareInsights.ts du site
 * (fonctions pures, sans réseau) : à partir des produits comparés, on tire
 *   · un meilleur choix global (score pondéré) et ses raisons ;
 *   · les gagnants par critère (prix, remise, garantie) ;
 *   · des alertes (rupture, stock faible).
 * Garder les deux fichiers alignés : le site et l'app doivent recommander le même produit.
 */
import type { ProductDetail } from '@/features/product/api';

type P = Pick<ProductDetail, 'id' | 'prix' | 'prixAncien' | 'stock' | 'garantie' | 'condition' | 'companyVerified'>;

export const STOCK_FAIBLE = 5;

/** Durée de garantie en mois depuis le texte libre du vendeur (« 12 mois », « 1 an », « Aucune »…).
 *  null = non renseignée, 0 = explicitement sans garantie. */
export function garantieMois(raw: string | null | undefined): number | null {
  const s = (raw ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
  if (!s || s === '-' || s === '—') return null;
  if (/\b(aucun|aucune|sans|none|pas de|non)\b/.test(s)) return 0;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(ans?|annees?|years?|mois|months?|semaines?|weeks?|jours?|days?)/);
  if (!m) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = Number(m[1].replace(',', '.'));
  const u = m[2];
  if (u.startsWith('an') || u.startsWith('annee') || u.startsWith('year')) return n * 12;
  if (u.startsWith('semaine') || u.startsWith('week')) return Math.round((n / 4.33) * 10) / 10;
  if (u.startsWith('jour') || u.startsWith('day')) return Math.round((n / 30) * 10) / 10;
  return n;
}

/** Remise en % (0 sans prix barré cohérent). */
export function remisePct(p: Pick<P, 'prix' | 'prixAncien'>): number {
  if (!p.prixAncien || p.prixAncien <= p.prix || p.prixAncien <= 0) return 0;
  return Math.round(((p.prixAncien - p.prix) / p.prixAncien) * 100);
}

const ETAT_SCORE: Record<string, number> = { neuf: 15, reconditionne: 9, occasion: 5 };

export type Reason = 'moinsCher' | 'remise' | 'garantie' | 'neuf' | 'verifiee' | 'enStock';

export const REASON_LABEL: Record<Reason, string> = {
  moinsCher: 'Le moins cher',
  remise: 'Plus forte remise',
  garantie: 'Meilleure garantie',
  neuf: 'Neuf',
  verifiee: 'Boutique vérifiée',
  enStock: 'Disponible',
};

export interface Insights {
  bestId: string | null;
  /** Le 2e est à moins de 4 points : « match serré » */
  serre: boolean;
  reasons: Reason[];
  cheapestId: string | null;
  ecartPrix: number;
  bestRemiseId: string | null;
  bestGarantieId: string | null;
  outOfStock: string[];
  lowStock: string[];
  /** Écart de prix de chaque produit par rapport au moins cher */
  diffVsMin: Record<string, number>;
}

/** Le SEUL produit qui a la meilleure valeur — null en cas d'égalité ou si personne n'est départagé. */
function uniqueArgBest<T>(list: T[], val: (x: T) => number, cmp: 'min' | 'max'): T | null {
  if (list.length < 2) return null;
  const vals = list.map(val);
  if (new Set(vals).size === 1) return null;
  const target = cmp === 'min' ? Math.min(...vals) : Math.max(...vals);
  const winners = list.filter((_, i) => vals[i] === target);
  return winners.length === 1 ? winners[0] : null;
}

const cond = (p: P) => (p.condition ?? '').toLowerCase();

export function computeInsights(produits: P[]): Insights {
  const out: Insights = {
    bestId: null,
    serre: false,
    reasons: [],
    cheapestId: null,
    ecartPrix: 0,
    bestRemiseId: null,
    bestGarantieId: null,
    outOfStock: [],
    lowStock: [],
    diffVsMin: {},
  };
  if (!produits.length) return out;

  const prixMin = Math.min(...produits.map((p) => p.prix));
  const prixMax = Math.max(...produits.map((p) => p.prix));
  produits.forEach((p) => (out.diffVsMin[p.id] = p.prix - prixMin));
  out.ecartPrix = prixMax - prixMin;
  out.outOfStock = produits.filter((p) => p.stock <= 0).map((p) => p.id);
  out.lowStock = produits.filter((p) => p.stock > 0 && p.stock <= STOCK_FAIBLE).map((p) => p.id);

  const cheapest = uniqueArgBest(produits, (p) => p.prix, 'min');
  const remise = uniqueArgBest(produits, remisePct, 'max');
  const garantie = uniqueArgBest(produits, (p) => garantieMois(p.garantie) ?? 0, 'max');
  out.cheapestId = cheapest?.id ?? null;
  out.bestRemiseId = remise?.id ?? null;
  out.bestGarantieId = garantie?.id ?? null;

  /* Score global (≈ sur 100) — seulement les produits disponibles ; le prix pèse le plus. */
  const dispo = produits.filter((p) => p.stock > 0);
  const gMax = Math.max(0, ...produits.map((p) => garantieMois(p.garantie) ?? 0));
  const scores: Record<string, number> = {};
  dispo.forEach((p) => {
    let s = p.prix > 0 ? 45 * (prixMin / p.prix) : 0;
    s += (Math.min(remisePct(p), 60) / 60) * 8;
    s += gMax > 0 ? 17 * ((garantieMois(p.garantie) ?? 0) / gMax) : 0;
    s += ETAT_SCORE[cond(p)] ?? 8;
    s += p.companyVerified ? 6 : 0;
    s += p.stock > STOCK_FAIBLE ? 4 : 1;
    scores[p.id] = Math.round(s * 10) / 10;
  });

  if (produits.length >= 2 && dispo.length >= 1) {
    const ranked = [...dispo].sort((a, b) => scores[b.id] - scores[a.id]);
    out.bestId = ranked[0].id;
    out.serre = ranked.length > 1 && scores[ranked[0].id] - scores[ranked[1].id] < 4;
  }

  if (out.bestId) {
    const best = produits.find((p) => p.id === out.bestId)!;
    if (cheapest?.id === best.id) out.reasons.push('moinsCher');
    if (remise?.id === best.id) out.reasons.push('remise');
    if (garantie?.id === best.id) out.reasons.push('garantie');
    if (cond(best) === 'neuf' && produits.some((p) => cond(p) !== 'neuf')) out.reasons.push('neuf');
    if (best.companyVerified && produits.some((p) => !p.companyVerified)) out.reasons.push('verifiee');
    if (out.outOfStock.length) out.reasons.push('enStock');
  }
  return out;
}
