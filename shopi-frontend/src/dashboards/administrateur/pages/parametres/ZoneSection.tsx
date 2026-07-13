/* ================================================================
 * FICHIER : pages/parametres/ZoneSection.tsx
 *
 * Centre de contrôle territorial de l'administrateur Shopi.
 * Toutes les données proviennent du backend — aucune constante codée.
 *
 * ONGLETS :
 *   1. Identité      — infos zone + KPIs acteurs
 *   2. Statistiques  — grille complète de métriques
 *   3. Couverture    — barres + table par commune
 *   4. Carte         — Leaflet + OpenStreetMap
 *   5. Alertes       — 13 toggles synchronisés au backend
 * ================================================================ */

import 'leaflet/dist/leaflet.css';
import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet';

import styles  from '../../styles/ParametresPage.module.css';
import zStyles from '../../styles/ZoneSection.module.css';

import {
  refreshZone, updatePreferences,
  DEFAULT_ALERT_PREFS,
  type ZoneInfo, type ZoneStatistiques,
  type CommuneCouverture, type AlertPreferences,
} from '../../services/zone.service';

import type { SectionProps } from './types';

/* ── Fix Leaflet marker icons avec Vite ─────────────────────── */
const ZONE_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;
    background:var(--blue);
    border-radius:50%;
    border:3px solid #fff;
    box-shadow:0 2px 10px rgba(0,0,0,.35);
  "></div>`,
  iconSize:   [18, 18],
  iconAnchor: [9, 9],
});

const COMMUNE_ICON = (sante: 'good' | 'medium' | 'low') => L.divIcon({
  className: '',
  html: `<div style="
    width:13px;height:13px;
    background:${sante === 'good' ? '#047857' : sante === 'medium' ? '#B45309' : '#DC2626'};
    border-radius:50%;
    border:2px solid #fff;
    box-shadow:0 1px 6px rgba(0,0,0,.3);
  "></div>`,
  iconSize:   [13, 13],
  iconAnchor: [6, 6],
});

/* ── Coordonnées par défaut (Conakry) ───────────────────────── */
const DEFAULT_CENTER: [number, number] = [9.6412, -13.5784];

/* ── Labels des préférences d'alertes ──────────────────────── */
const ALERT_LABELS: { key: string; label: string; desc: string; icon: string; color: string }[] = [
  { key: 'grave',              label: 'Signalement grave',           desc: "Notification immédiate pour tout signalement critique.",           icon: 'fa-flag',                 color: 'tIcRed'   },
  { key: 'validation',         label: 'Validation en attente > 24h', desc: "Rappel quotidien si une validation n’est pas traitée sous 24h.", icon: 'fa-user-check',         color: 'tIcAmber' },
  { key: 'litige',             label: 'Nouveau litige',              desc: "Alerte à chaque ouverture d’un dossier de litige.",            icon: 'fa-scale-balanced',       color: 'tIcTeal'  },
  { key: 'nouvelleEntreprise', label: 'Nouvelle entreprise',         desc: "Notification lors de l’inscription d’une nouvelle entreprise.", icon: 'fa-store',              color: 'tIcTeal'  },
  { key: 'nouveauPartenaire',  label: 'Nouveau partenaire',          desc: "Alerte à chaque nouvelle inscription partenaire dans la zone.",    icon: 'fa-handshake',            color: 'tIcTeal'  },
  { key: 'nouveauLivreur',     label: 'Nouveau livreur',             desc: "Notification lorsqu’un livreur rejoint votre zone.",               icon: 'fa-motorcycle',           color: 'tIcTeal'  },
  { key: 'commandeImportante', label: 'Commande importante',         desc: "Alerte pour les commandes dépassant un seuil de montant.",         icon: 'fa-bag-shopping',         color: 'tIcAmber' },
  { key: 'hausseInhabituelle', label: 'Hausse inhabituelle',         desc: "Détection automatique d’une montée anormale d’activité.", icon: 'fa-arrow-trend-up', color: 'tIcAmber' },
  { key: 'baisseVentes',       label: 'Baisse des ventes',           desc: "Alerte si le volume hebdomadaire chute de plus de 20%.",               icon: 'fa-arrow-trend-down',     color: 'tIcRed'   },
  { key: 'signalementCritique',label: 'Signalement critique',        desc: "Notification prioritaire pour les fraudes ou abus caractérisés.", icon: 'fa-triangle-exclamation', color: 'tIcRed' },
  { key: 'paiementEchoue',     label: 'Paiement échoué',   desc: "Alerte lors d’un échec de transaction de paiement.",          icon: 'fa-credit-card',          color: 'tIcRed'   },
  { key: 'livreurInactif',     label: 'Livreur inactif',             desc: "Notification si un livreur n’a pas eu d’activité depuis 7 jours.", icon: 'fa-person-biking', color: 'tIcAmber' },
  { key: 'tentativeFraude',    label: 'Tentative de fraude',         desc: "Alerte immédiate si un comportement frauduleux est détecté.", icon: 'fa-shield-halved',  color: 'tIcRed'   },
];

/* ── Map des classes CSS d'icônes d'alerte ──────────────────── */
const getAlertIcClass = (color: string, s: typeof styles): string => ({
  tIcRed:   s.tIcRed,
  tIcAmber: s.tIcAmber,
  tIcTeal:  s.tIcTeal,
}[color] ?? '');

/* ── Labels des onglets ─────────────────────────────────────── */
type Tab = 'identite' | 'statistiques' | 'couverture' | 'carte' | 'alertes';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'identite',      label: 'Identité',      icon: 'fa-id-card'          },
  { id: 'statistiques',  label: 'Statistiques',  icon: 'fa-chart-bar'        },
  { id: 'couverture',    label: 'Couverture',    icon: 'fa-map-location-dot'  },
  { id: 'carte',         label: 'Carte',         icon: 'fa-earth-africa'     },
  { id: 'alertes',       label: 'Alertes',       icon: 'fa-bell'             },
];

/* ── Couleurs des barres de couverture ──────────────────────── */
function santeColor(sante: 'good' | 'medium' | 'low') {
  if (sante === 'good')   return 'var(--emerald)';
  if (sante === 'medium') return 'var(--amber)';
  return '#DC2626';
}

/* ── Formatage de nombres ───────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('fr-FR');

/* ================================================================
 * SOUS-COMPOSANTS SKELETON
 * ================================================================ */
function SkeletonStats() {
  return (
    <div className={zStyles.statsGrid}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`${zStyles.skeleton} ${zStyles.skeletonCard}`} />
      ))}
    </div>
  );
}

function SkeletonBars() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ marginBottom: 16 }}>
          <div className={`${zStyles.skeleton} ${zStyles.skeletonText}`} style={{ width: '30%', marginBottom: 6 }} />
          <div className={`${zStyles.skeleton} ${zStyles.skeletonBar}`} style={{ width: `${60 + i * 8}%` }} />
        </div>
      ))}
    </div>
  );
}

/* ================================================================
 * SOUS-COMPOSANT — ANNEAU SANTÉ SVG
 * ================================================================ */
function SanteRing({ pct }: { pct: number }) {
  const r   = 30;
  const circ = 2 * Math.PI * r;
  const fill = ((pct / 100) * circ);
  const color = pct >= 75 ? 'var(--emerald)' : pct >= 45 ? 'var(--amber)' : '#DC2626';

  return (
    <div className={zStyles.santeRing}>
      <svg className={zStyles.santeSvg} width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--g200)" strokeWidth="7" />
        <circle
          cx="38" cy="38" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 38 38)"
          style={{ transition: 'stroke-dasharray .8s ease' }}
        />
        <text x="38" y="43" textAnchor="middle" fill={color} fontSize="13" fontWeight="800">{pct}%</text>
      </svg>
      <div className={zStyles.santeInfo}>
        <div className={zStyles.santeScore}>{pct}%</div>
        <div className={zStyles.santeLabel}>Santé de la zone</div>
        <div style={{ marginTop: 6, fontSize: 11, color: pct >= 75 ? 'var(--emerald)' : pct >= 45 ? 'var(--amber)' : '#DC2626', fontWeight: 700 }}>
          {pct >= 75 ? '✓ Zone en bonne santé' : pct >= 45 ? '⚠ Zone à surveiller' : '✗ Zone en difficulté'}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
 * COMPOSANT PRINCIPAL
 * ================================================================ */
export default function ZoneSection({ onToast }: SectionProps) {

  /* ── État global ──────────────────────────────────────────── */
  const [tab,        setTab]        = useState<Tab>('identite');
  const [info,       setInfo]       = useState<ZoneInfo | null>(null);
  const [stats,      setStats]      = useState<ZoneStatistiques | null>(null);
  const [couverture, setCouverture] = useState<CommuneCouverture[]>([]);
  const [alertPrefs, setAlertPrefs] = useState<AlertPreferences>(DEFAULT_ALERT_PREFS);
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  /* ── Alertes : dirty state ────────────────────────────────── */
  const [savedPrefs,   setSavedPrefs]   = useState<AlertPreferences>(DEFAULT_ALERT_PREFS);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const alertsDirty = JSON.stringify(alertPrefs) !== JSON.stringify(savedPrefs);

  /* ── Carte : ne monter que lors de l'onglet Carte ────────── */
  const mapMounted = useRef(false);
  if (tab === 'carte') mapMounted.current = true;

  /* ── Chargement initial ──────────────────────────────────── */
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setSyncing(true);
    setError(null);

    try {
      const data = await refreshZone();
      setInfo(data.info);
      setStats(data.stats);
      setCouverture(data.couverture);
      setAlertPrefs(data.alertPrefs);
      setSavedPrefs(data.alertPrefs);
    } catch {
      setError('Impossible de charger les données de la zone. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Sauvegarde des alertes ──────────────────────────────── */
  const saveAlerts = async () => {
    setSavingAlerts(true);
    try {
      const saved = await updatePreferences(alertPrefs);
      setSavedPrefs(saved);
      onToast('Préférences d\'alertes sauvegardées', 's');
    } catch {
      onToast('Échec de la sauvegarde', 'w');
    } finally {
      setSavingAlerts(false);
    }
  };

  const cancelAlerts = () => setAlertPrefs(savedPrefs);

  const toggleAlert = (key: string) => {
    setAlertPrefs(p => ({ ...p, [key]: !p[key] }));
  };

  /* ── Centre de la carte ──────────────────────────────────── */
  const mapCenter: [number, number] = info?.latitude && info?.longitude
    ? [info.latitude, info.longitude]
    : DEFAULT_CENTER;

  /* ================================================================
   * RENDU : ERREUR
   * ================================================================ */
  if (error && !loading) {
    return (
      <div className={styles.secBody}>
        <div className={styles.card}>
          <div className={zStyles.errorBox}>
            <div className={zStyles.errorIcon}><i className="fas fa-triangle-exclamation" /></div>
            <div className={zStyles.errorMsg}>Données de zone indisponibles</div>
            <div className={zStyles.errorSub}>{error}</div>
            <button className={zStyles.retryBtn} onClick={() => load()}>
              <i className="fas fa-rotate-right" /> Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================
   * RENDU : ONGLETS
   * ================================================================ */
  return (
    <div className={styles.secBody}>

      {/* ── Navigation ─────────────────────────────────────── */}
      <div className={zStyles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${zStyles.tab} ${tab === t.id ? zStyles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fas ${t.icon} ${zStyles.tabIcon}`} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ================================================================
       * ONGLET 1 — IDENTITÉ
       * ================================================================ */}
      {tab === 'identite' && (
        <>
          {/* Card identité */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <div className={styles.cardTitle}>
                  <i className="fas fa-map-location-dot" /> Identité de la zone
                </div>
                <div className={styles.cardSub}>
                  {info ? `Dernière synchronisation : ${new Date(info.synchroAt).toLocaleString('fr-FR')}` : 'Chargement…'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {!loading && info && (
                  <span className={`${styles.bdg} ${info.statut === 'actif' ? styles.bdgGreen : ''}`}>
                    <i className="fas fa-circle" style={{ fontSize: 7 }} />
                    {' '}{info.statut === 'actif' ? 'Active' : 'Inactive'}
                  </span>
                )}
                <button
                  className={zStyles.refreshBtn}
                  onClick={() => load(true)}
                  disabled={syncing || loading}
                  title="Synchroniser"
                >
                  <i className={`fas fa-arrows-rotate ${syncing ? zStyles.spinning : ''}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>

            <div className={styles.cardBody}>
              {loading ? (
                <>
                  <div className={`${zStyles.skeleton} ${zStyles.skeletonCard}`} style={{ marginBottom: 16 }} />
                  <div className={`${zStyles.skeleton} ${zStyles.skeletonText}`} style={{ width: '60%' }} />
                  <div className={`${zStyles.skeleton} ${zStyles.skeletonText}`} style={{ width: '40%' }} />
                </>
              ) : info ? (
                <>
                  {/* Mini KPIs */}
                  <div className={styles.miniKpis}>
                    <div className={styles.mkpi}>
                      <div className={styles.mkpiStripe} style={{ background: 'var(--blue)' }} />
                      <i className="fas fa-map" style={{ color: 'var(--blue)', fontSize: 13 }} />
                      <div className={styles.mkpiV}>{info.communeCount}</div>
                      <div className={styles.mkpiL}>Communes</div>
                    </div>
                    <div className={styles.mkpi}>
                      <div className={styles.mkpiStripe} style={{ background: 'var(--emerald)' }} />
                      <i className="fas fa-heart-pulse" style={{ color: 'var(--emerald)', fontSize: 13 }} />
                      <div className={styles.mkpiV}>{stats?.sante ?? '—'}%</div>
                      <div className={styles.mkpiL}>Santé</div>
                    </div>
                    <div className={styles.mkpi}>
                      <div className={styles.mkpiStripe} style={{ background: 'var(--teal)' }} />
                      <i className="fas fa-users" style={{ color: 'var(--teal)', fontSize: 13 }} />
                      <div className={styles.mkpiV}>{stats ? fmt(stats.acteurTotal) : '—'}</div>
                      <div className={styles.mkpiL}>Acteurs</div>
                    </div>
                    <div className={styles.mkpi}>
                      <div className={styles.mkpiStripe} style={{ background: 'var(--violet)' }} />
                      <i className="fas fa-location-crosshairs" style={{ color: 'var(--violet)', fontSize: 13 }} />
                      <div className={styles.mkpiV}>{info.rayonKm ? `${info.rayonKm} km` : '—'}</div>
                      <div className={styles.mkpiL}>Rayon</div>
                    </div>
                  </div>

                  <div className={styles.divider} />

                  {/* Champs d'identité */}
                  <div className={zStyles.zoneIdentityGrid}>
                    <div className={zStyles.identityField}>
                      <span className={zStyles.identityLabel}>Nom de la zone</span>
                      <span className={zStyles.identityValue}>{info.nom}</span>
                    </div>
                    <div className={zStyles.identityField}>
                      <span className={zStyles.identityLabel}>Code</span>
                      <span className={zStyles.identityValue}>{info.code}</span>
                    </div>
                    <div className={zStyles.identityField}>
                      <span className={zStyles.identityLabel}>Administrateur responsable</span>
                      <span className={zStyles.identityValue}>{info.adminNom}</span>
                    </div>
                    <div className={zStyles.identityField}>
                      <span className={zStyles.identityLabel}>Type de couverture</span>
                      <span className={zStyles.identityValue} style={{ textTransform: 'capitalize' }}>
                        {info.couvertureType}
                      </span>
                    </div>
                    {info.latitude && info.longitude && (
                      <>
                        <div className={zStyles.identityField}>
                          <span className={zStyles.identityLabel}>Latitude</span>
                          <span className={zStyles.identityValue}>{info.latitude.toFixed(4)}</span>
                        </div>
                        <div className={zStyles.identityField}>
                          <span className={zStyles.identityLabel}>Longitude</span>
                          <span className={zStyles.identityValue}>{info.longitude.toFixed(4)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Communes couvertes */}
                  {info.communes.length > 0 && (
                    <>
                      <div className={styles.divider} />
                      <div className={zStyles.identityField}>
                        <span className={zStyles.identityLabel}>Communes couvertes</span>
                        <div className={zStyles.communeChips}>
                          {info.communes.map(c => (
                            <span key={c.id} className={zStyles.communeChip}>
                              <i className="fas fa-check" style={{ fontSize: 9 }} /> {c.nom}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : null}
            </div>
          </div>

          {/* Card acteurs */}
          {(loading || stats) && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}><i className="fas fa-users" /> Acteurs de la zone</div>
                  <div className={styles.cardSub}>Répartition par type d'acteur inscrit</div>
                </div>
              </div>
              <div className={styles.cardBody}>
                {loading ? (
                  [1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--bdr)' }}>
                      <div className={`${zStyles.skeleton} ${zStyles.skeletonText}`} style={{ width: '40%' }} />
                      <div className={`${zStyles.skeleton} ${zStyles.skeletonText}`} style={{ width: 40 }} />
                    </div>
                  ))
                ) : stats && ([
                  { key: 'partenaires', label: 'Partenaires',  sub: 'Recruteurs actifs',   icon: 'fa-handshake', color: 'var(--blue)',    bg: 'var(--sky)', v: stats.partenaires },
                  { key: 'entreprises', label: 'Entreprises',  sub: 'Boutiques et commerces', icon: 'fa-store',  color: 'var(--violet)', bg: 'var(--vl-bg)', v: stats.entreprises },
                  { key: 'livreurs',    label: 'Livreurs',     sub: 'Actifs dans la zone',  icon: 'fa-motorcycle', color: 'var(--teal)', bg: 'rgba(14,116,144,.1)', v: stats.livreurs },
                  { key: 'correspondants', label: 'Correspondants', sub: 'Points relais',   icon: 'fa-map-pin',  color: 'var(--amber)', bg: 'var(--am-bg)', v: stats.correspondants },
                ].map(row => (
                  <div key={row.key} className={zStyles.actorRow}>
                    <div className={zStyles.actorLeft}>
                      <div className={zStyles.actorIcon} style={{ background: row.bg, color: row.color }}>
                        <i className={`fas ${row.icon}`} />
                      </div>
                      <div>
                        <div className={zStyles.actorName}>{row.label}</div>
                        <div className={zStyles.actorSub}>{row.sub}</div>
                      </div>
                    </div>
                    <div className={zStyles.actorCount}>{fmt(row.v)}</div>
                  </div>
                )))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ================================================================
       * ONGLET 2 — STATISTIQUES
       * ================================================================ */}
      {tab === 'statistiques' && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}><i className="fas fa-chart-bar" /> Statistiques de la zone</div>
              <div className={styles.cardSub}>Métriques agrégées en temps réel</div>
            </div>
            <button className={zStyles.refreshBtn} onClick={() => load(true)} disabled={syncing}>
              <i className={`fas fa-arrows-rotate ${syncing ? zStyles.spinning : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>
          <div className={styles.cardBody}>

            {loading ? <SkeletonStats /> : stats ? (
              <>
                {/* Score de santé */}
                <SanteRing pct={stats.sante} />
                <div style={{ height: 20 }} />

                {/* Grille de métriques */}
                <div className={zStyles.statsGrid}>
                  {[
                    { label: 'Partenaires',          v: stats.partenaires,        icon: 'fa-handshake',          color: 'var(--blue)',    bg: 'var(--sky)',              stripe: 'var(--blue)'    },
                    { label: 'Entreprises',           v: stats.entreprises,        icon: 'fa-store',              color: 'var(--violet)', bg: 'var(--vl-bg)',            stripe: 'var(--violet)'  },
                    { label: 'Livreurs',              v: stats.livreurs,           icon: 'fa-motorcycle',         color: 'var(--teal)',   bg: 'rgba(14,116,144,.1)',     stripe: 'var(--teal)'    },
                    { label: 'Correspondants',        v: stats.correspondants,     icon: 'fa-map-pin',            color: 'var(--amber)', bg: 'var(--am-bg)',            stripe: 'var(--amber)'   },
                    { label: 'Total acteurs',         v: stats.acteurTotal,        icon: 'fa-users',              color: 'var(--blue)',   bg: 'var(--sky)',              stripe: 'var(--blue)'    },
                    { label: 'Commandes',             v: stats.commandes,          icon: 'fa-bag-shopping',       color: 'var(--emerald)', bg: 'var(--em-bg)',          stripe: 'var(--emerald)' },
                    { label: 'Commandes du jour',     v: stats.commandesJour,      icon: 'fa-clock',              color: 'var(--teal)',   bg: 'rgba(14,116,144,.1)',     stripe: 'var(--teal)'    },
                    { label: 'Livraisons en cours',   v: stats.livraisonsEnCours,  icon: 'fa-truck-fast',         color: 'var(--blue)',   bg: 'var(--sky)',              stripe: 'var(--blue)'    },
                    { label: 'Litiges ouverts',       v: stats.litigesOuverts,     icon: 'fa-scale-balanced',     color: '#DC2626',       bg: 'rgba(220,38,38,.09)',     stripe: '#DC2626'        },
                    { label: 'Signalements actifs',   v: stats.signalementsActifs, icon: 'fa-flag',               color: '#DC2626',       bg: 'rgba(220,38,38,.09)',     stripe: '#DC2626'        },
                    { label: 'Commandes terminées',   v: stats.commandesTerminees, icon: 'fa-circle-check',       color: 'var(--emerald)', bg: 'var(--em-bg)',          stripe: 'var(--emerald)' },
                    { label: 'Commandes annulées',    v: stats.commandesAnnulees,  icon: 'fa-circle-xmark',       color: '#DC2626',       bg: 'rgba(220,38,38,.09)',     stripe: '#DC2626'        },
                  ].map((c, i) => (
                    <div key={i} className={zStyles.statCard}>
                      <div className={zStyles.statStripe} style={{ background: c.stripe }} />
                      <div className={zStyles.statIcon} style={{ background: c.bg, color: c.color }}>
                        <i className={`fas ${c.icon}`} />
                      </div>
                      <div className={zStyles.statValue}>{fmt(c.v)}</div>
                      <div className={zStyles.statLabel}>{c.label}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* ================================================================
       * ONGLET 3 — COUVERTURE
       * ================================================================ */}
      {tab === 'couverture' && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}><i className="fas fa-map-location-dot" /> Couverture par commune</div>
              <div className={styles.cardSub}>Taux de couverture calculé automatiquement par le backend</div>
            </div>
          </div>
          <div className={styles.cardBody}>
            {loading ? (
              <SkeletonBars />
            ) : couverture.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t3)', fontSize: 13 }}>
                <i className="fas fa-map" style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
                Aucune commune associée à cette zone.<br />
                <span style={{ fontSize: 11.5 }}>Assignez une zone via le référentiel géographique.</span>
              </div>
            ) : (
              <>
                {/* Barres de couverture */}
                <div style={{ marginBottom: 24 }}>
                  {couverture.map(c => (
                    <div key={c.id} className={zStyles.communeRow}>
                      <div className={zStyles.communeName}>{c.nom}</div>
                      <div className={zStyles.communeBarWrap}>
                        <div
                          className={zStyles.communeBar}
                          style={{ width: `${c.pct}%`, background: santeColor(c.sante) }}
                        />
                      </div>
                      <div className={zStyles.communePct} style={{ color: santeColor(c.sante) }}>
                        {c.pct}%
                      </div>
                      <span className={`${zStyles.communeBadge} ${
                        c.sante === 'good' ? zStyles.communeBadgeGood
                          : c.sante === 'medium' ? zStyles.communeBadgeMedium
                          : zStyles.communeBadgeLow
                      }`}>
                        {c.sante === 'good' ? 'Bon' : c.sante === 'medium' ? 'Moyen' : 'Faible'}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.divider} />

                {/* Tableau des communes */}
                <div className={zStyles.tableWrap}>
                  <table className={zStyles.table}>
                    <thead>
                      <tr>
                        <th>Commune</th>
                        <th>Couverture</th>
                        <th>Acteurs</th>
                        <th>Livreurs</th>
                        <th>Entreprises</th>
                        <th>Santé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {couverture.map(c => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 700, color: 'var(--heading-color)' }}>{c.nom}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, background: 'var(--g100)', borderRadius: 999, overflow: 'hidden', minWidth: 60 }}>
                                <div style={{ height: '100%', width: `${c.pct}%`, background: santeColor(c.sante), borderRadius: 999 }} />
                              </div>
                              <span style={{ fontWeight: 700, color: santeColor(c.sante), fontSize: 12, width: 34 }}>{c.pct}%</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 700 }}>{fmt(c.acteurs)}</td>
                          <td>{fmt(c.livreurs)}</td>
                          <td>{fmt(c.entreprises)}</td>
                          <td>
                            <span className={`${zStyles.communeBadge} ${
                              c.sante === 'good' ? zStyles.communeBadgeGood
                                : c.sante === 'medium' ? zStyles.communeBadgeMedium
                                : zStyles.communeBadgeLow
                            }`} style={{ display: 'inline-block' }}>
                              {c.sante === 'good' ? '✓ Bon' : c.sante === 'medium' ? '⚠ Moyen' : '✗ Faible'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
       * ONGLET 4 — CARTE
       * ================================================================ */}
      {tab === 'carte' && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}><i className="fas fa-earth-africa" /> Carte interactive</div>
              <div className={styles.cardSub}>Couverture géographique — OpenStreetMap</div>
            </div>
          </div>
          <div className={styles.cardBody} style={{ padding: 0 }}>
            <div className={zStyles.mapWrapper}>
              {mapMounted.current && (
                <>
                  <MapContainer
                    center={mapCenter}
                    zoom={info?.latitude ? 12 : 11}
                    className={zStyles.mapContainer}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Cercle de rayon de la zone */}
                    {info?.latitude && info?.longitude && info.rayonKm > 0 && (
                      <Circle
                        center={[info.latitude, info.longitude]}
                        radius={info.rayonKm * 1000}
                        pathOptions={{ color: 'var(--blue)', fillColor: 'var(--blue)', fillOpacity: 0.08, weight: 2 }}
                      />
                    )}

                    {/* Marqueur centre de la zone */}
                    {info?.latitude && info?.longitude && (
                      <Marker position={[info.latitude, info.longitude]} icon={ZONE_ICON}>
                        <Popup>
                          <strong>{info.nom}</strong><br />
                          {info.communeCount} commune{info.communeCount > 1 ? 's' : ''}
                        </Popup>
                      </Marker>
                    )}

                    {/* Marqueurs des communes avec coordonnées */}
                    {couverture
                      .filter(c => c.latitude && c.longitude)
                      .map(c => (
                        <Marker
                          key={c.id}
                          position={[c.latitude!, c.longitude!]}
                          icon={COMMUNE_ICON(c.sante)}
                        >
                          <Popup>
                            <strong>{c.nom}</strong><br />
                            Couverture : <b>{c.pct}%</b><br />
                            Acteurs : {fmt(c.acteurs)}
                          </Popup>
                        </Marker>
                      ))}
                  </MapContainer>

                  {/* Légende */}
                  <div className={zStyles.mapOverlay}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, color: 'var(--t3)', marginBottom: 8 }}>Légende</div>
                    {[
                      { color: '#047857', label: 'Bonne couverture' },
                      { color: '#B45309', label: 'Couverture moyenne' },
                      { color: '#DC2626', label: 'Faible couverture' },
                    ].map(l => (
                      <div key={l.label} className={zStyles.mapLegendRow}>
                        <div className={zStyles.mapDot} style={{ background: l.color }} />
                        {l.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: '12px 18px', fontSize: 11.5, color: 'var(--t3)' }}>
              <i className="fas fa-info-circle" style={{ marginRight: 6 }} />
              Les communes sans coordonnées GPS enregistrées n'apparaissent pas sur la carte.
              Ajoutez-les via le référentiel géographique.
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
       * ONGLET 5 — ALERTES
       * ================================================================ */}
      {tab === 'alertes' && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <div className={styles.cardTitle}><i className="fas fa-bell" /> Préférences d'alertes</div>
              <div className={styles.cardSub}>Notifications synchronisées sur tous vos appareils</div>
            </div>
          </div>
          <div className={styles.cardBody}>

            {/* Bandeau de sauvegarde */}
            {alertsDirty && (
              <div className={zStyles.alertSaveBar}>
                <span className={zStyles.alertSaveMsg}>
                  <i className="fas fa-pen-to-square" /> Modifications non sauvegardées
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className={styles.btnSecondary}
                    onClick={cancelAlerts}
                    disabled={savingAlerts}
                  >
                    Annuler
                  </button>
                  <button
                    className={styles.btnPrimary}
                    onClick={saveAlerts}
                    disabled={savingAlerts}
                  >
                    {savingAlerts
                      ? <><i className={`fas fa-circle-notch ${zStyles.spinning}`} /> Sauvegarde…</>
                      : <><i className="fas fa-floppy-disk" /> Sauvegarder</>}
                  </button>
                </div>
              </div>
            )}

            <div className={zStyles.alertGrid}>
              {ALERT_LABELS.map(a => (
                <div key={a.key} className={styles.toggleRow}>
                  <div className={`${styles.tIc} ${getAlertIcClass(a.color, styles)}`}>
                    <i className={`fas ${a.icon}`} />
                  </div>
                  <div className={styles.tMain}>
                    <div className={styles.tTitle}>{a.label}</div>
                    <div className={styles.tDesc}>{a.desc}</div>
                  </div>
                  <div
                    className={`${styles.sw} ${alertPrefs[a.key] ? styles.swOn : ''}`}
                    onClick={() => toggleAlert(a.key)}
                    role="switch"
                    aria-checked={alertPrefs[a.key] ?? false}
                    tabIndex={0}
                    onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && toggleAlert(a.key)}
                  />
                </div>
              ))}
            </div>

            {!alertsDirty && !loading && (
              <div style={{ marginTop: 16, fontSize: 11.5, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="fas fa-circle-check" style={{ color: 'var(--emerald)' }} />
                Préférences synchronisées avec le serveur
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
