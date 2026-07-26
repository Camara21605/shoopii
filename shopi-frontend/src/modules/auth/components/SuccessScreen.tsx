/* ============================================================
 * FICHIER : src/modules/auth/components/SuccessScreen.tsx
 * RÔLE    : Écran de succès affiché après connexion ou
 *           inscription réussie — logo Shopi animé + message
 * AUTEUR  : Shopi03
 * DERNIERE MISE A JOUR : 2026-07-19
 * ============================================================ */

import React from 'react';
import ShopiLogo from '../../../shared/components/ShopiLogo';
import { ROLE_DASHBOARD } from '../roleConfigs';
import type { Role } from '../types';

interface SuccessScreenProps {
  action: 'Connexion' | 'Inscription';
  role: Role;
}

export const SuccessScreen: React.FC<SuccessScreenProps> = ({ action, role }) => {
  const isLogin = action === 'Connexion';

  return (
    <div id="successScreen" className="success-screen show">

      {/* Logo Shopi animé — remplace le cercle ✅ */}
      <div className="success-logo">
        <ShopiLogo size={100} />
      </div>

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
