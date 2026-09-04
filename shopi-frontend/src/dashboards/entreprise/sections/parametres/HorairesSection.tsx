/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/HorairesSection.tsx
 * Section 3 — Horaires d'ouverture par jour de la semaine
 * PATCH /dashboard/entreprise/parametres/horaires
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const JOURS_FR: Record<string, string> = {
    lundi: t('parametres.horaires.jours.lundi'), mardi: t('parametres.horaires.jours.mardi'),
    mercredi: t('parametres.horaires.jours.mercredi'), jeudi: t('parametres.horaires.jours.jeudi'),
    vendredi: t('parametres.horaires.jours.vendredi'), samedi: t('parametres.horaires.jours.samedi'),
    dimanche: t('parametres.horaires.jours.dimanche'),
  };
  const [horaires, setHoraires] = useState<HoraireJour[]>(defaultHoraires());
  /* true au montage ET après chaque rechargement depuis l'API — sans ce
   * garde, l'auto-save ci-dessous se redéclenchait après CHAQUE
   * chargement de données (y compris juste après avoir déjà sauvegardé). */
  const skipNextSaveRef = useRef(true);

  /* Pré-remplir depuis les données API */
  useEffect(() => {
    if (data?.horaires && data.horaires.length > 0) {
      // Trier lundi → dimanche
      const sorted = [...data.horaires].sort(
        (a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour)
      );
      skipNextSaveRef.current = true;
      setHoraires(sorted);
    }
  }, [data]);

  function updateJour(jour: string, field: keyof HoraireJour, value: string | boolean) {
    setHoraires(prev => prev.map(h => h.jour === jour ? { ...h, [field]: value } : h));
    onDirty();
  }

  /* Sauvegarde automatique — plus de bouton "Sauvegarder" : chaque
   * changement (toggle, heure) déclenche un enregistrement après une
   * courte pause (800ms), pour ne pas envoyer une requête à chaque
   * frappe/glissement pendant que l'utilisateur ajuste encore l'heure. */
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    const timer = setTimeout(() => {
      saveHoraires(horaires)
        .then(() => onToast(t('parametres.horaires.savedToast'), 's'))
        .catch(() => onToast(t('parametres.horaires.errorToast'), 'e'));
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horaires]);

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-clock" /> {t('parametres.horaires.title')}</h1>
        <p>{t('parametres.horaires.subtitle')}</p>
      </div>

      <FormCard title={t('parametres.horaires.cardTitle')} icon="fa-calendar-week" subtitle={t('parametres.horaires.cardSubtitle')}>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {horaires.map(h => (
            <div key={h.jour} style={{
              display:'flex', alignItems:'center', flexWrap:'wrap', gap:'10px 14px',
              padding:'12px 16px', borderRadius:'var(--r-lg)',
              background: h.actif ? 'var(--sky,var(--g100))' : 'var(--g50)',
              border:`1.5px solid ${h.actif ? 'var(--sky-3,#C8D9F8)' : 'var(--bdr)'}`,
              transition:'all .2s',
            }}>
              {/* Toggle actif */}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flexShrink:0, minWidth:110 }}>
                <div
                  onClick={() => updateJour(h.jour, 'actif', !h.actif)}
                  style={{
                    width:40, height:22, borderRadius:11,
                    background: h.actif ? 'var(--t2)' : 'var(--g300)',
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
                <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, flex:'1 1 220px', minWidth:0 }}>
                  <input
                    type="time"
                    value={h.ouverture ?? '08:00'}
                    onChange={e => updateJour(h.jour, 'ouverture', e.target.value)}
                    style={{ width:110, maxWidth:'100%', padding:'6px 10px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--navy)', background:'var(--white)', cursor:'pointer' }}
                  />
                  <span style={{ color:'var(--t3)', fontSize:13 }}>→</span>
                  <input
                    type="time"
                    value={h.fermeture ?? '20:00'}
                    onChange={e => updateJour(h.jour, 'fermeture', e.target.value)}
                    style={{ width:110, maxWidth:'100%', padding:'6px 10px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--navy)', background:'var(--white)', cursor:'pointer' }}
                  />
                </div>
              ) : (
                <span style={{ fontSize:12, color:'var(--t4)', fontStyle:'italic' }}>{t('parametres.horaires.fermeCeJour')}</span>
              )}
            </div>
          ))}
        </div>

        {/* Plus de bouton — chaque changement s'enregistre automatiquement
         * (voir l'effet debounced ci-dessus). Seul indicateur restant :
         * un état "en cours" discret pendant l'appel réseau. */}
        {saving && (
          <div style={{ marginTop:16, display:'flex', alignItems:'center', gap:7, fontSize:12.5, color:'var(--t3)' }}>
            <i className="fas fa-spinner fa-spin" /> {t('parametres.horaires.sauvegardeEnCours')}
          </div>
        )}
      </FormCard>
    </>
  );
}