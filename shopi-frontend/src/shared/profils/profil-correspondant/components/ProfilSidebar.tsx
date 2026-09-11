/* ================================================================
 * FICHIER : profil-correspondant/components/ProfilSidebar.tsx
 * ================================================================ */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { ContactRow, VerifRow, SimilaireItem } from '../data/types';

interface Props {
  contacts:      ContactRow[];
  stats:         { v: string; l: string }[];
  abonnes:       number;
  verifications: VerifRow[];
  similaires:    SimilaireItem[];
  onToast:       (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

/* Contacter/Appeler/S'abonner retirés de cette sidebar — ils dupliquaient
 * exactement les mêmes actions déjà présentes dans ProfilHeader (bouton
 * "Appeler"/"Contacter"/FollowButton) ; demande explicite de suppression
 * définitive des boutons répétés. */
export default function ProfilSidebar({
  contacts, stats, abonnes, verifications, similaires, onToast,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <aside>
      {/* Contacts détaillés */}
      {contacts.length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-address-book" /> {t('profilCorrespondant.sidebar.contactsDetailles')}</div></div>
          <div className={styles.cb}>
            <div className={styles.contactList}>
              {contacts.map(c => (
                <div key={c.label} className={styles.clRow}>
                  <div className={styles.clIco}><i className={`fas ${c.icone}`} /></div>
                  <div>
                    <div className={styles.clLbl}>{c.label}</div>
                    <div className={styles.clVal}>{c.valeur}</div>
                  </div>
                  <div className={styles.clAction} onClick={() => onToast(t('profilCorrespondant.sidebar.copieToast', { valeur: c.valeur }))}>
                    <i className="fas fa-copy" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Statistiques */}
      {stats.length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-chart-simple" /> {t('profilCorrespondant.sidebar.statistiques')}</div></div>
          <div className={styles.cb}>
            <div className={styles.sbStats}>
              {stats.map(s => (
                <div key={s.l} className={styles.ss}>
                  <div className={styles.ssV}>{s.v}</div>
                  <div className={styles.ssL}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Abonnés — juste le compteur ; le bouton S'abonner reste dans
       * ProfilHeader (retiré ici, c'était le même bouton répété). */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-users" /> {t('profilCorrespondant.sidebar.abonnesTitle')}</div></div>
        <div className={styles.cb}>
          <span className={styles.folCnt}>
            {abonnes > 0
              ? t('profilCorrespondant.sidebar.abonneCount', { count: abonnes })
              : t('profilCorrespondant.sidebar.aucunAbonne')}
          </span>
        </div>
      </div>

      {/* Vérifications Shoneya */}
      {verifications.length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-shield-halved" /> {t('profilCorrespondant.sidebar.verificationsShopi')}</div></div>
          <div className={styles.cb}>
            <div className={styles.verifList}>
              {verifications.map(v => (
                <div key={v.label} className={`${styles.vr} ${styles.vrOk}`}>
                  <i className="fas fa-circle-check" />
                  <div>
                    <div className={styles.vrNm}>{v.label}</div>
                    <div className={styles.vrDt}>{v.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Correspondants similaires (section masquée si vide — pas de données fictives) */}
      {similaires.length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}>
            <div className={styles.ct}><i className="fas fa-user-group" /> {t('profilCorrespondant.sidebar.correspondantsSimilaires')}</div>
            <button className={styles.chLink} onClick={() => navigate('/correspondants')}>{t('profilCorrespondant.sidebar.voirTout')}</button>
          </div>
          <div className={styles.similarList}>
            {similaires.map(s => (
              <div key={s.id} className={styles.simItem} onClick={() => navigate(`/correspondants/${s.id}`)}>
                <div className={styles.simAva}>{s.initiales}</div>
                <div>
                  <div className={styles.simNm}>{s.nom}</div>
                  <div className={styles.simMeta}>{s.meta}</div>
                </div>
                <div className={styles.simRight}>
                  <div className={styles.simNote}>{s.note.toFixed(1)}★</div>
                  <button
                    className={styles.simFbtn}
                    onClick={e => { e.stopPropagation(); onToast(t('profilCorrespondant.sidebar.abonneToast', { nom: s.nom })); }}
                  >
                    {t('profilCorrespondant.sidebar.suivreShort')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
