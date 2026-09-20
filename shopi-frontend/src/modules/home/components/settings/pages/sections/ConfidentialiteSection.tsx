/* ================================================================
 * src/modules/home/components/settings/sections/ConfidentialiteSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/privacy
 *
 * Chaque réglage a un effet RÉEL :
 *   - visibilité du profil / historique / liste de souhaits → profil public
 *     (ClientPublicProfilService) ;
 *   - recommandations personnalisées → moteur d'affinité (catalogue) ;
 *   - localisation → distances affichées sur les cartes et profils.
 * « Publicités personnalisées » a été retiré : la plateforme n'a aucun
 * système publicitaire, l'interrupteur ne pilotait rien.
 * ================================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

const DEFAULTS = { visibilite: 'public', historique: false, wishlist: true, perso: true, localisation: true };
type Prefs = typeof DEFAULTS;

const ROWS = [
  { key: 'historique',   ico: 'icoTeal',    icon: 'fa-bag-shopping'     },
  { key: 'wishlist',     ico: 'icoRose',    icon: 'fa-heart'            },
  { key: 'perso',        ico: 'icoAmber',   icon: 'fa-chart-simple'     },
  { key: 'localisation', ico: 'icoEmerald', icon: 'fa-map-location-dot' },
] as const;

export default function ConfidentialiteSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [saved,   setSaved]   = useState<Prefs>(DEFAULTS);
  const [prefs,   setPrefs]   = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await settingsApi.getPrivacy();
      const p = { ...DEFAULTS, ...(res.privacySettings ?? {}) } as Prefs;
      setSaved(p); setPrefs(p);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(prefs), [saved, prefs]);

  async function save() {
    setSaving(true);
    try {
      const res = await settingsApi.updatePrivacy({ privacySettings: JSON.stringify(prefs) });
      const p = { ...DEFAULTS, ...(res.privacySettings ?? {}) } as Prefs;
      setSaved(p); setPrefs(p);
      /* Les distances (cartes, profils) tiennent compte du réglage « localisation » immédiatement */
      window.dispatchEvent(new CustomEvent('privacy-updated', { detail: p }));
      onToast(t('settingsPage.confidentialite.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoViolet}`}><i className="fas fa-eye-slash" /></div>
          <div><div className={s.cardH}>{t('settingsPage.confidentialite.titre')}</div><div className={s.cardSub}>{t('settingsPage.confidentialite.subtitle')}</div></div>
        </div>
        <button className={s.cardAction} onClick={save} disabled={saving || loading || error || !dirty}>
          {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.confidentialite.enregistrement')}</> : t('settingsPage.confidentialite.enregistrer')}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading && <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div>}
        {!loading && error && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
            {t('settingsPage.confidentialite.loadError')}{' '}
            <button type="button" className={s.linkBtn} onClick={() => { setLoading(true); load(); }}>{t('settingsPage.confidentialite.reessayer')}</button>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className={s.privRow}>
              <div className={s.privLeft}>
                <div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-user" /></div>
                <div><div className={s.privTitle}>{t('settingsPage.confidentialite.visibiliteTitle')}</div><div className={s.privDesc}>{t('settingsPage.confidentialite.visibiliteDesc')}</div></div>
              </div>
              <select className={s.privSelect} value={prefs.visibilite} aria-label={t('settingsPage.confidentialite.visibiliteTitle')}
                onChange={e => setPrefs(prev => ({ ...prev, visibilite: e.target.value }))}>
                <option value="public">{t('settingsPage.confidentialite.visibiliteOptions.toutLeMonde')}</option>
                <option value="members">{t('settingsPage.confidentialite.visibiliteOptions.membresShopi')}</option>
                <option value="nobody">{t('settingsPage.confidentialite.visibiliteOptions.personne')}</option>
              </select>
            </div>
            {ROWS.map(({ key, ico, icon }) => (
              <div key={key} className={s.privRow}>
                <div className={s.privLeft}>
                  <div className={`${s.privIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                  <div>
                    <div className={s.privTitle}>{t(`settingsPage.confidentialite.rows.${key}.title`)}</div>
                    <div className={s.privDesc}>{t(`settingsPage.confidentialite.rows.${key}.desc`)}</div>
                  </div>
                </div>
                <Toggle checked={prefs[key]} onChange={v => setPrefs(prev => ({ ...prev, [key]: v }))} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
