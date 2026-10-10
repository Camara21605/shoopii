/* ================================================================
 * src/modules/home/components/settings/sections/ApparenceSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/apparence
 *
 * Thème (Clair / Sombre / Automatique) : appliqué immédiatement et enregistré
 * aussitôt dans le compte (pas besoin de « Enregistrer ») — voir ThemeContext.
 * Taille du texte : appliquée immédiatement à toute l'application
 * (shared/appearance/textSize.ts) et mémorisée dans le compte.
 * Retirée car sans effet : « qualité des images » (aucun consommateur).
 *
 * BUGS CORRIGÉS — l'aperçu restait appliqué si l'on quittait sans enregistrer ;
 * « Enregistrer » était actif sans aucun changement. (La taille du compte est
 * désormais aussi appliquée à l'ouverture de session : voir AppContext.)
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi } from '../../api/settings.api';
import { applyTextSize, isTextSize, readStoredTextSize, storeTextSize, type TextSize } from '../../../../../../shared/appearance/textSize';
import { useTheme, type ThemePreference } from '../../../../../../shared/context/ThemeContext';
import { accountToPreference, isAccountTheme, preferenceToAccount } from '../../../../../../shared/appearance/theme';

const THEMES: { pref: ThemePreference; key: 'clair' | 'sombre' | 'auto'; icon: string }[] = [
  { pref: 'light',  key: 'clair',  icon: 'fa-sun' },
  { pref: 'dark',   key: 'sombre', icon: 'fa-moon' },
  { pref: 'system', key: 'auto',   icon: 'fa-circle-half-stroke' },
];

interface Props { onToast: (msg: string) => void; }

const SIZES: TextSize[] = ['normal', 'grand', 'tres_grand'];

export default function ApparenceSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [size,    setSize]    = useState<TextSize>(readStoredTextSize());
  const [saved,   setSaved]   = useState<TextSize>(readStoredTextSize());
  /* Valeurs lues au démontage (aperçu non enregistré → on revient à la taille enregistrée) */
  const latest = useRef({ size, saved });
  useEffect(() => { latest.current = { size, saved }; }, [size, saved]);
  useEffect(() => () => {
    if (latest.current.size !== latest.current.saved) applyTextSize(latest.current.saved);
  }, []);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const { preference, setPreference } = useTheme();
  const [themeSaving, setThemeSaving] = useState(false);

  /* Thème : appliqué tout de suite, puis enregistré dans le compte */
  async function chooseTheme(pref: ThemePreference) {
    if (pref === preference || themeSaving) return;
    setPreference(pref);
    setThemeSaving(true);
    try {
      await settingsApi.updateApparence({ theme: preferenceToAccount(pref) });
      onToast(t('settingsPage.apparence.toastTheme'));
    } catch {
      onToast(`⚠️ ${t('settingsPage.apparence.themeSaveError')}`);
    } finally { setThemeSaving(false); }
  }

  /* Le compte fait foi (autre appareil) ; en cas d'échec on garde la valeur locale */
  useEffect(() => {
    settingsApi.getApparence()
      .then(res => {
        if (isTextSize(res.textSize)) { setSize(res.textSize); setSaved(res.textSize); applyTextSize(res.textSize); storeTextSize(res.textSize); }
        if (isAccountTheme(res.theme)) setPreference(accountToPreference(res.theme));
      })
      .catch(() => { /* valeur locale conservée */ })
      .finally(() => setLoading(false));
  }, [setPreference]);

  /* Aperçu immédiat ; l'enregistrement dans le compte se fait à la sauvegarde */
  const choose = (v: TextSize) => { setSize(v); applyTextSize(v); };

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateApparence({ textSize: size });
      storeTextSize(size);
      setSaved(size);
      onToast(t('settingsPage.apparence.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-palette" /></div>
          <div><div className={s.cardH}>{t('settingsPage.apparence.titre')}</div><div className={s.cardSub}>{t('settingsPage.apparence.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading || size === saved}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.apparence.enregistrement')}</> : t('settingsPage.apparence.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        {/* ── Thème ── */}
        <div className={s.themeBlock}>
          <div className={s.privLeft}>
            <div className={`${s.privIco} ${s.icoViolet}`}><i className="fas fa-circle-half-stroke" /></div>
            <div><div className={s.privTitle}>{t('settingsPage.apparence.themeTitle')}</div><div className={s.privDesc}>{t('settingsPage.apparence.themeDesc')}</div></div>
          </div>
          <div className={s.themeGrid} role="radiogroup" aria-label={t('settingsPage.apparence.themeTitle')}>
            {THEMES.map(({ pref, key, icon }) => {
              const on = preference === pref;
              return (
                <button
                  key={pref} type="button" role="radio" aria-checked={on}
                  className={`${s.themeOpt} ${on ? s.themeOptOn : ''}`}
                  onClick={() => chooseTheme(pref)}
                  disabled={themeSaving && !on}
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

        <div className={s.privRow}>
          <div className={s.privLeft}>
            <div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-text-height" /></div>
            <div><div className={s.privTitle}>{t('settingsPage.apparence.tailleTitle')}</div><div className={s.privDesc}>{t('settingsPage.apparence.tailleDesc')}</div></div>
          </div>
          <select className={s.privSelect} value={size} disabled={loading} aria-label={t('settingsPage.apparence.tailleTitle')} onChange={e => choose(e.target.value as TextSize)}>
            {SIZES.map(k => <option key={k} value={k}>{t(`settingsPage.apparence.tailleOptions.${k === 'tres_grand' ? 'tresGrand' : k}`)}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
