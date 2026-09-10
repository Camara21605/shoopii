/* ================================================================
 * FICHIER : sections/params/SecConfidentialite.tsx
 * Section "Confidentialité" — visibilité du profil et données.
 * API : onSave(dto) → PATCH /partenaire/parametres/confidentialite
 *
 * BUG CORRIGÉ — "Télécharger mes données" affichait un toast de succès
 * ("Export en préparation") sans jamais rien télécharger ni appeler la
 * moindre route : aucun endpoint d'export n'existe côté backend (vérifié
 * sur tout /modules/dashboard/partenaire). Remplacé par un export réel :
 * un fichier JSON généré côté client à partir de `data`, déjà chargé en
 * mémoire — mêmes données que celles affichées dans les autres sections
 * de ce dashboard, donc un export honnête plutôt qu'une fausse promesse
 * de traitement serveur asynchrone qui n'existe pas.
 * ================================================================ */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      onToast(t('partenaireParametres.secConfidentialite.savedToast'), 's');
    } catch {
      onToast(t('partenaireParametres.secConfidentialite.errorToast'), 'w');
    }
  }

  function exportData() {
    if (!data) return;
    const { ...exportable } = data;
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `shoneya-partenaire-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast(t('partenaireParametres.secConfidentialite.exportRow.toast'), 's');
  }

  type Row = { key: string; ic: string; t: string; d: string; val: boolean; set: (v: boolean) => void };
  const ROWS: Row[] = [
    { key: 'profilPublic', ic: 'fa-eye',          t: t('partenaireParametres.secConfidentialite.rows.profilPublic.t'), d: t('partenaireParametres.secConfidentialite.rows.profilPublic.d'), val: profilPublic, set: setProfilPublic },
    { key: 'afficherTel',  ic: 'fa-phone',        t: t('partenaireParametres.secConfidentialite.rows.afficherTel.t'),  d: t('partenaireParametres.secConfidentialite.rows.afficherTel.d'),  val: afficherTel,  set: setAfficherTel  },
    { key: 'classement',   ic: 'fa-ranking-star', t: t('partenaireParametres.secConfidentialite.rows.classement.t'),   d: t('partenaireParametres.secConfidentialite.rows.classement.d'),   val: classement,   set: setClassement   },
  ];

  return (
    <div className={s.fc}>
      <div className={s.fcHd}>
        <div className={s.fcTtl}><i className="fas fa-user-shield" /> {t('partenaireParametres.secConfidentialite.title')}</div>
      </div>
      <div className={s.fcBody}>
        {ROWS.map(r => (
          <div className={s.trow} key={r.key}>
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
            <div className={s.trowT}>{t('partenaireParametres.secConfidentialite.exportRow.t')}</div>
            <div className={s.trowD}>{t('partenaireParametres.secConfidentialite.exportRow.d')}</div>
          </div>
          <button className={s.docAct} onClick={exportData} disabled={!data}>
            {t('partenaireParametres.secConfidentialite.exportRow.btn')}
          </button>
        </div>
      </div>
    </div>
  );
}
