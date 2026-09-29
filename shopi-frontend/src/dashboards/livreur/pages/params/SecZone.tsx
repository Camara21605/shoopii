/*
 * FICHIER : src/dashboards/livreur/pages/params/SecZone.tsx
 * ✅ CONNECTÉ — type de livraison + zones dynamiques depuis le référentiel géo
 *
 * Chaque réglage a un effet RÉEL :
 *   - zones actives → recherche des livreurs par les clients, affectation par
 *     l'administrateur de zone, page « Ma zone de livraison » ;
 *   - planning → affiché aux clients sur la fiche du livreur ;
 *   - type de livraison → niveau des zones proposées (communes, quartiers…).
 *
 * RETIRÉS car sans aucun effet (enregistrés, jamais lus nulle part) :
 *   - « Distance maximale » (laissait croire que les missions au-delà ne seraient
 *     plus proposées) ;
 *   - « Disponibilité automatique » (pause auto, mode nuit, reprise auto, pause
 *     week-end) — ne s'enregistraient d'ailleurs qu'avec le bouton d'une autre carte.
 *
 * BUGS CORRIGÉS :
 *   - un rechargement des données effaçait la saisie non enregistrée ;
 *   - jour « ouvert » sans heure ou avec début = fin accepté (refusé aussi par le serveur) ;
 *   - heures reçues au format HH:MM:SS ; date de déverrouillage toujours en français ;
 *   - zones cliquables non accessibles au clavier ; indicateur « non enregistré »
 *     jamais remis à zéro après un enregistrement.
 */
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { buildJours, buildDeliveryTypes } from '../../data/parametresData';
import type { LivreurData, HoraireJour } from '../../hooks/useLivreurParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';
import ps from '../../styles/ParamsShared.module.css';

const JOURS_API = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];

interface GeoItem { id: string; nom: string; code: string; }

const hhmm = (v: string | null | undefined) => (v ?? '').slice(0, 5);

function computeLock(setAt: string | null, lang: string): { locked: boolean; unlockDate: string } {
  if (!setAt) return { locked: false, unlockDate: '' };
  const d = new Date(setAt);
  d.setMonth(d.getMonth() + 6);
  const locked = new Date() < d;
  const unlockDate = d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });
  return { locked, unlockDate };
}

interface Props {
  data:          LivreurData | null;
  saving:        boolean;
  dirty:         () => void;
  clean?:        () => void;
  onPop:         (m: string, t?: string) => void;
  saveZones:     (body: Partial<LivreurData>) => Promise<void>;
  saveHoraires:  (h: HoraireJour[]) => Promise<void>;
}

type Planning = { on: boolean[]; open: string[]; close: string[] };

function planningDepuis(data: LivreurData | null): Planning {
  const base: Planning = { on: JOURS_API.map((_, i) => i < 6), open: JOURS_API.map(() => '07:00'), close: JOURS_API.map(() => '21:00') };
  if (!data?.horaires?.length) return base;
  const parJour = new Map(data.horaires.map(h => [h.jour, h]));
  return {
    on:    JOURS_API.map((j, i) => parJour.get(j)?.actif ?? base.on[i]),
    open:  JOURS_API.map((j, i) => hhmm(parJour.get(j)?.ouverture) || base.open[i]),
    close: JOURS_API.map((j, i) => hhmm(parJour.get(j)?.fermeture) || base.close[i]),
  };
}

export default function SecZone({ data, saving, dirty, clean, onPop, saveZones, saveHoraires }: Props) {
  const { t, i18n } = useTranslation();
  const DELIVERY_TYPES = buildDeliveryTypes(t);
  const JOURS          = buildJours(t);

  const [deliveryType, setDeliveryType] = useState('');
  const [geoItems,     setGeoItems]     = useState<GeoItem[]>([]);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [activeZones,  setActiveZones]  = useState<string[]>([]);
  const [planning,     setPlanning]     = useState<Planning>(() => planningDepuis(null));

  const { locked: typeLocked, unlockDate } = computeLock(data?.deliveryTypeSetAt ?? null, i18n.language);

  /* ── Init depuis l'API — chaque carte ne reprend les données du serveur que si
   *    l'on n'était pas en train de la modifier (identique aux données précédentes). */
  const prevDataRef = useRef<LivreurData | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = prevDataRef.current;
    prevDataRef.current = data;
    const zonesEnCours = !!prev && (deliveryType !== (prev.deliveryType ?? '') ||
      JSON.stringify([...activeZones].sort()) !== JSON.stringify([...(prev.communesActives ?? [])].sort()));
    if (!zonesEnCours) {
      setDeliveryType(data.deliveryType ?? '');
      setActiveZones(data.communesActives ?? []);
    }
    const planningEnCours = !!prev && JSON.stringify(planning) !== JSON.stringify(planningDepuis(prev));
    if (!planningEnCours) setPlanning(planningDepuis(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* ── Chargement des zones géo selon le type ── */
  useEffect(() => {
    if (!deliveryType) return;   // sans type, la carte des zones n'est pas affichée
    const typeConf = DELIVERY_TYPES.find(dt => dt.key === deliveryType);
    if (!typeConf) return;
    let cancelled = false;
    setGeoLoading(true);
    apiFetch<GeoItem[]>(`/geo/items?niveau=${typeConf.niveau}`)
      .then(d  => { if (!cancelled) setGeoItems(d ?? []); })
      .catch(() => { if (!cancelled) setGeoItems([]); })
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryType]);

  function selectType(key: string) {
    if (typeLocked || key === deliveryType) return;
    setDeliveryType(key);
    setActiveZones([]);
    dirty();
    onPop(t('livreurSecZone.toasts.typeSelected', { label: DELIVERY_TYPES.find(dt => dt.key === key)?.label }), 'i');
  }

  function toggleZone(nom: string) {
    setActiveZones(prev => prev.includes(nom) ? prev.filter(z => z !== nom) : [...prev, nom]);
    dirty();
  }

  const setJour = (i: number, champ: keyof Planning, v: string | boolean) => {
    setPlanning(p => {
      const n = { on: [...p.on], open: [...p.open], close: [...p.close] };
      (n[champ] as (string | boolean)[])[i] = v;
      return n;
    });
    dirty();
  };

  function setAllDays(on: boolean) {
    setPlanning(p => ({ ...p, on: JOURS_API.map(() => on) }));
    dirty();
    onPop(on ? t('livreurSecZone.toasts.allDaysOn') : t('livreurSecZone.toasts.planningCleared'), on ? 's' : 'w');
  }

  /* Jour ouvert invalide : heure manquante, ou début = fin */
  const erreurJour = (i: number): 'incomplet' | 'identique' | null => {
    if (!planning.on[i]) return null;
    if (!planning.open[i] || !planning.close[i]) return 'incomplet';
    if (planning.open[i] === planning.close[i]) return 'identique';
    return null;
  };
  const joursInvalides = JOURS_API.filter((_, i) => erreurJour(i) !== null).length;

  async function handleSaveZones() {
    try {
      await saveZones({ deliveryType: deliveryType || undefined, communesActives: activeZones } as Partial<LivreurData>);
      onPop(t('livreurSecZone.toasts.zonesSaved'), 's');
      clean?.();
    } catch (err: unknown) {
      onPop((err as Error)?.message ?? t('livreurSecZone.toasts.saveError'), 'e');
    }
  }

  async function handleSaveHoraires() {
    if (joursInvalides > 0) { onPop(t('livreurSecZone.planningCard.corriger'), 'e'); return; }
    try {
      const horaires: HoraireJour[] = JOURS_API.map((jour, i) => ({
        id:        data?.horaires?.find(h => h.jour === jour)?.id ?? '',
        jour,
        actif:     planning.on[i],
        ouverture: planning.on[i] ? planning.open[i]  : null,
        fermeture: planning.on[i] ? planning.close[i] : null,
      }));
      await saveHoraires(horaires);
      onPop(t('livreurSecZone.toasts.horairesSaved'), 's');
      clean?.();
    } catch (err: unknown) {
      onPop((err as Error)?.message ?? t('livreurSecZone.toasts.saveError'), 'e');
    }
  }

  const currentTypeConf = DELIVERY_TYPES.find(dt => dt.key === deliveryType);
  const activeCount      = activeZones.length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-map-location-dot" /> {t('livreurSecZone.header.titre')}</h2>
        <p>{t('livreurSecZone.header.sub')}</p>
      </div>

      {/* ── CARD 1 : Type de livraison ── */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-route" /> {t('livreurSecZone.typeCard.titre')}</div>
          {deliveryType && (
            <span style={{ fontSize:11, background:'var(--tl-bg)', color:'var(--teal)', padding:'3px 10px', borderRadius:'var(--pill)', fontWeight:700 }}>
              {currentTypeConf?.em} {currentTypeConf?.label}
            </span>
          )}
        </div>
        <div className={ps.cb}>
          {typeLocked && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', marginBottom: 14,
              background: 'var(--g50)', border: '1.5px solid var(--bdr2)',
              borderRadius: 'var(--r-md)', fontSize: 12,
            }}>
              <i className="fas fa-lock" style={{ color:'var(--t3)', fontSize:15, flexShrink:0 }} />
              <div>
                <div style={{ fontWeight:700, color:'var(--t1)' }}>{t('livreurSecZone.typeCard.lockedTitle')}</div>
                <div style={{ color:'var(--t2)', marginTop:2 }}>
                  {t('livreurSecZone.typeCard.lockedSub', { date: unlockDate })}
                </div>
              </div>
            </div>
          )}

          {!deliveryType && !typeLocked && (
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
              <i className="fas fa-circle-info" style={{ color:'var(--blue)' }} />
              {t('livreurSecZone.typeCard.chooseHint')}
            </div>
          )}

          <div role="radiogroup" aria-label={t('livreurSecZone.typeCard.titre')}
            style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:9 }}>
            {DELIVERY_TYPES.map(type => {
              const isSelected = deliveryType === type.key;
              const isDisabled = typeLocked && !isSelected;
              return (
                <button
                  key={type.key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => selectType(type.key)}
                  disabled={isDisabled}
                  style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                    padding:'14px 8px',
                    border:`2px solid ${isSelected ? 'var(--teal)' : 'var(--bdr2)'}`,
                    borderRadius:'var(--r-md)',
                    background: isSelected ? 'var(--tl-bg)' : 'var(--g50)',
                    cursor: isDisabled ? 'not-allowed' : typeLocked ? 'default' : 'pointer',
                    transition:'border-color .15s, background .15s, transform .1s',
                    transform: isSelected && !typeLocked ? 'translateY(-2px)' : 'none',
                    opacity: isDisabled ? 0.38 : 1,
                    position:'relative', textAlign:'center', fontFamily:'inherit',
                  }}
                >
                  {isSelected && (
                    <span style={{ position:'absolute', top:5, right:7, fontSize:10, color:'var(--teal)' }}>
                      <i className={`fas ${typeLocked ? 'fa-lock' : 'fa-circle-check'}`} />
                    </span>
                  )}
                  <span style={{ fontSize:22, lineHeight:1 }}>{type.em}</span>
                  <span style={{ fontSize:11.5, fontWeight:700, color:isSelected ? 'var(--teal)' : 'var(--t1)', lineHeight:1.2 }}>{type.label}</span>
                  <span style={{ fontSize:9.5, color:'var(--t3)', lineHeight:1.3 }}>{type.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CARD 2 : Zones actives (après le choix du type) ── */}
      {deliveryType && (
        <div className={ps.card}>
          <div className={ps.ch}>
            <div className={ps.chT}>
              <i className="fas fa-location-dot" />
              {' '}{t('livreurSecZone.zonesCard.titlePrefix')}{currentTypeConf?.label.toLowerCase()}
            </div>
            <span style={{ fontSize:12, color:'var(--teal)', fontWeight:700 }}>
              {t('livreurSecZone.zonesCard.selected', { count: activeCount })}
            </span>
          </div>
          <div className={ps.cb}>
            {geoLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'28px 0', color:'var(--t3)', fontSize:13 }}>
                <i className="fas fa-circle-notch fa-spin" style={{ color:'var(--teal)', fontSize:16 }} />
                {t('livreurZone.zones.loading')}
              </div>
            ) : geoItems.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'28px 0', color:'var(--t3)', textAlign:'center' }}>
                <i className="fas fa-map-pin" style={{ fontSize:24, opacity:.35 }} />
                <span style={{ fontSize:12 }}>{t('livreurSecZone.zonesCard.emptyGeo')}</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize:11.5, color:'var(--t3)', marginBottom:10 }}>
                  {t('livreurSecZone.zonesCard.instructions')}
                </div>
                <div className={ps.zoneGrid}>
                  {geoItems.map(item => {
                    const isOn = activeZones.includes(item.nom);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        aria-pressed={isOn}
                        className={`${ps.zoneOpt} ${isOn ? ps.zoneOn : ''}`}
                        style={{ fontFamily:'inherit', textAlign:'center' }}
                        onClick={() => toggleZone(item.nom)}
                      >
                        <div className={ps.zoEm}>{currentTypeConf?.em}</div>
                        <div className={ps.zoNm}>{item.nom}</div>
                        <div className={ps.zoStat} style={{ fontSize:9, opacity:.65 }}>{item.code}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
              <button type="button" onClick={handleSaveZones} disabled={saving}
                style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                  padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                  display:'flex', alignItems:'center', gap:7 }}>
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecZone.saving')}</>
                  : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecZone.zonesCard.saveZones')}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CARD 3 : Planning hebdomadaire (affiché aux clients) ── */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-clock" /> {t('livreurSecZone.planningCard.titre')}</div>
          <div style={{ display:'flex', gap:6 }}>
            <button type="button" className={ps.chAction} onClick={() => setAllDays(true)}>{t('livreurSecZone.planningCard.activerTout')}</button>
            <button type="button" onClick={() => setAllDays(false)}
              style={{ background:'var(--g50)', color:'var(--t2)', border:'1px solid var(--bdr2)',
                borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              {t('livreurSecZone.planningCard.effacer')}
            </button>
          </div>
        </div>
        <div className={ps.cb}>
          <div className={ps.horGrid}>
            {JOURS.map((j, i) => {
              const err = erreurJour(i);
              const apresMinuit = planning.on[i] && !err && planning.close[i] < planning.open[i];
              return (
                <div key={j}>
                  <div className={`${ps.horRow} ${!planning.on[i] ? ps.horOff : ''}`}
                    style={err ? { outline:'1.5px solid var(--red)', borderRadius:'var(--r-md)' } : undefined}>
                    <div className={ps.horDay}>{j}</div>
                    <div className={ps.horT}>
                      <input className={ps.horInp} type="time" value={planning.open[i]} disabled={!planning.on[i]}
                        aria-label={`${j} — ${t('livreurSecZone.planningCard.debut')}`}
                        onChange={e => setJour(i, 'open', e.target.value)} />
                      <span className={ps.horSep}>→</span>
                      <input className={ps.horInp} type="time" value={planning.close[i]} disabled={!planning.on[i]}
                        aria-label={`${j} — ${t('livreurSecZone.planningCard.fin')}`}
                        onChange={e => setJour(i, 'close', e.target.value)} />
                    </div>
                    <label className={ps.tog}>
                      <input type="checkbox" role="switch" aria-label={j} checked={planning.on[i]}
                        onChange={e => setJour(i, 'on', e.target.checked)} />
                      <span className={ps.togs} />
                    </label>
                  </div>
                  {err && <div style={{ fontSize:11, color:'var(--red)', fontWeight:700, margin:'4px 0 2px 4px' }}><i className="fas fa-circle-exclamation" /> {t(`livreurSecZone.planningCard.erreur_${err}`)}</div>}
                  {apresMinuit && <div style={{ fontSize:11, color:'var(--t3)', margin:'4px 0 2px 4px' }}><i className="fas fa-moon" /> {t('livreurSecZone.planningCard.apresMinuit')}</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:12, marginTop:14, flexWrap:'wrap' }}>
            {joursInvalides > 0 && <span style={{ fontSize:12, color:'var(--red)', fontWeight:600 }}>{t('livreurSecZone.planningCard.corriger')}</span>}
            <button type="button" onClick={handleSaveHoraires} disabled={saving || joursInvalides > 0}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving || joursInvalides > 0 ? 0.6 : 1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving
                ? <><i className="fas fa-spinner fa-spin" /> {t('livreurSecZone.saving')}</>
                : <><i className="fas fa-cloud-arrow-up" /> {t('livreurSecZone.planningCard.saveHoraires')}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
