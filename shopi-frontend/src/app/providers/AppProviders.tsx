/* ============================================================
 * FICHIER : src/app/AppProviders.tsx
 * RÔLE    : Centralise tous les providers globaux
 * ============================================================ */

import type { ReactNode } from 'react'

import { AppProvider } from '../../shared/context/AppContext'
import { ToastProvider } from '../../shared/context/ToastContext'
import { ThemeProvider } from '../../shared/context/ThemeContext'
import ToastContainer from '../../shared/components/ui/ToastContainer'
import '../../shared/components/ui/ToastContainer.css'

interface Props {
  children: ReactNode
}

/**
 * AppProviders
 * Wrapper global de tous les contextes de l'application
 *
 * ToastContainer est monté ICI (racine de l'app) et pas seulement dans
 * EntrepriseApp.tsx : avant ce correctif, tout appel à pop()/showToast()
 * depuis une page hors du dashboard Entreprise (ex: /messagerie, partagée
 * par tous les rôles, ou GlobalCallProvider pour les erreurs d'appel)
 * mettait bien à jour l'état du contexte racine, mais RIEN ne le
 * rendait visuellement à l'écran — le toast n'existait jamais nulle
 * part. Symptôme observé : un appel qui échoue à l'acceptation (accès
 * micro refusé/occupé) raccrochait sans aucun message, donnant
 * l'impression que "l'appel se coupe" sans explication.
 */
export function AppProviders({ children }: Props) {
  return (
    <ThemeProvider>
      <AppProvider>
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </AppProvider>
    </ThemeProvider>
  )
}