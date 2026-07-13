/* ================================================================
 * FICHIER : pages/parametres/PartenairesSection.tsx
 *
 * Partner Management Center (PMC) — Shopi
 * 7 onglets : Vue d'ensemble | Tiers | Commissions | Objectifs |
 *             Bonus & Récompenses | Validation | Tableau de bord
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import base   from '../../styles/ParametresPage.module.css';
import styles from '../../styles/PartenairesSection.module.css';
import type { SectionProps } from './types';
import {
  getPartnerSettings, updatePartnerSettings, getPartnerStats,
  exportPartnerConfigAsJson, exportPartnerStatsAsCsv,
  DEFAULT_SETTINGS, DEFAULT_NOTIF_EVENTS,
  DEFAULT_TIERS, DEFAULT_BONUS_RULES, DEFAULT_OBJECTIVES,
  DEFAULT_DOCUMENTS, DEFAULT_REWARD_RULES,
  type PartnerSettings, type PartnerStats,
  type PartnerTier, type PartnerBonusRule,
  type PartnerObjective, type PartnerRewardRule, type PartnerDocument,
} from '../../services/partner-settings.service';

/* ── Onglets ──────────────────────────────────────────────────── */

type TabId = 'overview' | 'tiers' | 'objectifs' | 'bonus' | 'validation' | 'stats';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'overview',     icon: 'fa-gauge-high',    label: "Vue d'ensemble" },
  { id: 'tiers',        icon: 'fa-layer-group',   label: 'Tiers' },
  { id: 'objectifs',    icon: 'fa-bullseye',      label: 'Objectifs' },
  { id: 'bonus',        icon: 'fa-gift',          label: 'Bonus & Récompenses' },
  { id: 'validation',   icon: 'fa-user-check',    label: 'Validation' },
  { id: 'stats',        icon: 'fa-chart-bar',     label: 'Tableau de bord' },
];

/* ── Modes de validation ──────────────────────────────────────── */

const VALID_MODES = [
  { id: 'auto',    icon: 'fa-robot',      color: '#059669', bg: 'rgba(5,150,105,.1)',  title: 'Automatique',  desc: 'Dossiers complets approuvés instantanément. Idéal pour fort volume.' },
  { id: 'manuel',  icon: 'fa-user-check', color: '#0284C7', bg: 'rgba(2,132,199,.1)',  title: 'Manuel',       desc: 'Chaque candidat est examiné individuellement. Contrôle maximal.' },
  { id: 'hybride', icon: 'fa-brain',      color: '#7C3AED', bg: 'rgba(124,58,237,.1)', title: 'Hybride',      desc: 'Score automatique — les cas limites passent en revue humaine.' },
];

/* ── Événements de notification ──────────────────────────────── */

const NOTIF_EVENTS = [
  { key: 'partnerRegistered', icon: 'fa-user-plus',       color: '#0284C7', bg: 'rgba(2,132,199,.1)',  title: 'Inscription' },
  { key: 'partnerValidated',  icon: 'fa-circle-check',    color: '#059669', bg: 'rgba(5,150,105,.1)',  title: 'Validé' },
  { key: 'partnerSuspended',  icon: 'fa-ban',             color: '#dc2626', bg: 'rgba(220,38,38,.1)',  title: 'Suspendu' },
  { key: 'tierUpgrade',       icon: 'fa-arrow-up',        color: '#D97706', bg: 'rgba(217,119,6,.1)',  title: 'Tier + ' },
  { key: 'tierDowngrade',     icon: 'fa-arrow-down',      color: '#EA580C', bg: 'rgba(234,88,12,.1)',  title: 'Tier − ' },
  { key: 'bonusEarned',       icon: 'fa-coins',           color: '#D97706', bg: 'rgba(217,119,6,.1)',  title: 'Bonus' },
  { key: 'objectiveReached',  icon: 'fa-bullseye',        color: '#7C3AED', bg: 'rgba(124,58,237,.1)', title: 'Objectif' },
  { key: 'rewardUnlocked',    icon: 'fa-trophy',          color: '#D97706', bg: 'rgba(217,119,6,.1)',  title: 'Récompense' },
  { key: 'paymentSent',       icon: 'fa-money-bill-wave', color: '#059669', bg: 'rgba(5,150,105,.1)',  title: 'Paiement' },
  { key: 'documentExpired',   icon: 'fa-file-circle-xmark',color:'#dc2626', bg: 'rgba(220,38,38,.1)',  title: 'Doc expiré' },
];

/* ── Icônes récompenses ───────────────────────────────────────── */

const REWARD_TYPE_ICONS: Record<string, string> = {
  badge:  'fa-medal',
  credit: 'fa-coins',
  coupon: 'fa-ticket',
  gift:   'fa-gift',
  vip:    'fa-crown',
};

/* ── Labels métriques ─────────────────────────────────────────── */

const METRIC_LABELS: Record<string, string> = {
  companies: 'Entreprises',
  orders:    'Commandes',
  revenue:   'CA (GNF)',
  deliveries:'Livreurs',
  clients:   'Clients',
};

const PERIOD_LABELS: Record<string, string> = {
  monthly:   'Mensuel',
  quarterly: 'Trimestriel',
  annual:    'Annuel',
};

function fmtGNF(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

let _tierCounter = 0;
function newTierId() { return `custom_${++_tierCounter}_${Date.now()}`; }

/* ═══════════════════════════════════════════════════════════════ */

export default function PartenairesSection({ onToast }: SectionProps) {

  const [tab,      setTab]      = useState<TabId>('overview');
  const [settings, setSettings] = useState<PartnerSettings | null>(null);
  const [draft,    setDraft]    = useState<PartnerSettings | null>(null);
  const [stats,    setStats]    = useState<PartnerStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  /* ── Chargement ─────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, st] = await Promise.all([getPartnerSettings(), getPartnerStats()]);
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

  /* ── Dirty detection ─────────────────────────────────────────── */

  const isDirty = draft !== null && settings !== null &&
    JSON.stringify(draft) !== JSON.stringify(settings);

  /* ── Sauvegarde ──────────────────────────────────────────────── */

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const { id, updatedAt, ...payload } = draft;
      const saved = await updatePartnerSettings(payload);
      setSettings(structuredClone(saved));
      setDraft(structuredClone(saved));
      onToast('Configuration partenaires sauvegardée', 's');
    } catch {
      onToast('Erreur lors de la sauvegarde', 'w');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (settings) setDraft(structuredClone(settings));
  };

  /* ── Helpers draft ───────────────────────────────────────────── */

  const set = <K extends keyof PartnerSettings>(key: K, val: PartnerSettings[K]) =>
    setDraft(d => d ? { ...d, [key]: val } : d);

  const setTier = (idx: number, patch: Partial<PartnerTier>) =>
    setDraft(d => {
      if (!d) return d;
      const t = [...(d.tiers ?? DEFAULT_TIERS)];
      t[idx] = { ...t[idx], ...patch };
      return { ...d, tiers: t };
    });

  const addTier = () =>
    setDraft(d => {
      if (!d) return d;
      const existing = d.tiers ?? DEFAULT_TIERS;
      const newTier: PartnerTier = {
        id: newTierId(), label: 'Nouveau tier', color: '#6366f1',
        icon: 'fa-star', badge: '⭐', description: 'Description du tier.',
        commission: 4, objectif: 100, bonus: 15_000, minCompanies: 0,
        enabled: true, order: existing.length + 1,
      };
      return { ...d, tiers: [...existing, newTier] };
    });

  const deleteTier = (idx: number) =>
    setDraft(d => {
      if (!d) return d;
      const t = (d.tiers ?? DEFAULT_TIERS).filter((_, i) => i !== idx);
      return { ...d, tiers: t };
    });

  const setBonus = (idx: number, patch: Partial<PartnerBonusRule>) =>
    setDraft(d => {
      if (!d) return d;
      const r = [...(d.bonusRules ?? DEFAULT_BONUS_RULES)];
      r[idx] = { ...r[idx], ...patch };
      return { ...d, bonusRules: r };
    });

  const setObjective = (idx: number, patch: Partial<PartnerObjective>) =>
    setDraft(d => {
      if (!d) return d;
      const r = [...(d.objectives ?? DEFAULT_OBJECTIVES)];
      r[idx] = { ...r[idx], ...patch };
      return { ...d, objectives: r };
    });

  const setReward = (idx: number, patch: Partial<PartnerRewardRule>) =>
    setDraft(d => {
      if (!d) return d;
      const r = [...(d.rewardRules ?? DEFAULT_REWARD_RULES)];
      r[idx] = { ...r[idx], ...patch };
      return { ...d, rewardRules: r };
    });

  const setDoc = (idx: number, patch: Partial<PartnerDocument>) =>
    setDraft(d => {
      if (!d) return d;
      const r = [...(d.requiredDocuments ?? DEFAULT_DOCUMENTS)];
      r[idx] = { ...r[idx], ...patch };
      return { ...d, requiredDocuments: r };
    });

  const setNotif = (key: string, val: boolean) =>
    setDraft(d => d ? { ...d, notifEventsConfig: { ...(d.notifEventsConfig ?? {}), [key]: val } } : d);

  const getNotif = (key: string): boolean => {
    const cfg = draft?.notifEventsConfig ?? DEFAULT_NOTIF_EVENTS;
    return key in cfg ? cfg[key] : (DEFAULT_NOTIF_EVENTS[key] ?? true);
  };

  /* ── États intermédiaires ────────────────────────────────────── */

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
        borderRadius: 12,
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

  const d: PartnerSettings = draft ?? { ...DEFAULT_SETTINGS };

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
                <div className={base.cardTitle}><i className="fas fa-handshake" /> Réseau partenaires</div>
                <div className={base.cardSub}>Statistiques de votre périmètre de partenariat</div>
              </div>
              <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
                onClick={() => { void getPartnerStats().then(setStats); }}>
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
                  <div className={styles.overviewGrid}>
                    {[
                      { label: 'Total partenaires',  value: stats.total,        icon: 'fa-handshake',    color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                      { label: 'Actifs',              value: stats.active,       icon: 'fa-circle-check', color: '#059669', bg: 'rgba(5,150,105,.1)' },
                      { label: 'En attente',          value: stats.pending,      icon: 'fa-hourglass',    color: '#D97706', bg: 'rgba(217,119,6,.1)' },
                      { label: 'Suspendus',           value: stats.suspended,    icon: 'fa-ban',          color: '#dc2626', bg: 'rgba(220,38,38,.1)' },
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
                  <div className={styles.overviewGrid3}>
                    {[
                      { label: 'Nouveaux ce mois',         value: stats.newThisMonth,            icon: 'fa-user-plus',     color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
                      { label: 'Entreprises recrutées',    value: stats.totalCompaniesRecruited, icon: 'fa-building',      color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                      { label: 'Livreurs & correspondants',value: stats.totalDeliveries + stats.totalCorrespondants, icon: 'fa-people-group', color: '#059669', bg: 'rgba(5,150,105,.1)' },
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

          {/* Résumé configuration */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-sliders" /> Configuration active</div>
                <div className={base.cardSub}>Résumé du Partner Management Center</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {[
                  { label: 'Tiers actifs',        value: `${(d.tiers ?? DEFAULT_TIERS).filter(t => t.enabled).length} / ${(d.tiers ?? DEFAULT_TIERS).length}` },
                  { label: 'Mode validation',      value: VALID_MODES.find(v => v.id === d.validationMode)?.title ?? d.validationMode },
                  { label: 'Délai validation',     value: `${d.validationDelayH} h` },
                  { label: 'Fréquence paiement',   value: d.paymentFrequency === 'daily' ? 'Quotidien' : d.paymentFrequency === 'weekly' ? 'Hebdo' : 'Mensuel' },
                  { label: 'Upgrade tier auto',    value: d.autoTierUpgrade ? 'Activé' : 'Désactivé' },
                ].map(r => (
                  <div key={r.label} style={{
                    background: 'var(--bg-input,#f9fafb)', borderRadius: 9, padding: '12px 14px',
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
          ONGLET 2 — TIERS
          ══════════════════════════════════════════════════════════ */}
      {tab === 'tiers' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-layer-group" /> Niveaux de partenariat</div>
                <div className={base.cardSub}>Définissez les tiers, leurs commissions et avantages</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className={styles.toggleRow} style={{ padding: 0, border: 'none', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted,#6b7280)' }}>Upgrade auto</span>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={d.autoTierUpgrade}
                      onChange={e => set('autoTierUpgrade', e.target.checked)} />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.tierGrid}>
                {(d.tiers ?? DEFAULT_TIERS)
                  .sort((a, b) => a.order - b.order)
                  .map((tier, i) => (
                  <div key={tier.id}
                    className={`${styles.tierCard} ${!tier.enabled ? styles.tierCardDisabled : ''}`}
                    style={{ borderColor: tier.enabled ? tier.color + '55' : undefined }}>

                    {/* Supprimer (seulement les tiers custom) */}
                    {!['bronze','silver','gold'].includes(tier.id) && (
                      <button className={styles.tierDeleteBtn} onClick={() => deleteTier(i)}>
                        <i className="fas fa-xmark" />
                      </button>
                    )}

                    <div className={styles.tierHeader}>
                      <div>
                        <div className={styles.tierBadge}>{tier.badge}</div>
                        <div className={styles.tierLabel} style={{ color: tier.color }}>{tier.label}</div>
                      </div>
                      <label className={`${styles.toggle} ${styles.tierToggle}`}>
                        <input type="checkbox" checked={tier.enabled}
                          onChange={e => setTier(i, { enabled: e.target.checked })} />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>

                    <div className={styles.tierDesc}>{tier.description}</div>

                    <div className={styles.tierFields}>
                      <div>
                        <div className={styles.fieldLabel}>Commission (%)</div>
                        <input className={styles.fieldInput} type="number" min={0} max={50} step={0.5}
                          value={tier.commission}
                          onChange={e => setTier(i, { commission: +e.target.value })} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>Min. entreprises</div>
                        <input className={styles.fieldInput} type="number" min={0} max={10000}
                          value={tier.minCompanies}
                          onChange={e => setTier(i, { minCompanies: +e.target.value })} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>Objectif (cmd/mois)</div>
                        <input className={styles.fieldInput} type="number" min={1} max={10000}
                          value={tier.objectif}
                          onChange={e => setTier(i, { objectif: +e.target.value })} />
                      </div>
                      <div>
                        <div className={styles.fieldLabel}>Bonus mensuel (GNF)</div>
                        <input className={styles.fieldInput} type="number" min={0} step={5000}
                          value={tier.bonus}
                          onChange={e => setTier(i, { bonus: +e.target.value })} />
                      </div>
                      <div className={styles.tierFieldFull}>
                        <div className={styles.fieldLabel}>Nom du tier</div>
                        <input className={styles.fieldInput} type="text"
                          value={tier.label}
                          onChange={e => setTier(i, { label: e.target.value })} />
                      </div>
                      <div className={styles.tierFieldFull}>
                        <div className={styles.fieldLabel}>Description</div>
                        <input className={styles.fieldInput} type="text"
                          value={tier.description}
                          onChange={e => setTier(i, { description: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Bouton ajouter */}
                <button className={styles.tierAddBtn} onClick={addTier}>
                  <i className="fas fa-plus" /> Ajouter un tier
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 3 — OBJECTIFS
          ══════════════════════════════════════════════════════════ */}
      {tab === 'objectifs' && (
        <div className={base.card}>
          <div className={base.cardHead}>
            <div>
              <div className={base.cardTitle}><i className="fas fa-bullseye" /> Système d'objectifs</div>
              <div className={base.cardSub}>Cibles de performance déclenchant bonus et upgrades de tier</div>
            </div>
          </div>
          <div className={base.cardBody}>
            <div className={styles.objectiveGrid}>
              {(d.objectives ?? DEFAULT_OBJECTIVES).map((obj, i) => (
                <div key={obj.id} className={styles.objectiveCard}
                  style={{ borderLeftColor: obj.enabled ? '#0284C7' : '#d1d5db' }}>
                  <div>
                    <div className={styles.objectiveName}>{obj.label}</div>
                    <div className={styles.objectiveMeta}>
                      <span className={styles.metricBadge}>{METRIC_LABELS[obj.metric] ?? obj.metric}</span>
                      <span className={styles.periodBadge}>{PERIOD_LABELS[obj.period] ?? obj.period}</span>
                    </div>
                  </div>
                  <div className={styles.objectiveField}>
                    <div className={styles.fieldLabel}>Cible</div>
                    <input type="number" min={1} value={obj.target}
                      onChange={e => setObjective(i, { target: +e.target.value })} />
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Métrique</div>
                    <select className={styles.fieldInput} style={{ fontSize: 12, padding: '6px 10px', width: 110 }}
                      value={obj.metric}
                      onChange={e => setObjective(i, { metric: e.target.value as PartnerObjective['metric'] })}>
                      {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className={styles.fieldLabel}>Période</div>
                    <select className={styles.fieldInput} style={{ fontSize: 12, padding: '6px 10px', width: 110 }}
                      value={obj.period}
                      onChange={e => setObjective(i, { period: e.target.value as PartnerObjective['period'] })}>
                      {Object.entries(PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <label className={styles.toggle}>
                    <input type="checkbox" checked={obj.enabled}
                      onChange={e => setObjective(i, { enabled: e.target.checked })} />
                    <span className={styles.toggleSlider} />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 5 — BONUS & RÉCOMPENSES
          ══════════════════════════════════════════════════════════ */}
      {tab === 'bonus' && (
        <>
          {/* Programme bonus */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-gift" /> Programme de bonus</div>
                <div className={base.cardSub}>Bonifications versées selon les paliers de performance</div>
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
                    <div key={rule.id} className={styles.bonusCard}>
                      <div className={styles.bonusIcon}>
                        <i className={`fas ${rule.type === 'monthly' ? 'fa-calendar' : rule.type === 'quarterly' ? 'fa-calendar-week' : rule.type === 'annual' ? 'fa-star' : 'fa-trophy'}`} />
                      </div>
                      <div>
                        <div className={styles.bonusLabel}>{rule.label}</div>
                        <div className={styles.bonusSub}>{PERIOD_LABELS[rule.type] ?? rule.type}</div>
                      </div>
                      <div className={styles.bonusField}>
                        <div className={styles.fieldLabel}>Seuil</div>
                        <input type="number" min={0} value={rule.threshold}
                          onChange={e => setBonus(i, { threshold: +e.target.value })} />
                      </div>
                      <div className={styles.bonusField}>
                        <div className={styles.fieldLabel}>Montant (GNF)</div>
                        <input type="number" min={0} step={5000} value={rule.bonusAmount}
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

          {/* Programme récompenses */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-trophy" /> Récompenses & Badges</div>
                <div className={base.cardSub}>Distinctions débloquées selon les jalons atteints</div>
              </div>
              <label className={styles.toggle}>
                <input type="checkbox" checked={d.rewardProgramEnabled}
                  onChange={e => set('rewardProgramEnabled', e.target.checked)} />
                <span className={styles.toggleSlider} />
              </label>
            </div>
            {d.rewardProgramEnabled && (
              <div className={base.cardBody}>
                <div className={styles.rewardGrid}>
                  {(d.rewardRules ?? DEFAULT_REWARD_RULES).map((rule, i) => (
                    <div key={rule.id}
                      className={`${styles.rewardCard} ${rule.enabled ? styles.rewardCardEnabled : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div className={styles.rewardIcon}>
                          <i className={`fas ${REWARD_TYPE_ICONS[rule.type] ?? 'fa-gift'}`} />
                        </div>
                        <label className={styles.toggle}>
                          <input type="checkbox" checked={rule.enabled}
                            onChange={e => setReward(i, { enabled: e.target.checked })} />
                          <span className={styles.toggleSlider} />
                        </label>
                      </div>
                      <div className={styles.rewardLabel}>{rule.label}</div>
                      <div className={styles.rewardCondition}>{rule.condition}</div>
                      {rule.value > 0 && (
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>
                          {fmtGNF(rule.value)} GNF
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Événements de notification */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-bell" /> Événements de notification</div>
                <div className={base.cardSub}>Alertes envoyées aux partenaires selon les événements</div>
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
                      <div className={styles.notifCardTitle}>{ev.title}</div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <i className={`fas ${on ? 'fa-toggle-on' : 'fa-toggle-off'}`}
                          style={{ fontSize: 16, color: on ? '#0284C7' : '#d1d5db' }} />
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
          ONGLET 6 — VALIDATION
          ══════════════════════════════════════════════════════════ */}
      {tab === 'validation' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-user-check" /> Workflow de validation</div>
                <div className={base.cardSub}>Processus d'approbation des nouvelles candidatures partenaires</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.validGrid}>
                {VALID_MODES.map(v => (
                  <div key={v.id}
                    className={`${styles.validCard} ${d.validationMode === v.id ? styles.validCardActive : ''}`}
                    onClick={() => set('validationMode', v.id)}>
                    <div className={styles.validIcon} style={{ background: v.bg, color: v.color }}>
                      <i className={`fas ${v.icon}`} />
                    </div>
                    <div className={styles.validName}>{v.title}</div>
                    <div className={styles.validDesc}>{v.desc}</div>
                    {d.validationMode === v.id && (
                      <i className="fas fa-circle-check" style={{ color: v.color, fontSize: 13, marginTop: 4 }} />
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
                <div>
                  <div className={styles.fieldLabel}>Délai de validation (heures)</div>
                  <input className={styles.fieldInput} type="number" min={1} max={720}
                    value={d.validationDelayH}
                    onChange={e => set('validationDelayH', +e.target.value)} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted,#6b7280)', marginTop: 5 }}>
                    Durée maximale avant expiration du dossier.
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className={styles.toggleRow} style={{ paddingTop: 0 }}>
                    <div>
                      <div className={styles.toggleLabel}>Rejet automatique à expiration</div>
                      <div className={styles.toggleSub}>Dossier incomplet après délai → refus automatique.</div>
                    </div>
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={d.autoRejectExpired}
                        onChange={e => set('autoRejectExpired', e.target.checked)} />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>
                  <div className={styles.toggleRow}>
                    <div>
                      <div className={styles.toggleLabel}>Downgrade tier automatique</div>
                      <div className={styles.toggleSub}>Rétrogradation si objectif non atteint 3 mois consécutifs.</div>
                    </div>
                    <label className={styles.toggle}>
                      <input type="checkbox" checked={d.autoTierDowngrade}
                        onChange={e => set('autoTierDowngrade', e.target.checked)} />
                      <span className={styles.toggleSlider} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-file-lines" /> Documents obligatoires</div>
                <div className={base.cardSub}>Pièces requises lors de l'inscription d'un partenaire</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.docGrid}>
                {(d.requiredDocuments ?? DEFAULT_DOCUMENTS).map((doc, i) => (
                  <div key={doc.id} className={styles.docCard}>
                    <div className={styles.docIcon}>
                      <i className="fas fa-file-lines" />
                    </div>
                    <div>
                      <div className={styles.docLabel}>{doc.label}</div>
                      <div className={styles.docDesc}>{doc.description}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <span className={styles.docRequired} style={{
                        background: doc.required ? 'rgba(220,38,38,.1)' : 'rgba(107,114,128,.1)',
                        color:      doc.required ? '#dc2626'            : '#6b7280',
                      }}>
                        {doc.required ? 'Obligatoire' : 'Optionnel'}
                      </span>
                      <label className={styles.toggle} style={{ width: 36, height: 20 }}>
                        <input type="checkbox" checked={doc.required}
                          onChange={e => setDoc(i, { required: e.target.checked })} />
                        <span className={styles.toggleSlider} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════
          ONGLET 7 — TABLEAU DE BORD
          ══════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-chart-bar" /> Tableau de bord partenaires</div>
                <div className={base.cardSub}>Métriques clés du réseau de partenariat</div>
              </div>
              <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
                onClick={() => { void getPartnerStats().then(setStats); }}>
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
                    { label: 'Total partenaires',         value: String(stats.total),                         icon: 'fa-handshake',     color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                    { label: 'Actifs',                    value: String(stats.active),                        icon: 'fa-circle-check',  color: '#059669', bg: 'rgba(5,150,105,.1)' },
                    { label: 'En attente',                value: String(stats.pending),                       icon: 'fa-hourglass',     color: '#D97706', bg: 'rgba(217,119,6,.1)' },
                    { label: 'Suspendus',                 value: String(stats.suspended),                     icon: 'fa-ban',           color: '#dc2626', bg: 'rgba(220,38,38,.1)' },
                    { label: 'Nouveaux ce mois',          value: String(stats.newThisMonth),                  icon: 'fa-user-plus',     color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
                    { label: 'Entreprises recrutées',     value: String(stats.totalCompaniesRecruited),       icon: 'fa-building',      color: '#0284C7', bg: 'rgba(2,132,199,.1)' },
                    { label: 'Livreurs recrutés',         value: String(stats.totalDeliveries),               icon: 'fa-person-biking', color: '#059669', bg: 'rgba(5,150,105,.1)' },
                    { label: 'Correspondants recrutés',   value: String(stats.totalCorrespondants),           icon: 'fa-headset',       color: '#7C3AED', bg: 'rgba(124,58,237,.1)' },
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
                <div className={base.cardSub}>Téléchargez la configuration ou les statistiques partenaires</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.exportGrid}>
                <div className={styles.exportCard} onClick={() => exportPartnerConfigAsJson(d)}>
                  <div className={styles.exportCardIcon} style={{ background: 'rgba(2,132,199,.1)', color: '#0284C7' }}>
                    <i className="fas fa-file-code" />
                  </div>
                  <div>
                    <div className={styles.exportCardTitle}>Configuration JSON</div>
                    <div className={styles.exportCardDesc}>Tiers, commissions, objectifs, bonus, validation — format JSON</div>
                  </div>
                </div>
                <div className={styles.exportCard}
                  onClick={() => stats && exportPartnerStatsAsCsv(stats)}
                  style={{ opacity: stats ? 1 : .5, cursor: stats ? 'pointer' : 'not-allowed' }}>
                  <div className={styles.exportCardIcon} style={{ background: 'rgba(5,150,105,.1)', color: '#059669' }}>
                    <i className="fas fa-file-csv" />
                  </div>
                  <div>
                    <div className={styles.exportCardTitle}>Statistiques CSV</div>
                    <div className={styles.exportCardDesc}>KPIs du réseau partenaires exportés au format tableur</div>
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
