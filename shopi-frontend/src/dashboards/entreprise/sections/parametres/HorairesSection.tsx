/*
 * FICHIER : src/dashboards/entreprise/sections/parametres/HorairesSection.tsx
 * Section 3 — Horaires d'ouverture par jour de la semaine
 * PATCH /dashboard/entreprise/parametres/horaires
 *
 * Reliés à la page boutique publique : « Ouvert maintenant · ferme à … » /
 * « Fermé · ouvre à … » (BoutiquePage.tsx), mis à jour en direct chez les
 * visiteurs (boutique:horaires_updated).
 *
 * CORRECTIONS :
 *   - Horaires jamais enregistrés : on n'affiche plus des horaires par défaut
 *     comme s'ils étaient réels (les clients, eux, voyaient « Horaires non
 *     renseignés ») — bandeau explicite + bouton pour les enregistrer.
 *   - Jour ouvert invalide (ouverture = fermeture) signalé et JAMAIS
 *     enregistré (le serveur refuse aussi) ; fermeture après minuit acceptée.
 *   - Raccourci « Copier le lundi sur les autres jours ouverts ».
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FormCard from '../../components/parametres/FormCard';
import type { ParametresData, HoraireJour } from '../../hooks/useParametres';
import s from '../../styles/parametres/ParametresPage.module.css';
import type { ToastType } from '../../types';

interface Props {
  data:         ParametresData | null;
  saving:       boolean;
  onDirty:      () => void;
  onToast:      (m: string, t?: ToastType) => void;
  saveHoraires: (h: HoraireJour[]) => Promise<void>;
}

const JOURS = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];

/* Point de départ proposé quand rien n'est encore enregistré */
function defaultHoraires(): HoraireJour[] {
  return JOURS.map(jour => ({
    id:        '',
    jour,
    ouverture: '08:00',
    fermeture: jour === 'dimanche' ? '18:00' : '20:00',
    actif:     jour !== 'dimanche',
  }));
}

const hhmm = (v: string | null | undefined) => (v ?? '').slice(0, 5);

/** Erreur d'un jour ouvert, ou null s'il est valide. */
function erreurJour(h: HoraireJour): 'incomplet' | 'identique' | null {
  if (!h.actif) return null;
  if (!h.ouverture || !h.fermeture) return 'incomplet';
  if (hhmm(h.ouverture) === hhmm(h.fermeture)) return 'identique';
  return null;
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
  /* Rien d'enregistré en base : les horaires affichés ne sont qu'une proposition */
  const nonEnregistres = !!data && (data.horaires?.length ?? 0) === 0;
  /* true au montage ET après chaque rechargement depuis l'API — sans ce
   * garde, l'auto-save ci-dessous se redéclenchait après CHAQUE
   * chargement de données (y compris juste après avoir déjà sauvegardé). */
  const skipNextSaveRef = useRef(true);
  /* BUG CORRIGÉ — la réponse d'un enregistrement (données rechargées)
   * réécrasait le formulaire : une heure tapée PENDANT l'aller-retour réseau
   * était perdue. editVersion compte les modifications locales, sentVersion
   * la version partie avec le dernier enregistrement : si l'utilisateur a
   * modifié depuis, on garde sa saisie (l'enregistrement suivant l'enverra). */
  const editVersionRef = useRef(0);
  const sentVersionRef = useRef(0);

  /* Pré-remplir depuis les données API (heures ramenées à HH:MM) */
  useEffect(() => {
    if (editVersionRef.current !== sentVersionRef.current) return;
    if (data?.horaires && data.horaires.length > 0) {
      const sorted = [...data.horaires]
        .sort((a, b) => JOURS.indexOf(a.jour) - JOURS.indexOf(b.jour))
        .map(h => ({ ...h, ouverture: h.ouverture ? hhmm(h.ouverture) : h.ouverture, fermeture: h.fermeture ? hhmm(h.fermeture) : h.fermeture }));
      skipNextSaveRef.current = true;
      setHoraires(sorted);
    }
  }, [data]);

  const invalides = horaires.filter(h => erreurJour(h) !== null);

  function updateJour(jour: string, field: keyof HoraireJour, value: string | boolean) {
    editVersionRef.current += 1;
    setHoraires(prev => prev.map(h => {
      if (h.jour !== jour) return h;
      const next = { ...h, [field]: value };
      /* Rouvrir un jour sans heures : on repart d'horaires raisonnables */
      if (field === 'actif' && value === true) {
        next.ouverture = next.ouverture || '08:00';
        next.fermeture = next.fermeture || '20:00';
      }
      return next;
    }));
    onDirty();
  }

  function copierLundi() {
    const lundi = horaires.find(h => h.jour === 'lundi');
    if (!lundi || !lundi.actif) return;
    editVersionRef.current += 1;
    setHoraires(prev => prev.map(h => h.actif && h.jour !== 'lundi'
      ? { ...h, ouverture: lundi.ouverture, fermeture: lundi.fermeture } : h));
    onDirty();
    onToast(t('parametres.horaires.copieToast'), 'i');
  }

  const enregistrer = (liste: HoraireJour[]) => {
    sentVersionRef.current = editVersionRef.current;
    return saveHoraires(liste)
      .then(() => onToast(t('parametres.horaires.savedToast'), 's'))
      .catch((e: unknown) => onToast(e instanceof Error && e.message ? `❌ ${e.message}` : t('parametres.horaires.errorToast'), 'e'));
  };

  /* Sauvegarde automatique après une courte pause (800 ms) — jamais tant
   * qu'un jour ouvert est invalide (le jour fautif est signalé en rouge). */
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    if (horaires.some(h => erreurJour(h) !== null)) return;
    const timer = setTimeout(() => { void enregistrer(horaires); }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horaires]);

  const lundiOuvert = horaires.find(h => h.jour === 'lundi')?.actif;

  return (
    <>
      <div className={s.sectionHd}>
        <h1><i className="fas fa-clock" /> {t('parametres.horaires.title')}</h1>
        <p>{t('parametres.horaires.subtitle')}</p>
      </div>

      {nonEnregistres && (
        <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:12, padding:'12px 16px', marginBottom:14,
          borderRadius:'var(--r-lg)', background:'var(--am-bg, rgba(180,83,9,.09))', color:'var(--amber)', fontSize:13, fontWeight:600 }}>
          <i className="fas fa-triangle-exclamation" />
          <span style={{ flex:'1 1 240px' }}>{t('parametres.horaires.nonRenseignesHint')}</span>
          <button type="button" className={s.saveBtn} style={{ margin:0 }} disabled={saving || invalides.length > 0}
            onClick={() => { skipNextSaveRef.current = true; void enregistrer(horaires); }}>
            <i className="fas fa-cloud-arrow-up" /> {t('parametres.horaires.enregistrerCesHoraires')}
          </button>
        </div>
      )}

      <FormCard title={t('parametres.horaires.cardTitle')} icon="fa-calendar-week" subtitle={t('parametres.horaires.cardSubtitle')}>
        {lundiOuvert && (
          <button type="button" onClick={copierLundi}
            style={{ display:'inline-flex', alignItems:'center', gap:7, marginBottom:12, padding:'7px 12px', borderRadius:'var(--pill)',
              border:'1px solid var(--bdr2)', background:'var(--white)', color:'var(--t2)', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            <i className="fas fa-copy" /> {t('parametres.horaires.copierLundi')}
          </button>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {horaires.map(h => {
            const err = erreurJour(h);
            const apresMinuit = h.actif && !err && hhmm(h.fermeture) < hhmm(h.ouverture);
            return (
              <div key={h.jour} style={{
                display:'flex', alignItems:'center', flexWrap:'wrap', gap:'10px 14px',
                padding:'12px 16px', borderRadius:'var(--r-lg)',
                background: h.actif ? 'var(--sky,var(--g100))' : 'var(--g50)',
                border:`1.5px solid ${err ? 'var(--red)' : h.actif ? 'var(--sky-3,#C8D9F8)' : 'var(--bdr)'}`,
                transition:'all .2s',
              }}>
                {/* Interrupteur ouvert / fermé */}
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', flexShrink:0, minWidth:110 }}>
                  <button type="button" role="switch" aria-checked={h.actif} aria-label={JOURS_FR[h.jour]}
                    onClick={() => updateJour(h.jour, 'actif', !h.actif)}
                    style={{
                      width:40, height:22, borderRadius:11, border:'none', padding:0,
                      background: h.actif ? 'var(--t2)' : 'var(--g300)',
                      position:'relative', cursor:'pointer', transition:'background .2s', flexShrink:0,
                    }}>
                    <span style={{
                      position:'absolute', top:3, left: h.actif ? 20 : 3,
                      width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left .2s',
                      boxShadow:'0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </button>
                  <span style={{ fontSize:13, fontWeight: h.actif ? 700 : 500, color: h.actif ? 'var(--navy)' : 'var(--t3)' }}>
                    {JOURS_FR[h.jour]}
                  </span>
                </label>

                {h.actif ? (
                  <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, flex:'1 1 220px', minWidth:0 }}>
                    <input type="time" aria-label={`${JOURS_FR[h.jour]} — ${t('parametres.horaires.ouverture')}`}
                      value={hhmm(h.ouverture) || '08:00'}
                      onChange={e => updateJour(h.jour, 'ouverture', e.target.value)}
                      style={{ width:110, maxWidth:'100%', padding:'6px 10px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--navy)', background:'var(--white)', cursor:'pointer' }} />
                    <span style={{ color:'var(--t3)', fontSize:13 }}>→</span>
                    <input type="time" aria-label={`${JOURS_FR[h.jour]} — ${t('parametres.horaires.fermeture')}`}
                      value={hhmm(h.fermeture) || '20:00'}
                      onChange={e => updateJour(h.jour, 'fermeture', e.target.value)}
                      style={{ width:110, maxWidth:'100%', padding:'6px 10px', border:'1.5px solid var(--bdr2)', borderRadius:'var(--r-md)', fontSize:13, color:'var(--navy)', background:'var(--white)', cursor:'pointer' }} />
                    {err && <span style={{ fontSize:12, fontWeight:700, color:'var(--red)' }}><i className="fas fa-circle-exclamation" /> {t(`parametres.horaires.erreur_${err}`)}</span>}
                    {apresMinuit && <span style={{ fontSize:12, color:'var(--t3)' }}><i className="fas fa-moon" /> {t('parametres.horaires.apresMinuit')}</span>}
                  </div>
                ) : (
                  <span style={{ fontSize:12, color:'var(--t4)', fontStyle:'italic' }}>{t('parametres.horaires.fermeCeJour')}</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:14, fontSize:12, color:'var(--t3)', display:'flex', alignItems:'center', gap:7 }}>
          {saving
            ? <><i className="fas fa-spinner fa-spin" /> {t('parametres.horaires.sauvegardeEnCours')}</>
            : invalides.length > 0
              ? <span style={{ color:'var(--red)', fontWeight:600 }}><i className="fas fa-circle-exclamation" /> {t('parametres.horaires.corrigerAvantSauvegarde')}</span>
              : !nonEnregistres && <><i className="fas fa-circle-check" style={{ color:'var(--emerald)' }} /> {t('parametres.horaires.autoSaveHint')}</>}
        </div>
      </FormCard>
    </>
  );
}
