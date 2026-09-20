/* ================================================================
 * src/modules/home/components/settings/sections/LangueSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/langue
 *
 * Langue de l'interface : appliquée aussitôt et mémorisée dans le compte.
 * Retirés car sans effet : la devise (toute la plateforme est en GNF) et le
 * fuseau horaire (aucun affichage ne s'en sert) — choisir « USD » ou « GMT+2 »
 * ne changeait rien nulle part.
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi } from '../../api/settings.api';
import { isSupportedLangCode, SUPPORTED_LANG_CODES } from '../../../../../../shared/i18n/supportedLangs';

interface Props { onToast: (msg: string) => void; }

const LANGS: { code: string; label: string }[] = [
  { code: 'fr', label: '🇫🇷 Français' }, { code: 'en', label: '🇬🇧 English' }, { code: 'ar', label: '🇸🇦 العربية' },
  { code: 'zh', label: '🇨🇳 中文' },     { code: 'pt', label: '🇵🇹 Português' },
];

export default function LangueSection({ onToast }: Props) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'fr').slice(0, 2);
  const [langue,  setLangue]  = useState(current);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    settingsApi.getLangue().catch(() => null).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await settingsApi.updateLangue({ langue });
      if (isSupportedLangCode(langue)) await i18n.changeLanguage(langue);
      onToast(t('settingsPage.langue.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoTeal}`}><i className="fas fa-globe" /></div>
          <div><div className={s.cardH}>{t('settingsPage.langue.titre')}</div><div className={s.cardSub}>{t('settingsPage.langue.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading || langue === current}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.langue.enregistrement')}</> : t('settingsPage.langue.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        <div className={s.privRow}>
          <div className={s.privLeft}>
            <div className={`${s.privIco} ${s.icoTeal}`}><i className="fas fa-language" /></div>
            <div><div className={s.privTitle}>{t('settingsPage.langue.langueTitle')}</div><div className={s.privDesc}>{t('settingsPage.langue.langueDesc')}</div></div>
          </div>
          <select className={s.privSelect} value={langue} aria-label={t('settingsPage.langue.langueTitle')} onChange={e => setLangue(e.target.value)}>
            {LANGS.filter(l => SUPPORTED_LANG_CODES.includes(l.code as any)).map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
