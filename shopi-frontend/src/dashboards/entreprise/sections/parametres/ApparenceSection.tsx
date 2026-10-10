/* ================================================================
 * src/dashboards/entreprise/sections/parametres/ApparenceSection.tsx
 *
 * Paramètres → Apparence : thème d'affichage de l'espace entreprise
 * (Clair / Sombre / Automatique). Préférence PERSONNELLE de l'utilisateur
 * connecté (propriétaire ou collaborateur), enregistrée dans son compte
 * via PATCH /auth/theme — pas un réglage de la boutique, donc toujours
 * modifiable, même en lecture seule (comme la langue).
 * ================================================================ */

import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import ThemeChooser from '../../../../shared/components/ThemeChooser';
import { apiFetch } from '../../../../shared/services/apiFetch';

interface Props { onPop: (msg: string, type?: 's' | 'w' | 'e' | 'i') => void; }

export default function ApparenceSection({ onPop }: Props) {
  const { t } = useTranslation();
  return (
    <FormCard
      title={t('settingsPage.apparence.themeTitle')}
      icon="fa-circle-half-stroke"
      subtitle={t('settingsPage.apparence.themeDesc')}
    >
      <ThemeChooser
        onSave={theme => apiFetch('/auth/theme', { method: 'PATCH', body: { theme } })}
        onToast={(msg, ok) => onPop(msg, ok ? 's' : 'w')}
      />
    </FormCard>
  );
}
