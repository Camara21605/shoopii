/* ============================================================
 * FICHIER : src/app/AppProviders.tsx
 * RÔLE    : Centralise tous les providers globaux
 * ============================================================ */

import type { ReactNode } from 'react'

import { AppProvider } from '../../shared/context/AppContext'
import { ToastProvider } from '../../shared/context/ToastContext'
import { ThemeProvider } from '../../shared/context/ThemeContext'

interface Props {
  children: ReactNode
}

/**
 * AppProviders
 * Wrapper global de tous les contextes de l'application
 */
export function AppProviders({ children }: Props) {
  return (
    <ThemeProvider>
      <AppProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AppProvider>
    </ThemeProvider>
  )
}