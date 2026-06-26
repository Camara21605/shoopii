/* ============================================================
 * FICHIER : src/app/App.tsx
 * RÔLE    : Entrée principale de l'application
 * ============================================================ */

import React from 'react'
import { AppProviders } from './providers/AppProviders'
import { AppRouter } from './router'

import '../styles/global.css'

/**
 * App
 * Point d'entrée React
 */
const App: React.FC = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
)

export default App