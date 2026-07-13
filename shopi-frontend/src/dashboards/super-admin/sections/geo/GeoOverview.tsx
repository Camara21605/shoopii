/* ================================================================
 * FICHIER : sections/geo/GeoOverview.tsx
 * Vue d'ensemble du Référentiel Géographique.
 * Statistiques globales + KPIs + carte de couverture + accès rapides.
 * ================================================================ */

import s from '../GeoReferentielSection.module.css';
import type { GeoStats, GeoLevel } from './geo.types';
import { GEO_LEVELS } from './geo.types';

interface GeoOverviewProps {
  stats:      GeoStats;
  onNavigate: (level: string) => void;
}

/* Niveaux pour les cartes de statut */
const NIVEAU_KEYS: { key: keyof GeoStats; level: string }[] = [
  { key: 'totalPays',        level: 'pays'        },
  { key: 'totalRegions',     level: 'region'      },
  { key: 'totalPrefectures', level: 'prefecture'  },
  { key: 'totalCommunes',    level: 'commune'     },
  { key: 'totalQuartiers',   level: 'quartier'    },
  { key: 'totalZones',       level: 'zone'        },
];

/* Couleur d'icône et label selon le statut d'un item récent */
function recentMeta(statut: 'actif' | 'inactif', niveau: GeoLevel) {
  const cfg = GEO_LEVELS.find(l => l.level === niveau);
  const icon  = statut === 'actif' ? 'fa-circle-check' : 'fa-pen';
  const color = statut === 'actif' ? 'var(--acid)' : 'var(--sky)';
  const label = statut === 'actif' ? 'Actif' : 'Modifié';
  return { icon, color, label, levelLabel: cfg?.label ?? niveau };
}

function relativeTime(dateStr: string): string {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'À l\'instant';
  if (mins < 60)  return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 30)  return `Il y a ${days}j`;
  return `Il y a ${Math.floor(days / 30)} mois`;
}

export default function GeoOverview({ stats, onNavigate }: GeoOverviewProps) {
  return (
    <div className={s.body}>

      {/* ── Hero stats ── */}
      <div className={s.statsGrid}>
        {NIVEAU_KEYS.map(({ key, level }) => {
          const cfg = GEO_LEVELS.find(l => l.level === level)!;
          return (
            <div key={level} className={s.statCard} onClick={() => onNavigate(level)} title={`Gérer les ${cfg.labelPlural}`}>
              <div className={s.statStripe} style={{ background: `var(${cfg.color})` }} />
              <div className={s.statIc}>
                <i className={`fas ${cfg.icon}`} style={{ color: `var(${cfg.color})` }} />
              </div>
              <div className={s.statV}>{stats[key]}</div>
              <div className={s.statL}>{cfg.labelPlural}</div>
            </div>
          );
        })}
      </div>

      {/* ── Santé + répartition ── */}
      <div className={s.twoColGrid}>

        {/* Couverture globale */}
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}><i className="fas fa-chart-pie" style={{ color: 'var(--acid)' }} /> Couverture de la plateforme</div>
              <div className={s.cardSub}>Éléments actifs vs total</div>
            </div>
            <span className={`${s.bdg} ${stats.couverturePct >= 80 ? s.bdgOn : s.bdgGold}`}>
              {stats.couverturePct}%
            </span>
          </div>
          <div className={s.cardBody}>
            {/* Barre générale */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--txt-2)', marginBottom: 6 }}>
                <span>Actifs</span>
                <span style={{ fontWeight: 700, color: 'var(--acid)' }}>{stats.actifs} / {stats.actifs + stats.inactifs}</span>
              </div>
              <div style={{ height: 8, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${stats.couverturePct}%`, background: 'linear-gradient(90deg, var(--acid), #00E5A0)', borderRadius: 99, transition: 'width .5s' }} />
              </div>
            </div>

            {/* Par niveau */}
            {NIVEAU_KEYS.map(({ level }) => {
              const cfg   = GEO_LEVELS.find(l => l.level === level)!;
              const lvl   = stats.perNiveau[level] ?? { actifs: 0, total: 0 };
              const pct   = lvl.total > 0 ? Math.round((lvl.actifs / lvl.total) * 100) : 0;
              return (
                <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <i className={`fas ${cfg.icon}`} style={{ color: `var(${cfg.color})`, width: 14, textAlign: 'center', fontSize: 11 }} />
                  <span style={{ flex: 1, fontSize: 11.5, color: 'var(--txt-2)' }}>{cfg.labelPlural}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--txt-3)', minWidth: 42, textAlign: 'right' }}>
                    {lvl.actifs}/{lvl.total}
                  </span>
                  <div style={{ width: 64, height: 5, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: `var(${cfg.color})`, borderRadius: 99, transition: 'width .5s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: `var(${cfg.color})`, fontWeight: 700, minWidth: 28, textAlign: 'right' }}>
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activité récente */}
        <div className={s.card}>
          <div className={s.cardHead}>
            <div>
              <div className={s.cardTitle}><i className="fas fa-clock-rotate-left" style={{ color: 'var(--sky)' }} /> Activité récente</div>
              <div className={s.cardSub}>Dernières modifications du référentiel</div>
            </div>
          </div>
          <div className={s.cardBody}>
            {stats.recentItems.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--txt-3)', fontSize: 13, padding: '16px 0' }}>
                Aucune modification récente
              </p>
            ) : (
              stats.recentItems.map((r, i) => {
                const { icon, color, levelLabel } = recentMeta(r.statut, r.niveau);
                return (
                  <div key={i} className={s.auditItem} style={{ padding: '10px 0' }}>
                    <div className={s.auditIc} style={{ background: `${color}18`, color }}>
                      <i className={`fas ${icon}`} />
                    </div>
                    <div className={s.auditInfo}>
                      <div className={s.auditAction}>
                        <b>{r.nom}</b>
                        {' '}
                        <span className={s.codePill} style={{ fontSize: 10 }}>{r.code}</span>
                        <span style={{ color: 'var(--txt-3)', fontWeight: 400, marginLeft: 6 }}>{levelLabel}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>
                        par <b>{r.auteur}</b> · {relativeTime(r.updatedAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Carte de couverture (placeholder visuel — intégration Leaflet/MapLibre future) ── */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div>
            <div className={s.cardTitle}><i className="fas fa-map" style={{ color: 'var(--sky)' }} /> Carte de couverture géographique</div>
            <div className={s.cardSub}>Visualisation des zones de livraison actives — intégration OpenStreetMap / Leaflet prévue</div>
          </div>
          <div className={s.cardActions}>
            <button className={`${s.btnSecondary} ${s.btnSm}`}>
              <i className="fas fa-rotate" /> Sync OSM
            </button>
          </div>
        </div>
        <div className={s.cardBody}>
          {/* Placeholder map visuelle */}
          <div style={{
            height: 260, background: 'var(--surface)', borderRadius: 'var(--r-md)',
            border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12, position: 'relative', overflow: 'hidden',
          }}>
            {/* Grille décorative */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .06 }}>
              {Array.from({ length: 20 }, (_, i) => (
                <g key={i}>
                  <line x1={i * 60} y1="0" x2={i * 60} y2="100%" stroke="var(--acid)" strokeWidth="1" />
                  <line x1="0" y1={i * 40} x2="100%" y2={i * 40} stroke="var(--acid)" strokeWidth="1" />
                </g>
              ))}
            </svg>
            {/* Points de zones mock */}
            {[
              { x: '35%', y: '55%', label: 'Kaloum' },
              { x: '42%', y: '48%', label: 'Matam' },
              { x: '48%', y: '42%', label: 'Dixinn' },
              { x: '55%', y: '36%', label: 'Ratoma' },
              { x: '60%', y: '52%', label: 'Matoto' },
            ].map(p => (
              <div key={p.label} style={{ position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%,-50%)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--acid)', boxShadow: '0 0 16px var(--acid)' }} />
                <span style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: 'var(--txt-1)', background: 'var(--raised)', padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap', fontWeight: 600 }}>{p.label}</span>
              </div>
            ))}
            <i className="fas fa-map-location-dot" style={{ fontSize: 40, color: 'var(--txt-3)', position: 'relative', zIndex: 1 }} />
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{ fontFamily: 'var(--font-h)', fontWeight: 700, color: 'var(--txt-1)', fontSize: 14 }}>Carte interactive</div>
              <div style={{ fontSize: 12, color: 'var(--txt-3)', marginTop: 4 }}>Intégration Leaflet + OpenStreetMap — Phase suivante</div>
              <button className={s.btnSecondary} style={{ marginTop: 12 }}>
                <i className="fas fa-expand" /> Ouvrir la carte
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Accès rapides vers chaque niveau ── */}
      <div className={s.card}>
        <div className={s.cardHead}>
          <div className={s.cardTitle}><i className="fas fa-bolt" style={{ color: 'var(--gold)' }} /> Accès rapides</div>
        </div>
        <div className={s.cardBody}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {GEO_LEVELS.map(cfg => (
              <button key={cfg.level} className={s.btnSecondary} onClick={() => onNavigate(cfg.level)}>
                <i className={`fas ${cfg.icon}`} style={{ color: `var(${cfg.color})` }} />
                {cfg.labelPlural}
              </button>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
