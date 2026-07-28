/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/GenerateCodeModal.tsx
 *
 * Modale de génération d'un code de création de compte.
 * Étape 1 : choix du type d'acteur + destinataire (optionnel).
 * Étape 2 : code généré + boutons d'envoi (WhatsApp/SMS/Copier).
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/GenerateCodeModal.module.css';
import type { ActeurType } from '../data/types';

interface Props {
  onClose:    () => void;
  onGenerate: (type: ActeurType, targetEmail?: string) => Promise<string>;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

const TYPES: { id: ActeurType; icon: string; label: string }[] = [
  { id: 'ent', icon: 'fa-store',      label: 'Entreprise' },
  { id: 'lvr', icon: 'fa-motorcycle', label: 'Livreur' },
  { id: 'cor', icon: 'fa-map-pin',    label: 'Correspondant' },
  { id: 'cli', icon: 'fa-user',       label: 'Client VIP' },
];

export default function GenerateCodeModal({ onClose, onGenerate, onToast }: Props) {
  const [step, setStep]     = useState<1 | 2>(1);
  const [type, setType]     = useState<ActeurType>('ent');
  const [email, setEmail]   = useState('');
  const [code, setCode]     = useState('');
  const [busy, setBusy]     = useState(false);

  async function generate() {
    setBusy(true);
    try {
      const c = await onGenerate(type, email.trim() || undefined);
      setCode(c);
      setStep(2);
      onToast(`Code généré${email ? ' pour ' + email : ''}`, 's');
    } catch {
      onToast('Erreur lors de la génération du code', 'w');
    } finally {
      setBusy(false);
    }
  }

  function copy() { navigator.clipboard?.writeText(code); onToast('Code copié : ' + code, 's'); }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        {step === 1 ? (
          <>
            <div className={styles.head}>
              <div className={styles.title}>Générer un code de création</div>
              <div className={styles.sub}>Choisissez le type d'acteur à recruter</div>
            </div>
            <div className={styles.body}>
              <div className={styles.fld}>
                <label className={styles.lbl}>Type d'acteur</label>
                <div className={styles.typeGrid}>
                  {TYPES.map(t => (
                    <div key={t.id}
                      className={`${styles.typeOpt} ${styles['t_' + t.id]} ${type === t.id ? styles.on : ''}`}
                      onClick={() => setType(t.id)}>
                      <i className={`fas ${t.icon}`} />
                      <div className={styles.typeNm}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.fld}>
                <label className={styles.lbl}>Email du destinataire (optionnel)</label>
                <input
                  className={styles.in}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Ex. contact@techcorp.gn"
                />
              </div>
              <button className={styles.btn} onClick={generate} disabled={busy}>
                {busy
                  ? <><i className="fas fa-spinner fa-spin" /> Génération…</>
                  : <><i className="fas fa-bolt" /> Générer le code</>
                }
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.head}>
              <div className={styles.title}>Code généré ✓</div>
              <div className={styles.sub}>Envoyez-le au destinataire pour qu'il crée son compte</div>
            </div>
            <div className={styles.body}>
              <div className={styles.result}>
                <div className={styles.resultL}>Code de création</div>
                <div className={styles.resultV}>{code}</div>
                <div className={styles.resultExp}><i className="fas fa-clock" /> Valable 7 jours · usage unique</div>
              </div>
              <div className={styles.sendRow}>
                <button className={`${styles.sendBtn} ${styles.wa}`} onClick={() => onToast('Ouverture de WhatsApp…', 's')}><i className="fab fa-whatsapp" /> WhatsApp</button>
                <button className={`${styles.sendBtn} ${styles.sms}`} onClick={() => onToast('SMS préparé', 's')}><i className="fas fa-comment-sms" /> SMS</button>
                <button className={`${styles.sendBtn} ${styles.copy}`} onClick={copy}><i className="fas fa-copy" /> Copier</button>
              </div>
              <button className={styles.btn} style={{ marginTop: 16 }} onClick={onClose}><i className="fas fa-check" /> Terminé</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
