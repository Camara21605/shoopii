/* ================================================================
 * src/modules/home/components/settings/pages/hooks/useSecurityBadge.ts
 *
 * Nombre de points à corriger sur le compte (2FA absente, ou activée
 * sans codes de secours restants) — même calcul que SettingsTabs,
 * extrait ici pour être réutilisé par SettingsMobileMenu sans dupliquer
 * la logique de récupération.
 * ================================================================ */

import { useEffect, useState } from 'react';
import { settingsApi } from '../../api/settings.api';

export function useSecurityBadge(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => {
      settingsApi.getSecurite()
        .then(sec => {
          setCount([!sec.twoFaEnabled, sec.twoFaEnabled && sec.codesSecours === 0].filter(Boolean).length);
        })
        .catch(() => { /* badge simplement absent si l'appel échoue */ });
    };
    load();
    window.addEventListener('security-updated', load);
    return () => window.removeEventListener('security-updated', load);
  }, []);

  return count;
}
