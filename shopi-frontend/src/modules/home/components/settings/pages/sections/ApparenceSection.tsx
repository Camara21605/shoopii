/* ================================================================
 * src/modules/home/components/settings/sections/ApparenceSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/apparence
 *
 * Taille du texte : appliquée immédiatement à toute l'application
 * (shared/appearance/textSize.ts) et mémorisée dans le compte.
 * Retirés car sans effet : « qualité des images » (aucun consommateur) et le
 * choix du thème (le site est en mode sombre uniquement).
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi } from '../../api/settings.api';
import { applyTextSize, isTextSize, readStoredTextSize, storeTextSize, type TextSize } from '../../../../../../shared/appearance/textSize';

interface Props { onToast: (msg: string) => void; }

const SIZES: TextSize[] = ['normal', 'grand', 'tres_grand'];

export default function ApparenceSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [size,    setSize]    = useState<TextSize>(readStoredTextSize());
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  /* Le compte fait foi (autre appareil) ; en cas d'échec on garde la valeur locale */
  useEffect(() => {
    settingsApi.getApparence()
      .then(res => { if (isTextSize(res.textSize)) { setSize(res.textSize); applyTextSize(res.textSize); storeTextSize(res.textSize); } })
      .catch(() => { /* valeur locale conservée */ })
      .finally(() => setLoading(false));
  }, []);

  /* Aperçu immédiat ; l'enregistrement dans le compte se fait à la sauvegarde */
  const choose = (v: TextSize) => { setSize(v); applyTextSize(v); };

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateApparence({ textSize: size });
      storeTextSize(size);
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
        <button className={s.cardAction} onClick={save} disabled={saving || loading}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.apparence.enregistrement')}</> : t('settingsPage.apparence.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        <div className={s.privRow}>
          <div className={s.privLeft}>
            <div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-text-height" /></div>
            <div><div className={s.privTitle}>{t('settingsPage.apparence.tailleTitle')}</div><div className={s.privDesc}>{t('settingsPage.apparence.tailleDesc')}</div></div>
          </div>
          <select className={s.privSelect} value={size} aria-label={t('settingsPage.apparence.tailleTitle')} onChange={e => choose(e.target.value as TextSize)}>
            {SIZES.map(k => <option key={k} value={k}>{t(`settingsPage.apparence.tailleOptions.${k === 'tres_grand' ? 'tresGrand' : k}`)}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
