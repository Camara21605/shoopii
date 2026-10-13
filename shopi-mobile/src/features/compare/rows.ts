/**
 * Lignes du tableau de comparaison — mêmes lignes que la page /comparer du site :
 * prix, remise, boutique, sous-catégorie, marque, état, garantie, stock, livraison,
 * puis les caractéristiques (union de celles de tous les produits).
 * Chaque cellule garde une valeur de comparaison (`cmp`) qui sert au filtre
 * « Seulement les différences » ; les lignes vides partout (« — ») sont retirées.
 */
import { formatPrice } from '@/features/catalog/format';
import type { ProductDetail } from '@/features/product/api';
import { conditionLabel } from '@/features/product/components';

import { garantieMois, remisePct, STOCK_FAIBLE, type Insights } from './insights';

export type Tone = 'price' | 'promo' | 'ok' | 'low' | 'out' | 'link';
export interface Cell {
  text: string;
  cmp: string;
  tone?: Tone;
  /** Prix barré, écart « +12 000 GNF »… */
  sub?: string;
  /** Pastille « Meilleur prix », « Meilleure garantie »… */
  badge?: string;
  verified?: boolean;
  /** Toucher la cellule ouvre la boutique */
  shopId?: string;
}
export interface Row {
  key: string;
  label: string;
  /** Titre de partie (« Caractéristiques ») : pas de cellules */
  section?: boolean;
  cells: Cell[];
}

const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));

export function buildRows(produits: ProductDetail[], ins: Insights): Row[] {
  const multi = produits.length > 1;
  const best = (id: string | null, p: ProductDetail, label: string) => (multi && id === p.id ? label : undefined);

  const base: Row[] = [
    {
      key: 'prix',
      label: 'Prix',
      cells: produits.map((p) => ({
        text: formatPrice(p.prix),
        cmp: String(p.prix),
        tone: 'price',
        sub:
          multi && ins.cheapestId && ins.diffVsMin[p.id] > 0
            ? `+${formatPrice(ins.diffVsMin[p.id])}`
            : p.prixAncien && p.prixAncien > p.prix
              ? `au lieu de ${formatPrice(p.prixAncien)}`
              : undefined,
        badge: best(ins.cheapestId, p, 'Meilleur prix'),
      })),
    },
    {
      key: 'remise',
      label: 'Remise',
      cells: produits.map((p) => {
        const r = remisePct(p);
        return { text: r > 0 ? `−${r} %` : '—', cmp: String(r), tone: r > 0 ? 'promo' : undefined, badge: r > 0 ? best(ins.bestRemiseId, p, 'Plus forte remise') : undefined };
      }),
    },
    {
      key: 'boutique',
      label: 'Boutique',
      cells: produits.map((p) => ({ text: p.companyName || 'Boutique', cmp: p.companyId, tone: 'link', verified: p.companyVerified, shopId: p.companyId })),
    },
    { key: 'souscat', label: 'Sous-catégorie', cells: produits.map((p) => ({ text: txt(p.subCategory?.nom), cmp: txt(p.subCategory?.nom) })) },
    { key: 'marque', label: 'Marque', cells: produits.map((p) => ({ text: txt(p.marque), cmp: txt(p.marque) })) },
    { key: 'etat', label: 'État', cells: produits.map((p) => ({ text: conditionLabel(p.condition) ?? '—', cmp: txt(p.condition) })) },
    {
      key: 'garantie',
      label: 'Garantie',
      cells: produits.map((p) => ({
        text: txt(p.garantie),
        cmp: String(garantieMois(p.garantie) ?? txt(p.garantie)),
        badge: best(ins.bestGarantieId, p, 'Meilleure garantie'),
      })),
    },
    {
      key: 'stock',
      label: 'Stock',
      cells: produits.map((p) =>
        p.stock <= 0
          ? { text: 'Rupture de stock', cmp: 'out', tone: 'out' as const }
          : p.stock <= STOCK_FAIBLE
            ? { text: `Plus que ${p.stock} !`, cmp: 'ok', tone: 'low' as const }
            : { text: `${p.stock} en stock`, cmp: 'ok', tone: 'ok' as const },
      ),
    },
    {
      key: 'livraison',
      label: 'Livraison',
      cells: produits.map((p) => {
        const v = p.livraisonStandard || p.livraisonLivreur || p.livraisonCorrespondant ? p.delaiLivraison || 'Disponible' : 'Retrait en boutique';
        return { text: v, cmp: v };
      }),
    },
  ];

  const specKeys = Array.from(new Set(produits.flatMap((p) => p.specs.map((s) => s.cle))));
  const specs: Row[] = specKeys.map((cle) => ({
    key: `spec:${cle}`,
    label: cle,
    cells: produits.map((p) => {
      const v = txt(p.specs.find((s) => s.cle === cle)?.valeur);
      return { text: v, cmp: v };
    }),
  }));

  const all = [...base, ...(specs.length ? [{ key: 'sep', label: 'Caractéristiques', section: true, cells: [] }] : []), ...specs];
  return all.filter((r) => r.section || r.cells.some((c) => c.cmp !== '—' && c.cmp !== '0'));
}

export const isDiff = (r: Row) => new Set(r.cells.map((c) => c.cmp)).size > 1;

/** Lignes affichées selon le filtre « Seulement les différences ». */
export function visibleRows(rows: Row[], diffsOnly: boolean) {
  if (!diffsOnly) return rows;
  const specDiff = rows.some((r) => r.key.startsWith('spec:') && isDiff(r));
  return rows.filter((r) => (r.section ? specDiff : isDiff(r)));
}
