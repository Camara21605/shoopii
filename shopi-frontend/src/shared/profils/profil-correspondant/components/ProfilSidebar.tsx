/* ================================================================
 * FICHIER : profil-correspondant/components/ProfilSidebar.tsx
 * ================================================================ */

import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ProfilCorrespondant.module.css';
import FollowButton from '../../../components/FollowButton';
import type { ContactRow, VerifRow, SimilaireItem } from '../data/types';

interface Props {
  id:            string;
  nom:           string;
  contacts:      ContactRow[];
  stats:         { v: string; l: string }[];
  abonnes:       number;
  verifications: VerifRow[];
  similaires:    SimilaireItem[];
  suivi:         boolean;
  callLoading?:  boolean;
  onRequireAuth: () => void;
  onFollowChange:(next: { isSuivi: boolean }) => void;
  onMessage:     () => void;
  onCall?:       () => void;
  onToast:       (m: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

export default function ProfilSidebar({
  id, nom, contacts, stats, abonnes, verifications, similaires,
  suivi, callLoading, onRequireAuth, onFollowChange, onMessage, onCall, onToast,
}: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const prenom = nom.split(' ')[0];

  return (
    <aside>
      {/* Contacter */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-headset" /> {t('profilCorrespondant.sidebar.contacterPrenom', { prenom })}</div></div>
        <div className={styles.cb}>
          <div className={styles.sideBtns}>
            <button className={`${styles.sideBtn} ${styles.sbPrimary}`} onClick={onMessage}>
              <i className="fas fa-comment-dots" /> {t('profilCorrespondant.sidebar.envoyerMessage')}
            </button>
            <button className={`${styles.sideBtn} ${styles.sbWa}`} onClick={() => onToast(t('profilCorrespondant.sidebar.whatsappToast'))}>
              <i className="fab fa-whatsapp" /> WhatsApp
            </button>
            <button
              className={`${styles.sideBtn} ${styles.sbCall}`}
              onClick={onCall ?? (() => onToast(t('profilCorrespondant.sidebar.appelToast')))}
              disabled={callLoading}
            >
              {callLoading
                ? <><i className="fas fa-spinner fa-spin" /> …</>
                : <><i className="fas fa-phone" /> {t('profilCorrespondant.appeler')}</>}
            </button>
          </div>
        </div>
      </div>

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

      {/* Abonnés */}
      <div className={styles.card} style={{ position: 'relative' }}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-users" /> {t('profilCorrespondant.sidebar.abonnesTitle')}</div></div>
        <div className={styles.cb}>
          <div className={styles.folWrap}>
            <span className={styles.folCnt} style={{ marginRight: 8 }}>
              {abonnes > 0
                ? t('profilCorrespondant.sidebar.abonneCount', { count: abonnes })
                : t('profilCorrespondant.sidebar.aucunAbonne')}
            </span>
          </div>
          <FollowButton
            actorType="correspondant"
            id={id}
            name={nom}
            isSuivi={suivi}
            onToast={onToast}
            onRequireAuth={onRequireAuth}
            onChange={onFollowChange}
          />
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
