/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/CodesPage.tsx
 * Codes de création : stats + historique — données réelles.
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/CodesPage.module.css';
import { TYPE_ICON } from '../data/partenaireData';
import { apiFetch } from '@/shared/services/apiFetch';
import type { CodeStatut } from '../data/types';

interface Props {
  onGenerate: () => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

interface CodeRow {
  id: string;
  code: string;
  type: string;
  destinataire: string | null;
  statut: CodeStatut;
  creeLe: string;
  utilisePar: string | null;
  usedAt: string | null;
}

interface CodesData {
  stats: { total: number; used: number; pending: number; expired: number };
  codes: CodeRow[];
}

export default function CodesPage({ onGenerate, onToast }: Props) {
  const { t } = useTranslation();
  const [data, setData]       = useState<CodesData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch<CodesData>('/dashboard/partenaire/codes')
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  function copy(code: string) {
    navigator.clipboard?.writeText(code);
    onToast(t('partenaireCodes.copiedToast', { code }), 's');
  }

  return (
    <div>
      {/* Bandeau */}
      <div className={styles.codeHero}>
        <div className={styles.glow} />
        <div className={styles.heroIn}>
          <h3>{t('partenaireCodes.page.heroTitle')}</h3>
          <p>{t('partenaireCodes.page.heroParagraph')}</p>
        </div>
        <button className={styles.heroBtn} onClick={onGenerate}><i className="fas fa-plus" /> {t('partenaireCodes.page.generateBtn')}</button>
      </div>

      {/* Stats */}
      {data && (
        <div className={styles.stats}>
          <div className={styles.stat}><div className={styles.statV}>{data.stats.total}</div><div className={styles.statL}>{t('partenaireCodes.page.stats.total')}</div></div>
          <div className={styles.stat}><div className={`${styles.statV} ${styles.g}`}>{data.stats.used}</div><div className={styles.statL}>{t('partenaireCodes.page.stats.used')}</div></div>
          <div className={styles.stat}><div className={`${styles.statV} ${styles.a}`}>{data.stats.pending}</div><div className={styles.statL}>{t('partenaireCodes.page.stats.pending')}</div></div>
          <div className={styles.stat}><div className={styles.statV}>{data.stats.expired}</div><div className={styles.statL}>{t('partenaireCodes.page.stats.expired')}</div></div>
        </div>
      )}

      {/* Tableau */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.chT}><i className="fas fa-qrcode" /> {t('partenaireCodes.page.tableTitle')}</div></div>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}><i className="fas fa-spinner fa-spin" /></div>
        ) : !data || data.codes.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>{t('partenaireCodes.page.empty')}</div>
        ) : (
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('partenaireCodes.page.columns.code')}</th>
                  <th>{t('partenaireCodes.page.columns.type')}</th>
                  <th>{t('partenaireCodes.page.columns.destinataire')}</th>
                  <th>{t('partenaireCodes.page.columns.statut')}</th>
                  <th>{t('partenaireCodes.page.columns.creeLe')}</th>
                  <th>{t('partenaireCodes.page.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data.codes.map(c => (
                  <tr key={c.id}>
                    <td>
                      <span className={`${styles.codePill} ${c.statut === 'expired' ? styles.codeExp : ''}`}>
                        {c.code}
                        <i className={`fas fa-copy ${styles.copy}`} onClick={() => copy(c.code)} />
                      </span>
                    </td>
                    <td><span className={`${styles.typePill} ${styles['t_' + c.type]}`}><i className={`fas ${TYPE_ICON[c.type] ?? 'fa-user'}`} /> {t(`partenaireCodes.types.${c.type}`, { defaultValue: c.type })}</span></td>
                    <td>{c.destinataire ?? '—'}</td>
                    <td><span className={`${styles.stPill} ${styles['st_' + c.statut]}`}>{t(`partenaireCodes.statuts.${c.statut}`)}</span></td>
                    <td>{c.creeLe}</td>
                    <td>
                      <div className={styles.rowAct}>
                        {c.statut === 'sent' && (
                          <>
                            <button className={`${styles.raBtn} ${styles.wa}`} title={t('partenaireCodes.page.resendWhatsappTitle')} onClick={() => onToast(t('partenaireCodes.page.resendWhatsappToast'), 's')}><i className="fab fa-whatsapp" /></button>
                            <button className={styles.raBtn} title={t('partenaireCodes.page.resendSmsTitle')} onClick={() => onToast(t('partenaireCodes.page.resendSmsToast'), 's')}><i className="fas fa-comment-sms" /></button>
                          </>
                        )}
                        {c.statut === 'used' && c.utilisePar && (
                          <button className={styles.raBtn} title={t('partenaireCodes.page.usedByTitle', { name: c.utilisePar })} onClick={() => onToast(t('partenaireCodes.page.usedByToast', { name: c.utilisePar }), 'i')}><i className="fas fa-eye" /></button>
                        )}
                        {c.statut === 'expired' && (
                          <button className={styles.raBtn} title={t('partenaireCodes.page.regenerateTitle')} onClick={onGenerate}><i className="fas fa-rotate" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
