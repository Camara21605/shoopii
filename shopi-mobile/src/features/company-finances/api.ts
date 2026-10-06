/**
 * Finances de la boutique (espace entreprise) — même route que le site
 * (dashboards/entreprise/pages/FinancesPage.tsx) :
 *   GET /dashboard/entreprise/finances   (payments.view)
 *     solde / en attente du portefeuille de la boutique, revenus et dépenses
 *     du mois (commandes livrées), croissance vs mois dernier, CA des 6
 *     derniers mois (EN MILLIONS de GNF, arrondis par le serveur), 30
 *     derniers mouvements, virements (retraits), répartition du mois.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { z } from 'zod';

import { apiFetch } from '@/lib/api/client';

const num = z.coerce.number().catch(0);

const schema = z
  .object({
    solde: num,
    soldeEnAttente: num,
    revenusMois: num,
    depensesMois: num,
    croissanceRevenus: num,
    caData: z.array(z.object({ m: z.string().catch(''), v: num })).catch([]),
    transactions: z
      .array(z.object({ id: z.string(), description: z.string().catch('Mouvement'), reference: z.string().nullable().optional().catch(null), montant: num, dir: z.enum(['in', 'out']).catch('in'), date: z.string().catch('') }))
      .catch([]),
    virements: z.array(z.object({ id: z.string(), montant: num, statut: z.enum(['done', 'pending']).catch('pending'), date: z.string().catch('') })).catch([]),
    repartition: z.array(z.object({ label: z.string().catch(''), montant: num, pct: num })).catch([]),
  })
  .passthrough();
export type Finances = z.infer<typeof schema>;
export const fetchFinances = () => apiFetch('/dashboard/entreprise/finances', { schema });

export const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
export const dateFr = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};
/** Le serveur nomme encore la ligne « Commissions Shopi » : on affiche le nom actuel. */
export const repartitionLabel = (l: string) => l.replace(/Shopi\b/, 'Shoneya');

/** Bilan du mois en CSV (chiffres clés, répartition, mouvements) — le bouton du site ne fait rien. */
export async function shareMonthlyReport(f: Finances, shop: string) {
  const esc = (v: string | number) => (/[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const month = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const lines = [
    [`Bilan ${month}`, shop],
    [],
    ['Solde disponible (GNF)', f.solde],
    ['En attente (escrow) (GNF)', f.soldeEnAttente],
    ['Revenus du mois (GNF)', f.revenusMois],
    ['Dépenses du mois (GNF)', f.depensesMois],
    ['Évolution vs mois dernier (%)', f.croissanceRevenus],
    [],
    ['Répartition', 'Montant (GNF)', '%'],
    ...f.repartition.map((r) => [repartitionLabel(r.label), r.montant, r.pct]),
    [],
    ['Date', 'Mouvement', 'Référence', 'Montant (GNF)'],
    ...f.transactions.map((t) => [new Date(t.date).toLocaleString('fr-FR'), t.description, t.reference ?? '', t.montant]),
  ];
  const csv = `﻿${lines.map((l) => l.map(esc).join(';')).join('\n')}`;
  const name = `bilan-${new Date().toISOString().slice(0, 7)}.csv`;
  if (Platform.OS === 'web') {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Bilan mensuel', UTI: 'public.comma-separated-values-text' });
}
