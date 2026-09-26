/* ============================================================
 * FICHIER : src/app/ErrorBoundary.tsx
 *
 * RÔLE : Filet de sécurité racine — sans ce composant, une exception
 * JS non rattrapée N'IMPORTE OÙ dans l'arbre React (y compris pendant
 * le chargement d'un chunk lazy() cassé, ex. LocationMap/leaflet)
 * démonte TOUTE l'application et affiche une page blanche, quelle que
 * soit l'URL visitée — le bug d'un seul composant devient une panne
 * totale du site.
 *
 * Cas particulier : fichier de page introuvable après un déploiement
 * (ancienne version encore ouverte) → on passe tout seul à la nouvelle
 * version au lieu d'afficher l'erreur (voir shared/utils/newVersion.ts).
 * ============================================================ */

import React from 'react';
import { isStaleChunkError, reloadToNewVersion } from '../shared/utils/newVersion';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; updating: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, updating: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, updating: isStaleChunkError(error) };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    if (isStaleChunkError(error)) {
      void reloadToNewVersion().then(reloading => { if (!reloading) this.setState({ updating: false }); });
      return;
    }
    console.error('[ErrorBoundary] Erreur non rattrapée :', error, info.componentStack);
  }

  render() {
    if (this.state.hasError && this.state.updating) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
          textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#666',
        }}>
          <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 22 }} aria-hidden="true" />
          <p style={{ margin: 0 }}>Mise à jour de Shoneya…</p>
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
          textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Une erreur est survenue.</h1>
          <p style={{ color: '#666', margin: 0 }}>
            Rechargez la page. Si le problème persiste, contactez le support Shoneya.
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
