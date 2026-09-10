/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/ReportModal.tsx
 *
 * Modale de signalement d'un utilisateur malveillant.
 * Motif + gravité + description + preuve (optionnelle).
 * ================================================================ */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ReportModal.module.css';
import type { MotifSignalement, Gravite } from '../data/types';

type TargetType = 'ent' | 'lvr' | 'cor';

interface Props {
  defaultTarget?: string;
  /** id réel du compte visé (résolu au clic sur "Signaler cet acteur") —
   *  absent quand ouvert depuis le bouton générique, sans acteur précis. */
  defaultTargetUserId?: string;
  onClose:  () => void;
  onSubmit: (cible: string, motif: MotifSignalement, gravite: Gravite, desc: string, motifLabel: string, targetType: TargetType, targetUserId?: string) => Promise<string>;
  onToast:  (msg: string, type?: 's' | 'i' | 'w') => void;
}

const REASON_ICONS: Record<MotifSignalement, string> = {
  fraude: 'fa-money-bill-transfer', faux: 'fa-user-secret', contrefacon: 'fa-copyright',
  abus: 'fa-triangle-exclamation', autre: 'fa-ellipsis',
};
const REASON_IDS: MotifSignalement[] = ['fraude', 'faux', 'contrefacon', 'abus', 'autre'];
const SEV_IDS: Gravite[] = ['low', 'med', 'high'];
const TARGET_TYPE_ICONS: Record<TargetType, string> = { ent: 'fa-store', lvr: 'fa-motorcycle', cor: 'fa-map-pin' };
const TARGET_TYPE_IDS: TargetType[] = ['ent', 'lvr', 'cor'];

export default function ReportModal({ defaultTarget = '', defaultTargetUserId, onClose, onSubmit, onToast }: Props) {
  const { t } = useTranslation();
  const [cible, setCible]         = useState(defaultTarget);
  const [motif, setMotif]         = useState<MotifSignalement>('fraude');
  const [sev, setSev]             = useState<Gravite>('med');
  const [desc, setDesc]           = useState('');
  const [targetType, setTargetType] = useState<TargetType>('ent');
  const [busy, setBusy]           = useState(false);

  async function submit() {
    if (!cible.trim()) { onToast(t('partenaireSignalements.modal.errorCibleToast'), 'w'); return; }
    if (!desc.trim())  { onToast(t('partenaireSignalements.modal.errorDescToast'), 'w'); return; }
    const motifLabel = t(`partenaireSignalements.modal.reasons.${motif}.nm`);
    setBusy(true);
    try {
      const ref = await onSubmit(cible, motif, sev, desc, motifLabel, targetType, defaultTargetUserId);
      onClose();
      onToast(t('partenaireSignalements.modal.successToast'), 's');
      setTimeout(() => onToast(t('partenaireSignalements.modal.referenceToast', { ref }), 'i'), 700);
    } catch {
      onToast(t('partenaireSignalements.modal.errorSubmitToast'), 'w');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        <div className={styles.head}>
          <div className={styles.title}><i className="fas fa-flag" /> {t('partenaireSignalements.modal.title')}</div>
          <div className={styles.sub}>{t('partenaireSignalements.modal.sub')}</div>
        </div>

        <div className={styles.body}>
          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireSignalements.modal.cibleLabel')}</label>
            <input className={styles.in} value={cible} onChange={e => setCible(e.target.value)} placeholder={t('partenaireSignalements.modal.ciblePlaceholder')} />
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireSignalements.modal.motifLabel')}</label>
            <div className={styles.reasonGrid}>
              {REASON_IDS.map(id => (
                <div key={id}
                  className={`${styles.reasonOpt} ${motif === id ? styles.on : ''}`}
                  onClick={() => setMotif(id)}>
                  <div className={styles.reasonIc}><i className={`fas ${REASON_ICONS[id]}`} /></div>
                  <div><div className={styles.reasonNm}>{t(`partenaireSignalements.modal.reasons.${id}.nm`)}</div><div className={styles.reasonD}>{t(`partenaireSignalements.modal.reasons.${id}.d`)}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireSignalements.modal.graviteLabel')}</label>
            <div className={styles.sevPick}>
              {SEV_IDS.map(id => (
                <div key={id}
                  className={`${styles.sevOpt} ${styles['sev_' + id]} ${sev === id ? styles.on : ''}`}
                  onClick={() => setSev(id)}>
                  {t(`partenaireSignalements.gravites.${id}`)}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireSignalements.modal.descriptionLabel')}</label>
            <textarea className={styles.in} rows={4} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder={t('partenaireSignalements.modal.descriptionPlaceholder')}
              style={{ resize: 'none' }} />
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireSignalements.modal.preuvesLabel')}</label>
            <div className={styles.drop} onClick={() => onToast(t('partenaireSignalements.modal.dropToast'), 'i')}>
              <i className="fas fa-paperclip" />
              <div>{t('partenaireSignalements.modal.dropZone')}</div>
            </div>
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>{t('partenaireSignalements.modal.targetTypeLabel')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TARGET_TYPE_IDS.map(id => (
                <div key={id}
                  onClick={() => setTargetType(id)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 13,
                    border: `1.5px solid ${targetType === id ? 'var(--blue)' : 'var(--border)'}`,
                    background: targetType === id ? 'var(--blue-light, rgba(59,130,246,.12))' : 'transparent',
                    color: targetType === id ? 'var(--blue)' : 'var(--muted)',
                  }}>
                  <i className={`fas ${TARGET_TYPE_ICONS[id]}`} style={{ display: 'block', marginBottom: 4 }} />
                  {t(`partenaireCodes.types.${id}`)}
                </div>
              ))}
            </div>
          </div>

          <button className={styles.btn} onClick={submit} disabled={busy}>
            {busy
              ? <><i className="fas fa-spinner fa-spin" /> {t('partenaireSignalements.modal.envoi')}</>
              : <><i className="fas fa-paper-plane" /> {t('partenaireSignalements.modal.envoyerBtn')}</>
            }
          </button>
          <p className={styles.note}><i className="fas fa-lock" /> {t('partenaireSignalements.modal.note')}</p>
        </div>
      </div>
    </div>
  );
}
