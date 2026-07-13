/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/CodesPage.tsx
 *
 * Codes de création de la zone. Spécificités admin :
 * type Partenaire disponible + pouvoir de révoquer un code.
 * ================================================================ */

import styles from '../styles/CodesPage.module.css';
import { CODES, TYPE_LABEL, TYPE_ICON } from '../data/adminData';

interface CodesPageProps {
  onGenerate: () => void;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* Labels des statuts de code */
const ST_LABEL: Record<string, string> = { used: 'Utilisé', sent: 'Envoyé', expired: 'Expiré' };

export default function CodesPage({ onGenerate, onToast }: CodesPageProps) {
  const copier = (code: string) => {
    navigator.clipboard?.writeText(code);
    onToast('📋 Code copié : ' + code, 's');
  };

  return (
    <div>
      {/* ── Héro codes ── */}
      <div className={styles.codeHero}>
        <div className={styles.glow} />
        <div className={styles.heroIn}>
          <h3>Codes de création — Zone Conakry</h3>
          <p>
            En tant qu&apos;administrateur, vous pouvez créer des comptes de tout type, y compris
            des <b>partenaires</b>. L&apos;acteur qui s&apos;inscrit avec votre code est rattaché à votre zone.
          </p>
        </div>
        <button className={styles.heroBtn} onClick={onGenerate}>
          <i className="fas fa-plus" /> Générer un code
        </button>
      </div>

      {/* ── Statistiques ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={styles.cstatV}>38</div><div className={styles.cstatL}>Codes générés (mois)</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>29</div><div className={styles.cstatL}>Utilisés (compte créé)</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>5</div><div className={styles.cstatL}>En attente</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>4</div><div className={styles.cstatL}>Expirés</div></div>
      </div>

      {/* ── Historique des codes ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-qrcode" /> Historique des codes</div>
          <button className={styles.exportBtn} onClick={() => onToast('📄 Export CSV des codes lancé', 'i')}>
            <i className="fas fa-download" /> Exporter
          </button>
        </div>
        <div className={styles.tblWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Code</th><th>Type</th><th>Destinataire</th><th>Statut</th><th>Créé le</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {CODES.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className={styles.codePill} style={c.statut === 'expired' ? { opacity: .55 } : undefined}>
                      {c.code}
                      <i className={`fas fa-copy ${styles.codeCopy}`} onClick={() => copier(c.code)} />
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.typePill} ${styles['t_' + c.type]}`}>
                      <i className={`fas ${TYPE_ICON[c.type]}`} /> {TYPE_LABEL[c.type]}
                    </span>
                  </td>
                  <td>{c.destinataire ?? '—'}</td>
                  <td><span className={`${styles.stPill} ${styles['st_' + c.statut]}`}>{ST_LABEL[c.statut]}</span></td>
                  <td>{c.creeLe}</td>
                  <td>
                    <div className={styles.rowAct}>
                      {c.statut === 'sent' && (
                        <>
                          <button className={`${styles.raBtn} ${styles.wa}`} title="WhatsApp"
                            onClick={() => onToast('📱 Renvoyé via WhatsApp', 's')}>
                            <i className="fab fa-whatsapp" />
                          </button>
                          <button className={styles.raBtn} title="SMS"
                            onClick={() => onToast('✉️ Renvoyé par SMS', 's')}>
                            <i className="fas fa-comment-sms" />
                          </button>
                          <button className={`${styles.raBtn} ${styles.danger}`} title="Révoquer"
                            onClick={() => onToast('🚫 Code révoqué', 'w')}>
                            <i className="fas fa-ban" />
                          </button>
                        </>
                      )}
                      {c.statut === 'used' && (
                        <button className={styles.raBtn} title="Détails"
                          onClick={() => onToast('👤 Compte créé le ' + c.creeLe, 'i')}>
                          <i className="fas fa-eye" />
                        </button>
                      )}
                      {c.statut === 'expired' && (
                        <button className={styles.raBtn} title="Régénérer"
                          onClick={() => onToast('🔄 Nouveau code généré', 's')}>
                          <i className="fas fa-rotate" />
                        </button>
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
