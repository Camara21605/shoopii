/**
 * @file   UtilisateursPage.tsx
 * @module administrateur/pages
 *
 * Page "Utilisateurs" — gestion des comptes entreprise,
 * livreurs, partenaires et correspondants de la branche.
 * (Placeholder structuré — à connecter à l'API)
 */

import React from 'react';

export default function UtilisateursPage() {
  return (
    <main className="admin-main">
      <div className="adm-page-head">
        <div>
          <div className="adm-page-head__eyebrow">GESTION</div>
          <h1>Utilisateurs</h1>
          <div className="adm-page-head__sub">
            Entreprises, livreurs, partenaires et correspondants de votre branche
          </div>
        </div>
        <div className="adm-page-head__actions">
          <button className="adm-btn adm-btn--ghost">📥 Exporter</button>
          <button className="adm-btn adm-btn--primary">+ Inviter</button>
        </div>
      </div>

      <div className="adm-placeholder">
        <span className="adm-placeholder__icon">👥</span>
        <h2>Gestion des utilisateurs</h2>
        <p>
          La liste complète des utilisateurs de votre branche sera affichée ici,
          avec filtres par rôle, statut et période.
        </p>
        <button className="adm-btn adm-btn--primary">Charger les utilisateurs</button>
      </div>
    </main>
  );
}
