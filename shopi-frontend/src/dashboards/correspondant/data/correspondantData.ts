/* ================================================================
 * data/correspondantData.ts
 * Types partagés + formatteurs du dashboard correspondant Shoneya.
 *
 * Toutes les données proviennent désormais du backend
 * (GET /dashboard/correspondant/...) — ce fichier ne contient
 * plus que les types partagés entre pages et les helpers de
 * formatage réutilisés partout.
 * ================================================================ */

export type ColisStatus = 'att' | 'stock' | 'dep' | 'ret' | 'livr';

export type PageId =
  | 'overview' | 'colis' | 'transferts' | 'retours'
  | 'boutiques' | 'livreurs' | 'clients'
  | 'revenus' | 'portefeuille' | 'zone' | 'evaluation' | 'parametres';

export interface Colis {
  id: string; em: string; nm: string;
  boutique: string; client: string;
  valeur: number; date: string;
  status: ColisStatus; urgent: boolean;
  livreur: string | null; motif: string | null;
}

export const STATUS_CFG: Record<ColisStatus, {label:string}> = {
  att:   {label:'✓ Arrivé'},
  stock: {label:'📦 En stock'},
  dep:   {label:'🚀 Dispatché'},
  ret:   {label:'↩ Retour'},
  livr:  {label:'✅ Livré'},
};

export const fmtGNF  = (n: number) => n.toLocaleString('fr-FR') + ' GNF';
export const fmtMini = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return String(n);
};
