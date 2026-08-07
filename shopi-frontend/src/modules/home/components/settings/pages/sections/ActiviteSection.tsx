/* ================================================================
 * src/modules/home/components/settings/sections/ActiviteSection.tsx
 * CONNECTÉ — GET /client/parametres/activite
 * ================================================================ */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../styles/SettingsCard.module.css';
import { settingsApi, type ActiviteItem } from '../../api/settings.api';

interface Props { onToast: (msg: string) => void; }

export default function ActiviteSection({ onToast }: Props) {
  const { t } = useTranslation();
  const TYPE_CONFIG = {
    login:    { dot: s.actDotOk,   badge: 'badgeLogin' as const,    icon: 'fa-right-to-bracket', label: t('settingsPage.activite.types.login')   },
    order:    { dot: s.actDotInfo, badge: 'badgeOrder' as const,    icon: 'fa-bag-shopping',     label: t('settingsPage.activite.types.order')    },
    security: { dot: s.actDotWarn, badge: 'badgeSecurity' as const, icon: 'fa-key',              label: t('settingsPage.activite.types.security') },
    alert:    { dot: s.actDotBad,  badge: 'badgeAlert' as const,    icon: 'fa-triangle-exclamation', label: t('settingsPage.activite.types.alert') },
    profile:  { dot: s.actDotOk,   badge: 'badgeOrder' as const,    icon: 'fa-user',             label: t('settingsPage.activite.types.profile') },
  };
  const [entries,  setEntries]  = useState<ActiviteItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [exporting,setExporting]= useState(false);

  useEffect(() => {
    settingsApi.getActivite()
      .then(setEntries)
      .catch(() => onToast(t('settingsPage.activite.loadError')))
      .finally(() => setLoading(false));
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await settingsApi.exportJournal();
      onToast(`📥 ${res.message}`);
    } catch (err: any) { onToast(`❌ ${err.message}`); }
    finally { setExporting(false); }
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
        <button className={`${s.cardAction} ${s.cardActionOutline}`} onClick={handleExport} disabled={exporting}>
          {exporting ? <><i className="fas fa-circle-notch fa-spin" /> {t('settingsPage.activite.exportEnCours')}</> : <><i className="fas fa-download" /> {t('settingsPage.activite.exporter')}</>}
        </button>
      </div>
      <div className={s.cardBody}>
        {loading && (
          <div style={{ padding:'48px 24px', textAlign:'center', color:'var(--t3)' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize:24 }} />
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div style={{ padding:'24px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
            {t('settingsPage.activite.aucuneActivite')}
          </div>
        )}
        {entries.map((e, i) => {
          const cfg = TYPE_CONFIG[e.type] ?? TYPE_CONFIG.login;
          return (
            <div key={i} className={s.actRow}>
              <div className={`${s.actDot} ${cfg.dot}`} />
              <div className={s.actInfo}>
                <div className={s.actTitle}>{e.title}</div>
                <div className={s.actMeta}>
                  <span className={`${s.actBadge} ${s[cfg.badge]}`}>
                    <i className={`fas ${cfg.icon}`} style={{ fontSize:9 }} /> {cfg.label}
                  </span>
                  {e.meta.map((m, mi) => <span key={mi}>{m}</span>)}
                  {e.ip && <span className={s.actIp}>{e.ip}</span>}
                </div>
              </div>
              <div className={s.actTime}>{e.time}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
