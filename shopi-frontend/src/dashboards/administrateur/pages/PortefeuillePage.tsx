/**
 * @file   PortefeuillePage.tsx
 * @module administrateur/pages
 *
 * Page "Portefeuille" — intègre le composant partagé
 * PortefeuilleStandalone (même que l'ancien AdministrateurApp).
 */

import React from 'react';
import PortefeuilleStandalone from '../../../shared/components/portefeuille/PortefeuilleStandalone';

export default function PortefeuillePage() {
  return (
    <main className="admin-main">
      <div className="adm-page-head">
        <div>
          <div className="adm-page-head__eyebrow">FINANCE</div>
          <h1>Portefeuille</h1>
          <div className="adm-page-head__sub">
            Gestion du portefeuille et des transactions de la branche
          </div>
        </div>
      </div>
      <PortefeuilleStandalone />
    </main>
  );
}
