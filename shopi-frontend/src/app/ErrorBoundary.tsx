/* ============================================================
 * FICHIER : src/app/ErrorBoundary.tsx
 *
 * RÔLE : Filet de sécurité racine — sans ce composant, une exception
 * JS non rattrapée N'IMPORTE OÙ dans l'arbre React (y compris pendant
 * le chargement d'un chunk lazy() cassé, ex. LocationMap/leaflet)
 * démonte TOUTE l'application et affiche une page blanche, quelle que
 * soit l'URL visitée — le bug d'un seul composant devient une panne
 * totale du site.
 * ============================================================ */

import React from 'react';

interface Props { children: React.ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erreur non rattrapée :', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Une erreur est survenue.</h1>
          <p style={{ color: '#666', margin: 0 }}>
            Rechargez la page. Si le problème persiste, contactez le support Shopi.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#0B1F3A', color: '#fff', cursor: 'pointer', fontSize: 14,
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
