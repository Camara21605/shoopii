/* ================================================================
 * FICHIER : sections/params/SecConfidentialite.tsx
 * Section "Confidentialité" — visibilité du profil et données.
 * API : onSave(dto) → PATCH /partenaire/parametres/confidentialite
 * ================================================================ */

import { useState, useEffect } from 'react';
import s from '../../styles/ParamsShared.module.css';
import type { PartenaireData } from '../../hooks/usePartenaireParametres';

interface Props {
  data:        PartenaireData | null;
  saving:      boolean;
  dirty:       () => void;
  markClean:   () => void;
  saveTrigger: number;
  onSave:      (body: Partial<PartenaireData>) => Promise<void>;
  onToast:     (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function SecConfidentialite({
  data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  const [profilPublic,    setProfilPublic]    = useState(true);
  const [afficherTel,     setAfficherTel]     = useState(true);
  const [classement,      setClassement]      = useState(false);

  useEffect(() => {
    if (!data) return;
    setProfilPublic(data.profilPublic           ?? true);
    setAfficherTel(data.afficherTelephone       ?? true);
    setClassement(data.apparaitreClassement     ?? false);
  }, [data]);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  async function handleSave() {
    try {
      await onSave({ profilPublic, afficherTelephone: afficherTel, apparaitreClassement: classement });
      markClean();
      onToast('✅ Confidentialité sauvegardée', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  type Row = { ic: string; t: string; d: string; val: boolean; set: (v: boolean) => void; btn?: boolean; btnLabel?: string };
  const ROWS: Row[] = [
    { ic: 'fa-eye',          t: 'Profil partenaire public',    d: 'Votre profil est visible par les acteurs que vous recrutez.',      val: profilPublic, set: setProfilPublic },
    { ic: 'fa-phone',        t: 'Afficher mon téléphone',      d: 'Visible par vos acteurs recrutés uniquement.',                    val: afficherTel,  set: setAfficherTel  },
    { ic: 'fa-ranking-star', t: 'Apparaître dans le classement',d: 'Votre nom peut figurer au classement des partenaires.',           val: classement,   set: setClassement   },
  ];

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div className={s.fcTtl}><i className="fas fa-user-shield" /> Confidentialité</div>
      </div>
      <div className={s.fcBody}>
        {ROWS.map(r => (
          <div className={s.trow} key={r.t}>
            <div className={s.trowIc}><i className={`fas ${r.ic}`} /></div>
            <div className={s.trowMain}>
              <div className={s.trowT}>{r.t}</div>
              <div className={s.trowD}>{r.d}</div>
            </div>
            <div
              className={`${s.toggle} ${r.val ? s.toggleOn : ''}`}
              onClick={() => { r.set(!r.val); dirty(); }}
              role="switch" aria-checked={r.val}
            />
          </div>
        ))}
        {/* Export données */}
        <div className={s.trow}>
          <div className={s.trowIc}><i className="fas fa-download" /></div>
          <div className={s.trowMain}>
            <div className={s.trowT}>Télécharger mes données</div>
            <div className={s.trowD}>Recevez une copie de toutes vos données partenaire.</div>
          </div>
          <button className={s.docAct} onClick={() => onToast('📦 Export en préparation', 's')}>
            Demander
          </button>
        </div>
      </div>
    </div>
  );
}
