/* ============================================================
 * FICHIER : src/modules/auth/components/SuccessScreen.tsx
 * RÔLE    : Écran de succès affiché après connexion ou
 *           inscription réussie — animation scale-in + message
 * ============================================================ */

import React from 'react';
import { ROLE_DASHBOARD } from '../roleConfigs';
import type { Role } from '../types';

interface SuccessScreenProps {
  action: 'Connexion' | 'Inscription';
  role: Role;
}

/**
 * SuccessScreen
 * Remplace le formulaire après une authentification réussie.
 * Affiche une animation de validation et redirige vers le dashboard.
 */
export const SuccessScreen: React.FC<SuccessScreenProps> = ({ action, role }) => {
  const isLogin = action === 'Connexion';

  return (
    <div id="successScreen" className="success-screen show">
      {/* Cercle animé ✓ */}
      <div className="success-circle">✅</div>

      {/* Titre */}
      <h3 className="success-title" id="successTitle">
        {isLogin ? 'Connexion réussie !' : 'Compte créé !'}
      </h3>

      {/* Sous-titre */}
      <p className="success-sub" id="successSub">
        Bienvenue{!isLogin ? ' sur Shopi' : ''} ! Vous allez être redirigé
        vers {ROLE_DASHBOARD[role] || 'votre espace'}.
      </p>

      {/* Bouton d'accès au dashboard */}
      <button className="btn-go">
        <i className="fas fa-arrow-right" />
        Accéder à mon espace
      </button>
    </div>
  );
};