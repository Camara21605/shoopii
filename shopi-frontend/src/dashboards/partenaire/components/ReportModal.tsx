/* ================================================================
 * FICHIER : src/dashboards/partenaire/components/ReportModal.tsx
 *
 * Modale de signalement d'un utilisateur malveillant.
 * Motif + gravité + description + preuve (optionnelle).
 * ================================================================ */

import { useState } from 'react';
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

const TARGET_TYPES: { id: TargetType; icon: string; label: string }[] = [
  { id: 'ent', icon: 'fa-store',      label: 'Entreprise' },
  { id: 'lvr', icon: 'fa-motorcycle', label: 'Livreur' },
  { id: 'cor', icon: 'fa-map-pin',    label: 'Correspondant' },
];

export default function ReportModal({ defaultTarget = '', defaultTargetUserId, onClose, onSubmit, onToast }: Props) {
  const [cible, setCible]         = useState(defaultTarget);
  const [motif, setMotif]         = useState<MotifSignalement>('fraude');
  const [sev, setSev]             = useState<Gravite>('med');
  const [desc, setDesc]           = useState('');
  const [targetType, setTargetType] = useState<TargetType>('ent');
  const [busy, setBusy]           = useState(false);

  async function submit() {
    if (!cible.trim()) { onToast("Indiquez l'utilisateur concerné", 'w'); return; }
    if (!desc.trim())  { onToast('Ajoutez une description', 'w'); return; }
    const motifLabel = REASONS.find(r => r.id === motif)?.nm ?? motif;
    setBusy(true);
    try {
      const ref = await onSubmit(cible, motif, sev, desc, motifLabel, targetType, defaultTargetUserId);
      onClose();
      onToast("Signalement envoyé à l'équipe sécurité Shoneya", 's');
      setTimeout(() => onToast('Référence : ' + ref, 'i'), 700);
    } catch {
      onToast('Erreur lors de l\'envoi du signalement', 'w');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.bg} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button className={styles.x} onClick={onClose}><i className="fas fa-xmark" /></button>

        <div className={styles.head}>
          <div className={styles.title}><i className="fas fa-flag" /> Signaler un utilisateur</div>
          <div className={styles.sub}>Votre signalement est confidentiel et examiné par l'équipe de sécurité Shoneya.</div>
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

          <div className={styles.fld}>
            <label className={styles.lbl}>Type de compte signalé</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TARGET_TYPES.map(t => (
                <div key={t.id}
                  onClick={() => setTargetType(t.id)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, textAlign: 'center', cursor: 'pointer', fontSize: 13,
                    border: `1.5px solid ${targetType === t.id ? 'var(--blue)' : 'var(--border)'}`,
                    background: targetType === t.id ? 'var(--blue-light, rgba(59,130,246,.12))' : 'transparent',
                    color: targetType === t.id ? 'var(--blue)' : 'var(--muted)',
                  }}>
                  <i className={`fas ${t.icon}`} style={{ display: 'block', marginBottom: 4 }} />
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          <button className={styles.btn} onClick={submit} disabled={busy}>
            {busy
              ? <><i className="fas fa-spinner fa-spin" /> Envoi…</>
              : <><i className="fas fa-paper-plane" /> Envoyer le signalement</>
            }
          </button>
          <p className={styles.note}><i className="fas fa-lock" /> Les signalements abusifs ou répétés sans fondement peuvent affecter votre statut de partenaire.</p>
        </div>
      </div>
    </div>
  );
}
