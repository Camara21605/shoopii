/* ================================================================
 * FICHIER : profil-correspondant/components/ProfilSidebar.tsx
 * ================================================================ */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ProfilCorrespondant.module.css';
import type { ContactRow, VerifRow, SimilaireItem } from '../data/types';

interface Props {
  nom:           string;
  contacts:      ContactRow[];
  stats:         { v: string; l: string }[];
  abonnes:       number;
  verifications: VerifRow[];
  similaires:    SimilaireItem[];
  suivi:         boolean;
  onToggle:      () => void;
  onMessage:     () => void;
  onToast:       (m: string) => void;
}

export default function ProfilSidebar({
  nom, contacts, stats, abonnes, verifications, similaires,
  suivi, onToggle, onMessage, onToast,
}: Props) {
  const navigate = useNavigate();
  const prenom = nom.split(' ')[0];

  return (
    <aside>
      {/* Contacter */}
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-headset" /> Contacter {prenom}</div></div>
        <div className={styles.cb}>
          <div className={styles.sideBtns}>
            <button className={`${styles.sideBtn} ${styles.sbPrimary}`} onClick={onMessage}>
              <i className="fas fa-comment-dots" /> Envoyer un message
            </button>
            <button className={`${styles.sideBtn} ${styles.sbWa}`} onClick={() => onToast('📱 WhatsApp')}>
              <i className="fab fa-whatsapp" /> WhatsApp
            </button>
            <button className={`${styles.sideBtn} ${styles.sbCall}`} onClick={() => onToast('📞 Appel')}>
              <i className="fas fa-phone" /> Appeler
            </button>
          </div>
        </div>
      </div>

      {/* Contacts détaillés */}
      {contacts.length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-address-book" /> Contacts détaillés</div></div>
          <div className={styles.cb}>
            <div className={styles.contactList}>
              {contacts.map(c => (
                <div key={c.label} className={styles.clRow}>
                  <div className={styles.clIco}><i className={`fas ${c.icone}`} /></div>
                  <div>
                    <div className={styles.clLbl}>{c.label}</div>
                    <div className={styles.clVal}>{c.valeur}</div>
                  </div>
                  <div className={styles.clAction} onClick={() => onToast(`📋 ${c.valeur}`)}>
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
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-chart-simple" /> Statistiques</div></div>
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
      <div className={styles.card}>
        <div className={styles.ch}><div className={styles.ct}><i className="fas fa-users" /> Abonnés</div></div>
        <div className={styles.cb}>
          <div className={styles.folWrap}>
            <span className={styles.folCnt} style={{ marginRight: 8 }}>
              {abonnes > 0
                ? `${abonnes.toLocaleString('fr-FR')} abonné${abonnes > 1 ? 's' : ''}`
                : 'Aucun abonné pour le moment'}
            </span>
          </div>
          <button
            className={`${styles.sideBtn} ${suivi ? styles.sbCall : styles.sbPrimary}`}
            onClick={onToggle}
          >
            {suivi
              ? <><i className="fas fa-user-check" /> Abonné</>
              : <><i className="fas fa-plus" /> Suivre ce correspondant</>}
          </button>
        </div>
      </div>

      {/* Vérifications Shopi */}
      {verifications.length > 0 && (
        <div className={styles.card}>
          <div className={styles.ch}><div className={styles.ct}><i className="fas fa-shield-halved" /> Vérifications Shopi</div></div>
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
            <div className={styles.ct}><i className="fas fa-user-group" /> Correspondants similaires</div>
            <button className={styles.chLink} onClick={() => navigate('/correspondants')}>Voir tout</button>
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
                    onClick={e => { e.stopPropagation(); onToast(`✅ Abonné à ${s.nom}`); }}
                  >
                    + Suivre
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
