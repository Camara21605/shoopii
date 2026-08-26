/* ============================================================
 * FICHIER : src/modules/auth/pages/SessionConfirmScreen.tsx
 *
 * Étape intermédiaire du login quand ce compte a déjà une session
 * active sur un autre appareil. Le backend renvoie
 * { requiresSessionConfirm: true } depuis POST /auth/login (ou
 * /auth/login/choose-account) au lieu de fermer automatiquement
 * l'ancienne session — cet écran demande une confirmation explicite
 * avant de rappeler le même endpoint avec confirmDisconnectOther:true,
 * ce qui ferme instantanément l'autre appareil (notification temps
 * réel session:revoked, voir AppContext.handleSessionRevoked).
 * ============================================================ */

import React from 'react';

interface Props {
  isLoading: boolean;
  error:     string;
  onConfirm: () => void;
  onCancel:  () => void;
}

export const SessionConfirmScreen: React.FC<Props> = ({ isLoading, error, onConfirm, onCancel }) => (
  <div style={{ animation: 'fadeSlideIn .3s ease' }}>
    <button
      onClick={onCancel}
      disabled={isLoading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
        color: 'var(--t2)', fontSize: 13, fontWeight: 600, cursor: isLoading ? 'not-allowed' : 'pointer',
        marginBottom: 20, padding: 0,
      }}
    >
      <i className="fas fa-arrow-left" /> Retour à la connexion
    </button>

    <div style={{
      width: 52, height: 52, borderRadius: 14, background: 'var(--sky, #EEF3FF)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    }}>
      <i className="fas fa-mobile-screen-button" style={{ color: 'var(--blue, #1A4FC4)', fontSize: 22 }} />
    </div>

    <h2 style={{ fontFamily: 'var(--fd, Fraunces, serif)', fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
      Déjà connecté ailleurs
    </h2>
    <p style={{ fontSize: 13.5, color: 'var(--t2)', marginBottom: 22, lineHeight: 1.6 }}>
      Ce compte est actuellement connecté sur un autre appareil. Pour continuer ici,
      il faut déconnecter cet autre appareil — la déconnexion y sera immédiate.
    </p>

    {error && (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', marginBottom: 14, background: 'var(--rose-dim, #fff0f0)', border: '1.5px solid rgba(220,38,38,.25)', borderRadius: 10 }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
        <span style={{ fontSize: 13, color: 'var(--rose, #DC2626)', fontWeight: 500 }}>{error}</span>
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <button
        disabled={isLoading}
        onClick={onConfirm}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px 16px', background: 'var(--navy)', color: '#fff', border: 'none',
          borderRadius: 12, fontSize: 14, fontWeight: 700,
          cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? .7 : 1,
        }}
      >
        {isLoading
          ? <><i className="fas fa-spinner fa-spin" /> Déconnexion en cours…</>
          : <><i className="fas fa-right-from-bracket" /> Oui, déconnecter l'autre appareil</>}
      </button>
      <button
        disabled={isLoading}
        onClick={onCancel}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '13px 16px', background: 'var(--white)', color: 'var(--navy)',
          border: '1.5px solid var(--bdr2, #E2E8F0)', borderRadius: 12, fontSize: 14, fontWeight: 700,
          cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? .7 : 1,
        }}
      >
        Annuler
      </button>
    </div>
  </div>
);
