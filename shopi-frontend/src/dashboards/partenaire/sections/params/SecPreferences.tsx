/* ================================================================
 * FICHIER : sections/params/SecPreferences.tsx
 * Section "Préférences" — langue et apparence du dashboard.
 * API : onSave(dto) → PATCH /partenaire/parametres/preferences
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

const LANGUES = [
  { val: 'fr',       label: '🇫🇷 Français' },
  { val: 'pular',    label: 'Pular' },
  { val: 'malinke',  label: 'Malinké' },
  { val: 'soussou',  label: 'Soussou' },
];

const THEMES = [
  { val: 'light', label: '☀️ Clair' },
  { val: 'dark',  label: '🌙 Sombre' },
];

export default function SecPreferences({
  data, saving, dirty, markClean, saveTrigger, onSave, onToast
}: Props) {
  const [langue,    setLangue]    = useState('fr');
  const [apparence, setApparence] = useState('light');

  useEffect(() => {
    if (!data) return;
    setLangue(data.langue      ?? 'fr');
    setApparence(data.apparence ?? 'light');
  }, [data]);

  useEffect(() => {
    if (saveTrigger > 0) handleSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger]);

  async function handleSave() {
    try {
      await onSave({ langue, apparence });
      /* Persist preference locally for immediate effect */
      localStorage.setItem('shopi_lang', langue);
      markClean();
      onToast('✅ Préférences sauvegardées', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'w');
    }
  }

  return (
    <>
      {/* Langue */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div>
            <div className={s.fcTtl}><i className="fas fa-language" /> Langue</div>
            <div className={s.fcSub}>Langue d'affichage de votre espace partenaire.</div>
          </div>
        </div>
        <div className={s.fcBody}>
          <div className={s.optGrid}>
            {LANGUES.map(l => (
              <div
                key={l.val}
                className={`${s.opt} ${langue === l.val ? s.optOn : ''}`}
                onClick={() => { setLangue(l.val); dirty(); }}
              >
                <div className={s.optRadio} />
                <div className={s.optL}>{l.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Apparence */}
      <div className={s.fc}>
        <div className={s.fcHd}>
          <div className={s.fcTtl}><i className="fas fa-palette" /> Apparence</div>
        </div>
        <div className={s.fcBody}>
          <div className={s.optGrid}>
            {THEMES.map(t => (
              <div
                key={t.val}
                className={`${s.opt} ${apparence === t.val ? s.optOn : ''}`}
                onClick={() => { setApparence(t.val); dirty(); }}
              >
                <div className={s.optRadio} />
                <div className={s.optL}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
