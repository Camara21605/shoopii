/* ================================================================
 * FICHIER : pages/parametres/LivreursSection.tsx
 *
 * Centre de Gestion Intelligent des Livreurs — Delivery Management Center
 * 7 onglets : Vue d'ensemble | Zones | Assignation | Score |
 *             Bonus & Sanctions | Véhicules | Tableau de bord
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import base   from '../../styles/ParametresPage.module.css';
import styles from '../../styles/LivreursSection.module.css';
import type { SectionProps } from './types';
import {
  getDeliverySettings, updateDeliverySettings, getDeliveryStats,
  exportDeliveryConfigAsJson, exportDeliveryStatsAsCsv,
  DEFAULT_SETTINGS, DEFAULT_NOTIF_EVENTS,
  DEFAULT_BONUS_RULES, DEFAULT_PENALTY_RULES,
  type DeliverySettings, type DeliveryStats,
  type BonusRule, type PenaltyRule, type VehicleRule,
} from '../../services/delivery-settings.service';

/* ── Onglets ──────────────────────────────────────────────────── */

type TabId = 'overview' | 'zones' | 'assignation' | 'score' | 'bonus' | 'vehicules' | 'stats';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'overview',   icon: 'fa-gauge-high',     label: "Vue d'ensemble" },
  { id: 'zones',      icon: 'fa-map-pin',         label: 'Zones' },
  { id: 'assignation',icon: 'fa-route',           label: 'Assignation' },
  { id: 'score',      icon: 'fa-star-half-stroke',label: 'Score' },
  { id: 'bonus',      icon: 'fa-award',           label: 'Bonus & Sanctions' },
  { id: 'vehicules',  icon: 'fa-truck',           label: 'Véhicules' },
  { id: 'stats',      icon: 'fa-chart-bar',       label: 'Tableau de bord' },
];

/* ── Stratégies d'assignation ────────────────────────────────── */

const STRATEGIES: { id: string; icon: string; title: string; desc: string }[] = [
  { id: 'nearest',          icon: 'fa-location-dot',   title: 'Le plus proche',     desc: 'Distance GPS en temps réel entre livreur et point de départ.' },
  { id: 'best_score',       icon: 'fa-medal',          title: 'Meilleur score',      desc: 'Score composite : ponctualité, note, taux de réussite.' },
  { id: 'best_availability',icon: 'fa-circle-dot',     title: 'Plus disponible',     desc: 'Livreur avec le moins de commandes en cours.' },
  { id: 'best_rating',      icon: 'fa-star',           title: 'Mieux noté',          desc: 'Priorité à la satisfaction client sur les commandes récentes.' },
];

/* ── Événements de notification ──────────────────────────────── */

const NOTIF_EVENTS: { key: string; icon: string; color: string; bg: string; title: string; desc: string }[] = [
  { key: 'deliveryAssigned',  icon: 'fa-person-biking',       color: '#0284C7', bg: 'rgba(2,132,199,.1)',   title: 'Commande assignée',    desc: 'Notification au livreur lors de chaque nouvelle assignation.' },
  { key: 'deliveryCompleted', icon: 'fa-circle-check',        color: '#059669', bg: 'rgba(5,150,105,.1)',   title: 'Livraison terminée',   desc: 'Confirmation après dépôt confirmé par le client.' },
  { key: 'deliverySuspended', icon: 'fa-ban',                 color: '#dc2626', bg: 'rgba(220,38,38,.1)',   title: 'Compte suspendu',      desc: 'Alerte lors de la suspension automatique ou manuelle.' },
  { key: 'bonusEarned',       icon: 'fa-coins',               color: '#D97706', bg: 'rgba(217,119,6,.1)',   title: 'Bonus débloqué',       desc: 'Notification quand un palier de bonus est atteint.' },
  { key: 'penaltyApplied',    icon: 'fa-triangle-exclamation',color: '#EA580C', bg: 'rgba(234,88,12,.1)',   title: 'Pénalité appliquée',   desc: 'Alerte après sanction automatique.' },
  { key: 'scoreChanged',      icon: 'fa-chart-line',          color: '#7C3AED', bg: 'rgba(124,58,237,.1)',  title: 'Score modifié',        desc: 'Rappel hebdomadaire du score de performance.' },
  { key: 'paymentSent',       icon: 'fa-money-bill-transfer', color: '#059669', bg: 'rgba(5,150,105,.1)',   title: 'Paiement envoyé',      desc: 'Notification lors de chaque virement de gains.' },
  { key: 'newZone',           icon: 'fa-map-location-dot',   color: '#0284C7', bg: 'rgba(2,132,199,.1)',   title: 'Nouvelle zone active', desc: 'Alerte quand une zone de livraison est élargie.' },
];

/* ── Labels actions pénalité ─────────────────────────────────── */

const ACTION_LABELS: Record<string, string> = {
  warning:        'Avertissement',
  score_reduction:'Réduction score',
  suspend_temp:   'Suspension temp.',
  suspend_perm:   'Suspension perm.',
};

function fmtGNF(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/* ═══════════════════════════════════════════════════════════════ */

export default function LivreursSection({ onToast }: SectionProps) {

  const [tab,     setTab]     = useState<TabId>('overview');
  const [settings, setSettings] = useState<DeliverySettings | null>(null);
  const [draft,   setDraft]   = useState<DeliverySettings | null>(null);
  const [stats,   setStats]   = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  /* ── Chargement ────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, st] = await Promise.all([getDeliverySettings(), getDeliveryStats()]);
      setSettings(structuredClone(cfg));
      setDraft(structuredClone(cfg));
      setStats(st);
    } catch {
      setError('Impossible de charger la configuration. Vérifiez la connexion au serveur.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ── Dirty detection ───────────────────────────────────────── */

  const isDirty = draft !== null && settings !== null &&
    JSON.stringify(draft) !== JSON.stringify(settings);

  /* ── Sauvegarde ────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { id, updatedAt, ...payload } = draft;
      const saved = await updateDeliverySettings(payload);
      setSettings(structuredClone(saved));
      setDraft(structuredClone(saved));
      onToast('Configuration livreurs sauvegardée', 's');
    } catch {
      onToast('Erreur lors de la sauvegarde', 'w');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (settings) setDraft(structuredClone(settings));
  };

  /* ── Helpers draft ─────────────────────────────────────────── */

  const set = <K extends keyof DeliverySettings>(key: K, val: DeliverySettings[K]) =>
    setDraft(d => d ? { ...d, [key]: val } : d);

  const setBonus = (idx: number, patch: Partial<BonusRule>) =>
    setDraft(d => {
      if (!d) return d;
      const rules = [...(d.bonusRules ?? DEFAULT_BONUS_RULES)];
      rules[idx] = { ...rules[idx], ...patch };
      return { ...d, bonusRules: rules };
    });

  const setPenalty = (idx: number, patch: Partial<PenaltyRule>) =>
    setDraft(d => {
      if (!d) return d;
      const rules = [...(d.penaltyRules ?? DEFAULT_PENALTY_RULES)];
      rules[idx] = { ...rules[idx], ...patch };
      return { ...d, penaltyRules: rules };
    });

  const setVehicle = (idx: number, patch: Partial<VehicleRule>) =>
    setDraft(d => {
      if (!d) return d;
      const rules = [...(d.vehicleRules ?? [])];
      rules[idx] = { ...rules[idx], ...patch };
      return { ...d, vehicleRules: rules };
    });

  const setWeight = (key: string, val: number) =>
    setDraft(d => {
      if (!d) return d;
      return { ...d, scoreWeights: { ...(d.scoreWeights ?? {}), [key]: val } };
    });

  const setNotif = (key: string, val: boolean) =>
    setDraft(d => d ? { ...d, notifEventsConfig: { ...(d.notifEventsConfig ?? {}), [key]: val } } : d);

  const getNotif = (key: string): boolean => {
    const cfg = draft?.notifEventsConfig ?? DEFAULT_NOTIF_EVENTS;
    return key in cfg ? cfg[key] : (DEFAULT_NOTIF_EVENTS[key] ?? true);
  };

  /* ── Etats intermédiaires ─────────────────────────────────── */

  if (loading) return (
    <div className={base.secBody}>
      <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted,#6b7280)', fontSize: 14 }}>
        <i className="fas fa-rotate-right fa-spin" style={{ fontSize: 22, marginBottom: 10, display: 'block', color: '#0284C7' }} />
        Chargement de la configuration…
      </div>
    </div>
  );

  if (error) return (
    <div className={base.secBody}>
      <div style={{
        textAlign: 'center', padding: '40px 24px',
        background: 'var(--bg-card,#fff)', border: '1px solid var(--border,#e5e7eb)',
        borderRadius: 12, margin: 0,
      }}>
        <i className="fas fa-triangle-exclamation" style={{ fontSize: 28, color: '#dc2626', marginBottom: 10, display: 'block' }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary,#111827)', marginBottom: 6 }}>Chargement impossible</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted,#6b7280)', marginBottom: 18 }}>{error}</div>
        <button className={`${base.btn} ${base.btnBlue} ${base.btnSm}`} onClick={load}>
          <i className="fas fa-rotate-right" /> Réessayer
        </button>
      </div>
    </div>
  );

  const d: DeliverySettings = draft ?? { ...DEFAULT_SETTINGS };
  const weightTotal = Object.values(d.scoreWeights ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className={base.secBody}>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: tab === t.id ? '#0284C7' : 'var(--bg-card,#fff)',
              color:      tab === t.id ? '#fff'    : 'var(--text-muted,#6b7280)',
              boxShadow:  tab === t.id ? '0 2px 8px rgba(2,132,199,.25)' : 'inset 0 0 0 1px var(--border,#e5e7eb)',
              transition: 'all .15s',
            }}
            onClick={() => setTab(t.id)}>
            <i className={`fas ${t.icon}`} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Save bar ── */}
      {isDirty && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(2,132,199,.06)', border: '1px solid rgba(2,132,199,.25)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16, gap: 12,
        }}>
          <span style={{ fontSize: 13, color: '#0284C7', fontWeight: 600 }}>
            <i className="fas fa-circle-dot" /> Modifications non sauvegardées
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
              onClick={handleDiscard} disabled={saving}>Annuler</button>
            <button className={`${base.btn} ${base.btnBlue} ${base.btnSm}`}
              onClick={handleSave} disabled={saving}>
              {saving
                ? <><i className="fas fa-rotate-right fa-spin" /> Sauvegarde…</>
                : <><i className="fas fa-check" /> Sauvegarder</>}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 1 — VUE D'ENSEMBLE
          ══════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-gauge-high" /> Activité du réseau livreurs</div>
                <div className={base.cardSub}>Statistiques issues de votre périmètre administrateur</div>
              </div>
              <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
                onClick={() => { setStats(null); void getDeliveryStats().then(setStats); }}>
                <i className="fas fa-rotate-right" /> Actualiser
              </button>
            </div>
            <div className={base.cardBody}>
              {!stats ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted,#6b7280)', fontSize: 13 }}>
                  <i className="fas fa-chart-bar" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                  Statistiques non disponibles
                </div>
              ) : (
                <>
                  {/* Ligne 1 — statuts */}
                  <div className={styles.overviewGrid}>
                    {[
                      { label: 'Total livreurs',  value: stats.total,     icon: 'fa-users',        color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                      { label: 'Actifs',           value: stats.active,    icon: 'fa-circle-check', color: '#059669', bg: 'rgba(5,150,105,.1)' },
                      { label: 'En attente',       value: stats.pending,   icon: 'fa-hourglass',    color: '#D97706', bg: 'rgba(217,119,6,.1)' },
                      { label: 'Suspendus',        value: stats.suspended, icon: 'fa-ban',          color: '#dc2626', bg: 'rgba(220,38,38,.1)' },
                      { label: 'Nouveaux ce mois', value: stats.newThisMonth, icon: 'fa-user-plus', color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
                    ].map(k => (
                      <div key={k.label} className={styles.kpiCard}>
                        <div className={styles.kpiIcon} style={{ background: k.bg, color: k.color }}>
                          <i className={`fas ${k.icon}`} />
                        </div>
                        <div className={styles.kpiValue}>{k.value}</div>
                        <div className={styles.kpiLabel}>{k.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Ligne 2 — disponibilité */}
                  <div className={styles.overviewGrid4}>
                    {[
                      { label: 'Disponibles',   value: stats.available,       icon: 'fa-circle-dot',     color: '#059669', bg: 'rgba(5,150,105,.1)' },
                      { label: 'En livraison',  value: stats.onDelivery,      icon: 'fa-person-biking',  color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                      { label: 'Note moyenne',  value: stats.avgRating.toFixed(1) + ' ★', icon: 'fa-star', color: '#D97706', bg: 'rgba(217,119,6,.1)' },
                      { label: 'Ponctualité',   value: stats.avgPonctualite.toFixed(0) + '%', icon: 'fa-clock', color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
                    ].map(k => (
                      <div key={k.label} className={styles.kpiCard}>
                        <div className={styles.kpiIcon} style={{ background: k.bg, color: k.color }}>
                          <i className={`fas ${k.icon}`} />
                        </div>
                        <div className={styles.kpiValue}>{k.value}</div>
                        <div className={styles.kpiLabel}>{k.label}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Résumé configuration active */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-sliders" /> Configuration active</div>
                <div className={base.cardSub}>Résumé des paramètres du moteur de gestion</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Stratégie', value: STRATEGIES.find(s => s.id === d.assignmentStrategy)?.title ?? d.assignmentStrategy },
                  { label: 'Score minimum', value: `${d.minScore} / 100` },
                  { label: 'Rayon max', value: `${d.maxRadiusKm} km` },
                  { label: 'Dist. max livraison', value: `${d.maxDeliveryDistanceKm} km` },
                  { label: 'Max simultané', value: `${d.maxSimultaneousOrders} cdes` },
                  { label: 'Fréq. paiement', value: d.paymentFrequency === 'daily' ? 'Quotidien' : d.paymentFrequency === 'weekly' ? 'Hebdo' : 'Mensuel' },
                ].map(r => (
                  <div key={r.label} style={{
                    background: 'var(--bg-input,#f9fafb)',
                    borderRadius: 9, padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted,#6b7280)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{r.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary,#111827)' }}>{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 2 — ZONES & DISTANCES
          ══════════════════════════════════════════════════════════ */}
      {tab === 'zones' && (
        <div className={base.card}>
          <div className={base.cardHead}>
            <div>
              <div className={base.cardTitle}><i className="fas fa-map-pin" /> Zones et distances</div>
              <div className={base.cardSub}>Périmètre d'intervention et distances de livraison</div>
            </div>
          </div>
          <div className={base.cardBody}>
            <div className={styles.zonesGrid}>

              {/* Rayon d'activité */}
              <div className={styles.zoneCard}>
                <div className={styles.zoneCardTitle}><i className="fas fa-circle-radiation" /> Rayon d'activité</div>
                <div className={styles.fieldRow}>
                  <label>Rayon maximum (km)</label>
                  <input type="number" min={1} max={200} value={d.maxRadiusKm}
                    onChange={e => set('maxRadiusKm', +e.target.value)} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', margin: 0, lineHeight: 1.5 }}>
                  Distance maximale entre le livreur et le point de départ d'une commande.
                  Au-delà, la commande ne lui est pas proposée.
                </p>
              </div>

              {/* Distance max par livraison */}
              <div className={styles.zoneCard}>
                <div className={styles.zoneCardTitle}><i className="fas fa-route" /> Distance par livraison</div>
                <div className={styles.fieldRow}>
                  <label>Distance maximum (km)</label>
                  <input type="number" min={1} max={500} value={d.maxDeliveryDistanceKm}
                    onChange={e => set('maxDeliveryDistanceKm', +e.target.value)} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', margin: 0, lineHeight: 1.5 }}>
                  Au-delà de cette distance par course, la livraison nécessite
                  une approbation manuelle de votre équipe.
                </p>
              </div>

              {/* Délai de réassignation */}
              <div className={styles.zoneCard}>
                <div className={styles.zoneCardTitle}><i className="fas fa-clock-rotate-left" /> Réassignation</div>
                <div className={styles.fieldRow}>
                  <label>Délai avant réassignation (min)</label>
                  <input type="number" min={1} max={60} value={d.reassignTimeoutMin}
                    onChange={e => set('reassignTimeoutMin', +e.target.value)} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', margin: 0, lineHeight: 1.5 }}>
                  Si un livreur n'accepte pas dans ce délai, la commande est
                  automatiquement réassignée à un autre livreur disponible.
                </p>
              </div>

              {/* Délai d'acceptation */}
              <div className={styles.zoneCard}>
                <div className={styles.zoneCardTitle}><i className="fas fa-hourglass-half" /> Délai d'acceptation</div>
                <div className={styles.fieldRow}>
                  <label>Temps de réponse requis (min)</label>
                  <input type="number" min={1} max={30} value={d.acceptDeadlineMin}
                    onChange={e => set('acceptDeadlineMin', +e.target.value)} />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', margin: 0, lineHeight: 1.5 }}>
                  Durée maximale pour accepter ou refuser une commande assignée.
                  Passé ce délai, un refus automatique est enregistré.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 3 — ASSIGNATION
          ══════════════════════════════════════════════════════════ */}
      {tab === 'assignation' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-robot" /> Stratégie d'assignation</div>
                <div className={base.cardSub}>Algorithme utilisé pour affecter une commande à un livreur</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.strategyGrid}>
                {STRATEGIES.map(s => (
                  <div key={s.id}
                    className={`${styles.strategyCard} ${d.assignmentStrategy === s.id ? styles.strategyCardActive : ''}`}
                    onClick={() => set('assignmentStrategy', s.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: d.assignmentStrategy === s.id ? 'rgba(2,132,199,.12)' : 'var(--bg-input,#f9fafb)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: d.assignmentStrategy === s.id ? '#0284C7' : 'var(--text-muted,#6b7280)',
                        fontSize: 12,
                      }}>
                        <i className={`fas ${s.icon}`} />
                      </div>
                      <div className={styles.strategyName}>{s.title}</div>
                      {d.assignmentStrategy === s.id && (
                        <i className="fas fa-circle-check" style={{ marginLeft: 'auto', color: '#0284C7', fontSize: 13 }} />
                      )}
                    </div>
                    <div className={styles.strategyDesc}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-sliders" /> Paramètres opérationnels</div>
                <div className={base.cardSub}>Limites et seuils de l'assignation automatique</div>
              </div>
            </div>
            <div className={base.cardBody}>

              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Assignation automatique</div>
                  <div className={styles.toggleSub}>Le livreur prioritaire reçoit la commande sans intervention humaine.</div>
                </div>
                <label className={styles.toggle}>
                  <input type="checkbox" checked={d.autoAssignEnabled}
                    onChange={e => set('autoAssignEnabled', e.target.checked)} />
                  <span className={styles.toggleSlider} />
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                <div className={styles.fieldRow}>
                  <label>Commandes simultanées max</label>
                  <input type="number" min={1} max={20} value={d.maxSimultaneousOrders}
                    onChange={e => set('maxSimultaneousOrders', +e.target.value)} />
                </div>
                <div className={styles.fieldRow}>
                  <label>Fréquence de paiement</label>
                  <select value={d.paymentFrequency}
                    onChange={e => set('paymentFrequency', e.target.value)}>
                    <option value="daily">Quotidien</option>
                    <option value="weekly">Hebdomadaire</option>
                    <option value="monthly">Mensuel</option>
                  </select>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 4 — SCORE
          ══════════════════════════════════════════════════════════ */}
      {tab === 'score' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-star-half-stroke" /> Seuils de score</div>
                <div className={base.cardSub}>Contrôle d'accès basé sur le score composite du livreur</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {[
                  { key: 'minScore'                  as const, label: 'Score minimum requis',         color: '#0284C7', hint: 'En dessous de ce score, le livreur ne reçoit plus de nouvelles commandes.' },
                  { key: 'suspensionScoreThreshold'  as const, label: 'Seuil de suspension auto',     color: '#dc2626', hint: 'Score en dessous duquel la suspension automatique se déclenche.' },
                  { key: 'reactivationScoreThreshold'as const, label: 'Score de réactivation',        color: '#059669', hint: 'Score minimal requis pour qu\'un compte suspendu soit réactivé.' },
                ].map(r => (
                  <div key={r.key} className={styles.zoneCard}>
                    <div className={styles.zoneCardTitle} style={{ color: r.color }}>
                      <i className="fas fa-sliders" style={{ color: r.color }} /> {r.label}
                    </div>
                    <div className={styles.fieldRow}>
                      <label>Score (0–100)</label>
                      <input type="number" min={0} max={100} value={d[r.key] as number}
                        onChange={e => set(r.key, +e.target.value)} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted,#6b7280)', margin: 0, lineHeight: 1.5 }}>{r.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-chart-pie" /> Pondérations du score</div>
                <div className={base.cardSub}>
                  Les poids doivent totaliser 100 — actuellement&nbsp;
                  <strong style={{ color: weightTotal === 100 ? '#059669' : '#dc2626' }}>{weightTotal}</strong>
                </div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.weightsCard} style={{ border: 'none', padding: 0 }}>
                {Object.entries(d.scoreWeights ?? {}).map(([k, v]) => (
                  <div key={k} className={styles.weightRow}>
                    <div className={styles.weightName}>
                      {{
                        ponctualite:      'Ponctualité',
                        noteClients:      'Note clients',
                        tauxReussite:     'Taux de réussite',
                        volumeLivraisons: 'Volume livraisons',
                        absenceIncidents: 'Absence incidents',
                      }[k] ?? k}
                    </div>
                    <input type="range" className={styles.weightSlider}
                      min={0} max={100} step={5} value={v}
                      onChange={e => setWeight(k, +e.target.value)} />
                    <div className={styles.weightVal}>{v}%</div>
                  </div>
                ))}
                <div className={`${styles.weightTotal} ${weightTotal === 100 ? styles.weightTotalOk : styles.weightTotalOver}`}>
                  Total : {weightTotal} / 100 {weightTotal === 100 ? '✓' : '— ajustez les curseurs'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 5 — BONUS & SANCTIONS
          ══════════════════════════════════════════════════════════ */}
      {tab === 'bonus' && (
        <>
          {/* Programme de bonus */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-award" /> Programme de bonus</div>
                <div className={base.cardSub}>Récompense les livreurs atteignant des paliers de volume</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={d.bonusProgramEnabled}
                  onChange={e => set('bonusProgramEnabled', e.target.checked)} />
                <span className={styles.toggleSlider} />
              </label>
            </div>
            {d.bonusProgramEnabled && (
              <div className={base.cardBody}>
                <div className={styles.bonusGrid}>
                  {(d.bonusRules ?? DEFAULT_BONUS_RULES).map((rule, i) => (
                    <div key={rule.id} className={styles.bonusRuleCard}>
                      <div className={styles.bonusRuleIcon}>
                        <i className={`fas ${rule.type === 'daily' ? 'fa-sun' : rule.type === 'weekly' ? 'fa-calendar-week' : 'fa-calendar'}`} />
                      </div>
                      <div>
                        <div className={styles.bonusRuleName}>{rule.label}</div>
                        <div className={styles.bonusRuleSub}>Type : {rule.type === 'daily' ? 'Journalier' : rule.type === 'weekly' ? 'Hebdomadaire' : 'Mensuel'}</div>
                      </div>
                      <div className={styles.bonusField}>
                        <div className={styles.bonusFieldLabel}>Livraisons requises</div>
                        <input type="number" min={1} value={rule.deliveriesRequired}
                          onChange={e => setBonus(i, { deliveriesRequired: +e.target.value })} />
                      </div>
                      <div className={styles.bonusField}>
                        <div className={styles.bonusFieldLabel}>Montant (GNF)</div>
                        <input type="number" min={0} step={1000} value={rule.bonusAmount}
                          onChange={e => setBonus(i, { bonusAmount: +e.target.value })} />
                      </div>
                      <label className={styles.toggle}>
                        <input type="checkbox" checked={rule.enabled}
                          onChange={e => setBonus(i, { enabled: e.target.checked })} />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sanctions automatiques */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-gavel" /> Sanctions automatiques</div>
                <div className={base.cardSub}>Pénalités déclenchées par le moteur de règles comportementales</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={d.autoPenaltyEnabled}
                  onChange={e => set('autoPenaltyEnabled', e.target.checked)} />
                <span className={styles.toggleSlider} />
              </label>
            </div>
            {d.autoPenaltyEnabled && (
              <div className={base.cardBody}>
                <div className={styles.penaltyGrid}>
                  {(d.penaltyRules ?? DEFAULT_PENALTY_RULES).map((rule, i) => (
                    <div key={rule.id} className={styles.penaltyCard}>
                      <div>
                        <div className={styles.penaltyTrigger}>{rule.trigger}</div>
                        <div className={styles.penaltyAction}>
                          <span className={styles.actionBadge}>{ACTION_LABELS[rule.action] ?? rule.action}</span>
                          {rule.value > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted,#6b7280)' }}>
                            {rule.action === 'score_reduction' ? `−${rule.value} pts` : `${rule.value} j`}
                          </span>}
                        </div>
                      </div>
                      <div className={styles.penaltyField}>
                        <div className={styles.bonusFieldLabel}>Seuil</div>
                        <input type="number" min={1} value={rule.threshold}
                          onChange={e => setPenalty(i, { threshold: +e.target.value })} />
                      </div>
                      <div className={styles.penaltyField}>
                        <div className={styles.bonusFieldLabel}>Valeur</div>
                        <input type="number" min={0} value={rule.value}
                          onChange={e => setPenalty(i, { value: +e.target.value })} />
                      </div>
                      <label className={styles.toggle}>
                        <input type="checkbox" checked={rule.enabled}
                          onChange={e => setPenalty(i, { enabled: e.target.checked })} />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notifications livreurs */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-bell" /> Événements de notification</div>
                <div className={base.cardSub}>Choisissez quand les livreurs reçoivent des alertes</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.notifGrid}>
                {NOTIF_EVENTS.map(ev => {
                  const on = getNotif(ev.key);
                  return (
                    <div key={ev.key}
                      className={`${styles.notifCard} ${on ? styles.notifCardOn : ''}`}
                      onClick={() => setNotif(ev.key, !on)}>
                      <div className={styles.notifCardIcon} style={{ background: ev.bg, color: ev.color }}>
                        <i className={`fas ${ev.icon}`} />
                      </div>
                      <div>
                        <div className={styles.notifCardTitle}>{ev.title}</div>
                        <div className={styles.notifCardDesc}>{ev.desc}</div>
                      </div>
                      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#0284C7' : 'var(--text-muted,#6b7280)' }}>
                          {on ? 'Activé' : 'Désactivé'}
                        </span>
                        <i className={`fas ${on ? 'fa-toggle-on' : 'fa-toggle-off'}`}
                          style={{ fontSize: 18, color: on ? '#0284C7' : '#d1d5db' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 6 — VÉHICULES
          ══════════════════════════════════════════════════════════ */}
      {tab === 'vehicules' && (
        <div className={base.card}>
          <div className={base.cardHead}>
            <div>
              <div className={base.cardTitle}><i className="fas fa-truck" /> Règles par type de véhicule</div>
              <div className={base.cardSub}>Capacités maximales et distances autorisées par catégorie</div>
            </div>
          </div>
          <div className={base.cardBody}>
            <div className={styles.vehicleGrid}>
              {(d.vehicleRules ?? []).map((v, i) => (
                <div key={v.type} className={`${styles.vehicleCard} ${v.enabled ? styles.vehicleCardEnabled : ''}`}>
                  <div className={styles.vehicleHeader}>
                    <div>
                      <div className={styles.vehicleEmoji}>{v.icon}</div>
                      <div className={styles.vehicleLabel}>{v.label}</div>
                    </div>
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={v.enabled}
                        onChange={e => setVehicle(i, { enabled: e.target.checked })} />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>
                  <div className={styles.vehicleFields}>
                    <div>
                      <div className={styles.vehicleFieldLabel}>Poids max (kg)</div>
                      <input type="number" min={1} value={v.maxWeightKg}
                        onChange={e => setVehicle(i, { maxWeightKg: +e.target.value })} />
                    </div>
                    <div>
                      <div className={styles.vehicleFieldLabel}>Distance max (km)</div>
                      <input type="number" min={1} value={v.maxDistanceKm}
                        onChange={e => setVehicle(i, { maxDistanceKm: +e.target.value })} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 7 — TABLEAU DE BORD / STATS
          ══════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-chart-bar" /> Tableau de bord livreurs</div>
                <div className={base.cardSub}>Métriques clés du réseau de livraison</div>
              </div>
              <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
                onClick={() => { void getDeliveryStats().then(setStats); }}>
                <i className="fas fa-rotate-right" /> Actualiser
              </button>
            </div>
            <div className={base.cardBody}>
              {!stats ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted,#6b7280)', fontSize: 13 }}>
                  <i className="fas fa-chart-bar" style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                  Statistiques non disponibles
                </div>
              ) : (
                <div className={styles.statsGrid}>
                  {[
                    { label: 'Total livreurs',        value: String(stats.total),                         icon: 'fa-users',              color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                    { label: 'Actifs',                value: String(stats.active),                        icon: 'fa-circle-check',       color: '#059669', bg: 'rgba(5,150,105,.1)' },
                    { label: 'Vérifiés',              value: String(stats.verified),                      icon: 'fa-user-shield',        color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
                    { label: 'Disponibles',           value: String(stats.available),                     icon: 'fa-circle-dot',         color: '#059669', bg: 'rgba(5,150,105,.1)' },
                    { label: 'En livraison',          value: String(stats.onDelivery),                    icon: 'fa-person-biking',      color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                    { label: 'Suspendus',             value: String(stats.suspended),                     icon: 'fa-ban',                color: '#dc2626', bg: 'rgba(220,38,38,.1)' },
                    { label: 'Total livraisons',      value: String(stats.totalDeliveries),               icon: 'fa-box-open',           color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                    { label: 'Note moyenne',          value: stats.avgRating.toFixed(1) + ' / 5 ★',      icon: 'fa-star',               color: '#D97706', bg: 'rgba(217,119,6,.1)' },
                    { label: 'Ponctualité moy.',      value: stats.avgPonctualite.toFixed(0) + '%',       icon: 'fa-clock',              color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
                    { label: 'Gains totaux',          value: fmtGNF(stats.totalEarnings) + ' GNF',        icon: 'fa-money-bill-wave',    color: '#059669', bg: 'rgba(5,150,105,.1)' },
                    { label: 'Nouveaux ce mois',      value: String(stats.newThisMonth),                  icon: 'fa-user-plus',          color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                    { label: 'Bannis',                value: String(stats.banned),                        icon: 'fa-circle-xmark',       color: '#7f1d1d', bg: 'rgba(127,29,29,.1)' },
                  ].map(k => (
                    <div key={k.label} className={styles.statCard}>
                      <div className={styles.statIcon} style={{ background: k.bg, color: k.color }}>
                        <i className={`fas ${k.icon}`} />
                      </div>
                      <div>
                        <div className={styles.statValue}>{k.value}</div>
                        <div className={styles.statLabel}>{k.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Export */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-download" /> Export des données</div>
                <div className={base.cardSub}>Téléchargez la configuration ou les statistiques du réseau</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.exportGrid}>
                <div className={styles.exportCard} onClick={() => exportDeliveryConfigAsJson(d)}>
                  <div className={styles.exportCardIcon} style={{ background: 'rgba(2,132,199,.1)', color: '#0284C7' }}>
                    <i className="fas fa-file-code" />
                  </div>
                  <div>
                    <div className={styles.exportCardTitle}>Configuration JSON</div>
                    <div className={styles.exportCardDesc}>Tous les paramètres du moteur livreurs en JSON structuré</div>
                  </div>
                </div>
                <div className={styles.exportCard}
                  onClick={() => stats && exportDeliveryStatsAsCsv(stats)}
                  style={{ opacity: stats ? 1 : .5, cursor: stats ? 'pointer' : 'not-allowed' }}>
                  <div className={styles.exportCardIcon} style={{ background: 'rgba(5,150,105,.1)', color: '#059669' }}>
                    <i className="fas fa-file-csv" />
                  </div>
                  <div>
                    <div className={styles.exportCardTitle}>Statistiques CSV</div>
                    <div className={styles.exportCardDesc}>KPIs du réseau exportés au format tableur</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
