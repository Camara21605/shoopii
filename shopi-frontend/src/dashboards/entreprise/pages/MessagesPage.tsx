/*
 * FICHIER : src/dashboards/entreprise/pages/MessagesPage.tsx
 * Page messagerie du dashboard entreprise.
 * Wrapper minimal — toute la logique est dans MessagerieCore.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import MessagerieCore from '../../../shared/messagerie/MessagerieCore';
import { useForceDarkTheme } from '../../../shared/context/ThemeContext';
import { useTeamPermissions } from '../hooks/useTeamPermissions';

export default function MessagesPage() {
  /* La messagerie (partagée par tous les espaces) n'a pas encore de mode
   * clair : sombre le temps de cette page, puis retour au thème choisi. */
  useForceDarkTheme();
  const { t } = useTranslation();
  const { can, isOwner, loading } = useTeamPermissions();

  /* Un collaborateur sans messaging.read ne peut faire aboutir AUCUN appel
   * de MessagerieCore (tout est gardé côté backend) — on évite de le
   * laisser sur un écran qui échouerait en boucle. Le bouton d'accès dans
   * Topbar est déjà masqué dans ce cas ; ce garde couvre le cas où la
   * permission est révoquée pendant qu'il est déjà sur cette page. */
  if (!loading && !isOwner && !can('messaging', 'read')) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', minHeight: 300, gap: 8, textAlign: 'center', color: 'var(--t2)', padding: 24,
      }}>
        <i className="fas fa-lock" style={{ fontSize: 28, opacity: .5 }} />
        <strong>{t('messagerie.accessDenied.title')}</strong>
        <span style={{ fontSize: 13 }}>{t('messagerie.accessDenied.message')}</span>
      </div>
    );
  }

  return <MessagerieCore canSend={isOwner || can('messaging', 'send')} />;
}