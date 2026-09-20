/* ================================================================
 * src/modules/home/components/settings/sections/AdressesSection.tsx
 *
 * Adresses de livraison — RÉELLES : même gestion que la page « Adresses », la
 * carte et la commande (/location/addresses : quartier, position GPS sur
 * carte, adresse par défaut, instructions pour le livreur).
 *
 * BUG CORRIGÉ — ce panneau avait sa propre liste JSON (sans quartier ni
 * position), séparée des adresses utilisées à la commande : ce qu'on y saisissait
 * n'était jamais utilisé nulle part.
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import SectionAddresses from '../../../../../../shared/profils/profil-client/sections/SectionAddresses';

interface Props { onToast: (msg: string) => void; }

export default function AdressesSection({ onToast }: Props) {
  const { t } = useTranslation();
  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoBlue}`}><i className="fas fa-location-dot" /></div>
          <div>
            <div className={s.cardH}>{t('settingsPage.adresses.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.adresses.subtitle')}</div>
          </div>
        </div>
      </div>
      <div className={s.cardBody} style={{ padding: '0 24px 20px' }}>
        <SectionAddresses onToast={msg => onToast(msg)} />
      </div>
    </div>
  );
}
