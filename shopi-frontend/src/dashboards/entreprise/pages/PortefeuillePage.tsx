/*
 * FICHIER : src/dashboards/entreprise/pages/PortefeuillePage.tsx
 *
 * RÔLE : Page Portefeuille du dashboard entreprise — délègue
 *        au composant partagé Portefeuille.
 */

import Portefeuille from '../../../shared/components/portefeuille/Portefeuille';

export default function PortefeuillePage() {
  /* .page : mêmes marges que les autres pages du dashboard */
  return (
    <div className="page on">
      <Portefeuille />
    </div>
  );
}
