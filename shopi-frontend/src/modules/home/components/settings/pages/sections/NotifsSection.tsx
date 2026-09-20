/* ================================================================
 * src/modules/home/components/settings/sections/NotifsSection.tsx
 * CONNECTÉ — GET + PATCH /client/parametres/notifs (préférences RÉELLES)
 *
 * Pilote le vrai système de notifications : interrupteurs globaux push /
 * e-mail, catégories par canal, mode « Ne pas déranger ». (Avant : les
 * interrupteurs étaient enregistrés dans un JSON que personne ne lisait.)
 * Pas de colonne SMS : le canal SMS n'est pas encore branché.
 * ================================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { Toggle } from '../components/Toggle';
import { settingsApi, type NotifsView } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

const ROWS = [
  { key: 'commandes', ico: 'icoEmerald', icon: 'fa-bag-shopping' },
  { key: 'promos',    ico: 'icoViolet',  icon: 'fa-tag'          },
  { key: 'messages',  ico: 'icoRose',    icon: 'fa-comment-dots' },
  { key: 'social',    ico: 'icoTeal',    icon: 'fa-user-group'   },
] as const;

const TIMEZONES = ['Africa/Conakry', 'UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'Asia/Shanghai', 'Asia/Dubai'];

export default function NotifsSection({ onToast }: Props) {
  const { t } = useTranslation();
  const [saved,   setSaved]   = useState<NotifsView | null>(null);
  const [draft,   setDraft]   = useState<NotifsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [saving,  setSaving]  = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try { const v = await settingsApi.getNotifs(); setSaved(v); setDraft(v); }
    catch { setError(true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => !!saved && !!draft && JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const setGlobal = (ch: 'push' | 'email', v: boolean) => setDraft(d => d && ({ ...d, global: { ...d.global, [ch]: v } }));
  const setGroup  = (key: string, ch: 'push' | 'email', v: boolean) =>
    setDraft(d => d && ({ ...d, groups: { ...d.groups, [key]: { ...d.groups[key], [ch]: v } } }));
  const setDnd    = (patch: Partial<NotifsView['dnd']>) => setDraft(d => d && ({ ...d, dnd: { ...d.dnd, ...patch } }));

  async function save() {
    if (!saved || !draft) return;
    setSaving(true);
    try {
      /* Seules les catégories réellement modifiées sont envoyées */
      const groups: Record<string, { push?: boolean; email?: boolean }> = {};
      for (const { key } of ROWS) for (const ch of ['push', 'email'] as const) {
        if (draft.groups[key]?.[ch] !== saved.groups[key]?.[ch]) (groups[key] ??= {})[ch] = draft.groups[key][ch];
      }
      const view = await settingsApi.updateNotifs({ global: draft.global, dnd: draft.dnd, groups });
      setSaved(view); setDraft(view);
      onToast(t('settingsPage.notifs.toastSaved'));
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <div className={s.card}><div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}><i className="fas fa-circle-notch fa-spin" /></div></div>
  );

  if (error || !draft) return (
    <div className={s.card}>
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
        {t('settingsPage.notifs.loadError')}{' '}
        <button type="button" className={s.linkBtn} onClick={() => { setLoading(true); load(); }}>{t('settingsPage.notifs.reessayer')}</button>
      </div>
    </div>
  );

  return (
    <>
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoAmber}`}><i className="fas fa-bell" /></div>
            <div><div className={s.cardH}>{t('settingsPage.notifs.titre')}</div><div className={s.cardSub}>{t('settingsPage.notifs.subtitle')}</div></div>
          </div>
          <button className={s.cardAction} onClick={save} disabled={saving || !dirty}>
            {saving ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.notifs.enregistrement')}</> : t('settingsPage.notifs.enregistrer')}
          </button>
        </div>

        <div className={s.cardBody}>
          {/* Canaux globaux */}
          <div className={s.privRow}>
            <div className={s.privLeft}>
              <div className={`${s.privIco} ${s.icoBlue}`}><i className="fas fa-mobile-screen" /></div>
              <div><div className={s.privTitle}>{t('settingsPage.notifs.globalPush')}</div><div className={s.privDesc}>{t('settingsPage.notifs.globalPushDesc')}</div></div>
            </div>
            <Toggle checked={draft.global.push} onChange={v => setGlobal('push', v)} />
          </div>
          <div className={s.privRow}>
            <div className={s.privLeft}>
              <div className={`${s.privIco} ${s.icoTeal}`}><i className="fas fa-envelope" /></div>
              <div><div className={s.privTitle}>{t('settingsPage.notifs.globalEmail')}</div><div className={s.privDesc}>{t('settingsPage.notifs.globalEmailDesc')}</div></div>
            </div>
            <Toggle checked={draft.global.email} onChange={v => setGlobal('email', v)} />
          </div>

          {/* Catégories × canaux */}
          {ROWS.map(({ key, ico, icon }) => (
            <div key={key} className={s.notifRow}>
              <div className={s.notifLeft}>
                <div className={`${s.notifIco} ${(s as any)[ico]}`}><i className={`fas ${icon}`} /></div>
                <div>
                  <div className={s.notifTitle}>{t(`settingsPage.notifs.rows.${key}.title`)}</div>
                  <div className={s.notifDesc}>{t(`settingsPage.notifs.rows.${key}.desc`)}</div>
                </div>
              </div>
              <div className={s.notifChannels}>
                {(['email', 'push'] as const).map(ch => (
                  <div key={ch} className={s.notifCh}>
                    <Toggle
                      checked={!!draft.groups[key]?.[ch] && draft.global[ch]}
                      disabled={!draft.global[ch]}
                      onChange={v => setGroup(key, ch, v)}
                    />
                    <span>{t(`settingsPage.notifs.${ch}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ne pas déranger */}
      <div className={s.card}>
        <div className={s.cardHd}>
          <div className={s.cardTitle}>
            <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-moon" /></div>
            <div><div className={s.cardH}>{t('settingsPage.notifs.dndTitre')}</div><div className={s.cardSub}>{t('settingsPage.notifs.dndDesc')}</div></div>
          </div>
          <Toggle checked={draft.dnd.enabled} onChange={v => setDnd({ enabled: v })} />
        </div>
        {draft.dnd.enabled && (
          <div className={s.cardBody} style={{ padding: '4px 24px 20px' }}>
            <div className={s.editGrid}>
              <div className={s.field}>
                <label htmlFor="dnd-start">{t('settingsPage.notifs.dndDebut')}</label>
                <input id="dnd-start" type="time" value={draft.dnd.start} onChange={e => setDnd({ start: e.target.value })} />
              </div>
              <div className={s.field}>
                <label htmlFor="dnd-end">{t('settingsPage.notifs.dndFin')}</label>
                <input id="dnd-end" type="time" value={draft.dnd.end} onChange={e => setDnd({ end: e.target.value })} />
              </div>
              <div className={`${s.field} ${s.fieldFull}`}>
                <label htmlFor="dnd-tz">{t('settingsPage.notifs.dndFuseau')}</label>
                <select id="dnd-tz" value={draft.dnd.timezone} onChange={e => setDnd({ timezone: e.target.value })}>
                  {(TIMEZONES.includes(draft.dnd.timezone) ? TIMEZONES : [draft.dnd.timezone, ...TIMEZONES]).map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <span className={s.fieldHint}>{t('settingsPage.notifs.dndHint')}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'var(--sky)', border: '1px solid var(--sky-3)', borderRadius: 'var(--r-md)', padding: '14px 16px', fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
        <i className="fas fa-circle-info" style={{ color: 'var(--blue)', flexShrink: 0, marginTop: 2 }} />
        <div>{t('settingsPage.notifs.note')}</div>
      </div>
    </>
  );
}
