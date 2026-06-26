// src/dashboards/entreprise/layout/ReseauBottomNav.tsx
// Barre de navigation fixe en bas d'écran (mobile uniquement) :
// Suivre correspondants · Suivre livreurs · Mon espace (bascule vers l'espace client)
// ⚠️ Distinct du tb-bottomnav (gestion produits/commandes) et des pages
//    "Mes livreurs" / "Correspondants" (gestion du réseau de l'entreprise).

import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { EntreprisePage } from '../types';
import './ReseauBottomNav.css';

interface Props {
  activePage: EntreprisePage;
  onNavigate: (page: EntreprisePage) => void;
}

export default function ReseauBottomNav({ activePage, onNavigate }: Props) {
  const navigate = useNavigate();

  const isCorrespondants = activePage === 'reseauCorrespondants' || activePage === 'profilCorrespondantReseau';
  const isLivreurs       = activePage === 'reseauLivreurs'       || activePage === 'profilLivreurReseau';

  return (
    <nav className="rbn-nav" aria-label="Navigation réseau mobile">
      <button
        className={`rbn-it${isCorrespondants ? ' on' : ''}`}
        onClick={() => onNavigate('reseauCorrespondants')}
      >
        <i className="fas fa-warehouse"></i>
        <span>Correspondants</span>
      </button>

      <button
        className={`rbn-it${isLivreurs ? ' on' : ''}`}
        onClick={() => onNavigate('reseauLivreurs')}
      >
        <i className="fas fa-motorcycle"></i>
        <span>Livreurs</span>
      </button>

      <button
        className="rbn-it"
        onClick={() => navigate('/home')}
        title="Basculer vers l'espace client"
      >
        <i className="fas fa-layer-group"></i>
        <span>Mon espace</span>
      </button>
    </nav>
  );
}
