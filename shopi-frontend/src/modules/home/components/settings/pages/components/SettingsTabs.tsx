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
import s from '../styles/SettingsTabs.module.css';
import { settingsApi, type SecuriteData } from '../../api/settings.api';
import type { PanelId } from './SettingsSidebar';

interface Props {
  active:   PanelId;
  onSwitch: (id: PanelId) => void;
}

export default function SettingsTabs({ active, onSwitch }: Props) {
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
    <nav className={s.tabs} aria-label="Sections des paramètres">
      {item('profil',   'fa-user',         'Profil')}
      {item('adresses', 'fa-location-dot', 'Adresses')}
      {item('paiement', 'fa-credit-card',  'Paiement')}
      {item('points',   'fa-star',         'Points Shopi')}

      <span className={s.tabDivider} />

      {item('confidentialiteSecurite', 'fa-shield-halved', 'Confidentialité & sécurité', secBadge || undefined)}
      {item('securite',     'fa-lock',              'Sécurité')}
      {item('sessions',     'fa-desktop',           'Appareils connectés')}
      {item('activite',     'fa-clock-rotate-left', "Journal d'activité")}
      {item('approbations', 'fa-shield-check',      'Appareils de confiance')}

      <span className={s.tabDivider} />

      {item('notifs',          'fa-bell',          'Notifications')}
      {item('confidentialite', 'fa-shield-halved', 'Confidentialité')}
      {item('apparence',       'fa-palette',       'Apparence')}
      {item('langue',          'fa-globe',         'Langue & région')}

      <span className={s.tabDivider} />

      {item('donnees', 'fa-database', 'Mes données')}

      <span className={s.tabDivider} />

      {item('danger', 'fa-triangle-exclamation', 'Zone de danger', undefined, true)}
    </nav>
  );
}
