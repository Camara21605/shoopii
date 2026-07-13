/*
 * FICHIER : src/dashboards/livreur/pages/params/SecZone.tsx
 * ✅ CONNECTÉ — type de livraison + zones dynamiques depuis le référentiel géo
 */
import React, { useState, useEffect } from 'react';
import { JOURS, AUTO_DISPO, DELIVERY_TYPES } from '../../data/parametresData';
import type { LivreurData, HoraireJour } from '../../hooks/useLivreurParametres';
import { apiFetch } from '../../../../shared/services/apiFetch';
import ps from '../../styles/ParamsShared.module.css';

const JOURS_API = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];

interface GeoItem { id: string; nom: string; code: string; }

function computeLock(setAt: string | null): { locked: boolean; unlockDate: string } {
  if (!setAt) return { locked: false, unlockDate: '' };
  const d = new Date(setAt);
  d.setMonth(d.getMonth() + 6);
  const locked = new Date() < d;
  const unlockDate = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return { locked, unlockDate };
}

interface Props {
  data:          LivreurData | null;
  saving:        boolean;
  dirty:         () => void;
  onPop:         (m: string, t?: string) => void;
  saveZones:     (body: Partial<LivreurData>) => Promise<void>;
  saveHoraires:  (h: HoraireJour[]) => Promise<void>;
}

export default function SecZone({ data, saving, dirty, onPop, saveZones, saveHoraires }: Props) {
  const [deliveryType, setDeliveryType] = useState('');
  const [typeLocked,   setTypeLocked]   = useState(false);
  const [unlockDate,   setUnlockDate]   = useState('');
  const [geoItems,     setGeoItems]     = useState<GeoItem[]>([]);
  const [geoLoading,   setGeoLoading]   = useState(false);
  const [activeZones,  setActiveZones]  = useState<string[]>([]);
  const [dist,         setDist]         = useState(25);
  const [horOn,        setHorOn]        = useState(JOURS.map((_,i) => i < 6));
  const [horOpen,      setHorOpen]      = useState(JOURS.map(() => '07:00'));
  const [horClose,     setHorClose]     = useState(JOURS.map(() => '21:00'));
  const [autoDisp,     setAutoDisp]     = useState(AUTO_DISPO.map(a => a.on));

  /* ── Init depuis l'API ── */
  useEffect(() => {
    if (!data) return;
    setDeliveryType(data.deliveryType ?? '');
    setDist(data.distanceMax ?? 25);
    if (data.communesActives?.length) setActiveZones(data.communesActives);
    const { locked, unlockDate: ud } = computeLock(data.deliveryTypeSetAt);
    setTypeLocked(locked);
    setUnlockDate(ud);

    if (data.horaires?.length) {
      const sorted = [...data.horaires].sort(
        (a, b) => JOURS_API.indexOf(a.jour) - JOURS_API.indexOf(b.jour),
      );
      setHorOn(sorted.map(h => h.actif));
      setHorOpen(sorted.map(h => h.ouverture ?? '07:00'));
      setHorClose(sorted.map(h => h.fermeture ?? '21:00'));
    }
    if (data.autoDispoSettings) {
      const vals = Object.values(data.autoDispoSettings);
      setAutoDisp(prev => prev.map((v, i) => vals[i] ?? v));
    }
  }, [data]);

  /* ── Chargement des zones géo selon le type ── */
  useEffect(() => {
    if (!deliveryType) { setGeoItems([]); return; }
    const typeConf = DELIVERY_TYPES.find(t => t.key === deliveryType);
    if (!typeConf) return;
    let cancelled = false;
    setGeoLoading(true);
    apiFetch<GeoItem[]>(`/geo/items?niveau=${typeConf.niveau}`)
      .then(d  => { if (!cancelled) setGeoItems(d ?? []); })
      .catch(() => { if (!cancelled) setGeoItems([]); })
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
  }, [deliveryType]);

  function selectType(key: string) {
    if (typeLocked || key === deliveryType) return;
    setDeliveryType(key);
    setActiveZones([]);
    dirty();
    onPop(`📦 ${DELIVERY_TYPES.find(t => t.key === key)?.label}`, 'i');
  }

  function toggleZone(nom: string) {
    setActiveZones(prev =>
      prev.includes(nom) ? prev.filter(z => z !== nom) : [...prev, nom],
    );
    dirty();
  }

  function setAllDays(on: boolean) {
    setHorOn(JOURS.map(() => on));
    dirty();
    onPop(on ? '✅ Tous les jours activés' : '⚠️ Planning effacé', on ? 's' : 'w');
  }

  async function handleSaveZones() {
    try {
      await saveZones({
        deliveryType:      deliveryType || undefined,
        communesActives:   activeZones,
        distanceMax:       dist,
        autoDispoSettings: Object.fromEntries(
          AUTO_DISPO.map((item, i) => [item.key ?? `auto${i}`, autoDisp[i]]),
        ),
      } as any);
      onPop('✅ Zones et disponibilité sauvegardées', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  async function handleSaveHoraires() {
    try {
      const horaires: HoraireJour[] = JOURS_API.map((jour, i) => ({
        id:        data?.horaires?.find(h => h.jour === jour)?.id ?? '',
        jour,
        actif:     horOn[i],
        ouverture: horOn[i] ? horOpen[i]  : null,
        fermeture: horOn[i] ? horClose[i] : null,
      }));
      await saveHoraires(horaires);
      onPop('✅ Horaires sauvegardés', 's');
    } catch (err: any) {
      onPop(err?.message ?? '❌ Erreur lors de la sauvegarde', 'e');
    }
  }

  const currentTypeConf = DELIVERY_TYPES.find(t => t.key === deliveryType);
  const activeCount      = activeZones.length;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className={ps.psHd}>
        <h2><i className="fas fa-map-location-dot" /> Zones & Horaires</h2>
        <p>Définissez votre périmètre de livraison et vos plages horaires.</p>
      </div>

      {/* ── CARD 1 : Type de livraison ── */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-route" /> Type de livraison</div>
          {deliveryType && (
            <span style={{ fontSize:11, background:'var(--tl-bg)', color:'var(--teal)', padding:'3px 10px', borderRadius:'var(--pill)', fontWeight:700 }}>
              {currentTypeConf?.em} {currentTypeConf?.label}
            </span>
          )}
        </div>
        <div className={ps.cb}>
          {/* Bandeau de verrouillage */}
          {typeLocked && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', marginBottom: 14,
              background: 'rgba(234,179,8,.08)',
              border: '1.5px solid rgba(234,179,8,.35)',
              borderRadius: 'var(--r-md)', fontSize: 12,
            }}>
              <i className="fas fa-lock" style={{ color:'#b45309', fontSize:15, flexShrink:0 }} />
              <div>
                <div style={{ fontWeight:700, color:'#92400e' }}>Type de livraison verrouillé</div>
                <div style={{ color:'#78350f', marginTop:2 }}>
                  Modifiable à partir du <strong>{unlockDate}</strong>. Vous pouvez modifier vos zones actives à tout moment.
                </div>
              </div>
            </div>
          )}

          {!deliveryType && !typeLocked && (
            <div style={{ fontSize:12, color:'var(--t3)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
              <i className="fas fa-circle-info" style={{ color:'var(--blue)' }} />
              Choisissez votre périmètre d'intervention. Ce choix sera verrouillé pendant 6 mois.
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:9 }}>
            {DELIVERY_TYPES.map(type => {
              const isSelected = deliveryType === type.key;
              const isDisabled = typeLocked && !isSelected;
              return (
                <button
                  key={type.key}
                  type="button"
                  onClick={() => selectType(type.key)}
                  disabled={typeLocked && !isSelected}
                  style={{
                    display:       'flex',
                    flexDirection: 'column',
                    alignItems:    'center',
                    gap:           5,
                    padding:       '14px 8px',
                    border:        `2px solid ${isSelected ? 'var(--teal)' : 'var(--bdr2)'}`,
                    borderRadius:  'var(--r-md)',
                    background:    isSelected ? 'var(--tl-bg)' : isDisabled ? 'var(--g50)' : 'var(--g50)',
                    cursor:        isDisabled ? 'not-allowed' : typeLocked ? 'default' : 'pointer',
                    transition:    'border-color .15s, background .15s, transform .1s',
                    transform:     isSelected && !typeLocked ? 'translateY(-2px)' : 'none',
                    opacity:       isDisabled ? 0.38 : 1,
                    position:      'relative',
                    textAlign:     'center',
                  }}
                >
                  {isSelected && (
                    <span style={{ position:'absolute', top:5, right:7, fontSize:10, color:'var(--teal)' }}>
                      <i className={`fas ${typeLocked ? 'fa-lock' : 'fa-circle-check'}`} />
                    </span>
                  )}
                  <span style={{ fontSize:22, lineHeight:1 }}>{type.em}</span>
                  <span style={{ fontSize:11.5, fontWeight:700, color:isSelected ? 'var(--teal)' : 'var(--t1)', lineHeight:1.2 }}>
                    {type.label}
                  </span>
                  <span style={{ fontSize:9.5, color:'var(--t3)', lineHeight:1.3 }}>
                    {type.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── CARD 2 : Zones actives (conditionnelle) ── */}
      {deliveryType && (
        <div className={ps.card}>
          <div className={ps.ch}>
            <div className={ps.chT}>
              <i className="fas fa-location-dot" />
              {' '}Zones {currentTypeConf?.label.toLowerCase()}
            </div>
            <span style={{ fontSize:12, color:'var(--teal)', fontWeight:700 }}>
              {activeCount} sélectionnée{activeCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className={ps.cb}>
            {geoLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:9, padding:'28px 0', color:'var(--t3)', fontSize:13 }}>
                <i className="fas fa-circle-notch fa-spin" style={{ color:'var(--teal)', fontSize:16 }} />
                Chargement des zones…
              </div>
            ) : geoItems.length === 0 ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'28px 0', color:'var(--t3)', textAlign:'center' }}>
                <i className="fas fa-map-pin" style={{ fontSize:24, opacity:.35 }} />
                <span style={{ fontSize:12 }}>Aucune zone configurée dans le référentiel pour ce niveau.</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize:11.5, color:'var(--t3)', marginBottom:10 }}>
                  Activez les zones que vous acceptez de desservir.
                </div>
                <div className={ps.zoneGrid}>
                  {geoItems.map(item => {
                    const isOn = activeZones.includes(item.nom);
                    return (
                      <div
                        key={item.id}
                        className={`${ps.zoneOpt} ${isOn ? ps.zoneOn : ''}`}
                        onClick={() => toggleZone(item.nom)}
                      >
                        <div className={ps.zoEm}>{currentTypeConf?.em}</div>
                        <div className={ps.zoNm}>{item.nom}</div>
                        <div className={ps.zoStat} style={{ fontSize:9, opacity:.65 }}>
                          {item.code}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Slider distance */}
            <div style={{ marginTop:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:7 }}>
                <span style={{ color:'var(--t2)', fontWeight:600 }}>Distance maximale par livraison</span>
                <span style={{ fontFamily:'var(--fd)', fontWeight:800, color:'var(--teal)' }}>{dist} km</span>
              </div>
              <input type="range" min={5} max={200} value={dist} step={5}
                onChange={e => { setDist(+e.target.value); dirty(); }}
                style={{ width:'100%', accentColor:'var(--teal)', cursor:'pointer' }} />
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--t4)', marginTop:4 }}>
                <span>5 km</span><span>200 km</span>
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
              <button onClick={handleSaveZones} disabled={saving}
                style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                  padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                  display:'flex', alignItems:'center', gap:7 }}>
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</>
                  : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les zones</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bouton save zones quand aucun type choisi (pour sauver la sélection de type seulement) */}
      {!deliveryType && (
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={handleSaveZones} disabled={saving || !deliveryType}
            style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
              padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:0.4,
              display:'flex', alignItems:'center', gap:7 }}>
            <i className="fas fa-cloud-arrow-up" /> Sauvegarder les zones
          </button>
        </div>
      )}

      {/* ── CARD 3 : Planning hebdomadaire ── */}
      <div className={ps.card}>
        <div className={ps.ch}>
          <div className={ps.chT}><i className="fas fa-clock" /> Planning hebdomadaire</div>
          <div style={{ display:'flex', gap:6 }}>
            <button className={ps.chAction} onClick={() => setAllDays(true)}>Tout activer</button>
            <button onClick={() => setAllDays(false)}
              style={{ background:'var(--g50)', color:'var(--t2)', border:'1px solid var(--bdr2)',
                borderRadius:'var(--pill)', padding:'5px 13px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
              Effacer
            </button>
          </div>
        </div>
        <div className={ps.cb}>
          <div className={ps.horGrid}>
            {JOURS.map((j, i) => (
              <div key={j} className={`${ps.horRow} ${!horOn[i] ? ps.horOff : ''}`}>
                <div className={ps.horDay}>{j}</div>
                <div className={ps.horT}>
                  <input className={ps.horInp} type="time" value={horOpen[i]} disabled={!horOn[i]}
                    onChange={e => { const n=[...horOpen]; n[i]=e.target.value; setHorOpen(n); dirty(); }} />
                  <span className={ps.horSep}>→</span>
                  <input className={ps.horInp} type="time" value={horClose[i]} disabled={!horOn[i]}
                    onChange={e => { const n=[...horClose]; n[i]=e.target.value; setHorClose(n); dirty(); }} />
                </div>
                <label className={ps.tog}>
                  <input type="checkbox" checked={horOn[i]}
                    onChange={e => { const n=[...horOn]; n[i]=e.target.checked; setHorOn(n); dirty(); }} />
                  <span className={ps.togs} />
                </label>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:14 }}>
            <button onClick={handleSaveHoraires} disabled={saving}
              style={{ background:'var(--teal)', color:'#fff', border:'none', borderRadius:'var(--pill)',
                padding:'10px 22px', fontSize:12, fontWeight:700, cursor:'pointer', opacity:saving?0.6:1,
                display:'flex', alignItems:'center', gap:7 }}>
              {saving
                ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</>
                : <><i className="fas fa-cloud-arrow-up" /> Sauvegarder les horaires</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── CARD 4 : Disponibilité automatique ── */}
      <div className={`${ps.card} ${ps.cardLast}`}>
        <div className={ps.ch}><div className={ps.chT}><i className="fas fa-robot" /> Disponibilité automatique</div></div>
        <div className={ps.cb}>
          {AUTO_DISPO.map((item, i) => (
            <div key={i} className={ps.setRow}>
              <div>
                <div className={ps.srLbl}>
                  {item.l}
                  {item.badge && (
                    <span className={`${ps.srBadge} ${item.badge==='rec' ? ps.badgeRec : ps.badgeNew}`}>
                      {item.badge==='rec' ? 'Auto' : 'Nouveau'}
                    </span>
                  )}
                </div>
                <div className={ps.srSub}>{item.sub}</div>
              </div>
              <label className={ps.tog}>
                <input type="checkbox" checked={autoDisp[i]}
                  onChange={e => { const n=[...autoDisp]; n[i]=e.target.checked; setAutoDisp(n); dirty(); }} />
                <span className={ps.togs} />
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
