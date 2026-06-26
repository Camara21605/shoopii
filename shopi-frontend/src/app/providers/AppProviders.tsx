/* ============================================================
 * FICHIER : src/app/AppProviders.tsx
 * RÔLE    : Centralise tous les providers globaux
 * ============================================================ */

import type { ReactNode } from 'react'

import { AppProvider } from '../../shared/context/AppContext'
import { ToastProvider } from '../../shared/context/ToastContext'
// import { AuthProvider } from '../modules/auth/context/AuthContext' (si tu l’as plus tard)

interface Props {
  children: ReactNode
}

/**
 * AppProviders
 * Wrapper global de tous les contextes de l'application
 */
export function AppProviders({ children }: Props) {
  return (
    <AppProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AppProvider>
  )
}