/* ================================================================
 * FICHIER : sections/GeoReferentielSection.tsx
 *
 * Centre de Gestion du Référentiel Géographique Shopi.
 * Hiérarchie : Pays → Région → Préfecture → Commune
 *              → Quartier → Zone de livraison
 *
 * Données : chargées depuis /geo/all au montage, puis mises à
 * jour de façon optimiste lors de chaque opération CRUD.
 * ================================================================ */

import { useState, useCallback, useEffect, useMemo } from 'react';
import s from './GeoReferentielSection.module.css';
import type { GeoLevel, AnyGeoItem, GeoItem, AllGeoData } from './geo/geo.types';
import { GEO_LEVELS } from './geo/geo.types';
import { geoApi } from './geo/geoApi';

/* ── Sous-composants ── */
import GeoOverview  from './geo/GeoOverview';
import GeoTreeView  from './geo/GeoTreeView';
import GeoLevel_Cmp from './geo/GeoLevel';
import GeoImport    from './geo/GeoImport';
import GeoAudit     from './geo/GeoAudit';

type GeoView = 'overview' | 'tree' | GeoLevel | 'import' | 'sync' | 'audit';

interface NavGroup { label: string; items: { id: GeoView; label: string; icon: string; badge?: number }[] }

/* ================================================================
 * PROPS
 * ================================================================ */
interface Props {
  toast:    (type: string, msg: string) => void;
  isActive: boolean;
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
export default function GeoReferentielSection({ toast, isActive }: Props) {

  const [view,     setView]     = useState<GeoView>('overview');
  const [sbQuery,  setSbQuery]  = useState('');
  const [sbOpen,   setSbOpen]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  /* ── Données géographiques ── */
  const [pays,        setPays]        = useState<GeoItem[]>([]);
  const [regions,     setRegions]     = useState<GeoItem[]>([]);
  const [prefectures, setPrefectures] = useState<GeoItem[]>([]);
  const [communes,    setCommunes]    = useState<GeoItem[]>([]);
  const [quartiers,   setQuartiers]   = useState<GeoItem[]>([]);
  const [zones,       setZones]       = useState<AnyGeoItem[]>([]);

  /* ── Chargement initial depuis l'API ── */
  useEffect(() => {
    if (!isActive) return;
    setLoading(true);
    setApiError(null);
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
        setApiError(err?.message ?? 'Impossible de charger le référentiel géographique.');
        toast('error', 'Erreur de chargement du référentiel géo');
      })
      .finally(() => setLoading(false));
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Statistiques globales — mémoïsées pour éviter les recalculs inutiles ── */
  const stats = useMemo(() => {
    const all = [...pays, ...regions, ...prefectures, ...communes, ...quartiers, ...zones];
    const totalActifs   = all.filter(x => x.statut === 'actif').length;
    const totalInactifs = all.filter(x => x.statut === 'inactif').length;
    const couverturePct = all.length > 0 ? Math.round((totalActifs / all.length) * 100) : 0;

    const perNiveau = {
      pays:       { actifs: pays.filter(x => x.statut === 'actif').length,        total: pays.length        },
      region:     { actifs: regions.filter(x => x.statut === 'actif').length,     total: regions.length     },
      prefecture: { actifs: prefectures.filter(x => x.statut === 'actif').length, total: prefectures.length },
      commune:    { actifs: communes.filter(x => x.statut === 'actif').length,    total: communes.length    },
      quartier:   { actifs: quartiers.filter(x => x.statut === 'actif').length,   total: quartiers.length   },
      zone:       { actifs: zones.filter(x => x.statut === 'actif').length,       total: zones.length       },
    };

    const recentItems = [
      ...pays.map(x => ({ ...x, niveau: 'pays'        as const })),
      ...regions.map(x => ({ ...x, niveau: 'region'   as const })),
      ...prefectures.map(x => ({ ...x, niveau: 'prefecture' as const })),
      ...communes.map(x => ({ ...x, niveau: 'commune' as const })),
      ...quartiers.map(x => ({ ...x, niveau: 'quartier' as const })),
      ...zones.map(x => ({ ...x, niveau: 'zone'       as const })),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5)
      .map(({ niveau, nom, code, auteur, updatedAt, statut }) => ({ niveau, nom, code, auteur, updatedAt, statut }));

    return {
      totalPays:        pays.length,
      totalRegions:     regions.length,
      totalPrefectures: prefectures.length,
      totalCommunes:    communes.length,
      totalQuartiers:   quartiers.length,
      totalZones:       zones.length,
      actifs:           totalActifs,
      inactifs:         totalInactifs,
      couverturePct,
      perNiveau,
      recentItems,
    };
  }, [pays, regions, prefectures, communes, quartiers, zones]);

  /* ── allData pour les sélecteurs en cascade du modal ── */
  const allData: AllGeoData = { pays, regions, prefectures, communes, quartiers };

  /* ================================================================
   * HANDLERS CRUD GÉNÉRIQUES — optimistic update + appel API
   *
   * Pattern :
   *  1. Met à jour l'état local immédiatement (optimiste)
   *  2. Appelle l'API en arrière-plan
   *  3. Remplace l'entrée optimiste par la réponse réelle du serveur
   *  4. En cas d'erreur : annule la mise à jour locale + toast d'erreur
   * ================================================================ */
  type Setter<T> = React.Dispatch<React.SetStateAction<T[]>>;

  type LevelApi = {
    create: (data: Partial<GeoItem>) => Promise<GeoItem>;
    update: (id: string, data: Partial<GeoItem>) => Promise<GeoItem>;
    remove: (id: string) => Promise<void>;
    toggle: (id: string) => Promise<GeoItem>;
  };

  const makeHandlers = useCallback(<T extends AnyGeoItem>(
    setter: Setter<T>,
    api: LevelApi,
  ) => ({

    onAdd: (item: Partial<GeoItem>) => {
      const tempId = `__tmp_${Date.now()}`;
      const optimistic = {
        ...item,
        id:        tempId,
        enfants:   0,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      } as T;
      setter(prev => [...prev, optimistic]);

      api.create(item)
        .then(created => setter(prev => prev.map(x => x.id === tempId ? created as T : x)))
        .catch(err => {
          setter(prev => prev.filter(x => x.id !== tempId));
          toast('error', err?.message ?? 'Erreur de création');
        });
    },

    onEdit: (id: string, data: Partial<GeoItem>) => {
      let previous: T | undefined;
      setter(prev => {
        previous = prev.find(x => x.id === id);
        return prev.map(x => x.id === id ? { ...x, ...data } as T : x);
      });

      api.update(id, data)
        .then(updated => setter(prev => prev.map(x => x.id === id ? updated as T : x)))
        .catch(err => {
          if (previous) setter(prev => prev.map(x => x.id === id ? previous! : x));
          toast('error', err?.message ?? 'Erreur de modification');
        });
    },

    onDelete: (id: string) => {
      let deleted: T | undefined;
      setter(prev => {
        deleted = prev.find(x => x.id === id);
        return prev.filter(x => x.id !== id);
      });

      api.remove(id)
        .catch(err => {
          if (deleted) setter(prev => [...prev, deleted!]);
          toast('error', err?.message ?? 'Erreur de suppression');
        });
    },

    onToggle: (id: string) => {
      setter(prev => prev.map(x =>
        x.id === id ? { ...x, statut: x.statut === 'actif' ? 'inactif' : 'actif' } as T : x,
      ));

      api.toggle(id)
        .then(updated => setter(prev => prev.map(x => x.id === id ? updated as T : x)))
        .catch(err => {
          /* annuler le toggle optimiste */
          setter(prev => prev.map(x =>
            x.id === id ? { ...x, statut: x.statut === 'actif' ? 'inactif' : 'actif' } as T : x,
          ));
          toast('error', err?.message ?? 'Erreur de bascule');
        });
    },

  }), [toast]);

  /* ── Handlers par niveau ── */
  const paysH  = makeHandlers(setPays,        geoApi.pays        as LevelApi);
  const regH   = makeHandlers(setRegions,     geoApi.regions     as LevelApi);
  const prefH  = makeHandlers(setPrefectures, geoApi.prefectures as LevelApi);
  const commH  = makeHandlers(setCommunes,    geoApi.communes    as LevelApi);
  const quartH = makeHandlers(setQuartiers,   geoApi.quartiers   as LevelApi);
  const zoneH  = makeHandlers(
    setZones as Setter<AnyGeoItem>,
    geoApi.zones as unknown as LevelApi,
  );

  const handlers: Record<string, ReturnType<typeof makeHandlers>> = {
    pays: paysH, region: regH, prefecture: prefH,
    commune: commH, quartier: quartH, zone: zoneH,
  };

  /* ── Handler délégation : bascule auteur 'Super Admin' ↔ 'Délégué' ── */
  const makeDelegationHandler = useCallback(<T extends AnyGeoItem>(
    setter: Setter<T>,
    delegFn: (id: string) => Promise<GeoItem>,
  ) => (id: string, isProtected: boolean) => {
    const nextAuteur = isProtected ? 'Délégué' : 'Super Admin';
    setter(prev => prev.map(x => x.id === id ? { ...x, auteur: nextAuteur } as T : x));
    delegFn(id)
      .then(updated => setter(prev => prev.map(x => x.id === id ? updated as T : x)))
      .catch(err => {
        setter(prev => prev.map(x => x.id === id ? { ...x, auteur: isProtected ? 'Super Admin' : 'Délégué' } as T : x));
        toast('error', err?.message ?? 'Erreur de délégation');
      });
  }, [toast]);

  const delegHandlers: Record<string, (id: string, isProtected: boolean) => void> = {
    pays:        makeDelegationHandler(setPays,                    geoApi.pays.delegation),
    region:      makeDelegationHandler(setRegions,                 geoApi.regions.delegation),
    prefecture:  makeDelegationHandler(setPrefectures,             geoApi.prefectures.delegation),
    commune:     makeDelegationHandler(setCommunes,                geoApi.communes.delegation),
    quartier:    makeDelegationHandler(setQuartiers,               geoApi.quartiers.delegation),
    zone:        makeDelegationHandler(setZones as Setter<AnyGeoItem>, geoApi.zones.delegation),
  };

  /* ── Navigation depuis sous-composants ── */
  const navigateTo = useCallback((level: string) => setView(level as GeoView), []);

  if (!isActive) return null;

  const levelCfg = GEO_LEVELS.find(l => l.level === view);
  const currentHandlers = view in handlers ? handlers[view] : undefined;

  const levelItems = (): AnyGeoItem[] => {
    switch (view) {
      case 'pays':        return pays;
      case 'region':      return regions;
      case 'prefecture':  return prefectures;
      case 'commune':     return communes;
      case 'quartier':    return quartiers;
      case 'zone':        return zones;
      default:            return [];
    }
  };

  /* ── Groupes de navigation ── */
  const NAV_GROUPS: NavGroup[] = [
    {
      label: 'Aperçu',
      items: [
        { id: 'overview', label: 'Vue d\'ensemble', icon: 'fa-chart-pie' },
        { id: 'tree',     label: 'Arbre hiérarchique', icon: 'fa-sitemap' },
      ],
    },
    {
      label: 'Niveaux géographiques',
      items: GEO_LEVELS.map(cfg => ({ id: cfg.level as GeoView, label: cfg.labelPlural, icon: cfg.icon })),
    },
    {
      label: 'Outils',
      items: [
        { id: 'import', label: 'Import massif',    icon: 'fa-file-import' },
        { id: 'sync',   label: 'Synchronisation',  icon: 'fa-rotate' },
        { id: 'audit',  label: 'Journal d\'audit', icon: 'fa-clipboard-list' },
      ],
    },
  ];

  const filteredGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: sbQuery ? g.items.filter(i => i.label.toLowerCase().includes(sbQuery.toLowerCase())) : g.items,
  })).filter(g => g.items.length > 0);

  const headMeta: Record<string, { title: string; sub: string; icon: string; color: string }> = {
    overview: { title: 'Référentiel Géographique', sub: 'Vue d\'ensemble de la hiérarchie géographique Shopi', icon: 'fa-earth-africa', color: 'var(--acid)' },
    tree:     { title: 'Arbre hiérarchique',        sub: 'Naviguez dans la hiérarchie complète',               icon: 'fa-sitemap',      color: 'var(--acid)' },
    import:   { title: 'Import massif',             sub: 'Importez des données depuis CSV ou Excel',           icon: 'fa-file-import',  color: 'var(--violet)' },
    sync:     { title: 'Synchronisation',           sub: 'Synchroniser avec OpenStreetMap ou sources officielles', icon: 'fa-rotate',  color: 'var(--sky)' },
    audit:    { title: 'Journal d\'audit',          sub: 'Historique de toutes les modifications du référentiel', icon: 'fa-clipboard-list', color: 'var(--sky)' },
    ...Object.fromEntries(GEO_LEVELS.map(cfg => [cfg.level, {
      title: cfg.labelPlural,
      sub: `Gestion des ${cfg.labelPlural.toLowerCase()} — CRUD complet`,
      icon: cfg.icon,
      color: `var(${cfg.color})`,
    }])),
  };
  const hm = headMeta[view] ?? headMeta.overview;

  /* ================================================================
   * RENDU
   * ================================================================ */
  return (
    <div className="section active">
      <div className={s.wrap}>

        {/* ════════════════════════ SIDEBAR ════════════════════════ */}
        {sbOpen && <div className={s.sbOverlay} onClick={() => setSbOpen(false)} />}
        <nav className={`${s.sb} ${sbOpen ? s.sbOpen : ''}`}>
          <div className={s.sbHead}>
            <div className={s.sbTitle}><i className="fas fa-earth-africa" /> Référentiel Géo</div>
            <div className={s.sbSearch}>
              <i className="fas fa-magnifying-glass" />
              <input placeholder="Rechercher…" value={sbQuery} onChange={e => setSbQuery(e.target.value)} />
            </div>
          </div>

          <div className={s.sbNav}>
            {filteredGroups.map(g => (
              <div key={g.label} className={s.sbGroup}>
                <div className={s.sbGroupLabel}>{g.label}</div>
                {g.items.map(item => {
                  const lCfg = GEO_LEVELS.find(l => l.level === item.id);
                  return (
                    <button key={item.id}
                      className={`${s.sbItem} ${view === item.id ? s.on : ''}`}
                      onClick={() => { setView(item.id); setSbQuery(''); setSbOpen(false); }}>
                      <i className={`fas ${item.icon}`}
                        style={lCfg ? { color: view === item.id ? `var(${lCfg.color})` : undefined } : undefined} />
                      {item.label}
                      {item.badge !== undefined && <span className={s.sbBadge}>{item.badge}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* ════════════════════════ CONTENU ════════════════════════ */}
        <div className={s.content}>

          {/* En-tête */}
          <div className={s.pageHead}>
            <div className={s.crumb}>
              <span>Super Admin</span>
              <i className="fas fa-chevron-right" />
              <span>Référentiel Géographique</span>
              <i className="fas fa-chevron-right" />
              <span style={{ color: 'var(--txt-1)', fontWeight: 700 }}>{hm.title}</span>
            </div>
            <div className={s.headRow}>
              <button className={s.sbMenuBtn} onClick={() => setSbOpen(o => !o)} title="Navigation géographique">
                <i className={`fas fa-${sbOpen ? 'xmark' : 'bars'}`} />
              </button>
              <div className={s.headL}>
                <div className={s.pageTitle}>
                  <i className={`fas ${hm.icon}`} style={{ color: hm.color }} />
                  {hm.title}
                  {loading && (
                    <span style={{ fontSize: 11, color: 'var(--txt-3)', marginLeft: 10, fontFamily: 'var(--font-b)', fontWeight: 400 }}>
                      <i className="fas fa-circle-notch fa-spin" style={{ marginRight: 4 }} />
                      Chargement…
                    </span>
                  )}
                </div>
                <div className={s.pageSub}>{hm.sub}</div>
              </div>
              <div className={s.headActions}>
                {levelCfg && (
                  <>
                    <button className={`${s.btnSecondary} ${s.btnSm}`}
                      onClick={() => toast('info', `Export CSV des ${levelCfg.labelPlural} lancé`)}>
                      <i className="fas fa-download" /> Export CSV
                    </button>
                    <button className={`${s.btnSecondary} ${s.btnSm}`} onClick={() => setView('import')}>
                      <i className="fas fa-upload" /> Import
                    </button>
                  </>
                )}
                <button className={`${s.btnSecondary} ${s.btnSm}`} onClick={() => setView('audit')}>
                  <i className="fas fa-clock-rotate-left" /> Journal
                </button>
                <button className={`${s.btnSecondary} ${s.btnSm}`}
                  onClick={() => {
                    setLoading(true);
                    geoApi.all()
                      .then(data => {
                        setPays(data.pays); setRegions(data.regions);
                        setPrefectures(data.prefectures); setCommunes(data.communes);
                        setQuartiers(data.quartiers); setZones(data.zones as AnyGeoItem[]);
                        toast('success', 'Données rechargées');
                      })
                      .catch(() => toast('error', 'Erreur de rechargement'))
                      .finally(() => setLoading(false));
                  }}
                  disabled={loading}
                  title="Recharger depuis le serveur">
                  <i className={`fas fa-rotate ${loading ? 'fa-spin' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Bannière d'erreur API ── */}
          {apiError && (
            <div className={s.apiBanner}>
              <i className="fas fa-triangle-exclamation" style={{ color: 'var(--rose)' }} />
              <span style={{ flex: 1, color: 'var(--txt-2)' }}>{apiError}</span>
              <button className={`${s.btnGhost} ${s.btnSm}`}
                onClick={() => {
                  setApiError(null); setLoading(true);
                  geoApi.all()
                    .then(data => {
                      setPays(data.pays); setRegions(data.regions);
                      setPrefectures(data.prefectures); setCommunes(data.communes);
                      setQuartiers(data.quartiers); setZones(data.zones as AnyGeoItem[]);
                    })
                    .catch(err => setApiError(err?.message ?? 'Erreur'))
                    .finally(() => setLoading(false));
                }}>
                <i className="fas fa-rotate" /> Réessayer
              </button>
            </div>
          )}

          {/* ── Skeleton de chargement (premier chargement uniquement) ── */}
          {loading && all.length === 0 ? (
            <div className={s.body}>
              <div className={s.card} style={{ padding: 40, textAlign: 'center' }}>
                <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 32, color: 'var(--acid)', marginBottom: 16, display: 'block' }} />
                <div style={{ fontFamily: 'var(--font-h)', fontWeight: 700, color: 'var(--txt-1)', marginBottom: 6 }}>
                  Chargement du référentiel…
                </div>
                <div style={{ fontSize: 12, color: 'var(--txt-3)' }}>
                  Connexion au backend NestJS en cours.
                </div>
              </div>
            </div>
          ) : (
            <>
              {view === 'overview' && <GeoOverview stats={stats} onNavigate={navigateTo} />}
              {view === 'tree'     && <GeoTreeView onNavigate={l => setView(l)} />}

              {levelCfg && currentHandlers && (
                <GeoLevel_Cmp
                  level={view as GeoLevel}
                  items={levelItems()}
                  allData={allData}
                  toast={toast}
                  onAdd={currentHandlers.onAdd}
                  onEdit={currentHandlers.onEdit}
                  onDelete={currentHandlers.onDelete}
                  onToggle={currentHandlers.onToggle}
                  onToggleProtection={delegHandlers[view as GeoLevel]}
                />
              )}

              {view === 'import' && <GeoImport toast={toast} />}

              {view === 'sync' && (
                <div className={s.body}>
                  <div className={s.card}>
                    <div className={s.cardHead}>
                      <div className={s.cardTitle}><i className="fas fa-rotate" style={{ color: 'var(--sky)' }} /> Synchronisation avec sources officielles</div>
                    </div>
                    <div className={s.cardBody}>
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <i className="fas fa-rotate" style={{ fontSize: 48, color: 'var(--txt-3)', marginBottom: 16, display: 'block' }} />
                        <div style={{ fontFamily: 'var(--font-h)', fontWeight: 700, fontSize: 16, color: 'var(--txt-1)', marginBottom: 8 }}>
                          Synchronisation — Prochainement
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--txt-2)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
                          Cette fonctionnalité permettra de synchroniser automatiquement le référentiel
                          avec <b>OpenStreetMap</b>, les <b>découpages administratifs officiels</b> de chaque pays,
                          et d&apos;autres sources de données géographiques vérifiées.
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                          {['OpenStreetMap', 'GeoNames', 'GADM', 'OSM Overpass'].map(src => (
                            <span key={src} className={`${s.bdg} ${s.bdgSky}`} style={{ fontSize: 12, padding: '6px 14px' }}>{src}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'audit' && <GeoAudit />}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
