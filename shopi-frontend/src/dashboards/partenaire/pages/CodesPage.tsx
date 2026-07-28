/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/CodesPage.tsx
 * Codes de création : stats + historique — données réelles.
 * ================================================================ */

import { useState, useEffect } from 'react';
import styles from '../styles/CodesPage.module.css';
import { TYPE_LABEL, TYPE_ICON } from '../data/partenaireData';
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

const ST_LABEL: Record<CodeStatut, string> = { used: 'Utilisé', sent: 'Envoyé', expired: 'Expiré' };

export default function CodesPage({ onGenerate, onToast }: Props) {
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
    onToast('Code copié : ' + code, 's');
  }

  return (
    <div>
      {/* Bandeau */}
      <div className={styles.codeHero}>
        <div className={styles.glow} />
        <div className={styles.heroIn}>
          <h3>Codes de création de compte</h3>
          <p>Générez un code unique, choisissez le type d'acteur, et envoyez-le. L'acteur l'utilise pour créer son compte — il sera automatiquement rattaché à vous.</p>
        </div>
        <button className={styles.heroBtn} onClick={onGenerate}><i className="fas fa-plus" /> Générer un code</button>
      </div>

      {/* Stats */}
      {data && (
        <div className={styles.stats}>
          <div className={styles.stat}><div className={styles.statV}>{data.stats.total}</div><div className={styles.statL}>Codes générés</div></div>
          <div className={styles.stat}><div className={`${styles.statV} ${styles.g}`}>{data.stats.used}</div><div className={styles.statL}>Utilisés (compte créé)</div></div>
          <div className={styles.stat}><div className={`${styles.statV} ${styles.a}`}>{data.stats.pending}</div><div className={styles.statL}>En attente d'utilisation</div></div>
          <div className={styles.stat}><div className={styles.statV}>{data.stats.expired}</div><div className={styles.statL}>Expirés</div></div>
        </div>
      )}

      {/* Tableau */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.chT}><i className="fas fa-qrcode" /> Historique des codes</div></div>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}><i className="fas fa-spinner fa-spin" /></div>
        ) : !data || data.codes.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>Aucun code généré pour l'instant</div>
        ) : (
          <div className={styles.tblWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Code</th><th>Type d'acteur</th><th>Destinataire</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr>
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
                    <td><span className={`${styles.typePill} ${styles['t_' + c.type]}`}><i className={`fas ${TYPE_ICON[c.type] ?? 'fa-user'}`} /> {TYPE_LABEL[c.type] ?? c.type}</span></td>
                    <td>{c.destinataire ?? '—'}</td>
                    <td><span className={`${styles.stPill} ${styles['st_' + c.statut]}`}>{ST_LABEL[c.statut]}</span></td>
                    <td>{c.creeLe}</td>
                    <td>
                      <div className={styles.rowAct}>
                        {c.statut === 'sent' && (
                          <>
                            <button className={`${styles.raBtn} ${styles.wa}`} title="Renvoyer via WhatsApp" onClick={() => onToast('Code renvoyé via WhatsApp', 's')}><i className="fab fa-whatsapp" /></button>
                            <button className={styles.raBtn} title="SMS" onClick={() => onToast('Code renvoyé par SMS', 's')}><i className="fas fa-comment-sms" /></button>
                          </>
                        )}
                        {c.statut === 'used' && c.utilisePar && (
                          <button className={styles.raBtn} title={`Utilisé par ${c.utilisePar}`} onClick={() => onToast(`Compte créé par ${c.utilisePar}`, 'i')}><i className="fas fa-eye" /></button>
                        )}
                        {c.statut === 'expired' && (
                          <button className={styles.raBtn} title="Régénérer" onClick={onGenerate}><i className="fas fa-rotate" /></button>
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
