/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/GeoReferentielPage.tsx
 *
 * Page Référentiel Géographique pour l'administrateur.
 * Affiche uniquement les niveaux géo accordés par le super-admin
 * (geo_pays, geo_regions, geo_prefectures, geo_communes,
 *  geo_quartiers, geo_zones).
 *
 * Structure :
 *  - Héro navy (titre + badges niveaux autorisés + compteur global)
 *  - KPI cards par niveau (total / actifs / inactifs)
 *  - Card principale : tabs par niveau + GeoLevel_Cmp
 *
 * GeoLevel_Cmp est wrappé dans .geoScope qui redefine les
 * variables CSS du super-admin en valeurs admin light theme.
 * ================================================================ */

import { useState, useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import css from '../styles/GeoReferentielPage.module.css';
import type { GeoLevel, GeoItem, AnyGeoItem, AllGeoData, ZoneLivraison } from '../../super-admin/sections/geo/geo.types';
import { GEO_LEVELS } from '../../super-admin/sections/geo/geo.types';
import { geoApi }     from '../../super-admin/sections/geo/geoApi';
import GeoLevel_Cmp   from '../../super-admin/sections/geo/GeoLevel';

/* ── Couleur par niveau (admin palette) ── */
const LEVEL_STYLE: Record<string, { bg: string; color: string }> = {
  pays:       { bg: 'rgba(37,96,220,.08)',    color: 'var(--blue)'    },
  region:     { bg: 'rgba(14,116,144,.09)',   color: 'var(--teal)'    },
  prefecture: { bg: 'rgba(109,40,217,.08)',   color: 'var(--violet)'  },
  commune:    { bg: 'rgba(180,83,9,.09)',      color: 'var(--amber)'   },
  quartier:   { bg: 'rgba(190,24,93,.08)',     color: 'var(--rose)'    },
  zone:       { bg: 'rgba(4,120,87,.08)',      color: 'var(--emerald)' },
};

/* ── Mapping permission → niveau geo ── */
const PERM_TO_LEVEL: Record<string, GeoLevel> = {
  geo_pays:        'pays',
  geo_regions:     'region',
  geo_prefectures: 'prefecture',
  geo_communes:    'commune',
  geo_quartiers:   'quartier',
  geo_zones:       'zone',
};

interface Props {
  geoPerms: Record<string, boolean | string | null>;
  onToast:  (msg: string, type?: 's' | 'i' | 'w') => void;
}

export default function GeoReferentielPage({ geoPerms, onToast }: Props) {

  /* ── Pays assigné à cet admin (null = non assigné) ── */
  const paysAssigne = (geoPerms._paysAssigne as string | null) ?? null;

  /* ── Niveaux autorisés dans l'ordre hiérarchique ── */
  const allowedLevels: GeoLevel[] = GEO_LEVELS
    .map(cfg => cfg.level)
    .filter(lvl => {
      const key = Object.entries(PERM_TO_LEVEL).find(([, l]) => l === lvl)?.[0];
      return key ? geoPerms[key] === true : false;
    });

  const [activeLevel, setActiveLevel] = useState<GeoLevel>(allowedLevels[0] ?? 'commune');

  /* ── Données géo ── */
  const [pays,        setPays]        = useState<GeoItem[]>([]);
  const [regions,     setRegions]     = useState<GeoItem[]>([]);
  const [prefectures, setPrefectures] = useState<GeoItem[]>([]);
  const [communes,    setCommunes]    = useState<GeoItem[]>([]);
  const [quartiers,   setQuartiers]   = useState<GeoItem[]>([]);
  const [zones,       setZones]       = useState<AnyGeoItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [apiError,    setApiError]    = useState<string | null>(null);

  /* ── Chargement initial ── */
  useEffect(() => {
    setLoading(true);
    geoApi.all()
      .then(data => {
        setPays(data.pays);
        setRegions(data.regions);
        setPrefectures(data.prefectures);
        setCommunes(data.communes);
        setQuartiers(data.quartiers);
        setZones(data.zones as AnyGeoItem[]);
      })
      .catch(err => {
        setApiError(err?.message ?? 'Impossible de charger le référentiel.');
        onToast('Erreur de chargement du référentiel géo', 'w');
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Sync onglet si permissions changent ── */
  useEffect(() => {
    if (allowedLevels.length > 0 && !allowedLevels.includes(activeLevel)) {
      setActiveLevel(allowedLevels[0]);
    }
  }, [geoPerms]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Filtrage par pays assigné — mémorisé pour éviter recalcul à chaque render ── */
  const { allData, dataByLevel } = useMemo(() => {
    const fPays        = paysAssigne ? pays.filter(p => p.id === paysAssigne) : pays;
    const paysIds      = new Set(fPays.map(p => p.id));
    const fRegions     = paysAssigne ? regions.filter(r => paysIds.has(r.parentId!))       : regions;
    const regionIds    = new Set(fRegions.map(r => r.id));
    const fPrefectures = paysAssigne ? prefectures.filter(p => regionIds.has(p.parentId!)) : prefectures;
    const prefIds      = new Set(fPrefectures.map(p => p.id));
    const fCommunes    = paysAssigne ? communes.filter(c => prefIds.has(c.parentId!))       : communes;
    const communeIds   = new Set(fCommunes.map(c => c.id));
    const fQuartiers   = paysAssigne ? quartiers.filter(q => communeIds.has(q.parentId!))  : quartiers;
    const quartierIds  = new Set(fQuartiers.map(q => q.id));
    const fZones       = paysAssigne
      ? zones.filter(z => {
          const zone = z as unknown as ZoneLivraison;
          const ids  = zone.couvertureIds ?? [];
          switch (zone.couvertureType) {
            case 'pays':       return ids.some(id => paysIds.has(id));
            case 'region':     return ids.some(id => regionIds.has(id));
            case 'prefecture': return ids.some(id => prefIds.has(id));
            case 'commune':    return ids.some(id => communeIds.has(id));
            case 'quartier':   return ids.some(id => quartierIds.has(id));
            default:           return false;
          }
        })
      : zones;

    return {
      allData: { pays: fPays, regions: fRegions, prefectures: fPrefectures, communes: fCommunes, quartiers: fQuartiers } as AllGeoData,
      dataByLevel: { pays: fPays, region: fRegions, prefecture: fPrefectures, commune: fCommunes, quartier: fQuartiers, zone: fZones } as Record<GeoLevel, AnyGeoItem[]>,
    };
  }, [paysAssigne, pays, regions, prefectures, communes, quartiers, zones]);

  /* ── API + setter par niveau ── */
  type LevelApi = {
    create: (d: Partial<GeoItem>) => Promise<GeoItem>;
    update: (id: string, d: Partial<GeoItem>) => Promise<GeoItem>;
    remove: (id: string) => Promise<void>;
    toggle: (id: string) => Promise<GeoItem>;
  };
  const apiByLevel: Record<GeoLevel, LevelApi> = {
    pays:        geoApi.pays        as LevelApi,
    region:      geoApi.regions     as LevelApi,
    prefecture:  geoApi.prefectures as LevelApi,
    commune:     geoApi.communes    as LevelApi,
    quartier:    geoApi.quartiers   as LevelApi,
    zone:        geoApi.zones       as LevelApi,
  };
  const setterByLevel: Record<GeoLevel, Dispatch<SetStateAction<AnyGeoItem[]>>> = {
    pays:        setPays        as Dispatch<SetStateAction<AnyGeoItem[]>>,
    region:      setRegions     as Dispatch<SetStateAction<AnyGeoItem[]>>,
    prefecture:  setPrefectures as Dispatch<SetStateAction<AnyGeoItem[]>>,
    commune:     setCommunes    as Dispatch<SetStateAction<AnyGeoItem[]>>,
    quartier:    setQuartiers   as Dispatch<SetStateAction<AnyGeoItem[]>>,
    zone:        setZones       as Dispatch<SetStateAction<AnyGeoItem[]>>,
  };

  /* ── Adaptateur toast ── */
  const toast = useCallback((type: string, msg: string) => {
    onToast(msg, type === 'error' ? 'w' : type === 'success' ? 's' : 'i');
  }, [onToast]);

  /* ── CRUD handlers optimistes ── */
  const makeHandlers = useCallback((level: GeoLevel) => {
    const setter = setterByLevel[level];
    const api    = apiByLevel[level];

    const flip = (s: GeoItem['statut']) => s === 'actif' ? 'inactif' : 'actif';

    return {
      onAdd: (item: Partial<GeoItem>) => {
        const tmpId = `__tmp_${Date.now()}`;
        const now   = new Date().toISOString();
        setter(prev => [...prev, { ...item, id: tmpId, enfants: 0, createdAt: now, updatedAt: now } as AnyGeoItem]);
        api.create(item)
          .then(c => setter(prev => prev.map(x => x.id === tmpId ? c as AnyGeoItem : x)))
          .catch(e => { setter(prev => prev.filter(x => x.id !== tmpId)); toast('error', e?.message ?? 'Erreur création'); });
      },

      onEdit: (id: string, data: Partial<GeoItem>) => {
        let old: AnyGeoItem | undefined;
        setter(prev => { old = prev.find(x => x.id === id); return prev.map(x => x.id === id ? { ...x, ...data } as AnyGeoItem : x); });
        api.update(id, data)
          .then(u => setter(prev => prev.map(x => x.id === id ? u as AnyGeoItem : x)))
          .catch(e => { if (old) setter(prev => prev.map(x => x.id === id ? old! : x)); toast('error', e?.message ?? 'Erreur modification'); });
      },

      onDelete: (id: string) => {
        let del: AnyGeoItem | undefined;
        setter(prev => { del = prev.find(x => x.id === id); return prev.filter(x => x.id !== id); });
        api.remove(id).catch(e => { if (del) setter(prev => [...prev, del!]); toast('error', e?.message ?? 'Erreur suppression'); });
      },

      onToggle: (id: string) => {
        setter(prev => prev.map(x => x.id === id ? { ...x, statut: flip(x.statut) } as AnyGeoItem : x));
        api.toggle(id)
          .then(u => setter(prev => prev.map(x => x.id === id ? u as AnyGeoItem : x)))
          .catch(e => { setter(prev => prev.map(x => x.id === id ? { ...x, statut: flip(x.statut) } as AnyGeoItem : x)); toast('error', e?.message ?? 'Erreur statut'); });
      },
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Stats globales ── */
  const allItems = [...pays, ...regions, ...prefectures, ...communes, ...quartiers, ...zones];
  const totalActifs   = loading ? 0 : allItems.filter(x => x.statut === 'actif').length;
  const totalElements = allItems.length;

  /* ── Cas : permissions géo accordées mais aucun pays assigné ── */
  if (allowedLevels.length > 0 && !paysAssigne) {
    return (
      <div>
        <div className={css.hero}>
          <div className={css.heroGlow} /><div className={css.heroGrid} />
          <div className={css.heroIn}>
            <div className={css.heroL}>
              <div className={css.heroIco}><i className="fas fa-earth-africa" /></div>
              <div>
                <div className={css.heroTitle}>Référentiel Géographique</div>
                <div className={css.heroSub}>Gestion de la hiérarchie géographique</div>
              </div>
            </div>
          </div>
        </div>
        <div className={css.card}>
          <div className={css.empty}>
            <i className="fas fa-location-dot" />
            <div className={css.emptyT}>Aucun pays assigné</div>
            <p className={css.emptyS}>
              Vos permissions géographiques ont été accordées, mais aucun pays ne vous a encore été assigné.
              Contactez le super-administrateur pour obtenir l&apos;accès à votre zone.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Cas : aucune permission ── */
  if (allowedLevels.length === 0) {
    return (
      <div>
        <div className={css.hero}>
          <div className={css.heroGlow} /><div className={css.heroGrid} />
          <div className={css.heroIn}>
            <div className={css.heroL}>
              <div className={css.heroIco}><i className="fas fa-earth-africa" /></div>
              <div>
                <div className={css.heroTitle}>Référentiel Géographique</div>
                <div className={css.heroSub}>Gestion de la hiérarchie géographique</div>
              </div>
            </div>
          </div>
        </div>
        <div className={css.card}>
          <div className={css.empty}>
            <i className="fas fa-lock" />
            <div className={css.emptyT}>Accès non accordé</div>
            <p className={css.emptyS}>
              Aucune permission géographique n&apos;a été accordée à votre compte.
              Contactez le super-administrateur pour obtenir l&apos;accès à un ou plusieurs niveaux.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const activeCfg = GEO_LEVELS.find(l => l.level === activeLevel)!;
  const handlers  = makeHandlers(activeLevel);

  return (
    <div>
      {/* ════════════════════════════════════════
          HÉRO
      ════════════════════════════════════════ */}
      <div className={css.hero}>
        <div className={css.heroGlow} />
        <div className={css.heroGrid} />
        <div className={css.heroIn}>

          {/* Gauche : icône + titre + badges niveaux */}
          <div className={css.heroL}>
            <div className={css.heroIco}><i className="fas fa-earth-africa" /></div>
            <div>
              <div className={css.heroTitle}>Référentiel Géographique</div>
              <div className={css.heroSub}>Gérez les zones dont vous avez la responsabilité</div>
              <div className={css.heroBadges}>
                {allowedLevels.map(lvl => {
                  const cfg = GEO_LEVELS.find(l => l.level === lvl)!;
                  return (
                    <span key={lvl} className={`${css.heroBadge} ${css.perm}`}>
                      <i className={`fas ${cfg.icon}`} /> {cfg.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Droite : compteur global */}
          {!loading && (
            <div className={css.heroR}>
              <div className={css.heroStat}>{totalActifs}</div>
              <div className={css.heroStatL}>éléments actifs / {totalElements} total</div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          ERREUR API
      ════════════════════════════════════════ */}
      {apiError && (
        <div className={css.errBanner}>
          <i className="fas fa-triangle-exclamation" /> {apiError}
        </div>
      )}

      {/* ════════════════════════════════════════
          KPI CARDS — un par niveau autorisé
      ════════════════════════════════════════ */}
      <div className={css.kpis}>
        {allowedLevels.map(lvl => {
          const cfg   = GEO_LEVELS.find(l => l.level === lvl)!;
          const items = dataByLevel[lvl];
          const actifs   = items.filter(x => x.statut === 'actif').length;
          const inactifs = items.filter(x => x.statut === 'inactif').length;
          const st = LEVEL_STYLE[lvl] ?? { bg: 'var(--sky-2)', color: 'var(--blue)' };
          return (
            <div
              key={lvl}
              className={css.kpi}
              style={{ cursor: 'pointer', borderColor: activeLevel === lvl ? 'var(--bdrb)' : undefined }}
              onClick={() => setActiveLevel(lvl)}>
              <div className={css.kpiIco} style={{ background: st.bg, color: st.color }}>
                <i className={`fas ${cfg.icon}`} />
              </div>
              <div>
                <div className={css.kpiV}>{loading ? '—' : items.length}</div>
                <div className={css.kpiL}>{cfg.labelPlural}</div>
                {!loading && (
                  <div className={css.kpiSub}>
                    <span className={css.kpiOn}>{actifs} actifs</span>
                    {inactifs > 0 && <span className={css.kpiOff}>{inactifs} inactifs</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ════════════════════════════════════════
          CARD PRINCIPALE : tabs + tableau CRUD
      ════════════════════════════════════════ */}
      <div className={css.card}>

        {/* ── Barre de tabs ── */}
        <div className={css.tabBar}>
          <div className={css.tabBarTitle}>
            <i className={`fas ${activeCfg.icon}`} />
            Gestion des {activeCfg.labelPlural}
          </div>
          <div className={css.tabSep} />
          {allowedLevels.map(lvl => {
            const cfg   = GEO_LEVELS.find(l => l.level === lvl)!;
            const count = dataByLevel[lvl].length;
            return (
              <button
                key={lvl}
                className={`${css.tab} ${activeLevel === lvl ? css.tabOn : ''}`}
                onClick={() => setActiveLevel(lvl)}>
                <i className={`fas ${cfg.icon}`} />
                {cfg.labelPlural}
                <span className={css.tabCount}>{loading ? '…' : count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Contenu ── */}
        {loading ? (
          <div className={css.spin}>
            <i className="fas fa-circle-notch fa-spin" />
            <span>Chargement du référentiel géographique…</span>
          </div>
        ) : (
          /* geoScope : redefine super-admin CSS vars pour GeoLevel_Cmp */
          <div className={css.geoScope}>
            <GeoLevel_Cmp
              level={activeLevel}
              items={dataByLevel[activeLevel]}
              allData={allData}
              toast={toast}
              onAdd={handlers.onAdd}
              onEdit={handlers.onEdit}
              onDelete={handlers.onDelete}
              onToggle={handlers.onToggle}
              readOnly={geoPerms.geo_modifier_protege ? undefined : item => ['Super Admin', 'Système', 'System'].includes(item.auteur)}
              creatorLabel="Administrateur"
            />
          </div>
        )}
      </div>
    </div>
  );
}
