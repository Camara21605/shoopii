/* ================================================================
 * FICHIER : sections/geo/GeoModal.tsx
 *
 * Modal de création / édition d'un élément géographique.
 *
 * ── Pays ──
 *   Sélecteur mondial avec auto-remplissage (ISO2, ISO3, indicatif,
 *   devise).
 *
 * ── Région / Préfecture / Commune / Quartier ──
 *   Sélecteurs en cascade : Pays → Région → Préfecture → Commune.
 *   Chaque liste se filtre selon le parent choisi.
 *
 * ── Zone de livraison ──
 *   Type de couverture + navigation + sélection MULTIPLE.
 *   Une zone peut couvrir N entités du même niveau :
 *     Quartiers | Communes | Préfectures | Régions | Pays
 * ================================================================ */

import { useState, useEffect, useRef } from 'react';
import s from '../GeoReferentielSection.module.css';
import type {
  GeoItem, GeoLevel, GeoLevelConfig, AllGeoData,
  ZoneCoverageType, ZoneLivraison,
} from './geo.types';
import { GEO_LEVELS } from './geo.types';
import { COUNTRIES_DB } from './countries.data';
import type { WorldCountry } from './countries.data';

/* ================================================================
 * PROPS
 * ================================================================ */
interface GeoModalProps {
  mode:     'create' | 'edit';
  level:    GeoLevel;
  item?:    GeoItem;
  allData?: AllGeoData;
  parents?: { id: string; nom: string }[];
  onSave:  (data: Partial<GeoItem>) => void;
  onClose: () => void;
}

/* ================================================================
 * CHAMPS SPÉCIFIQUES PAR NIVEAU
 * ================================================================ */
const EXTRA_FIELDS: Partial<Record<GeoLevel, { key: string; label: string; type?: string }[]>> = {
  pays:       [
    { key: 'iso2',      label: 'Code ISO 2 (ex: GN)',       type: 'text'   },
    { key: 'iso3',      label: 'Code ISO 3 (ex: GIN)',      type: 'text'   },
    { key: 'indicatif', label: 'Indicatif (ex: +224)',      type: 'text'   },
    { key: 'devise',    label: 'Devise ISO 4217 (ex: GNF)', type: 'text'   },
  ],
  region:     [{ key: 'chef_lieu', label: 'Chef-lieu',          type: 'text'   }],
  prefecture: [{ key: 'chef_lieu', label: 'Chef-lieu',          type: 'text'   }],
  commune:    [{ key: 'type',      label: 'Type de commune',    type: 'select' }],
  quartier:   [{ key: 'population',label: 'Population estimée', type: 'number' }],
  zone:       [
    { key: 'rayonKm',        label: 'Rayon (km)',            type: 'number' },
    { key: 'fraisLivraison', label: 'Frais livraison (GNF)', type: 'number' },
    { key: 'tempsEstime',    label: 'Temps estimé (min)',    type: 'number' },
  ],
};

/* ================================================================
 * SOUS-COMPOSANT : CountryPicker (niveau Pays)
 * ================================================================ */
interface CountryPickerProps {
  value: string; onSelect: (c: WorldCountry) => void;
  onClear: () => void; autoFilled: boolean;
}
function CountryPicker({ value, onSelect, onClear, autoFilled }: CountryPickerProps) {
  const [query, setQuery] = useState(value);
  const [open,  setOpen]  = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const filtered = COUNTRIES_DB.filter(c => {
    const q = query.toLowerCase();
    return c.nom.toLowerCase().includes(q) || c.nomEn.toLowerCase().includes(q) ||
           c.iso2.toLowerCase().includes(q) || c.indicatif.includes(q);
  }).slice(0, 12);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <i className="fas fa-magnifying-glass" style={{
          position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--txt-3)', fontSize: 12, pointerEvents: 'none',
        }} />
        <input className={s.fldIn}
          style={{ paddingLeft: 32, paddingRight: autoFilled ? 56 : 32 }}
          value={query} placeholder="Rechercher (nom, ISO, indicatif)…"
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} autoComplete="off" />
        {autoFilled && (
          <span style={{ position: 'absolute', right: 32, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>
            {COUNTRIES_DB.find(c => c.nom === query)?.drapeau ?? ''}
          </span>
        )}
        {(query || autoFilled) && (
          <button type="button" onClick={() => { setQuery(''); setOpen(false); onClear(); }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', padding: '2px 4px' }}>
            <i className="fas fa-xmark" />
          </button>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--raised)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', marginTop: 4, maxHeight: 260,
          overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,.35)',
        }}>
          {filtered.length === 0
            ? <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--txt-3)', textAlign: 'center' }}>
                Aucun résultat pour &laquo;{query}&raquo;
              </div>
            : filtered.map(c => (
              <button key={c.iso2} type="button"
                onMouseDown={e => { e.preventDefault(); setQuery(c.nom); setOpen(false); onSelect(c); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 14px',
                  background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                <span style={{ fontSize: 20, lineHeight: 1, minWidth: 26 }}>{c.drapeau}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--txt-1)', fontWeight: 500 }}>{c.nom}</span>
                <span style={{ fontSize: 10, background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '2px 6px', color: 'var(--txt-2)', fontFamily: 'var(--font-m)' }}>
                  {c.iso2}
                </span>
                <span style={{ fontSize: 10, color: 'var(--acid)', fontFamily: 'var(--font-m)', minWidth: 38 }}>
                  {c.indicatif}
                </span>
              </button>
            ))
          }
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * SOUS-COMPOSANT : CascadeSelector (Région / Préfecture / Commune / Quartier)
 * ================================================================ */
interface CascadeProps { level: GeoLevel; allData: AllGeoData; value: string; onChange: (id: string) => void; }

function initFromParentId(level: GeoLevel, parentId: string, d: AllGeoData) {
  const empty = { paysId: '', regionId: '', prefectureId: '', communeId: '' };
  if (!parentId) return empty;
  if (level === 'region')     return { ...empty, paysId: parentId };
  if (level === 'prefecture') {
    const r = d.regions.find(r => r.id === parentId);
    return { ...empty, paysId: r?.parentId ?? '', regionId: parentId };
  }
  if (level === 'commune') {
    const p = d.prefectures.find(p => p.id === parentId);
    const r = d.regions.find(r => r.id === p?.parentId);
    return { ...empty, paysId: r?.parentId ?? '', regionId: p?.parentId ?? '', prefectureId: parentId };
  }
  if (level === 'quartier' || level === 'zone') {
    const c = d.communes.find(c => c.id === parentId);
    const p = d.prefectures.find(p => p.id === c?.parentId);
    const r = d.regions.find(r => r.id === p?.parentId);
    return { paysId: r?.parentId ?? '', regionId: p?.parentId ?? '', prefectureId: c?.parentId ?? '', communeId: parentId };
  }
  return empty;
}

function CascadeSelector({ level, allData, value, onChange }: CascadeProps) {
  const init = initFromParentId(level, value, allData);
  const [paysId,       setPaysId]       = useState(init.paysId);
  const [regionId,     setRegionId]     = useState(init.regionId);
  const [prefectureId, setPrefectureId] = useState(init.prefectureId);
  const [communeId,    setCommuneId]    = useState(init.communeId);

  const filteredRegions     = allData.regions.filter(r => !paysId       || r.parentId === paysId);
  const filteredPrefectures = allData.prefectures.filter(p => !regionId || p.parentId === regionId);
  const filteredCommunes    = allData.communes.filter(c => !prefectureId|| c.parentId === prefectureId);

  const needsRegion     = ['prefecture', 'commune', 'quartier'].includes(level);
  const needsPrefecture = ['commune', 'quartier'].includes(level);
  const needsCommune    = level === 'quartier';

  const paysNom       = allData.pays.find(p => p.id === paysId)?.nom;
  const regionNom     = allData.regions.find(r => r.id === regionId)?.nom;
  const prefNom       = allData.prefectures.find(p => p.id === prefectureId)?.nom;
  const communeNom    = allData.communes.find(c => c.id === communeId)?.nom;

  const handlePays = (id: string) => {
    setPaysId(id); setRegionId(''); setPrefectureId(''); setCommuneId('');
    onChange(level === 'region' ? id : '');
  };
  const handleRegion = (id: string) => {
    setRegionId(id); setPrefectureId(''); setCommuneId('');
    onChange(level === 'prefecture' ? id : '');
  };
  const handlePrefecture = (id: string) => {
    setPrefectureId(id); setCommuneId('');
    onChange(level === 'commune' ? id : '');
  };
  const handleCommune = (id: string) => {
    setCommuneId(id);
    onChange(level === 'quartier' ? id : '');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(paysNom || regionNom) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', fontSize: 11,
          color: 'var(--txt-3)', padding: '7px 12px', background: 'var(--surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
          <i className="fas fa-location-dot" style={{ color: 'var(--acid)', marginRight: 3 }} />
          {paysNom && <span style={{ color: 'var(--txt-2)' }}>{paysNom}</span>}
          {regionNom && <><i className="fas fa-chevron-right" style={{ fontSize: 8 }} /><span style={{ color: 'var(--txt-2)' }}>{regionNom}</span></>}
          {prefNom   && <><i className="fas fa-chevron-right" style={{ fontSize: 8 }} /><span style={{ color: 'var(--txt-2)' }}>{prefNom}</span></>}
          {communeNom&& <><i className="fas fa-chevron-right" style={{ fontSize: 8 }} /><span style={{ color: 'var(--txt-1)', fontWeight: 700 }}>{communeNom}</span></>}
        </div>
      )}
      <div className={s.fld}>
        <label className={s.fldL}><i className="fas fa-earth-africa" style={{ color: 'var(--acid)', marginRight: 5, fontSize: 11 }} />Pays <span className={s.required}>*</span></label>
        <select className={s.fldSel} value={paysId} onChange={e => handlePays(e.target.value)}>
          <option value="">— Sélectionner un pays —</option>
          {allData.pays.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.code})</option>)}
        </select>
      </div>
      {needsRegion && (
        <div className={s.fld}>
          <label className={s.fldL}><i className="fas fa-map" style={{ color: 'var(--sky)', marginRight: 5, fontSize: 11 }} />Région <span className={s.required}>*</span></label>
          <select className={s.fldSel} value={regionId} onChange={e => handleRegion(e.target.value)}
            disabled={!paysId} style={{ opacity: paysId ? 1 : 0.5 }}>
            <option value="">{paysId ? '— Sélectionner une région —' : '— Choisir un pays d\'abord —'}</option>
            {filteredRegions.map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
          {paysId && filteredRegions.length === 0 && <span className={s.fldHint} style={{ color: 'var(--gold)' }}>Aucune région pour ce pays.</span>}
        </div>
      )}
      {needsPrefecture && (
        <div className={s.fld}>
          <label className={s.fldL}><i className="fas fa-building-columns" style={{ color: 'var(--violet)', marginRight: 5, fontSize: 11 }} />Préfecture <span className={s.required}>*</span></label>
          <select className={s.fldSel} value={prefectureId} onChange={e => handlePrefecture(e.target.value)}
            disabled={!regionId} style={{ opacity: regionId ? 1 : 0.5 }}>
            <option value="">{regionId ? '— Sélectionner une préfecture —' : '— Choisir une région d\'abord —'}</option>
            {filteredPrefectures.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
          {regionId && filteredPrefectures.length === 0 && <span className={s.fldHint} style={{ color: 'var(--gold)' }}>Aucune préfecture pour cette région.</span>}
        </div>
      )}
      {needsCommune && (
        <div className={s.fld}>
          <label className={s.fldL}><i className="fas fa-city" style={{ color: 'var(--gold)', marginRight: 5, fontSize: 11 }} />Commune <span className={s.required}>*</span></label>
          <select className={s.fldSel} value={communeId} onChange={e => handleCommune(e.target.value)}
            disabled={!prefectureId} style={{ opacity: prefectureId ? 1 : 0.5 }}>
            <option value="">{prefectureId ? '— Sélectionner une commune —' : '— Choisir une préfecture d\'abord —'}</option>
            {filteredCommunes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          {prefectureId && filteredCommunes.length === 0 && <span className={s.fldHint} style={{ color: 'var(--gold)' }}>Aucune commune pour cette préfecture.</span>}
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * SOUS-COMPOSANT : ZoneCoverageSelector
 * Sélection MULTIPLE d'entités géographiques pour une zone.
 * Supporte : Quartiers | Communes | Préfectures | Régions | Pays
 * ================================================================ */
interface ZoneCoverageProps {
  allData:        AllGeoData;
  couvertureType: ZoneCoverageType;
  couvertureIds:  string[];
  onTypeChange:   (t: ZoneCoverageType) => void;
  onIdsChange:    (ids: string[]) => void;
}

const COVERAGE_TYPES: { type: ZoneCoverageType; label: string; icon: string; color: string }[] = [
  { type: 'quartier',   label: 'Quartiers',    icon: 'fa-house',            color: 'var(--coral)'  },
  { type: 'commune',    label: 'Communes',     icon: 'fa-city',             color: 'var(--gold)'   },
  { type: 'prefecture', label: 'Préfectures',  icon: 'fa-building-columns', color: 'var(--violet)' },
  { type: 'region',     label: 'Régions',      icon: 'fa-map',              color: 'var(--sky)'    },
  { type: 'pays',       label: 'Pays',         icon: 'fa-earth-africa',     color: 'var(--acid)'   },
];

function ZoneCoverageSelector({ allData, couvertureType, couvertureIds, onTypeChange, onIdsChange }: ZoneCoverageProps) {
  /* Navigation / filtre (n'affecte pas les IDs sélectionnés) */
  const [navPaysId,       setNavPaysId]       = useState('');
  const [navRegionId,     setNavRegionId]     = useState('');
  const [navPrefectureId, setNavPrefectureId] = useState('');
  const [navCommuneId,    setNavCommuneId]    = useState('');

  /* Changement de type → réinitialise tout */
  const handleTypeChange = (t: ZoneCoverageType) => {
    onTypeChange(t); onIdsChange([]);
    setNavPaysId(''); setNavRegionId(''); setNavPrefectureId(''); setNavCommuneId('');
  };

  /* Toggle sélection */
  const toggle = (id: string) =>
    onIdsChange(couvertureIds.includes(id) ? couvertureIds.filter(i => i !== id) : [...couvertureIds, id]);

  /* Liste filtrée d'entités au niveau cible */
  const entityList: GeoItem[] = (() => {
    switch (couvertureType) {
      case 'pays':       return allData.pays;
      case 'region':     return allData.regions.filter(r => !navPaysId || r.parentId === navPaysId);
      case 'prefecture': return allData.prefectures.filter(p => !navRegionId || p.parentId === navRegionId);
      case 'commune':    return allData.communes.filter(c => !navPrefectureId || c.parentId === navPrefectureId);
      case 'quartier':   return allData.quartiers.filter(q => !navCommuneId || q.parentId === navCommuneId);
    }
  })();

  /* Nom d'une entité pour les chips */
  const entityName = (id: string) => {
    const all = [...allData.pays, ...allData.regions, ...allData.prefectures, ...allData.communes, ...allData.quartiers];
    return all.find(e => e.id === id)?.nom ?? id;
  };

  const tc = COVERAGE_TYPES.find(t => t.type === couvertureType)!;
  const showNavPays       = couvertureType !== 'pays';
  const showNavRegion     = ['prefecture', 'commune', 'quartier'].includes(couvertureType);
  const showNavPrefecture = ['commune', 'quartier'].includes(couvertureType);
  const showNavCommune    = couvertureType === 'quartier';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Sélection du type de couverture ── */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>
          Type de couverture <span style={{ color: 'var(--rose)' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {COVERAGE_TYPES.map(t => (
            <button key={t.type} type="button"
              className={`${s.btnGhost} ${s.btnSm}`}
              style={{
                color: couvertureType === t.type ? t.color : 'var(--txt-2)',
                borderColor: couvertureType === t.type ? t.color : 'var(--border)',
                background: couvertureType === t.type ? `${t.color}18` : 'transparent',
                fontWeight: couvertureType === t.type ? 700 : 400,
              }}
              onClick={() => handleTypeChange(t.type)}>
              <i className={`fas ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Navigation / filtre de liste ── */}
      {(showNavPays || showNavRegion || showNavPrefecture || showNavCommune) && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>
            <i className="fas fa-filter" style={{ marginRight: 4 }} />
            Filtrer la liste par
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
            {showNavPays && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 3 }}>
                  <i className="fas fa-earth-africa" style={{ color: 'var(--acid)', marginRight: 3 }} />Pays
                </div>
                <select className={s.fldSel} value={navPaysId}
                  onChange={e => { setNavPaysId(e.target.value); setNavRegionId(''); setNavPrefectureId(''); setNavCommuneId(''); }}>
                  <option value="">Tous</option>
                  {allData.pays.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            )}
            {showNavRegion && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 3 }}>
                  <i className="fas fa-map" style={{ color: 'var(--sky)', marginRight: 3 }} />Région
                </div>
                <select className={s.fldSel} value={navRegionId} disabled={!navPaysId} style={{ opacity: navPaysId ? 1 : 0.5 }}
                  onChange={e => { setNavRegionId(e.target.value); setNavPrefectureId(''); setNavCommuneId(''); }}>
                  <option value="">Toutes</option>
                  {allData.regions.filter(r => !navPaysId || r.parentId === navPaysId).map(r => <option key={r.id} value={r.id}>{r.nom}</option>)}
                </select>
              </div>
            )}
            {showNavPrefecture && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 3 }}>
                  <i className="fas fa-building-columns" style={{ color: 'var(--violet)', marginRight: 3 }} />Préfecture
                </div>
                <select className={s.fldSel} value={navPrefectureId} disabled={!navRegionId} style={{ opacity: navRegionId ? 1 : 0.5 }}
                  onChange={e => { setNavPrefectureId(e.target.value); setNavCommuneId(''); }}>
                  <option value="">Toutes</option>
                  {allData.prefectures.filter(p => !navRegionId || p.parentId === navRegionId).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>
              </div>
            )}
            {showNavCommune && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 3 }}>
                  <i className="fas fa-city" style={{ color: 'var(--gold)', marginRight: 3 }} />Commune
                </div>
                <select className={s.fldSel} value={navCommuneId} disabled={!navPrefectureId} style={{ opacity: navPrefectureId ? 1 : 0.5 }}
                  onChange={e => setNavCommuneId(e.target.value)}>
                  <option value="">Toutes</option>
                  {allData.communes.filter(c => !navPrefectureId || c.parentId === navPrefectureId).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Liste d'entités avec cases à cocher ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
            {entityList.length} {tc.label.toLowerCase()} disponibles
          </span>
          {couvertureIds.length > 0 && (
            <span style={{ fontSize: 11, color: tc.color, fontWeight: 700 }}>
              <i className="fas fa-circle-check" style={{ marginRight: 4 }} />
              {couvertureIds.length} sélectionnée(s)
            </span>
          )}
        </div>

        {entityList.length === 0
          ? (
            <div style={{ padding: '14px', color: 'var(--txt-3)', fontSize: 12, textAlign: 'center',
              background: 'var(--surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              <i className="fas fa-triangle-exclamation" style={{ color: 'var(--gold)', marginRight: 6 }} />
              Aucune entité disponible. Ajustez les filtres ou ajoutez des données.
            </div>
          )
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 5, maxHeight: 200, overflowY: 'auto',
              padding: 10, background: 'var(--surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              {entityList.map(e => {
                const sel = couvertureIds.includes(e.id);
                return (
                  <label key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    padding: '7px 9px', borderRadius: 'var(--r-sm)',
                    background: sel ? `${tc.color}15` : 'transparent',
                    border: `1px solid ${sel ? tc.color : 'transparent'}`,
                    transition: 'all .12s',
                  }}>
                    <input type="checkbox" checked={sel} onChange={() => toggle(e.id)}
                      style={{ accentColor: tc.color, cursor: 'pointer' }} />
                    <span style={{ flex: 1, fontSize: 12, color: sel ? 'var(--txt-1)' : 'var(--txt-2)', fontWeight: sel ? 600 : 400, lineHeight: 1.3 }}>
                      {e.nom}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--txt-3)', fontFamily: 'var(--font-m)' }}>{e.code}</span>
                  </label>
                );
              })}
            </div>
          )
        }
      </div>

      {/* ── Chips des entités sélectionnées ── */}
      {couvertureIds.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>
            <i className="fas fa-layer-group" style={{ marginRight: 4 }} />
            Couverture sélectionnée
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {couvertureIds.map(id => (
              <span key={id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: `${tc.color}12`, border: `1px solid ${tc.color}40`,
                borderRadius: 'var(--pill)', padding: '4px 10px', fontSize: 11, color: 'var(--txt-1)',
              }}>
                <i className={`fas ${tc.icon}`} style={{ color: tc.color, fontSize: 9 }} />
                {entityName(id)}
                <button type="button" onClick={() => toggle(id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--txt-3)', padding: 0, lineHeight: 1, marginLeft: 2 }}>
                  <i className="fas fa-xmark" style={{ fontSize: 9 }} />
                </button>
              </span>
            ))}
            <button type="button"
              className={`${s.btnGhost} ${s.btnSm}`}
              style={{ fontSize: 10, color: 'var(--rose)', borderColor: 'var(--rose)' }}
              onClick={() => onIdsChange([])}>
              <i className="fas fa-xmark" /> Tout effacer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
export default function GeoModal({ mode, level, item, allData, parents, onSave, onClose }: GeoModalProps) {
  const cfg = GEO_LEVELS.find(l => l.level === level)! as GeoLevelConfig;

  /* ── État du formulaire ── */
  const [form, setForm] = useState<Record<string, string>>({
    nom:         item?.nom         ?? '',
    code:        item?.code        ?? '',
    description: item?.description ?? '',
    statut:      item?.statut      ?? 'actif',
    parentId:    item?.parentId    ?? '',
  });
  const [autoFilled, setAutoFilled] = useState(mode === 'edit' && level === 'pays');

  /* ── États spécifiques Zone ── */
  const zoneItem = (level === 'zone' && item) ? item as ZoneLivraison : undefined;
  const [couvertureType, setCouvertureType] = useState<ZoneCoverageType>(
    zoneItem?.couvertureType ?? 'commune'
  );
  const [couvertureIds, setCouvertureIds] = useState<string[]>(
    zoneItem?.couvertureIds ?? []
  );

  /* ── Sync édition ── */
  useEffect(() => {
    if (item) {
      setForm({ ...(item as Record<string, unknown> as Record<string, string>) });
      if (level === 'pays') setAutoFilled(true);
      if (level === 'zone') {
        const z = item as ZoneLivraison;
        setCouvertureType(z.couvertureType ?? 'commune');
        setCouvertureIds(z.couvertureIds ?? []);
      }
    }
  }, [item, level]);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  /* ── Auto-remplissage pays ── */
  const handleCountrySelect = (c: WorldCountry) => {
    setForm(f => ({ ...f, nom: c.nom, code: c.iso2, iso2: c.iso2, iso3: c.iso3, indicatif: c.indicatif, devise: c.devise }));
    setAutoFilled(true);
  };
  const handleClearCountry = () => {
    setForm(f => ({ ...f, nom: '', code: '', iso2: '', iso3: '', indicatif: '', devise: '' }));
    setAutoFilled(false);
  };

  /* ── Soumission ── */
  const handleSubmit = () => {
    if (!form.nom?.trim() || !form.code?.trim()) return;
    if (level === 'zone' && couvertureIds.length === 0) return;

    const parentId = level === 'zone'
      ? (couvertureIds[0] ?? null)
      : (form.parentId || null);

    onSave({
      ...form,
      nom:      form.nom.trim(),
      code:     form.code.trim().toUpperCase(),
      parentId,
      statut:   form.statut as 'actif' | 'inactif',
      ...(level === 'zone' ? { couvertureType, couvertureIds } : {}),
    });
  };

  const extra            = EXTRA_FIELDS[level] ?? [];
  const hasCascade       = level !== 'pays' && level !== 'zone' && !!allData;
  const hasSimpleParent  = level !== 'pays' && level !== 'zone' && !allData && !!(parents?.length);
  const isFormValid      = !!(form.nom?.trim() && form.code?.trim() && (level !== 'zone' || couvertureIds.length > 0));

  /* ================================================================
   * RENDU
   * ================================================================ */
  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>

        {/* ── En-tête ── */}
        <div className={s.modalHead}>
          <div className={s.modalTitle}>
            <i className={`fas ${cfg.icon}`} style={{ color: `var(${cfg.color})` }} />
            {mode === 'create' ? `Nouveau(lle) ${cfg.label}` : `Modifier ${cfg.label}`}
          </div>
          <button className={s.modalClose} onClick={onClose}><i className="fas fa-xmark" /></button>
        </div>

        {/* ── Corps ── */}
        <div className={s.modalBody}>
          <div className={s.fldGrid}>

            {/* ══════════════ PAYS ══════════════ */}
            {level === 'pays' && (
              <>
                <div className={`${s.fld} ${s.fldFull}`}>
                  <label className={s.fldL}>
                    Sélectionner un pays <span className={s.required}>*</span>
                    <span style={{ fontSize: 10, color: 'var(--txt-3)', fontWeight: 400, marginLeft: 8 }}>
                      Tous les champs s&apos;auto-remplissent
                    </span>
                  </label>
                  <CountryPicker value={form.nom ?? ''} onSelect={handleCountrySelect}
                    onClear={handleClearCountry} autoFilled={autoFilled} />
                </div>
                {autoFilled && (
                  <div className={s.fldFull} style={{ background: 'rgba(0,200,138,.08)', border: '1px solid rgba(0,200,138,.25)',
                    borderRadius: 'var(--r-sm)', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <i className="fas fa-circle-check" style={{ color: 'var(--acid)' }} />
                    <span>Auto-rempli — <span style={{ color: 'var(--txt-2)' }}>modifiez si nécessaire.</span></span>
                  </div>
                )}
                <div className={s.fldFull} style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />
                <div className={`${s.fld} ${s.fldFull}`}>
                  <label className={s.fldL}>Nom <span className={s.required}>*</span></label>
                  <input className={s.fldIn} value={form.nom ?? ''} placeholder="Ex : Guinée" onChange={e => set('nom', e.target.value)} />
                </div>
                <div className={s.fld}>
                  <label className={s.fldL}>Code / ISO 2 <span className={s.required}>*</span></label>
                  <input className={s.fldIn} value={form.code ?? ''} placeholder="Ex: GN"
                    onChange={e => set('code', e.target.value.toUpperCase())}
                    style={{ fontFamily: 'var(--font-m)', letterSpacing: 2 }} />
                </div>
                <div className={s.fld}>
                  <label className={s.fldL}>Statut</label>
                  <select className={s.fldSel} value={form.statut} onChange={e => set('statut', e.target.value)}>
                    <option value="actif">Actif</option><option value="inactif">Inactif</option>
                  </select>
                </div>
                {extra.filter(xf => xf.key !== 'iso2').map(xf => (
                  <div key={xf.key} className={s.fld}>
                    <label className={s.fldL}>{xf.label}</label>
                    <input className={s.fldIn} type={xf.type ?? 'text'} value={form[xf.key] ?? ''} placeholder={xf.label}
                      onChange={e => set(xf.key, e.target.value)}
                      style={xf.key === 'indicatif' || xf.key === 'iso3' ? { fontFamily: 'var(--font-m)' } : undefined} />
                  </div>
                ))}
              </>
            )}

            {/* ══════════════ RÉGION / PRÉFECTURE / COMMUNE / QUARTIER ══════════════ */}
            {level !== 'pays' && level !== 'zone' && (
              <>
                {hasCascade && (
                  <div className={`${s.fld} ${s.fldFull}`}>
                    <label className={s.fldL} style={{ marginBottom: 10 }}>
                      Localisation hiérarchique <span className={s.required}>*</span>
                      <span style={{ fontSize: 10, color: 'var(--txt-3)', fontWeight: 400, marginLeft: 8 }}>
                        Naviguez pour placer ce(tte) {cfg.label.toLowerCase()}
                      </span>
                    </label>
                    <CascadeSelector level={level} allData={allData!}
                      value={form.parentId ?? ''} onChange={id => set('parentId', id)} />
                  </div>
                )}
                {hasSimpleParent && (
                  <div className={s.fld}>
                    <label className={s.fldL}>
                      {GEO_LEVELS.find(l => l.level === cfg.parentLevel)?.label ?? 'Parent'} <span className={s.required}>*</span>
                    </label>
                    <select className={s.fldSel} value={form.parentId} onChange={e => set('parentId', e.target.value)}>
                      <option value="">— Sélectionner —</option>
                      {parents!.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </select>
                  </div>
                )}
                <div className={s.fldFull} style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <div className={`${s.fld} ${s.fldFull}`}>
                  <label className={s.fldL}>Nom <span className={s.required}>*</span></label>
                  <input className={s.fldIn} value={form.nom ?? ''} placeholder={`Nom du/de la ${cfg.label}…`} onChange={e => set('nom', e.target.value)} />
                </div>
                <div className={s.fld}>
                  <label className={s.fldL}>Code <span className={s.required}>*</span></label>
                  <input className={s.fldIn} value={form.code ?? ''} placeholder="ex: GN-C"
                    onChange={e => set('code', e.target.value.toUpperCase())} style={{ fontFamily: 'var(--font-m)' }} />
                  <span className={s.fldHint}>Identifiant unique.</span>
                </div>
                <div className={s.fld}>
                  <label className={s.fldL}>Statut</label>
                  <select className={s.fldSel} value={form.statut} onChange={e => set('statut', e.target.value)}>
                    <option value="actif">Actif</option><option value="inactif">Inactif</option>
                  </select>
                </div>
                {extra.map(xf => (
                  <div key={xf.key} className={s.fld}>
                    <label className={s.fldL}>{xf.label}</label>
                    {xf.type === 'select' && xf.key === 'type'
                      ? (
                        <select className={s.fldSel} value={form.type ?? 'urbaine'} onChange={e => set('type', e.target.value)}>
                          <option value="urbaine">Urbaine</option>
                          <option value="semi-urbaine">Semi-urbaine</option>
                          <option value="rurale">Rurale</option>
                        </select>
                      )
                      : <input className={s.fldIn} type={xf.type ?? 'text'} value={form[xf.key] ?? ''} placeholder={xf.label} onChange={e => set(xf.key, e.target.value)} />
                    }
                  </div>
                ))}
              </>
            )}

            {/* ══════════════ ZONE DE LIVRAISON ══════════════ */}
            {level === 'zone' && (
              <>
                {/* Nom + Code + Statut */}
                <div className={`${s.fld} ${s.fldFull}`}>
                  <label className={s.fldL}>Nom de la zone <span className={s.required}>*</span></label>
                  <input className={s.fldIn} value={form.nom ?? ''} placeholder="Ex : Centre-Ville Élargi…" onChange={e => set('nom', e.target.value)} />
                </div>
                <div className={s.fld}>
                  <label className={s.fldL}>Code <span className={s.required}>*</span></label>
                  <input className={s.fldIn} value={form.code ?? ''} placeholder="ex: Z-KA-CENTRE"
                    onChange={e => set('code', e.target.value.toUpperCase())} style={{ fontFamily: 'var(--font-m)' }} />
                </div>
                <div className={s.fld}>
                  <label className={s.fldL}>Statut</label>
                  <select className={s.fldSel} value={form.statut} onChange={e => set('statut', e.target.value)}>
                    <option value="actif">Actif</option><option value="inactif">Inactif</option>
                  </select>
                </div>

                <div className={s.fldFull} style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                {/* Sélecteur de couverture multi-entités */}
                <div className={`${s.fld} ${s.fldFull}`}>
                  <label className={s.fldL} style={{ marginBottom: 10 }}>
                    Couverture géographique <span className={s.required}>*</span>
                    <span style={{ fontSize: 10, color: 'var(--txt-3)', fontWeight: 400, marginLeft: 8 }}>
                      Sélectionnez une ou plusieurs entités (inter-régions, inter-communes, etc.)
                    </span>
                  </label>
                  {allData
                    ? <ZoneCoverageSelector allData={allData} couvertureType={couvertureType}
                        couvertureIds={couvertureIds} onTypeChange={setCouvertureType} onIdsChange={setCouvertureIds} />
                    : <p style={{ fontSize: 12, color: 'var(--txt-3)' }}>Données géographiques non disponibles.</p>
                  }
                </div>

                {couvertureIds.length === 0 && (
                  <div className={s.fldFull} style={{ background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.2)',
                    borderRadius: 'var(--r-sm)', padding: '8px 14px', fontSize: 12, color: 'var(--gold)', display: 'flex', gap: 8 }}>
                    <i className="fas fa-triangle-exclamation" />
                    Sélectionnez au moins une entité géographique pour définir la couverture.
                  </div>
                )}

                <div className={s.fldFull} style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                {/* Caractéristiques : rayon, frais, temps */}
                {extra.map(xf => (
                  <div key={xf.key} className={s.fld}>
                    <label className={s.fldL}>{xf.label}</label>
                    <input className={s.fldIn} type={xf.type ?? 'number'} value={form[xf.key] ?? ''} placeholder={xf.label}
                      onChange={e => set(xf.key, e.target.value)} />
                  </div>
                ))}
              </>
            )}

            {/* Description — tous niveaux */}
            <div className={`${s.fld} ${s.fldFull}`}>
              <label className={s.fldL}>Description</label>
              <textarea className={s.fldArea} value={form.description ?? ''} rows={2}
                placeholder="Description optionnelle…" onChange={e => set('description', e.target.value)} />
            </div>

          </div>
        </div>

        {/* ── Pied ── */}
        <div className={s.modalFoot}>
          <button className={s.btnSecondary} onClick={onClose}>Annuler</button>
          <button className={s.btnPrimary} onClick={handleSubmit} disabled={!isFormValid}>
            <i className="fas fa-check" />
            {mode === 'create' ? 'Créer' : 'Enregistrer'}
            {level === 'zone' && couvertureIds.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, opacity: .8 }}>({couvertureIds.length} entité{couvertureIds.length > 1 ? 's' : ''})</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
