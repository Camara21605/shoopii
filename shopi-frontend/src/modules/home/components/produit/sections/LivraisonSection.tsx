/* ================================================================
 * src/modules/home/components/produit/sections/LivraisonSection.tsx
 *
 * DYNAMIQUE :
 *   - GET /public/livreurs → liste réelle depuis BDD
 *   - GET /public/correspondants → liste réelle
 *   - Section masquée si pas de livreurs disponibles
 *   - Fallback sur données mock si API vide
 * ================================================================ */

import React, { useState, useCallback, useEffect } from 'react';
import {
  GEO_DATA, SHOP_CONTINENT,
  SPEED_MUL, DIST_MUL, SPEED_ETA,
  type Livreur, type Correspondant,
  LIVREURS_DATA, CORRESPONDANTS as CORRESP_MOCK,
} from '../data/produitMockData';
import { produitApi, type LivreurApi, type CorrespondantApi } from '../api/produit.api';
import styles from '../styles/LivraisonSection.module.css';

export interface LivraisonState {
  selectedVille:   string | null;
  selectedPays:    string | null;
  isInternational: boolean;
  delivMode:       'standard' | 'livreur' | null;
  selectedLvr:     Livreur | null;
  selectedCorr:    Correspondant | null;
  currentSpeed:    string;
  distZone:        'local' | 'near' | 'far';
}

interface Props {
  onChange: (state: LivraisonState) => void;
  onToast:  (m: string) => void;
}

/* ── Helpers ── */
function calcFee(baseFee: number, distZone: string, speed: string): number {
  return Math.round(baseFee * (DIST_MUL[distZone] || 1) * (SPEED_MUL[speed] || 1) / 1000) * 1000;
}
function getDistZone(ville: string, pays: string): 'local' | 'near' | 'far' {
  if (pays !== 'GN') return 'far';
  if (['Conakry','Coyah'].includes(ville)) return 'local';
  if (['Kindia','Boké'].includes(ville))   return 'near';
  return 'far';
}
function getDistBadge(isIntl: boolean, distZone: string) {
  if (isIntl)             return { label:'🌍 International — Autre continent', cls:styles.distIntl, note:'Correspondant recommandé'       };
  if (distZone==='local') return { label:'📍 Même zone — Conakry',            cls:styles.distSame, note:'Tarif de base livreur'           };
  if (distZone==='near')  return { label:'🗺️ Ville proche — ~120 km',         cls:styles.distNear, note:'+30% sur le tarif de base'       };
  return                         { label:'📦 Autre région — +200 km',          cls:styles.distFar,  note:'+80% sur le tarif de base'       };
}

/* Convertit LivreurApi → Livreur (type mock) */
function toLivreur(l: LivreurApi): Livreur {
  return { id: parseInt(l.id) || 0, em: l.emoji, name: l.nom, zone: l.zone,
    rating: String(l.rating), trips: String(l.totalTrips), online: l.online,
    baseFee: l.baseFee, distZone: l.distZone, source: l.source };
}
function toCorrespondant(c: CorrespondantApi): Correspondant {
  return { id: parseInt(c.id) || 0, em: c.emoji, name: c.nom, region: c.region,
    type: c.type, rating: String(c.rating), missions: c.missions,
    online: c.online, baseFee: c.baseFee };
}

const SPEED_OPTIONS = [
  { key:'eco',      icon:'🐢', label:'Économique', mul:'×1.0' },
  { key:'standard', icon:'🚴', label:'Standard',   mul:'×1.3' },
  { key:'express',  icon:'🚀', label:'Express',    mul:'×1.8' },
  { key:'ultra',    icon:'⚡', label:'Ultra',      mul:'×2.5' },
];

export default function LivraisonSection({ onChange, onToast }: Props) {
  const [cont,      setCont]      = useState('');
  const [pays,      setPays]      = useState('');
  const [ville,     setVille]     = useState('');
  const [isIntl,    setIsIntl]    = useState(false);
  const [distZ,     setDistZ]     = useState<'local'|'near'|'far'>('local');
  const [corrMode,  setCorrMode]  = useState<'direct'|'corr'|null>(null);
  const [selCorr,   setSelCorr]   = useState<Correspondant|null>(null);
  const [delMode,   setDelMode]   = useState<'standard'|'livreur'|null>(null);
  const [selLvr,    setSelLvr]    = useState<Livreur|null>(null);
  const [speed,     setSpeed]     = useState('standard');

  /* Données API */
  const [livreurs,       setLivreurs]       = useState<Livreur[]>([]);
  const [correspondants, setCorrespondants] = useState<Correspondant[]>([]);
  const [loadingLvr,     setLoadingLvr]     = useState(false);
  const [loadingCorr,    setLoadingCorr]    = useState(false);

  /* ── Charger les livreurs quand une ville est sélectionnée ── */
  useEffect(() => {
    if (!ville) return;
    setLoadingLvr(true);
    produitApi.getLivreurs(ville)
      .then(data => {
        if (data && data.length > 0) setLivreurs(data.map(toLivreur));
        else setLivreurs(LIVREURS_DATA); // fallback mock
      })
      .catch(() => setLivreurs(LIVREURS_DATA))
      .finally(() => setLoadingLvr(false));
  }, [ville]);

  /* ── Charger les correspondants si boutique internationale ── */
  useEffect(() => {
    if (!isIntl) return;
    setLoadingCorr(true);
    produitApi.getCorrespondants()
      .then(data => {
        if (data && data.length > 0) setCorrespondants(data.map(toCorrespondant));
        else setCorrespondants(CORRESP_MOCK);
      })
      .catch(() => setCorrespondants(CORRESP_MOCK))
      .finally(() => setLoadingCorr(false));
  }, [isIntl]);

  const notify = useCallback((overrides: Partial<LivraisonState>) => {
    onChange({
      selectedVille: ville || null, selectedPays: pays || null,
      isInternational: isIntl, delivMode: delMode,
      selectedLvr: selLvr, selectedCorr: selCorr,
      currentSpeed: speed, distZone: distZ, ...overrides,
    });
  }, [ville, pays, isIntl, delMode, selLvr, selCorr, speed, distZ]);

  function handleContinent(v: string) {
    setCont(v); setPays(''); setVille('');
    setIsIntl(false); setCorrMode(null); setSelCorr(null);
    setDelMode(null); setSelLvr(null);
    notify({ selectedVille:null, selectedPays:null, isInternational:false, delivMode:null, selectedLvr:null, selectedCorr:null });
  }
  function handlePays(v: string) {
    setPays(v); setVille('');
    setCorrMode(null); setSelCorr(null); setDelMode(null); setSelLvr(null);
    notify({ selectedVille:null, selectedPays:v, delivMode:null, selectedLvr:null, selectedCorr:null });
  }
  function handleVille(v: string) {
    setVille(v);
    const international = cont !== SHOP_CONTINENT;
    const dz = getDistZone(v, pays);
    setIsIntl(international); setDistZ(dz);
    if (!international) { setCorrMode(null); setSelCorr(null); }
    notify({ selectedVille:v, selectedPays:pays, isInternational:international, distZone:dz, delivMode:null, selectedLvr:null, selectedCorr:null });
  }
  function handleCorrMode(mode: 'direct'|'corr') {
    setCorrMode(mode); setSelCorr(null);
    notify({ selectedCorr:null });
  }
  function handleSelCorr(c: Correspondant) {
    setSelCorr(c); onToast(`✅ Correspondant : ${c.name}`);
    notify({ selectedCorr:c });
  }
  function handleDelMode(mode: 'standard'|'livreur') {
    setDelMode(mode); setSelLvr(null);
    notify({ delivMode:mode, selectedLvr:null });
  }
  function handleSelLvr(l: Livreur) {
    setSelLvr(l);
    const fee = calcFee(l.baseFee, distZ, speed);
    onToast(`✅ ${l.name} — ${fee.toLocaleString('fr')} GNF`);
    notify({ selectedLvr:l });
  }
  function handleSpeed(s: string) {
    setSpeed(s); notify({ currentSpeed:s });
  }

  const distBadge = ville ? getDistBadge(isIntl, distZ) : null;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHd}>
        <i className="fas fa-truck-fast" />
        <span className={styles.hdTitle}>Livraison &amp; Réception</span>
        <span className={styles.hdReq}>Requis avant commande</span>
      </div>

      {/* ÉTAPE 1 — Adresse */}
      <div className={styles.step}>
        <div className={styles.stepTitle}>
          <span className={styles.stepNum}>1</span>
          Votre adresse de destination
          {ville && <span className={styles.stepDone}><i className="fas fa-check-circle" /> Renseigné</span>}
        </div>
        <div className={styles.addrRow}>
          <select className={styles.field} value={cont} onChange={e => handleContinent(e.target.value)}>
            <option value="">-- Votre continent --</option>
            {Object.entries(GEO_DATA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className={styles.field} value={pays} onChange={e => handlePays(e.target.value)} disabled={!cont}>
            <option value="">-- Votre pays --</option>
            {cont && GEO_DATA[cont] && Object.entries(GEO_DATA[cont].pays).map(([code, data]) => (
              <option key={code} value={code}>{data.label}</option>
            ))}
          </select>
        </div>
        {pays && (
          <div className={styles.addrRow}>
            <select className={styles.field} value={ville} onChange={e => handleVille(e.target.value)}>
              <option value="">-- Votre ville --</option>
              {GEO_DATA[cont]?.pays[pays]?.villes.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <input type="text" className={styles.field} placeholder="Quartier / Rue (optionnel)" />
          </div>
        )}
        {distBadge && (
          <div className={styles.distWrap}>
            <span className={`${styles.distBadge} ${distBadge.cls}`}>{distBadge.label}</span>
            <span className={styles.distNote}>{distBadge.note}</span>
          </div>
        )}
      </div>

      {/* ÉTAPE 2 — Correspondant (si international) */}
      {isIntl && ville && (
        <div className={styles.step}>
          <div className={styles.stepTitle}>
            <span className={styles.stepNum}>2</span>
            Correspondant Shopi
            {(corrMode === 'direct' || selCorr) && <span className={styles.stepDone}><i className="fas fa-check-circle" /> Sélectionné</span>}
          </div>
          <div className={styles.corrBlock}>
            <div className={styles.corrBlockTitle}><i className="fas fa-map-pin" /> Boutique en dehors de votre continent</div>
            <div className={styles.corrBlockDesc}>
              <strong>Pourquoi un correspondant ?</strong><br />
              La boutique est à l'international. Un correspondant Shopi peut réceptionner votre colis, vérifier son état et vous le remettre.
            </div>
            <div className={styles.corrChoix}>
              {[
                { mode:'direct' as const, ico:'📦', titre:'Livraison directe',   sub:'La boutique expédie directement (délai plus long)' },
                { mode:'corr'   as const, ico:'🤝', titre:'Via un correspondant', sub:'Recommandé — relais local, plus sûr et plus rapide' },
              ].map(opt => (
                <div key={opt.mode} className={`${styles.corrOpt} ${corrMode === opt.mode ? styles.corrOptSel : ''}`}
                  onClick={() => handleCorrMode(opt.mode)}>
                  <div className={`${styles.corrOptRadio} ${corrMode === opt.mode ? styles.corrOptRadioOn : ''}`} />
                  <div className={styles.corrOptIco}>{opt.ico}</div>
                  <div className={styles.corrOptTitre}>{opt.titre}</div>
                  <div className={styles.corrOptSub}>{opt.sub}</div>
                </div>
              ))}
            </div>

            {corrMode === 'corr' && (
              <div className={styles.corrList}>
                <div className={styles.corrListHd}><i className="fas fa-users" /> Correspondants disponibles</div>
                {loadingCorr ? (
                  <div style={{ padding:'16px', textAlign:'center', color:'var(--t3)' }}>
                    <i className="fas fa-circle-notch fa-spin" />
                  </div>
                ) : correspondants.map(c => (
                  <div key={c.id} className={`${styles.corrCard} ${selCorr?.id === c.id ? styles.corrCardSel : ''}`}
                    onClick={() => handleSelCorr(c)}>
                    <div className={styles.corrAva}>{c.em}</div>
                    <div className={styles.corrInfo}>
                      <div className={styles.corrName}>{c.name}</div>
                      <div className={styles.corrMeta}>
                        <span className={styles.corrLoc}><i className="fas fa-location-dot" /> {c.region}</span>
                        <span className={styles.corrType}>{c.type}</span>
                        <span className={styles.corrRating}><i className="fas fa-star" /> {c.rating}</span>
                      </div>
                    </div>
                    <div className={styles.corrRight}>
                      <div className={styles.corrFee}>{c.baseFee.toLocaleString('fr')} GNF<small>frais corresp.</small></div>
                      <div className={`${styles.corrRadio} ${selCorr?.id === c.id ? styles.corrRadioOn : ''}`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ÉTAPE 3 — Mode livraison finale */}
      {ville && (!isIntl || corrMode) && (
        <div className={styles.step}>
          <div className={styles.stepTitle}>
            <span className={styles.stepNum}>{isIntl ? '3' : '2'}</span>
            Mode de livraison finale
            {delMode && (delMode === 'standard' || selLvr) && <span className={styles.stepDone}><i className="fas fa-check-circle" /> Sélectionné</span>}
          </div>

          <div className={styles.modeGrid}>
            <div className={`${styles.modeOpt} ${delMode === 'standard' ? styles.modeOptSel : ''}`}
              onClick={() => handleDelMode('standard')}>
              <div className={styles.modeOptTop}>
                <div className={`${styles.modeRadio} ${delMode === 'standard' ? styles.modeRadioOn : ''}`} />
                <div className={styles.modeIco}>🚚</div>
                <div><div className={styles.modeTitle}>Livraison standard</div><div className={styles.modeSub}>Gérée par la boutique</div></div>
              </div>
              <span className={`${styles.modePrix} ${styles.modePrixGreen}`}>Gratuite</span>
              <div className={styles.modeDel}><i className="fas fa-calendar" /> Délai selon la distance</div>
            </div>

            {/* Option livreur — masquée si aucun livreur disponible */}
            {(livreurs.length > 0 || loadingLvr) && (
              <div className={`${styles.modeOpt} ${delMode === 'livreur' ? styles.modeOptSel : ''}`}
                onClick={() => !loadingLvr && handleDelMode('livreur')}>
                <div className={styles.modeOptTop}>
                  <div className={`${styles.modeRadio} ${delMode === 'livreur' ? styles.modeRadioOn : ''}`} />
                  <div className={styles.modeIco}>🛵</div>
                  <div><div className={styles.modeTitle}>Choisir un livreur</div><div className={styles.modeSub}>Livreurs de votre réseau</div></div>
                </div>
                {loadingLvr
                  ? <span className={styles.modePrix}><i className="fas fa-circle-notch fa-spin" /></span>
                  : <span className={`${styles.modePrix} ${styles.modePrixTeal}`}>
                      À partir de {Math.min(...livreurs.map(l => calcFee(l.baseFee, distZ, speed))).toLocaleString('fr')} GNF
                    </span>
                }
                <div className={styles.modeDel}><i className="fas fa-bolt" /> Prix selon distance + vitesse</div>
              </div>
            )}
          </div>

          {/* Panneau livreurs */}
          {delMode === 'livreur' && !loadingLvr && (
            <div className={styles.livreurPanel}>
              <div className={styles.panelHd}>
                <div><div className={styles.panelTitle}>Choisissez votre livreur</div><div className={styles.panelSub}>Livreurs abonnés à vous et à la boutique</div></div>
                <div className={styles.srcTags}>
                  <span className={`${styles.srcTag} ${styles.srcClient}`}><i className="fas fa-user" /> Mes abonnés</span>
                  <span className={`${styles.srcTag} ${styles.srcBoutique}`}><i className="fas fa-store" /> Boutique</span>
                </div>
              </div>

              <div className={styles.speedLabel}><i className="fas fa-gauge" style={{ color:'var(--blue)' }} /> Vitesse de livraison</div>
              <div className={styles.speedSel}>
                {SPEED_OPTIONS.map(s => (
                  <button key={s.key} className={`${styles.speedBtn} ${speed === s.key ? styles.speedBtnActive : ''}`}
                    onClick={() => handleSpeed(s.key)}>
                    <span className={styles.speedIcon}>{s.icon}</span>
                    <span className={styles.speedName}>{s.label}</span>
                    <span className={styles.speedMul}>{s.mul}</span>
                  </button>
                ))}
              </div>

              <div className={styles.livreurList}>
                {livreurs.map(l => {
                  const fee  = calcFee(l.baseFee, distZ, speed);
                  const base = Math.round(l.baseFee * DIST_MUL[distZ] / 1000) * 1000;
                  const eta  = SPEED_ETA[l.distZone]?.[speed] || SPEED_ETA['local'][speed];
                  const feeColor = distZ==='local'?'var(--teal)':distZ==='near'?'var(--blue)':'var(--amber)';
                  return (
                    <div key={l.id} className={`${styles.lvCard} ${selLvr?.id === l.id ? styles.lvCardSel : ''}`}
                      onClick={() => handleSelLvr(l)}>
                      <div className={styles.lvAvaWrap}>
                        <div className={styles.lvAva}>{l.em}</div>
                        <div className={`${styles.lvDot} ${l.online ? styles.lvDotOn : styles.lvDotOff}`} />
                      </div>
                      <div className={styles.lvInfo}>
                        <div className={styles.lvName}>{l.name}</div>
                        <div className={styles.lvMeta}>
                          <span className={styles.lvZone}><i className="fas fa-location-dot" /> {l.zone}</span>
                          <span className={styles.lvRat}><i className="fas fa-star" /> {l.rating}</span>
                        </div>
                        <div className={styles.lvMeta} style={{ marginTop:4 }}>
                          {(l.source==='client'||l.source==='both') && <span className={`${styles.lvTag} ${styles.lvTagCli}`}>👤 Votre abonné</span>}
                          {(l.source==='boutique'||l.source==='both') && <span className={`${styles.lvTag} ${styles.lvTagBou}`}>🏪 Boutique</span>}
                        </div>
                      </div>
                      <div className={styles.lvRight}>
                        <div className={styles.lvFee} style={{ color:feeColor }}>
                          {fee.toLocaleString('fr')} GNF
                          {fee !== base && <span className={styles.lvBase}>{base.toLocaleString('fr')} GNF</span>}
                        </div>
                        <div className={styles.lvEta}><i className="fas fa-clock" /> {eta}</div>
                        <div className={styles.lvDist}>{distZ==='local'?'Même ville':distZ==='near'?'Proche':'Autre région'}</div>
                        <div className={`${styles.lvRadio} ${selLvr?.id === l.id ? styles.lvRadioOn : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {selLvr && (
                <div className={styles.lvSummary}>
                  <div className={styles.summItem}><span className={styles.summLbl}>Livreur :</span><span className={styles.summVal}>{selLvr.name}</span></div>
                  <div className={styles.summSep} />
                  <div className={styles.summItem}><span className={styles.summLbl}>Vitesse :</span><span className={styles.summVal}>{SPEED_OPTIONS.find(s=>s.key===speed)?.icon} {SPEED_OPTIONS.find(s=>s.key===speed)?.label}</span></div>
                  <div className={styles.summSep} />
                  <div className={styles.summItem}><span className={styles.summLbl}>Frais :</span><span className={`${styles.summVal} ${styles.summValTeal}`}>{calcFee(selLvr.baseFee, distZ, speed).toLocaleString('fr')} GNF</span></div>
                  <div className={styles.summSep} />
                  <div className={styles.summItem}><span className={styles.summLbl}>Délai :</span><span className={styles.summVal}>{SPEED_ETA[selLvr.distZone]?.[speed]}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const SPEED_OPTIONS_LABELS: Record<string, string> = {
  eco:'Économique 🐢', standard:'Standard 🚴', express:'Express 🚀', ultra:'Ultra ⚡'
};