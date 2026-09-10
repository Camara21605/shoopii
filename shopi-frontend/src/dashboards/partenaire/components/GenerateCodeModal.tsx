/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/GenerateCodeModal.tsx
 *
 * Modale de génération d'un code de création de compte.
 * Étape 1 : choix du type d'acteur + destinataire (optionnel).
 * Étape 2 : code généré + boutons d'envoi (WhatsApp/SMS/Copier).
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/GenerateCodeModal.module.css';
import type { ActeurType } from '../data/types';

interface Props {
  onClose:    () => void;
  onGenerate: (type: ActeurType, targetEmail?: string) => Promise<string>;
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
}

function buildTypes(t: (k: string) => string): { id: ActeurType; icon: string; label: string }[] {
  return [
    { id: 'ent', icon: 'fa-store',      label: t('partenaireCodes.types.ent') },
    { id: 'lvr', icon: 'fa-motorcycle', label: t('partenaireCodes.types.lvr') },
    { id: 'cor', icon: 'fa-map-pin',    label: t('partenaireCodes.types.cor') },
    { id: 'cli', icon: 'fa-user',       label: t('partenaireCodes.types.cli') },
  ];
}

export default function GenerateCodeModal({ onClose, onGenerate, onToast }: Props) {
  const { t } = useTranslation();
  const TYPES = buildTypes(t);
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
      onToast(email ? t('partenaireCodes.modal.generatedForToast', { email }) : t('partenaireCodes.modal.generatedToast'), 's');
    } catch {
      onToast(t('partenaireCodes.modal.errorToast'), 'w');
    } finally {
      setBusy(false);
    }
  }

  function copy() { navigator.clipboard?.writeText(code); onToast(t('partenaireCodes.copiedToast', { code }), 's'); }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        {step === 1 ? (
          <>
            <div className={styles.head}>
              <div className={styles.title}>{t('partenaireCodes.modal.step1.title')}</div>
              <div className={styles.sub}>{t('partenaireCodes.modal.step1.sub')}</div>
            </div>
            <div className={styles.body}>
              <div className={styles.fld}>
                <label className={styles.lbl}>{t('partenaireCodes.modal.step1.typeLabel')}</label>
                <div className={styles.typeGrid}>
                  {TYPES.map(ty => (
                    <div key={ty.id}
                      className={`${styles.typeOpt} ${styles['t_' + ty.id]} ${type === ty.id ? styles.on : ''}`}
                      onClick={() => setType(ty.id)}>
                      <i className={`fas ${ty.icon}`} />
                      <div className={styles.typeNm}>{ty.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.fld}>
                <label className={styles.lbl}>{t('partenaireCodes.modal.step1.emailLabel')}</label>
                <input
                  className={styles.in}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t('partenaireCodes.modal.step1.emailPlaceholder')}
                />
              </div>
              <button className={styles.btn} onClick={generate} disabled={busy}>
                {busy
                  ? <><i className="fas fa-spinner fa-spin" /> {t('partenaireCodes.modal.step1.generating')}</>
                  : <><i className="fas fa-bolt" /> {t('partenaireCodes.modal.step1.generateBtn')}</>
                }
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.head}>
              <div className={styles.title}>{t('partenaireCodes.modal.step2.title')}</div>
              <div className={styles.sub}>{t('partenaireCodes.modal.step2.sub')}</div>
            </div>
            <div className={styles.body}>
              <div className={styles.result}>
                <div className={styles.resultL}>{t('partenaireCodes.modal.step2.resultLabel')}</div>
                <div className={styles.resultV}>{code}</div>
                <div className={styles.resultExp}><i className="fas fa-clock" /> {t('partenaireCodes.modal.step2.resultExpiry')}</div>
              </div>
              <div className={styles.sendRow}>
                <button className={`${styles.sendBtn} ${styles.wa}`} onClick={() => onToast(t('partenaireCodes.modal.step2.whatsappToast'), 's')}><i className="fab fa-whatsapp" /> {t('partenaireCodes.modal.step2.whatsapp')}</button>
                <button className={`${styles.sendBtn} ${styles.sms}`} onClick={() => onToast(t('partenaireCodes.modal.step2.smsToast'), 's')}><i className="fas fa-comment-sms" /> {t('partenaireCodes.modal.step2.sms')}</button>
                <button className={`${styles.sendBtn} ${styles.copy}`} onClick={copy}><i className="fas fa-copy" /> {t('partenaireCodes.modal.step2.copier')}</button>
              </div>
              <button className={styles.btn} style={{ marginTop: 16 }} onClick={onClose}><i className="fas fa-check" /> {t('partenaireCodes.modal.step2.doneBtn')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
