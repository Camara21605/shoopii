/* ================================================================
 * FICHIER : src/dashboards/administrateur/components/GenerateCodeModal.tsx
 *
 * Modale de génération de code en 2 étapes.
 * Spécificité admin : le type PARTENAIRE est disponible
 * (préfixe PAR), en plus de ENT / LVR / COR.
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/GenerateCodeModal.module.css';
import type { ActeurType } from '../data/types';

interface GenerateCodeModalProps {
  onClose:    () => void;
  onGenerate: (type: ActeurType) => string;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

/* L'admin peut créer tous les types — partenaire par défaut */
const TYPES: { id: ActeurType; icon: string; label: string }[] = [
  { id: 'par', icon: 'fa-handshake',  label: 'Partenaire' },
  { id: 'ent', icon: 'fa-store',      label: 'Entreprise' },
  { id: 'lvr', icon: 'fa-motorcycle', label: 'Livreur' },
  { id: 'cor', icon: 'fa-map-pin',    label: 'Correspondant' },
];

export default function GenerateCodeModal({ onClose, onGenerate, onToast }: GenerateCodeModalProps) {
  const [step, setStep]       = useState<1 | 2>(1);
  const [selType, setSelType] = useState<ActeurType>('par');
  const [nom, setNom]         = useState('');
  const [tel, setTel]         = useState('');
  const [code, setCode]       = useState('');

  /* Étape 1 → 2 : génère le code et passe au résultat */
  const generer = () => {
    const c = onGenerate(selType);
    setCode(c);
    setStep(2);
    onToast(`✅ Code généré${nom.trim() ? ' pour ' + nom.trim() : ''}`, 's');
  };

  /* Copie le code dans le presse-papier */
  const copier = () => {
    navigator.clipboard?.writeText(code);
    onToast('📋 Code copié : ' + code, 's');
  };

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        {/* ── Étape 1 : choix du type + destinataire ── */}
        {step === 1 && (
          <>
            <div className={styles.head}>
              <div className={styles.title}>Générer un code de création</div>
              <div className={styles.sub}>
                L&apos;administrateur peut créer tous les types de comptes, y compris des partenaires.
              </div>
            </div>
            <div className={styles.body}>
              <div className={styles.fld}>
                <label className={styles.fldL}>Type d&apos;acteur</label>
                <div className={styles.typeGrid}>
                  {TYPES.map(t => (
                    <div key={t.id}
                      className={`${styles.typeOpt} ${styles['t_' + t.id]} ${selType === t.id ? styles.onOpt : ''}`}
                      onClick={() => setSelType(t.id)}>
                      <i className={`fas ${t.icon}`} />
                      <div className={styles.typeNm}>{t.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Nom du destinataire (optionnel)</label>
                <input className={styles.fldIn} value={nom} onChange={e => setNom(e.target.value)}
                  placeholder="Ex. Fatoumata Camara" />
              </div>
              <div className={styles.fld}>
                <label className={styles.fldL}>Téléphone (optionnel)</label>
                <input className={styles.fldIn} value={tel} onChange={e => setTel(e.target.value)}
                  placeholder="+224 6•• •• •• ••" inputMode="tel" />
              </div>
              <button className={styles.mBtn} onClick={generer}>
                <i className="fas fa-bolt" /> Générer le code
              </button>
            </div>
          </>
        )}

        {/* ── Étape 2 : affiche le code + options d'envoi ── */}
        {step === 2 && (
          <>
            <div className={styles.head}>
              <div className={styles.title}>Code généré ✓</div>
              <div className={styles.sub}>Envoyez-le au destinataire — le compte créé sera rattaché à votre zone.</div>
            </div>
            <div className={styles.body}>
              <div className={styles.result}>
                <div className={styles.resultL}>Code de création</div>
                <div className={styles.resultV}>{code}</div>
                <div className={styles.resultExp}>
                  <i className="fas fa-clock" /> Valable 7 jours · usage unique · Zone Conakry
                </div>
              </div>
              <div className={styles.sendRow}>
                <button className={`${styles.sendBtn} ${styles.sendWa}`}
                  onClick={() => onToast('📱 Ouverture de WhatsApp…', 's')}>
                  <i className="fab fa-whatsapp" /> WhatsApp
                </button>
                <button className={`${styles.sendBtn} ${styles.sendSms}`}
                  onClick={() => onToast('✉️ SMS préparé', 's')}>
                  <i className="fas fa-comment-sms" /> SMS
                </button>
                <button className={`${styles.sendBtn} ${styles.sendCopy}`} onClick={copier}>
                  <i className="fas fa-copy" /> Copier
                </button>
              </div>
              <button className={styles.mBtn} onClick={onClose} style={{ marginTop: 16 }}>
                <i className="fas fa-check" /> Terminé
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
