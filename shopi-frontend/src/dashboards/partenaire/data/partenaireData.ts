/* ================================================================
 * FICHIER : src/dashboards/partenaire/data/partenaireData.ts
 *
 * Constantes partagées du dashboard partenaire.
 * Toutes les données mockées ont été supprimées — voir les pages
 * respectives qui appellent directement /dashboard/partenaire/*.
 * ================================================================ */

/* Libellés des types d'acteur */
export const TYPE_LABEL: Record<string, string> = {
  ent: 'Entreprise', lvr: 'Livreur', cor: 'Correspondant', cli: 'Client VIP',
};
export const TYPE_ICON: Record<string, string> = {
  ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin', cli: 'fa-user',
};

/* Formatage GNF */
export const fmtGnf = (n: number) => n.toLocaleString('fr-FR') + ' GNF';
