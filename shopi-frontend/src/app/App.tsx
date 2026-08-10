/* ============================================================
 * FICHIER : src/app/App.tsx
 * RÔLE    : Entrée principale de l'application
 * ============================================================ */

import React from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router'
import { ErrorBoundary } from './ErrorBoundary'

import '../shared/i18n/i18n'
import '../styles/global.css'

/**
 * App
 * Point d'entrée React
 */
const App: React.FC = () => (
  <ErrorBoundary>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </ErrorBoundary>
)

export default App