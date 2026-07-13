/* ================================================================
 * FICHIER : pages/parametres/ValidationsSection.tsx
 *
 * Moteur de gestion des validations — connecté au backend.
 * Tabs : Mode global | Par acteur | Notifications | Tableau de bord
 * ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import base   from '../../styles/ParametresPage.module.css';
import styles from '../../styles/ValidationsSection.module.css';
import type { SectionProps } from './types';
import {
  getConfig, updateConfig, getStats,
  ACTOR_META, ACTOR_ORDER, DEFAULT_CONFIG,
  type ValidationConfig, type ValidationMode,
  type ActorRule, type ValidationStats,
} from '../../services/validation-config.service';

/* ── Onglets ────────────────────────────────────────────────── */

type TabId = 'mode' | 'acteurs' | 'notifs' | 'stats';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'mode',    icon: 'fa-sliders',    label: 'Mode global' },
  { id: 'acteurs', icon: 'fa-users-gear', label: 'Par acteur' },
  { id: 'notifs',  icon: 'fa-bell',       label: 'Notifications' },
  { id: 'stats',   icon: 'fa-chart-bar',  label: 'Tableau de bord' },
];

/* ── Définition des modes ───────────────────────────────────── */

const MODES: {
  id:    ValidationMode;
  icon:  string;
  color: string;
  bg:    string;
  title: string;
  desc:  string;
}[] = [
  {
    id: 'manuel', icon: 'fa-user-check', color: '#6D28D9', bg: 'rgba(109,40,217,.10)',
    title: 'Manuel',
    desc:  "Chaque demande est examinée et approuvée individuellement par l'administrateur.",
  },
  {
    id: 'auto', icon: 'fa-robot', color: '#059669', bg: 'rgba(5,150,105,.10)',
    title: 'Automatique',
    desc:  'Les demandes conformes aux critères sont approuvées instantanément.',
  },
  {
    id: 'hybride', icon: 'fa-code-branch', color: '#0284C7', bg: 'rgba(2,132,199,.10)',
    title: 'Hybride',
    desc:  "Auto si score ≥ seuil, sinon renvoi vers la file d'examen manuelle.",
  },
  {
    id: 'score', icon: 'fa-gauge-high', color: '#D97706', bg: 'rgba(217,119,6,.10)',
    title: 'Par score',
    desc:  "Décision basée uniquement sur le score de risque calculé à l'inscription.",
  },
];

/* ── Config notification ─────────────────────────────────────── */

const NOTIF_CHANNELS: {
  key:   keyof Pick<ValidationConfig, 'notifEmailEnabled' | 'notifSmsEnabled' | 'notifPushEnabled' | 'notifAdminEnabled'>;
  icon:  string;
  color: string;
  bg:    string;
  title: string;
  desc:  string;
}[] = [
  {
    key: 'notifEmailEnabled', icon: 'fa-envelope', color: '#0284C7', bg: 'rgba(2,132,199,.10)',
    title: 'Email', desc: "Envoi d'un e-mail à chaque décision (approbation, refus, expiration).",
  },
  {
    key: 'notifSmsEnabled', icon: 'fa-comment-sms', color: '#D97706', bg: 'rgba(217,119,6,.10)',
    title: 'SMS', desc: 'Notification SMS au demandeur pour les décisions critiques.',
  },
  {
    key: 'notifPushEnabled', icon: 'fa-bell', color: '#7C3AED', bg: 'rgba(124,58,237,.10)',
    title: 'Push', desc: 'Notification push dans le tableau de bord et l\'app mobile.',
  },
  {
    key: 'notifAdminEnabled', icon: 'fa-user-shield', color: '#059669', bg: 'rgba(5,150,105,.10)',
    title: 'Admin', desc: "Alerte à l'administrateur de zone pour chaque nouvelle demande.",
  },
];

/* ================================================================ */

export default function ValidationsSection({ onToast }: SectionProps) {

  const [tab,     setTab]     = useState<TabId>('mode');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const [config,  setConfig]  = useState<ValidationConfig | null>(null);
  const [draft,   setDraft]   = useState<ValidationConfig | null>(null);
  const [stats,   setStats]   = useState<ValidationStats | null>(null);

  /* Accordion par acteur */
  const [openActor, setOpenActor] = useState<string | null>(null);

  /* Champ d'ajout de document par acteur */
  const docInputRefs = useRef<Record<string, string>>({});

  /* ── Chargement initial ────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, st] = await Promise.all([getConfig(), getStats()]);
      setConfig(cfg);
      setDraft(structuredClone(cfg));
      setStats(st);
    } catch {
      setError("Impossible de charger la configuration. Vérifiez que le backend est actif.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Dirty state ──────────────────────────────────────────── */
  const isDirty = config !== null && draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(config);

  /* ── Sauvegarde ───────────────────────────────────────────── */
  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await updateConfig({
        modeGlobal:        draft.modeGlobal,
        delaiExpirationH:  draft.delaiExpirationH,
        scoreMinAuto:      draft.scoreMinAuto,
        notifEmailEnabled: draft.notifEmailEnabled,
        notifSmsEnabled:   draft.notifSmsEnabled,
        notifPushEnabled:  draft.notifPushEnabled,
        notifAdminEnabled: draft.notifAdminEnabled,
        reglesActeurs:     draft.reglesActeurs,
      });
      setConfig(saved);
      setDraft(structuredClone(saved));
      onToast('Configuration de validation sauvegardée', 's');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la sauvegarde';
      onToast(msg, 'w');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (config) setDraft(structuredClone(config));
  };

  /* ── Mutations du draft ───────────────────────────────────── */

  const setDraftField = <K extends keyof ValidationConfig>(
    key: K, value: ValidationConfig[K],
  ) => setDraft(d => d ? { ...d, [key]: value } : d);

  const setActorRule = (role: string, patch: Partial<ActorRule>) => {
    setDraft(d => {
      if (!d) return d;
      return {
        ...d,
        reglesActeurs: {
          ...d.reglesActeurs,
          [role]: { ...d.reglesActeurs[role], ...patch },
        },
      };
    });
  };

  const addDoc = (role: string, doc: string) => {
    const trimmed = doc.trim();
    if (!trimmed) return;
    const existing = draft?.reglesActeurs[role]?.docs ?? [];
    if (existing.includes(trimmed)) return;
    setActorRule(role, { docs: [...existing, trimmed] });
    docInputRefs.current[role] = '';
  };

  const removeDoc = (role: string, doc: string) => {
    const existing = draft?.reglesActeurs[role]?.docs ?? [];
    setActorRule(role, { docs: existing.filter(d => d !== doc) });
  };

  /* ================================================================
   * RENDER
   * ================================================================ */

  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <div className={base.secBody}>
      <div className={styles.errorBox}>
        <div className={styles.errorIcon}><i className="fas fa-triangle-exclamation" /></div>
        <div className={styles.errorMsg}>Chargement impossible</div>
        <div className={styles.errorSub}>{error}</div>
        <button className={styles.retryBtn} onClick={load}>
          <i className="fas fa-rotate-right" /> Réessayer
        </button>
      </div>
    </div>
  );

  const d = draft ?? { ...DEFAULT_CONFIG, updatedAt: '' };

  return (
    <div className={base.secBody}>

      {/* ── Onglets ── */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fas ${t.icon}`} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Save bar ── */}
      {isDirty && (
        <div className={styles.saveBar}>
          <div className={styles.saveBarMsg}>
            <i className="fas fa-circle-dot" />
            Modifications non sauvegardées
          </div>
          <div className={styles.saveBarActions}>
            <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
              onClick={handleDiscard} disabled={saving}>
              Annuler
            </button>
            <button className={`${base.btn} ${base.btnBlue} ${base.btnSm}`}
              onClick={handleSave} disabled={saving}>
              {saving
                ? <><i className={`fas fa-rotate-right ${styles.spinning}`} /> Sauvegarde…</>
                : <><i className="fas fa-check" /> Sauvegarder</>}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 1 — MODE GLOBAL
          ════════════════════════════════════════════════════════ */}
      {tab === 'mode' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-sliders" /> Mode de validation</div>
                <div className={base.cardSub}>Comportement par défaut pour toutes les nouvelles demandes</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.modeGrid}>
                {MODES.map(m => (
                  <button
                    key={m.id}
                    className={`${styles.modeCard} ${d.modeGlobal === m.id ? styles.modeCardActive : ''}`}
                    onClick={() => setDraftField('modeGlobal', m.id)}
                  >
                    <div className={styles.modeCardIcon}
                      style={{ background: m.bg, color: m.color }}>
                      <i className={`fas ${m.icon}`} />
                    </div>
                    <div className={styles.modeCardTitle}>
                      {d.modeGlobal === m.id && (
                        <i className="fas fa-circle-check" style={{ color: 'var(--blue)', fontSize: 11 }} />
                      )}
                      {m.title}
                    </div>
                    <div className={styles.modeCardDesc}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-clock" /> Délais et seuils</div>
                <div className={base.cardSub}>Paramètres globaux appliqués à tous les acteurs</div>
              </div>
            </div>
            <div className={base.cardBody}>

              {/* Délai d'expiration */}
              <div className={styles.sliderBlock}>
                <div className={styles.sliderBlockTitle}>
                  <i className="fas fa-hourglass-half" style={{ color: 'var(--amber)' }} />
                  Délai d&apos;expiration global
                </div>
                <div className={styles.sliderBlockSub}>
                  Les demandes non traitées après ce délai sont marquées « expirées »
                </div>
                <div className={styles.sliderRow}>
                  <input type="range" className={styles.sliderInput}
                    min={1} max={240} step={1} value={d.delaiExpirationH}
                    onChange={e => setDraftField('delaiExpirationH', +e.target.value)} />
                  <span className={styles.sliderVal}>{d.delaiExpirationH}h</span>
                </div>
              </div>

              {/* Score minimum (hybride/score uniquement) */}
              {(d.modeGlobal === 'hybride' || d.modeGlobal === 'score') && (
                <div className={styles.sliderBlock}>
                  <div className={styles.sliderBlockTitle}>
                    <i className="fas fa-gauge-high" style={{ color: 'var(--blue)' }} />
                    Score minimum d&apos;approbation automatique
                  </div>
                  <div className={styles.sliderBlockSub}>
                    Les demandes avec un score inférieur sont renvoyées en examen manuel
                  </div>
                  <div className={styles.sliderRow}>
                    <input type="range" className={styles.sliderInput}
                      min={50} max={100} step={1} value={d.scoreMinAuto}
                      onChange={e => setDraftField('scoreMinAuto', +e.target.value)} />
                    <span className={styles.sliderVal}>{d.scoreMinAuto}/100</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 2 — PAR ACTEUR
          ════════════════════════════════════════════════════════ */}
      {tab === 'acteurs' && (
        <div className={base.card}>
          <div className={base.cardHead}>
            <div>
              <div className={base.cardTitle}><i className="fas fa-users-gear" /> Règles par type d&apos;acteur</div>
              <div className={base.cardSub}>Configuration individuelle — délai, documents, approbation automatique</div>
            </div>
          </div>
          <div className={base.cardBody}>
            <div className={styles.actorList}>
              {ACTOR_ORDER.map(role => {
                const meta  = ACTOR_META[role];
                const rule  = d.reglesActeurs[role] ?? { auto: false, delaiH: 48, scoreMin: 75, docs: [], actif: true };
                const isOpen = openActor === role;

                return (
                  <div key={role}
                    className={`${styles.actorCard} ${isOpen ? styles.actorCardOpen : ''}`}>

                    {/* En-tête accordéon */}
                    <div className={styles.actorCardHead}
                      onClick={() => setOpenActor(isOpen ? null : role)}>
                      <div className={styles.actorCardIcon}
                        style={{ background: `${meta.color}18`, color: meta.color }}>
                        <i className={`fas ${meta.icon}`} />
                      </div>
                      <div className={styles.actorCardName}>{meta.label}</div>
                      <div className={styles.actorCardBadges}>
                        {rule.auto
                          ? <span className={`${styles.badge} ${styles.badgeAuto}`}><i className="fas fa-robot" /> Auto</span>
                          : <span className={`${styles.badge} ${styles.badgeManuel}`}><i className="fas fa-user-check" /> Manuel</span>
                        }
                        <span className={`${styles.badge} ${styles.badgeScore}`}>{rule.delaiH}h</span>
                        {rule.docs.length > 0 && (
                          <span className={`${styles.badge} ${styles.badgeScore}`}>
                            <i className="fas fa-file-lines" /> {rule.docs.length}
                          </span>
                        )}
                      </div>
                      <i className={`fas fa-chevron-down ${styles.actorCardChevron} ${isOpen ? styles.actorCardChevronOpen : ''}`} />
                    </div>

                    {/* Corps accordéon */}
                    {isOpen && (
                      <div className={styles.actorCardBody}>

                        {/* Toggle auto/manuel */}
                        <div className={styles.autoToggleRow}>
                          <div>
                            <div className={styles.autoToggleLabel}>Approbation automatique</div>
                            <div className={styles.autoToggleSub}>
                              {rule.auto
                                ? "Les demandes conformes sont approuvées sans intervention manuelle."
                                : "Chaque demande doit être examinée et approuvée manuellement."}
                            </div>
                          </div>
                          <div
                            className={`${base.sw} ${rule.auto ? base.swOn : ''}`}
                            onClick={() => setActorRule(role, { auto: !rule.auto })}
                          />
                        </div>

                        {/* Délai individuel */}
                        <div className={styles.sliderBlock} style={{ marginBottom: 0 }}>
                          <div className={styles.sliderBlockTitle}>
                            <i className="fas fa-clock" style={{ color: 'var(--amber)' }} />
                            Délai d&apos;examen
                          </div>
                          <div className={styles.sliderRow}>
                            <input type="range" className={styles.sliderInput}
                              min={1} max={168} step={1} value={rule.delaiH}
                              onChange={e => setActorRule(role, { delaiH: +e.target.value })} />
                            <span className={styles.sliderVal}>{rule.delaiH}h</span>
                          </div>
                        </div>

                        {/* Score individuel (hybride/score) */}
                        {(d.modeGlobal === 'hybride' || d.modeGlobal === 'score') && (
                          <div className={styles.sliderBlock} style={{ marginBottom: 0 }}>
                            <div className={styles.sliderBlockTitle}>
                              <i className="fas fa-gauge-high" style={{ color: 'var(--blue)' }} />
                              Score minimum d&apos;approbation
                            </div>
                            <div className={styles.sliderRow}>
                              <input type="range" className={styles.sliderInput}
                                min={50} max={100} step={1} value={rule.scoreMin}
                                onChange={e => setActorRule(role, { scoreMin: +e.target.value })} />
                              <span className={styles.sliderVal}>{rule.scoreMin}/100</span>
                            </div>
                          </div>
                        )}

                        {/* Documents requis */}
                        <div className={styles.docsSection}>
                          <div className={styles.docsSectionTitle}>
                            <i className="fas fa-file-lines" /> Documents requis
                          </div>
                          <div className={styles.docChips}>
                            {rule.docs.length === 0
                              ? <span className={styles.docEmpty}>Aucun document requis</span>
                              : rule.docs.map(doc => (
                                <span key={doc} className={styles.docChip}>
                                  {doc}
                                  <button className={styles.docChipRemove}
                                    onClick={() => removeDoc(role, doc)}
                                    title={`Retirer ${doc}`}>
                                    <i className="fas fa-xmark" />
                                  </button>
                                </span>
                              ))
                            }
                          </div>
                          <DocAddRow
                            role={role}
                            onAdd={addDoc}
                          />
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 3 — NOTIFICATIONS
          ════════════════════════════════════════════════════════ */}
      {tab === 'notifs' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-bell" /> Canaux de notification</div>
                <div className={base.cardSub}>Activez les canaux par lesquels Shopi informe les acteurs et les admins</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.notifGrid}>
                {NOTIF_CHANNELS.map(ch => (
                  <div key={ch.key} className={styles.notifCard}>
                    <div className={styles.notifCardIcon}
                      style={{ background: ch.bg, color: ch.color }}>
                      <i className={`fas ${ch.icon}`} />
                    </div>
                    <div className={styles.notifCardBody}>
                      <div className={styles.notifCardTitle}>{ch.title}</div>
                      <div className={styles.notifCardDesc}>{ch.desc}</div>
                    </div>
                    <div
                      className={`${base.sw} ${d[ch.key] ? base.swOn : ''}`}
                      onClick={() => setDraftField(ch.key, !d[ch.key])}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-circle-info" /> Événements déclencheurs</div>
                <div className={base.cardSub}>Les canaux activés ci-dessus sont utilisés pour ces événements</div>
              </div>
            </div>
            <div className={base.cardBody}>
              {[
                { icon: 'fa-circle-check',      color: 'var(--emerald)', label: 'Demande approuvée',   desc: 'Notification au demandeur + admin de zone.' },
                { icon: 'fa-circle-xmark',       color: 'var(--red)',     label: 'Demande refusée',     desc: 'Notification au demandeur avec motif de refus.' },
                { icon: 'fa-hourglass-end',      color: 'var(--amber)',   label: 'Demande expirée',     desc: 'Alerte envoyée si la demande dépasse le délai sans traitement.' },
                { icon: 'fa-user-plus',          color: 'var(--blue)',    label: 'Nouvelle inscription', desc: "Notification à l'admin à chaque nouvelle demande reçue." },
                { icon: 'fa-triangle-exclamation', color: 'var(--violet)', label: 'Rappel de traitement', desc: 'Relance admin si une demande reste en attente plus de 24h.' },
              ].map(ev => (
                <div key={ev.label} className={base.toggleRow}>
                  <div className={base.tIc} style={{ background: `${ev.color}18`, color: ev.color }}>
                    <i className={`fas ${ev.icon}`} />
                  </div>
                  <div className={base.tMain}>
                    <div className={base.tTitle}>{ev.label}</div>
                    <div className={base.tDesc}>{ev.desc}</div>
                  </div>
                  <i className="fas fa-check" style={{ fontSize: 11, color: 'var(--emerald)' }} />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 4 — TABLEAU DE BORD
          ════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (
        <StatsTab stats={stats} onRefresh={load} />
      )}

    </div>
  );
}

/* ── Sous-composant : champ d'ajout de document ─────────────── */

function DocAddRow({ role, onAdd }: { role: string; onAdd: (role: string, doc: string) => void }) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (!value.trim()) return;
    onAdd(role, value.trim());
    setValue('');
  };

  return (
    <div className={styles.docAddRow}>
      <input
        className={styles.docAddInput}
        placeholder="Nom du document…"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }}
      />
      <button className={styles.docAddBtn} onClick={submit} disabled={!value.trim()}>
        <i className="fas fa-plus" /> Ajouter
      </button>
    </div>
  );
}

/* ── Sous-composant : onglet statistiques ───────────────────── */

function StatsTab({
  stats,
  onRefresh,
}: {
  stats:     ValidationStats | null;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  if (!stats) return (
    <div className={base.card}>
      <div className={base.cardBody}>
        {[1,2,3].map(i => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonRow}`} />
        ))}
      </div>
    </div>
  );

  const t = stats.totaux;

  return (
    <>
      {/* KPI summary */}
      <div className={styles.statsHeader}>
        {([
          { label: 'Actifs',       val: t.actif,    color: '#059669', stripe: '#059669' },
          { label: 'En attente',   val: t.pending,  color: '#D97706', stripe: '#D97706' },
          { label: 'Suspendus',    val: t.suspendu, color: '#DC2626', stripe: '#DC2626' },
          { label: 'Total comptes',val: t.total,    color: 'var(--blue)', stripe: 'var(--blue)' },
        ] as const).map(kpi => (
          <div key={kpi.label} className={styles.statKpi}>
            <div className={styles.statKpiStripe} style={{ background: kpi.stripe }} />
            <div className={styles.statKpiVal} style={{ color: kpi.color }}>{kpi.val.toLocaleString('fr-FR')}</div>
            <div className={styles.statKpiLabel}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Table par type d'acteur */}
      <div className={base.card}>
        <div className={base.cardHead}>
          <div>
            <div className={base.cardTitle}><i className="fas fa-table" /> Comptes par type d&apos;acteur</div>
            <div className={base.cardSub}>Répartition actif / en attente / suspendu</div>
          </div>
          <button
            className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <i className={`fas fa-rotate-right ${refreshing ? styles.spinning : ''}`} />
            {refreshing ? 'Actualisation…' : 'Actualiser'}
          </button>
        </div>
        <div className={base.cardBody} style={{ padding: 0 }}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Type d&apos;acteur</th>
                  <th>Actifs</th>
                  <th>En attente</th>
                  <th>Suspendus</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.byRole.map(row => {
                  const meta = ACTOR_META[row.role];
                  return (
                    <tr key={row.role}>
                      <td>
                        <div className={styles.actorNameCell}>
                          <div className={styles.actorNameIcon}
                            style={{ background: `${meta?.color ?? 'var(--blue)'}18`, color: meta?.color ?? 'var(--blue)' }}>
                            <i className={`fas ${meta?.icon ?? 'fa-user'}`} />
                          </div>
                          {row.label}
                        </div>
                      </td>
                      <td className={styles.pillActive}>{row.actif.toLocaleString('fr-FR')}</td>
                      <td className={styles.pillPending}>{row.pending.toLocaleString('fr-FR')}</td>
                      <td className={styles.pillSuspend}>{row.suspendu.toLocaleString('fr-FR')}</td>
                      <td>{row.total.toLocaleString('fr-FR')}</td>
                    </tr>
                  );
                })}
                <tr className={styles.tableTotalRow}>
                  <td><strong>Total</strong></td>
                  <td>{t.actif.toLocaleString('fr-FR')}</td>
                  <td>{t.pending.toLocaleString('fr-FR')}</td>
                  <td>{t.suspendu.toLocaleString('fr-FR')}</td>
                  <td>{t.total.toLocaleString('fr-FR')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Skeleton loader ────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={`${styles.skeleton}`} style={{ height: 44, borderRadius: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />
        ))}
      </div>
      <div className={`${styles.skeleton}`} style={{ height: 120, borderRadius: 10 }} />
      <div className={`${styles.skeleton}`} style={{ height: 80, borderRadius: 10 }} />
    </div>
  );
}
