/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/HorairesSection.tsx
 * Section 3 — Horaires d'ouverture par jour de la semaine
 * PATCH /dashboard/entreprise/parametres/horaires
 */
import React, { useState, useEffect } from 'react';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData, HoraireJour } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';

interface Props {
  data:         ParametresData | null;
  saving:       boolean;
  onDirty:      () => void;
  onToast:      (m: string, t?: string) => void;
  saveHoraires: (h: HoraireJour[]) => Promise<void>;
}

const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
const JOURS_FR: Record<string, string> = {
  lundi:'Lundi', mardi:'Mardi', mercredi:'Mercredi', jeudi:'Jeudi',
  vendredi:'Vendredi', samedi:'Samedi', dimanche:'Dimanche',
};

/* Horaires par défaut si la BDD n'en a pas encore */
function defaultHoraires(): HoraireJour[] {
  return JOURS.map((jour, i) => ({
    id:        '',
    jour,
    ouverture: '08:00',
    fermeture: jour === 'dimanche' ? '18:00' : '20:00',
    actif:     jour !== 'dimanche',
  }));
}

export default function HorairesSection({ data, saving, onDirty, onToast, saveHoraires }: Props) {
  const [horaires, setHoraires] = useState<HoraireJour[]>(defaultHoraires());

  /* Pré-remplir depuis les données API */
  useEffect(() => {
    if (data?.horaires && data.horaires.length > 0) {
      // Trier lundi → dimanche
      const sorted = [...data.horaires].sort(
        (a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour)
      );
      setHoraires(sorted);
    }
  }, [data]);

  function updateJour(jour: string, field: keyof HoraireJour, value: string | boolean) {
    setHoraires(prev => prev.map(h => h.jour === jour ? { ...h, [field]: value } : h));
    onDirty();
  }

  async function handleSave() {
    try {
      await saveHoraires(horaires);
      onToast('✅ Horaires sauvegardés', 's');
    } catch {
      onToast('❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-clock" /> Horaires d'ouverture</h1>
        <p>Définissez vos jours et heures d'ouverture. Ces informations sont affichées sur votre page boutique.</p>
      </div>

      <FormCard title="Horaires par jour" icon="fa-calendar-week" subtitle="Activez les jours d'ouverture et définissez les horaires">
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {horaires.map(h => (
            <div key={h.jour} style={{
              display:'flex', alignItems:'center', gap:14,
              padding:'12px 16px', borderRadius:'var(--r-lg)',
              background: h.actif ? 'var(--sky,#EEF3FD)' : 'var(--g50)',
              border:`1.5px solid ${h.actif ? 'var(--sky-3,#C8D9F8)' : 'var(--bdr)'}`,
              transition:'all .2s',
            }}>
              {/* Toggle actif */}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flexShrink:0, minWidth:110 }}>
                <div
                  onClick={() => updateJour(h.jour, 'actif', !h.actif)}
                  style={{
                    width:40, height:22, borderRadius:11,
                    background: h.actif ? 'var(--teal,#0E7490)' : 'var(--g300)',
                    position:'relative', cursor:'pointer', transition:'background .2s',
                    flexShrink:0,
                  }}
                >
                  <div style={{
                    position:'absolute', top:3,
                    left: h.actif ? 20 : 3,
                    width:16, height:16, borderRadius:'50%',
                    background:'#fff', transition:'left .2s',
                    boxShadow:'0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </div>
                <span style={{ fontSize:13, fontWeight: h.actif ? 700 : 500, color: h.actif ? 'var(--navy)' : 'var(--t3)' }}>
                  {JOURS_FR[h.jour]}
                </span>
              </label>

              {/* Plages horaires */}
              {h.actif ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
                  <input
                    type="time"
                    value={h.ouverture ?? '08:00'}
                    onChange={e => updateJour(h.jour, 'ouverture', e.target.value)}
                    style={{ padding:'6px 10px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--navy)', background:'var(--white)', cursor:'pointer' }}
                  />
                  <span style={{ color:'var(--t3)', fontSize:13 }}>→</span>
                  <input
                    type="time"
                    value={h.fermeture ?? '20:00'}
                    onChange={e => updateJour(h.jour, 'fermeture', e.target.value)}
                    style={{ padding:'6px 10px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--navy)', background:'var(--white)', cursor:'pointer' }}
                  />
                </div>
              ) : (
                <span style={{ fontSize:12, color:'var(--t4)', fontStyle:'italic' }}>Fermé ce jour</span>
              )}
            </div>
          ))}
        </div>

        <div className={s.saveRow} style={{ marginTop:20 }}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les horaires</>}
          </button>
        </div>
      </FormCard>
    </>
  );
}