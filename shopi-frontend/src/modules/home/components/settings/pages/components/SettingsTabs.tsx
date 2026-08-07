/* ================================================================
 * src/modules/home/components/settings/pages/components/SettingsTabs.tsx
 *
 * ✅ Barre d'onglets horizontale — TOUJOURS visible, épinglée juste
 *    sous le header (position: sticky, 1er élément de la page).
 *    Séparée de SettingsSidebar (bandeau profil) pour que rien ne
 *    puisse jamais se chevaucher : sticky réserve lui-même sa place
 *    dans le flux, aucun calcul manuel de padding n'est nécessaire.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsTabs.module.css';
import { settingsApi, type SecuriteData } from '../../api/settings.api';
import type { PanelId } from './SettingsSidebar';

interface Props {
  active:   PanelId;
  onSwitch: (id: PanelId) => void;
}

export default function SettingsTabs({ active, onSwitch }: Props) {
  const { t } = useTranslation();
  const [securite, setSecurite] = useState<SecuriteData | null>(null);

  useEffect(() => {
    settingsApi.getSecurite().then(setSecurite).catch(() => {});
  }, []);

  /* Badge sécurité */
  const secBadge = securite
    ? [!securite.twoFaEnabled, securite.questionsConfigurees < 2, securite.codesSecours === 0]
        .filter(Boolean).length
    : 0;

  const item = (id: PanelId, icon: string, label: string, badge?: number, danger?: boolean) => (
    <button
      key={id}
      className={[s.item, active === id ? s.active : '', danger ? s.danger : ''].filter(Boolean).join(' ')}
      onClick={() => onSwitch(id)}
      aria-current={active === id ? 'true' : undefined}
    >
      <i className={`fas ${icon}`} />
      <span>{label}</span>
      {badge ? <span className={s.notif}>{badge}</span> : null}
    </button>
  );

  return (
    <nav className={s.tabs} aria-label={t('settingsPage.tabs.ariaLabel')}>
      {item('profil',   'fa-user',         t('settingsPage.tabs.profil'))}
      {item('adresses', 'fa-location-dot', t('settingsPage.tabs.adresses'))}
      {item('paiement', 'fa-credit-card',  t('settingsPage.tabs.paiement'))}
      {item('points',   'fa-star',         t('settingsPage.tabs.points'))}

      <span className={s.tabDivider} />

      {item('confidentialiteSecurite', 'fa-shield-halved', t('settingsPage.tabs.confidentialiteSecurite'), secBadge || undefined)}
      {item('securite',     'fa-lock',              t('settingsPage.tabs.securite'))}
      {item('sessions',     'fa-desktop',           t('settingsPage.tabs.sessions'))}
      {item('activite',     'fa-clock-rotate-left', t('settingsPage.tabs.activite'))}
      {item('approbations', 'fa-shield-check',      t('settingsPage.tabs.approbations'))}

      <span className={s.tabDivider} />

      {item('notifs',          'fa-bell',          t('settingsPage.tabs.notifs'))}
      {item('confidentialite', 'fa-shield-halved', t('settingsPage.tabs.confidentialite'))}
      {item('apparence',       'fa-palette',       t('settingsPage.tabs.apparence'))}
      {item('langue',          'fa-globe',         t('settingsPage.tabs.langue'))}

      <span className={s.tabDivider} />

      {item('donnees', 'fa-database', t('settingsPage.tabs.donnees'))}

      <span className={s.tabDivider} />

      {item('danger', 'fa-triangle-exclamation', t('settingsPage.tabs.danger'), undefined, true)}
    </nav>
  );
}
