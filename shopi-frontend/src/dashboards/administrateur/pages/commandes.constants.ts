/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/commandes.constants.ts
 * Libellés et formats partagés par la page Commandes et son détail.
 * ================================================================ */

export const ST_LABEL: Record<string, string> = {
  prep: 'Préparation', ship: 'En livraison', relay: 'Au relais',
  done: 'Livrée', dispute: 'Litige', cancel: 'Annulée', refund: 'Remboursée',
};

export const fmtGnf = (n: number) => n.toLocaleString('fr-FR') + ' GNF';
