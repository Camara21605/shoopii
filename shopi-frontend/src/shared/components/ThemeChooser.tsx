/* ================================================================
 * FICHIER : src/shared/components/ThemeChooser.tsx
 *
 * Choix du thème d'affichage : Clair / Sombre / Automatique, avec un
 * aperçu miniature de chaque thème. Partagé par Paramètres → Apparence
 * du client et de l'espace entreprise.
 *
 * Le composant applique le thème tout de suite (ThemeContext) puis
 * appelle `onSave` pour l'enregistrer dans le compte. Si l'enregistrement
 * échoue, le thème reste appliqué sur cet appareil et un message le dit.
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { preferenceToAccount, type AccountTheme } from '../appearance/theme';
import s from './ThemeChooser.module.css';

const THEMES: { pref: ThemePreference; key: AccountTheme; icon: string }[] = [
  { pref: 'light',  key: 'clair',  icon: 'fa-sun' },
  { pref: 'dark',   key: 'sombre', icon: 'fa-moon' },
  { pref: 'system', key: 'auto',   icon: 'fa-circle-half-stroke' },
];

interface Props {
  /** Enregistre le choix dans le compte ('clair' | 'sombre' | 'auto'). */
  onSave:  (theme: AccountTheme) => Promise<unknown>;
  onToast: (msg: string, ok: boolean) => void;
}

export default function ThemeChooser({ onSave, onToast }: Props) {
  const { t } = useTranslation();
  const { preference, setPreference } = useTheme();
  const [saving, setSaving] = useState(false);

  async function choose(pref: ThemePreference) {
    if (pref === preference || saving) return;
    setPreference(pref);
    setSaving(true);
    try {
      await onSave(preferenceToAccount(pref));
      onToast(t('settingsPage.apparence.toastTheme'), true);
    } catch {
      onToast(t('settingsPage.apparence.themeSaveError'), false);
    } finally { setSaving(false); }
  }

  return (
    <div className={s.themeBlock}>
      <div className={s.themeGrid} role="radiogroup" aria-label={t('settingsPage.apparence.themeTitle')}>
        {THEMES.map(({ pref, key, icon }) => {
          const on = preference === pref;
          return (
            <button
              key={pref} type="button" role="radio" aria-checked={on}
              className={`${s.themeOpt} ${on ? s.themeOptOn : ''}`}
              onClick={() => choose(pref)}
              disabled={saving && !on}
            >
              <span className={s.themePrev} aria-hidden="true">
                {(key === 'auto' ? ['clair', 'sombre'] : [key]).map(k => (
                  <span key={k} className={`${s.tpHalf} ${s[`tp_${k}`]}`}>
                    <span className={s.tpBar} /><span className={s.tpLine} /><span className={s.tpLineShort} /><span className={s.tpCard} />
                  </span>
                ))}
              </span>
              <span className={s.themeLbl}>
                <i className={`fas ${icon}`} /> <span className={s.themeLblTxt}>{t(`settingsPage.apparence.themeOptions.${key}`)}</span>
                {on && <i className={`fas fa-check ${s.themeCheck}`} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className={s.themeHint}>
        <i className="fas fa-circle-half-stroke" /> {t('settingsPage.apparence.themeOptions.auto')} — {t('settingsPage.apparence.themeAutoHint')}
      </p>
    </div>
  );
}
