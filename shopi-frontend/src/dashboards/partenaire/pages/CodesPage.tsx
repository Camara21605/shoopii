/* ================================================================
 * FICHIER : src/dashboards/partenaire/pages/CodesPage.tsx
 * Codes de création : stats + historique des codes générés.
 * ================================================================ */

import styles from '../styles/CodesPage.module.css';
import { CODES, TYPE_LABEL, TYPE_ICON } from '../data/partenaireData';
import type { CodeStatut } from '../data/types';

interface Props {
  onGenerate: () => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const ST_LABEL: Record<CodeStatut, string> = { used: 'Utilisé', sent: 'Envoyé', expired: 'Expiré' };

export default function CodesPage({ onGenerate, onToast }: Props) {
  function copy(code: string) { navigator.clipboard?.writeText(code); onToast('📋 Code copié : ' + code, 's'); }

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
      <div className={styles.stats}>
        <div className={styles.stat}><div className={styles.statV}>11</div><div className={styles.statL}>Codes générés</div></div>
        <div className={styles.stat}><div className={`${styles.statV} ${styles.g}`}>7</div><div className={styles.statL}>Utilisés (compte créé)</div></div>
        <div className={styles.stat}><div className={`${styles.statV} ${styles.a}`}>3</div><div className={styles.statL}>En attente d'utilisation</div></div>
        <div className={styles.stat}><div className={styles.statV}>1</div><div className={styles.statL}>Expirés</div></div>
      </div>

      {/* Tableau */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.chT}><i className="fas fa-qrcode" /> Historique des codes</div></div>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Code</th><th>Type d'acteur</th><th>Destinataire</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {CODES.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className={`${styles.codePill} ${c.statut === 'expired' ? styles.codeExp : ''}`}>
                      {c.code}
                      <i className={`fas fa-copy ${styles.copy}`} onClick={() => copy(c.code)} />
                    </span>
                  </td>
                  <td><span className={`${styles.typePill} ${styles['t_' + c.type]}`}><i className={`fas ${TYPE_ICON[c.type]}`} /> {TYPE_LABEL[c.type]}</span></td>
                  <td>{c.destinataire ?? '—'}</td>
                  <td><span className={`${styles.stPill} ${styles['st_' + c.statut]}`}>{ST_LABEL[c.statut]}</span></td>
                  <td>{c.creeLe}</td>
                  <td>
                    <div className={styles.rowAct}>
                      {c.statut === 'sent' && (
                        <>
                          <button className={`${styles.raBtn} ${styles.wa}`} title="Renvoyer via WhatsApp" onClick={() => onToast('📱 Code renvoyé via WhatsApp', 's')}><i className="fab fa-whatsapp" /></button>
                          <button className={styles.raBtn} title="SMS" onClick={() => onToast('✉️ Code renvoyé par SMS', 's')}><i className="fas fa-comment-sms" /></button>
                        </>
                      )}
                      {c.statut === 'used' && (
                        <button className={styles.raBtn} title="Détails" onClick={() => onToast('👤 Détails du compte créé', 'i')}><i className="fas fa-eye" /></button>
                      )}
                      {c.statut === 'expired' && (
                        <button className={styles.raBtn} title="Régénérer" onClick={() => onToast('🔄 Nouveau code généré', 's')}><i className="fas fa-rotate" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
