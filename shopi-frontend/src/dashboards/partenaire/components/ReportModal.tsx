/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/ReportModal.tsx
 *
 * Modale de signalement d'un utilisateur malveillant.
 * Motif + gravité + description + preuve (optionnelle).
 * ================================================================ */

import { useState } from 'react';
import styles from '../styles/ReportModal.module.css';
import type { MotifSignalement, Gravite } from '../data/types';

interface Props {
  defaultTarget?: string;
  onClose:  () => void;
  onSubmit: (cible: string, motif: MotifSignalement, gravite: Gravite, desc: string) => string;
  onToast:  (msg: string, type?: 's' | 'i' | 'w') => void;
}

const REASONS: { id: MotifSignalement; icon: string; nm: string; d: string }[] = [
  { id: 'fraude',      icon: 'fa-money-bill-transfer', nm: 'Arnaque / Fraude',        d: "Vol d'argent, produits non livrés, escroquerie" },
  { id: 'faux',        icon: 'fa-user-secret',         nm: 'Faux compte / Usurpation', d: 'Fausse identité, compte usurpant une vraie boutique' },
  { id: 'contrefacon', icon: 'fa-copyright',           nm: 'Contrefaçon',             d: 'Produits faux ou non conformes' },
  { id: 'abus',        icon: 'fa-triangle-exclamation',nm: 'Comportement abusif',     d: 'Paiements hors-app, menaces, harcèlement' },
  { id: 'autre',       icon: 'fa-ellipsis',            nm: 'Autre',                   d: 'Tout autre comportement suspect' },
];
const SEVS: { id: Gravite; label: string }[] = [
  { id: 'low', label: 'Mineur' }, { id: 'med', label: 'Modéré' }, { id: 'high', label: 'Grave' },
];

export default function ReportModal({ defaultTarget = '', onClose, onSubmit, onToast }: Props) {
  const [cible, setCible]   = useState(defaultTarget);
  const [motif, setMotif]   = useState<MotifSignalement>('fraude');
  const [sev, setSev]       = useState<Gravite>('med');
  const [desc, setDesc]     = useState('');

  function submit() {
    if (!cible.trim()) { onToast("⚠️ Indiquez l'utilisateur concerné", 'w'); return; }
    if (!desc.trim())  { onToast('⚠️ Ajoutez une description', 'w'); return; }
    const ref = onSubmit(cible, motif, sev, desc);
    onClose();
    onToast("🛡️ Signalement envoyé à l'équipe sécurité Shopi", 's');
    setTimeout(() => onToast('📋 Référence : ' + ref, 'i'), 700);
  }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        <div className={styles.head}>
          <div className={styles.title}><i className="fas fa-flag" /> Signaler un utilisateur</div>
          <div className={styles.sub}>Votre signalement est confidentiel et examiné par l'équipe de sécurité Shopi.</div>
        </div>

        <div className={styles.body}>
          <div className={styles.fld}>
            <label className={styles.lbl}>Utilisateur concerné</label>
            <input className={styles.in} value={cible} onChange={e => setCible(e.target.value)} placeholder="Nom, code ou identifiant de l'acteur" />
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>Motif du signalement</label>
            <div className={styles.reasonGrid}>
              {REASONS.map(r => (
                <div key={r.id}
                  className={`${styles.reasonOpt} ${motif === r.id ? styles.on : ''}`}
                  onClick={() => setMotif(r.id)}>
                  <div className={styles.reasonIc}><i className={`fas ${r.icon}`} /></div>
                  <div><div className={styles.reasonNm}>{r.nm}</div><div className={styles.reasonD}>{r.d}</div></div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>Niveau de gravité</label>
            <div className={styles.sevPick}>
              {SEVS.map(s => (
                <div key={s.id}
                  className={`${styles.sevOpt} ${styles['sev_' + s.id]} ${sev === s.id ? styles.on : ''}`}
                  onClick={() => setSev(s.id)}>
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>Description détaillée</label>
            <textarea className={styles.in} rows={4} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Décrivez précisément ce qui s'est passé : dates, montants, preuves éventuelles…"
              style={{ resize: 'none' }} />
          </div>

          <div className={styles.fld}>
            <label className={styles.lbl}>Preuves (optionnel)</label>
            <div className={styles.drop} onClick={() => onToast('📎 Sélecteur de fichier (capture, reçu…)', 'i')}>
              <i className="fas fa-paperclip" />
              <div>Joindre une capture d'écran ou un reçu</div>
            </div>
          </div>

          <button className={styles.btn} onClick={submit}><i className="fas fa-paper-plane" /> Envoyer le signalement</button>
          <p className={styles.note}><i className="fas fa-lock" /> Les signalements abusifs ou répétés sans fondement peuvent affecter votre statut de partenaire.</p>
        </div>
      </div>
    </div>
  );
}
