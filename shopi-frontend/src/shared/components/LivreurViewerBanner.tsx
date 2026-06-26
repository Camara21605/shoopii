/* ================================================================
 * FICHIER : src/shared/components/LivreurViewerBanner.tsx
 *
 * Bandeau affiché en tête des pages publiques /correspondants et
 * /livreurs lorsque l'utilisateur connecté est un LIVREUR.
 * Précise le contexte : c'est le livreur qui consulte/suit.
 * ================================================================ */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoleFromToken } from '../services/authUtils';

interface Props {
  /** "correspondants" | "livreurs" — adapte le texte du bandeau */
  cible: 'correspondants' | 'livreurs';
}

export default function LivreurViewerBanner({ cible }: Props) {
  const navigate = useNavigate();

  if (getRoleFromToken() !== 'delivery') return null;

  const texte = cible === 'correspondants'
    ? 'Suivez des correspondants pour rester informé de leurs annonces et disponibilités.'
    : 'Suivez d\'autres livreurs pour suivre leur activité sur le réseau.';

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0E7490 0%, #0a5570 100%)',
      color: '#fff',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
      flexWrap: 'wrap',
      fontSize: 13,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <i className="fas fa-motorcycle" style={{ fontSize: 16 }} />
        <span>
          <strong>Vue livreur</strong> — {texte}
        </span>
      </div>
      <button
        onClick={() => navigate('/dashboard/livreur')}
        style={{
          background: 'rgba(255,255,255,.14)',
          border: '1px solid rgba(255,255,255,.25)',
          borderRadius: 999,
          color: '#fff',
          fontWeight: 700,
          fontSize: 12,
          padding: '7px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <i className="fas fa-arrow-left" /> Retour à mon espace livreur
      </button>
    </div>
  );
}
