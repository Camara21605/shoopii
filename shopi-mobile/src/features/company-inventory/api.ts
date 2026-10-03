/**
 * Inventaire & stock (espace entreprise) — mêmes données que InventairePage du site :
 *   GET   /produits (tout le catalogue, partagé avec la rubrique Produits : même cache)
 *   PATCH /produits/:id { stock?, seuil? }   (products.edit)
 *
 * Règles de statut identiques au site :
 *   rupture  stock = 0
 *   faible   stock ≤ seuil (seuil défini)
 *   critique stock < 5 (sans seuil, ou au-dessus du seuil)
 *   en stock sinon
 * Barre : pleine à 3 × le seuil (30 sans seuil). Réapprovisionnement suggéré :
 * remonter à 3 × le seuil (10 minimum).
 */
import { apiFetch } from '@/lib/api/client';

import type { Product } from '@/features/company-products/api';

export { fetchAllProducts, gnf, normalize, type Product } from '@/features/company-products/api';

export type Level = 'out' | 'low' | 'crit' | 'ok';

export function levelOf(stock: number, seuil: number | null | undefined): Level {
  if (stock === 0) return 'out';
  if (seuil != null && stock <= seuil) return 'low';
  if (stock < 5) return 'crit';
  return 'ok';
}

export const LEVEL: Record<Level, { label: string; color: string; bg: string; icon: string }> = {
  out: { label: 'Rupture', color: '#B91C1C', bg: '#FEF2F2', icon: 'close-circle' },
  low: { label: 'Stock faible', color: '#B45309', bg: '#FFF7E6', icon: 'warning' },
  crit: { label: 'Critique', color: '#B45309', bg: '#FFF7E6', icon: 'alert-circle' },
  ok: { label: 'En stock', color: '#047857', bg: '#ECFDF5', icon: 'checkmark-circle' },
};

export const stockPct = (stock: number, seuil: number | null | undefined) => Math.min(100, Math.round((stock / ((seuil ?? 10) * 3)) * 100));

/** Stock visé après réapprovisionnement : 3 × le seuil, 10 minimum. */
export const restockTarget = (p: Pick<Product, 'seuil'>) => Math.max((p.seuil ?? 5) * 3, 10);

export const patchStock = (id: string, body: { stock?: number; seuil?: number | null }) => apiFetch(`/produits/${id}`, { method: 'PATCH', body });

/** Applique des PATCH en parallèle ; renvoie les réussites et le nombre d'échecs. */
export async function patchMany<T extends { id: string }>(items: T[], body: (item: T) => { stock?: number; seuil?: number | null }) {
  const results = await Promise.allSettled(items.map((it) => patchStock(it.id, body(it)).then(() => it)));
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  return { ok, failed: results.length - ok.length };
}

export const fmtNum = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
