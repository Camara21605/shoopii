/* ================================================================
 * src/modules/home/components/settings/sections/ActiviteSection.tsx
 * CONNECTÉ — GET /client/parametres/activite
 *
 * Journal RÉEL du compte (connexions réussies/échouées, déconnexions,
 * changements de mot de passe / e-mail / téléphone…), filtrable par rubrique,
 * avec « Voir plus » et export CSV fabriqué ici à partir des lignes chargées
 * (avant : journal toujours vide et faux « vous recevrez un e-mail »).
 * ================================================================ */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type ActiviteItem } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

type Filter = 'all' | ActiviteItem['type'];
const FILTERS: Filter[] = ['all', 'login', 'security', 'alert', 'profile'];
const PAGE = 50;

/** Échappe une cellule CSV (guillemets, séparateurs, retours ligne) et neutralise les formules Excel. */
const csvCell = (v: string) => {
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export default function ActiviteSection({ onToast }: Props) {
  const { t, i18n } = useTranslation();
  const TYPE_CONFIG = {
    login:    { dot: s.actDotOk,   badge: 'badgeLogin' as const,    icon: 'fa-right-to-bracket', label: t('settingsPage.activite.types.login')   },
    order:    { dot: s.actDotInfo, badge: 'badgeOrder' as const,    icon: 'fa-bag-shopping',     label: t('settingsPage.activite.types.order')    },
    security: { dot: s.actDotWarn, badge: 'badgeSecurity' as const, icon: 'fa-key',              label: t('settingsPage.activite.types.security') },
    alert:    { dot: s.actDotBad,  badge: 'badgeAlert' as const,    icon: 'fa-triangle-exclamation', label: t('settingsPage.activite.types.alert') },
    profile:  { dot: s.actDotOk,   badge: 'badgeOrder' as const,    icon: 'fa-user',             label: t('settingsPage.activite.types.profile') },
  };
  const [entries,  setEntries]  = useState<ActiviteItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);
  const [limit,    setLimit]    = useState(PAGE);
  const [filter,   setFilter]   = useState<Filter>('all');

  const load = useCallback(async (n: number) => {
    setError(false);
    try { setEntries(await settingsApi.getActivite(n)); }
    catch { setError(true); onToast(t('settingsPage.activite.loadError')); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(limit); }, [load, limit]);

  const shown = useMemo(() => entries.filter(e => filter === 'all' || e.type === filter), [entries, filter]);
  const title = (e: ActiviteItem) => t(`settingsPage.activite.events.${e.code}`, { defaultValue: e.title });
  const when  = (iso: string) => new Date(iso).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });

  function handleExport() {
    if (!shown.length) { onToast(t('settingsPage.activite.aucuneActivite')); return; }
    const head = ['date', 'evenement', 'rubrique', 'appareil', 'lieu', 'ip', 'resultat'].map(csvCell).join(';');
    const rows = shown.map(e => [
      new Date(e.time).toISOString(), title(e), TYPE_CONFIG[e.type]?.label ?? e.type, e.device, e.location, e.ip,
      e.success ? 'ok' : 'echec',
    ].map(csvCell).join(';'));
    /* BOM UTF-8 : Excel affiche correctement les accents */
    const blob = new Blob(['﻿' + [head, ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `shoneya-journal-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast(t('settingsPage.activite.exportOk', { count: shown.length }));
  }

  return (
    <div className={s.card}>
      <div className={s.cardHd}>
        <div className={s.cardTitle}>
          <div className={`${s.cardIco} ${s.icoNavy}`}><i className="fas fa-clock-rotate-left" /></div>
          <div>
            <div className={s.cardH}>{t('settingsPage.activite.titre')}</div>
            <div className={s.cardSub}>{t('settingsPage.activite.subtitle')}</div>
          </div>
        </div>
        <button className={`${s.cardAction} ${s.cardActionOutline}`} onClick={handleExport} disabled={loading || !shown.length}>
          <i className="fas fa-download" /> {t('settingsPage.activite.exporter')}
        </button>
      </div>

      <div className={s.actFilters} role="tablist" aria-label={t('settingsPage.activite.filtres.label')}>
        {FILTERS.map(f => (
          <button key={f} type="button" role="tab" aria-selected={filter === f}
            className={`${s.actFilter} ${filter === f ? s.actFilterOn : ''}`} onClick={() => setFilter(f)}>
            {t(`settingsPage.activite.filtres.${f}`)}
          </button>
        ))}
      </div>

      <div className={s.cardBody}>
        {loading && (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
          </div>
        )}
        {!loading && error && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.activite.loadErrorInline')}{' '}
            <button type="button" className={s.linkBtn} onClick={() => { setLoading(true); load(limit); }}>{t('settingsPage.activite.reessayer')}</button>
          </div>
        )}
        {!loading && !error && shown.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.activite.aucuneActivite')}
          </div>
        )}
        {shown.map((e, i) => {
          const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.login;
          return (
            <div key={`${e.time}-${i}`} className={s.actRow}>
              <div className={`${s.actDot} ${e.success ? cfg.dot : s.actDotBad}`} />
              <div className={s.actInfo}>
                <div className={s.actTitle}>{title(e)}</div>
                <div className={s.actMeta}>
                  <span className={`${s.actBadge} ${s[cfg.badge]}`}>
                    <i className={`fas ${cfg.icon}`} style={{ fontSize:9 }} /> {cfg.label}
                  </span>
                  {e.device && <span>{e.device}</span>}
                  {e.location && <span><i className="fas fa-map-marker-alt" style={{ fontSize:9 }} /> {e.location}</span>}
                  {e.ip && <span className={s.actIp}>{e.ip}</span>}
                </div>
              </div>
              <div className={s.actTime}>{when(e.time)}</div>
            </div>
          );
        })}
        {!loading && !error && entries.length >= limit && limit < 200 && (
          <div style={{ padding: '14px 24px 18px', textAlign: 'center' }}>
            <button type="button" className={`${s.cardAction} ${s.cardActionOutline}`} onClick={() => { setLoading(true); setLimit(l => Math.min(l + PAGE, 200)); }}>
              {t('settingsPage.activite.voirPlus')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
