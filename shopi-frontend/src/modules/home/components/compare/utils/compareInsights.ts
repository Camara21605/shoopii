/* ================================================================
 * FICHIER : src/modules/home/components/compare/utils/compareInsights.ts
 *
 * RÔLE : « Intelligence » de la page /comparer — fonctions PURES (pas
 *        d'appel réseau, pas de React) qui lisent les produits comparés
 *        et en tirent :
 *          - un meilleur choix global (score pondéré + raisons) ;
 *          - les gagnants par critère (prix, remise, garantie, état…) ;
 *          - des alertes (rupture de stock, stock faible, garantie absente).
 *        Tout est calculé côté client à partir des données déjà chargées.
 * ================================================================ */
import type { ProduitApi } from '../../produit/pages/ProduitPage';

/** Durée de garantie en mois depuis un texte libre du vendeur :
 *  « 12 mois », « 1 an », « 2 ans », « 6 months », « Aucune »…
 *  null = inconnu / non renseigné, 0 = explicitement sans garantie. */
export function garantieMois(raw: string | null | undefined): number | null {
  const s = (raw ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  if (!s || s === '-' || s === '—') return null;
  if (/\b(aucun|aucune|sans|none|pas de|non)\b/.test(s)) return 0;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(ans?|annees?|years?|mois|months?|semaines?|weeks?|jours?|days?)/);
  if (!m) {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;           // « 12 » tout court → mois
  }
  const n = Number(m[1].replace(',', '.'));
  const u = m[2];
  if (u.startsWith('an') || u.startsWith('annee') || u.startsWith('year')) return n * 12;
  if (u.startsWith('semaine') || u.startsWith('week')) return Math.round((n / 4.33) * 10) / 10;
  if (u.startsWith('jour') || u.startsWith('day'))     return Math.round((n / 30) * 10) / 10;
  return n;
}

/** Remise en % (0 si pas de prix barré cohérent). */
export function remisePct(p: Pick<ProduitApi, 'prix' | 'prixAncien'>): number {
  if (!p.prixAncien || p.prixAncien <= p.prix || p.prixAncien <= 0) return 0;
  return Math.round(((p.prixAncien - p.prix) / p.prixAncien) * 100);
}

const ETAT_SCORE: Record<string, number> = { neuf: 15, reconditionne: 9, occasion: 5 };
export const STOCK_FAIBLE = 5;

export type Reason = 'moinsCher' | 'remise' | 'garantie' | 'neuf' | 'verifiee' | 'enStock';

export interface Insights {
  /** Produit recommandé (null si moins de 2 produits disponibles) */
  bestId:     string | null;
  /** true si le 2e est à moins de 4 points : « match serré » */
  serre:      boolean;
  reasons:    Reason[];
  /** Gagnants par critère (absent quand le critère ne départage pas) */
  cheapestId:   string | null;
  priciestId:   string | null;
  /** Écart de prix entre le plus cher et le moins cher */
  ecartPrix:    number;
  bestRemiseId: string | null;
  bestGarantieId: string | null;
  outOfStock:   string[];
  lowStock:     string[];
  /** Écart de prix de chaque produit par rapport au moins cher */
  diffVsMin:    Record<string, number>;
  scores:       Record<string, number>;
}

/** Le SEUL produit qui a la meilleure valeur — null si égalité ou si le
 *  critère ne départage personne (moins de 2 produits, tous égaux). */
function uniqueArgBest<T>(list: T[], val: (x: T) => number, cmp: 'min' | 'max'): T | null {
  if (list.length < 2) return null;
  const vals = list.map(val);
  if (new Set(vals).size === 1) return null;
  const target  = cmp === 'min' ? Math.min(...vals) : Math.max(...vals);
  const winners = list.filter((_, i) => vals[i] === target);
  return winners.length === 1 ? winners[0] : null;
}

export function computeInsights(produits: ProduitApi[]): Insights {
  const empty: Insights = {
    bestId: null, serre: false, reasons: [],
    cheapestId: null, priciestId: null, ecartPrix: 0, bestRemiseId: null, bestGarantieId: null,
    outOfStock: [], lowStock: [], diffVsMin: {}, scores: {},
  };
  if (produits.length === 0) return empty;

  const prixMin = Math.min(...produits.map(p => p.prix));
  const prixMax = Math.max(...produits.map(p => p.prix));
  const diffVsMin: Record<string, number> = {};
  produits.forEach(p => { diffVsMin[p.id] = p.prix - prixMin; });

  const outOfStock = produits.filter(p => p.stock <= 0).map(p => p.id);
  const lowStock   = produits.filter(p => p.stock > 0 && p.stock <= STOCK_FAIBLE).map(p => p.id);

  const cheapest = uniqueArgBest(produits, p => p.prix, 'min');
  const priciest = uniqueArgBest(produits, p => p.prix, 'max');
  const remiseWinner   = uniqueArgBest(produits, p => remisePct(p), 'max');
  const garantieWinner = uniqueArgBest(produits, p => garantieMois(p.garantie) ?? 0, 'max');

  /* ── Score global (sur 100 environ) — seulement les produits disponibles ── */
  const dispo = produits.filter(p => p.stock > 0);
  const gMax  = Math.max(0, ...produits.map(p => garantieMois(p.garantie) ?? 0));
  const scores: Record<string, number> = {};
  dispo.forEach(p => {
    let s = 0;
    s += p.prix > 0 ? 45 * (prixMin / p.prix) : 0;                       // prix : critère n°1
    s += Math.min(remisePct(p), 60) / 60 * 8;                            // promo
    s += gMax > 0 ? 17 * ((garantieMois(p.garantie) ?? 0) / gMax) : 0;   // garantie
    s += ETAT_SCORE[(p.condition ?? '').toLowerCase()] ?? 8;             // état
    s += p.companyVerified ? 6 : 0;                                       // boutique vérifiée
    s += p.stock > STOCK_FAIBLE ? 4 : 1;                                  // disponibilité
    scores[p.id] = Math.round(s * 10) / 10;
  });

  let bestId: string | null = null;
  let serre = false;
  if (produits.length >= 2 && dispo.length >= 1) {
    const ranked = [...dispo].sort((a, b) => scores[b.id] - scores[a.id]);
    bestId = ranked[0].id;
    serre  = ranked.length > 1 && scores[ranked[0].id] - scores[ranked[1].id] < 4;
  }

  const reasons: Reason[] = [];
  if (bestId) {
    const best = produits.find(p => p.id === bestId)!;
    if (cheapest?.id === bestId) reasons.push('moinsCher');
    if (remiseWinner?.id === bestId) reasons.push('remise');
    if (garantieWinner?.id === bestId) reasons.push('garantie');
    if ((best.condition ?? '').toLowerCase() === 'neuf' && produits.some(p => (p.condition ?? '').toLowerCase() !== 'neuf')) reasons.push('neuf');
    if (best.companyVerified && produits.some(p => !p.companyVerified)) reasons.push('verifiee');
    if (outOfStock.length > 0) reasons.push('enStock');
  }

  return {
    bestId, serre, reasons,
    cheapestId: cheapest?.id ?? null,
    priciestId: priciest?.id ?? null,
    ecartPrix:  prixMax - prixMin,
    bestRemiseId: remiseWinner?.id ?? null,
    bestGarantieId: garantieWinner?.id ?? null,
    outOfStock, lowStock, diffVsMin, scores,
  };
}
