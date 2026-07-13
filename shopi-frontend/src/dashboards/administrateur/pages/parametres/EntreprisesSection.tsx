/* ================================================================
 * FICHIER : pages/parametres/EntreprisesSection.tsx
 *
 * Centre de Gouvernance des Entreprises Shopi
 * 7 onglets : Vue d'ensemble | Documents | Catégories | Validation |
 *             Suspensions | Règles | Tableau de bord
 * ================================================================ */

import { useState, useEffect, useCallback } from 'react';
import base   from '../../styles/ParametresPage.module.css';
import styles from '../../styles/EntreprisesSection.module.css';
import type { SectionProps } from './types';
import {
  getSettings, updateSettings, getStats, getCategoriesList,
  exportConfigAsJson, exportStatsAsCsv,
  DEFAULT_SETTINGS, DEFAULT_NOTIF_EVENTS,
  type CompanySettings, type ValidationMode,
  type RequiredDocument, type CategoryRule,
  type CompanyStats, type CategoryItem,
} from '../../services/company-settings.service';

/* ── Onglets ─────────────────────────────────────────────────── */

type TabId = 'overview' | 'documents' | 'categories' | 'validation' | 'suspensions' | 'regles' | 'notifications' | 'stats';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'overview',       icon: 'fa-gauge-high',   label: "Vue d'ensemble" },
  { id: 'documents',      icon: 'fa-file-lines',   label: 'Documents' },
  { id: 'categories',     icon: 'fa-tags',         label: 'Catégories' },
  { id: 'validation',     icon: 'fa-circle-check', label: 'Validation' },
  { id: 'suspensions',    icon: 'fa-ban',          label: 'Suspensions' },
  { id: 'regles',         icon: 'fa-sliders',      label: 'Règles' },
  { id: 'notifications',  icon: 'fa-bell',         label: 'Notifications' },
  { id: 'stats',          icon: 'fa-chart-bar',    label: 'Tableau de bord' },
];

/* ── Modes de validation ─────────────────────────────────────── */

const VALID_MODES: {
  id: ValidationMode; icon: string; color: string; bg: string; title: string; desc: string;
}[] = [
  {
    id: 'auto', icon: 'fa-robot', color: '#059669', bg: 'rgba(5,150,105,.10)',
    title: 'Automatique',
    desc: "Les dossiers complets sont approuvés instantanément. Idéal pour un volume élevé d'inscriptions.",
  },
  {
    id: 'manuel', icon: 'fa-user-check', color: '#0284C7', bg: 'rgba(2,132,199,.10)',
    title: 'Manuel',
    desc: "Chaque entreprise est examinée individuellement. Contrôle maximal, délai plus long.",
  },
  {
    id: 'hybride', icon: 'fa-brain', color: '#7C3AED', bg: 'rgba(124,58,237,.10)',
    title: 'Hybride',
    desc: "Score automatique : les dossiers clairs sont approuvés, les cas limites passent en revue humaine.",
  },
];

/* ── Permissions produits ────────────────────────────────────── */

const PERMS: {
  key:   keyof Pick<CompanySettings, 'allowPhysical' | 'allowDigital' | 'allowServices' | 'allowInternational'>;
  icon:  string; color: string; bg: string; title: string; desc: string;
}[] = [
  { key: 'allowPhysical',      icon: 'fa-box',             color: '#0284C7', bg: 'rgba(2,132,199,.10)',   title: 'Produits physiques',    desc: 'Articles livrables à domicile.' },
  { key: 'allowDigital',       icon: 'fa-file-arrow-down', color: '#7C3AED', bg: 'rgba(124,58,237,.10)',  title: 'Produits numériques',   desc: 'Téléchargements, licences, codes.' },
  { key: 'allowServices',      icon: 'fa-handshake',       color: '#059669', bg: 'rgba(5,150,105,.10)',   title: 'Services',              desc: 'Prestations à la demande ou sur rdv.' },
  { key: 'allowInternational', icon: 'fa-globe',           color: '#D97706', bg: 'rgba(217,119,6,.10)',   title: 'Ventes internationales', desc: 'Expéditions hors frontières.' },
];

/* ── Limites opérationnelles ─────────────────────────────────── */

const OP_RULES: {
  key:   keyof Pick<CompanySettings, 'monthlyOrderLimit' | 'dailyOrderLimit' | 'maxProducts' | 'maxActivePromotions' | 'maxBranches'>;
  icon: string; color: string; label: string; min: number; max: number; step: number;
}[] = [
  { key: 'monthlyOrderLimit',   icon: 'fa-bag-shopping', color: '#0284C7', label: 'Commandes / mois',      min: 10,  max: 100000, step: 10 },
  { key: 'dailyOrderLimit',     icon: 'fa-calendar-day', color: '#059669', label: 'Commandes / jour',      min: 1,   max: 10000,  step: 1  },
  { key: 'maxProducts',         icon: 'fa-box-open',     color: '#7C3AED', label: 'Produits max',           min: 10,  max: 100000, step: 10 },
  { key: 'maxActivePromotions', icon: 'fa-tag',          color: '#D97706', label: 'Promotions actives',     min: 1,   max: 500,    step: 1  },
  { key: 'maxBranches',         icon: 'fa-store',        color: '#DB2777', label: 'Magasins / succursales', min: 1,   max: 100,    step: 1  },
];

/* ── Critères de suspension ──────────────────────────────────── */

const SUSP_TRIGGERS = [
  { icon: 'fa-flag',              color: '#DC2626', bg: 'rgba(220,38,38,.10)',   title: 'Signalements clients',   desc: "Accumulation de signalements graves par des acheteurs ou partenaires." },
  { icon: 'fa-gavel',             color: '#D97706', bg: 'rgba(217,119,6,.10)',   title: 'Litiges non résolus',    desc: "Litiges ouverts dépassant le seuil sans tentative de résolution." },
  { icon: 'fa-hourglass-end',     color: '#6D28D9', bg: 'rgba(109,40,217,.10)',  title: 'Inactivité prolongée',   desc: "Aucune commande ni connexion au-delà de la durée configurée." },
  { icon: 'fa-clock-rotate-left', color: '#0284C7', bg: 'rgba(2,132,199,.10)',   title: 'Validation expirée',     desc: "Dossier incomplet non finalisé dans le délai imparti après inscription." },
];

/* ── Événements de notification ──────────────────────────────── */

const NOTIF_EVENTS: {
  key: string; icon: string; color: string; title: string; desc: string;
}[] = [
  { key: 'newEnterprise',         icon: 'fa-building-circle-arrow-right', color: '#0284C7', title: 'Nouvelle inscription',       desc: "Notifier les responsables dès qu'une entreprise s'inscrit sur votre réseau." },
  { key: 'enterpriseValidated',   icon: 'fa-circle-check',               color: '#059669', title: 'Entreprise validée',         desc: "Confirmer par email l'activation du compte entreprise après validation." },
  { key: 'enterpriseSuspended',   icon: 'fa-ban',                        color: '#DC2626', title: 'Suspension déclenchée',      desc: "Alerter le responsable lors d'une suspension automatique ou manuelle." },
  { key: 'documentSubmitted',     icon: 'fa-file-circle-check',          color: '#7C3AED', title: 'Document soumis',            desc: "Recevoir une alerte quand une entreprise envoie un document à vérifier." },
  { key: 'documentExpired',       icon: 'fa-file-circle-exclamation',    color: '#D97706', title: 'Document expiré',            desc: "Avertir avant et à l'expiration d'un document réglementaire." },
  { key: 'orderThresholdReached', icon: 'fa-bag-shopping',               color: '#0891B2', title: 'Seuil commandes atteint',    desc: "Signaler quand une entreprise approche ou dépasse sa limite mensuelle." },
  { key: 'inactivityWarning',     icon: 'fa-hourglass-half',             color: '#6D28D9', title: 'Avertissement inactivité',   desc: "Relancer automatiquement les entreprises en période d'inactivité prolongée." },
  { key: 'suspensionAutoTrigger', icon: 'fa-robot',                      color: '#DB2777', title: 'Moteur auto-suspension',     desc: "Rapport des actions automatiques déclenchées par le moteur de suspension." },
];

/* ── Formatage montants GNF ──────────────────────────────────── */

function fmtGNF(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}G`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString('fr-FR');
}

/* ================================================================ */

export default function EntreprisesSection({ onToast }: SectionProps) {

  const [tab,        setTab]        = useState<TabId>('overview');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);

  const [settings,   setSettings]   = useState<CompanySettings | null>(null);
  const [draft,      setDraft]      = useState<CompanySettings | null>(null);
  const [stats,      setStats]      = useState<CompanyStats | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const [newDocLabel, setNewDocLabel] = useState('');
  const [newDocDesc,  setNewDocDesc]  = useState('');

  /* ── Chargement ───────────────────────────────────────────── */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, st, cats] = await Promise.all([
        getSettings(), getStats(), getCategoriesList(),
      ]);
      setSettings(cfg);
      setDraft(structuredClone(cfg));
      setStats(st);
      setCategories(cats);
    } catch {
      setError('Impossible de charger la configuration entreprises.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Dirty / save ─────────────────────────────────────────── */
  const isDirty = settings !== null && draft !== null &&
    JSON.stringify(draft) !== JSON.stringify(settings);

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await updateSettings(draft);
      setSettings(saved);
      setDraft(structuredClone(saved));
      onToast('Paramètres entreprises sauvegardés', 's');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Erreur de sauvegarde', 'w');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => { if (settings) setDraft(structuredClone(settings)); };

  /* ── Helpers draft ────────────────────────────────────────── */
  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) =>
    setDraft(d => d ? { ...d, [k]: v } : d);

  const toggleDoc = (id: string) =>
    setDraft(d => !d ? d : {
      ...d,
      requiredDocuments: d.requiredDocuments.map((doc: RequiredDocument) =>
        doc.id === id ? { ...doc, required: !doc.required } : doc),
    });

  const removeDoc = (id: string) =>
    setDraft(d => !d ? d : {
      ...d,
      requiredDocuments: d.requiredDocuments.filter((doc: RequiredDocument) => doc.id !== id),
    });

  const addDoc = () => {
    if (!newDocLabel.trim()) return;
    const newDoc: RequiredDocument = {
      id:          `doc_${Date.now()}`,
      label:       newDocLabel.trim(),
      description: newDocDesc.trim(),
      required:    true,
    };
    setDraft(d => !d ? d : { ...d, requiredDocuments: [...d.requiredDocuments, newDoc] });
    setNewDocLabel('');
    setNewDocDesc('');
  };

  const setNotif = (key: string, val: boolean) =>
    setDraft(d => !d ? d : {
      ...d,
      notifEventsConfig: { ...(d.notifEventsConfig ?? {}), [key]: val },
    });

  const getNotif = (key: string): boolean => {
    const cfg = draft?.notifEventsConfig ?? DEFAULT_NOTIF_EVENTS;
    return key in cfg ? cfg[key] : (DEFAULT_NOTIF_EVENTS[key] ?? true);
  };

  const getCatRule = (nom: string): CategoryRule =>
    draft?.categoryRules.find((r: CategoryRule) => r.nom === nom) ?? { nom, enabled: true, commission: null };

  const setCatRule = (nom: string, patch: Partial<CategoryRule>) =>
    setDraft(d => {
      if (!d) return d;
      const exists = d.categoryRules.some((r: CategoryRule) => r.nom === nom);
      if (exists) return { ...d, categoryRules: d.categoryRules.map((r: CategoryRule) => r.nom === nom ? { ...r, ...patch } : r) };
      return { ...d, categoryRules: [...d.categoryRules, { nom, enabled: true, commission: null, ...patch }] };
    });

  /* ── Guards ───────────────────────────────────────────────── */
  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <div className={base.secBody}>
      <div className={styles.errorBox}>
        <div className={styles.errorIcon}><i className="fas fa-triangle-exclamation" /></div>
        <div className={styles.errorMsg}>Chargement impossible</div>
        <div className={styles.errorSub}>{error}</div>
        <button className={styles.retryBtn} onClick={load}><i className="fas fa-rotate-right" /> Réessayer</button>
      </div>
    </div>
  );

  const d: CompanySettings = draft ?? { ...DEFAULT_SETTINGS, updatedAt: '' };

  const activeCatCount = categories.filter((c: CategoryItem) => getCatRule(c.nom).enabled).length;

  return (
    <div className={base.secBody}>

      {/* ── Tabs ── */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
            onClick={() => setTab(t.id)}>
            <i className={`fas ${t.icon}`} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Save bar ── */}
      {isDirty && (
        <div className={styles.saveBar}>
          <div className={styles.saveBarMsg}>
            <i className="fas fa-circle-dot" /> Modifications non sauvegardées
          </div>
          <div className={styles.saveBarActions}>
            <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
              onClick={handleDiscard} disabled={saving}>Annuler</button>
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
          ONGLET 1 — VUE D'ENSEMBLE
          ════════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* KPIs réseau */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-building" /> Activité du réseau entreprises</div>
                <div className={base.cardSub}>Statistiques issues de votre périmètre administrateur</div>
              </div>
              <button className={`${base.btn} ${base.btnSecondary} ${base.btnSm}`}
                onClick={() => setTab('stats')}>
                <i className="fas fa-chart-bar" /> Tableau de bord
              </button>
            </div>
            <div className={base.cardBody}>
              {!stats ? (
                <>
                  <div className={styles.overviewGrid}>
                    {[1,2,3,4,5].map(i => <div key={i} className={`${styles.skeleton} ${styles.overviewCard}`} style={{ height: 78 }} />)}
                  </div>
                  <div className={styles.overviewGrid4}>
                    {[1,2,3,4].map(i => <div key={i} className={`${styles.skeleton} ${styles.overviewCard}`} style={{ height: 78 }} />)}
                  </div>
                </>
              ) : (
                <>
                  {/* Ligne 1 — statuts réseau */}
                  <div className={styles.overviewGrid}>
                    {([
                      { label: 'Total entreprises', val: stats.total,        color: '#0284C7', icon: 'fa-building',        fmt: (n: number) => n.toLocaleString('fr-FR') },
                      { label: 'Actives',           val: stats.active,       color: '#059669', icon: 'fa-circle-check',    fmt: (n: number) => n.toLocaleString('fr-FR') },
                      { label: 'En attente',        val: stats.pending,      color: '#D97706', icon: 'fa-clock',           fmt: (n: number) => n.toLocaleString('fr-FR') },
                      { label: 'Suspendues',        val: stats.suspended,    color: '#DC2626', icon: 'fa-ban',             fmt: (n: number) => n.toLocaleString('fr-FR') },
                      { label: 'Ce mois',           val: stats.newThisMonth, color: '#7C3AED', icon: 'fa-arrow-trend-up',  fmt: (n: number) => n.toLocaleString('fr-FR') },
                    ] as const).map(k => (
                      <div key={k.label} className={styles.overviewCard}>
                        <div className={styles.overviewCardStripe} style={{ background: k.color }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span className={styles.overviewCardLabel}>{k.label}</span>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${k.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className={`fas ${k.icon}`} style={{ color: k.color, fontSize: 9 }} />
                          </div>
                        </div>
                        <div className={styles.overviewCardVal} style={{ color: k.color }}>{k.fmt(k.val)}</div>
                      </div>
                    ))}
                  </div>

                  {/* Ligne 2 — performance */}
                  <div className={styles.overviewGrid4}>
                    {([
                      { label: 'Vérifiées',        val: stats.verified,     color: '#059669', icon: 'fa-shield-halved',       fmt: (n: number) => n.toLocaleString('fr-FR') },
                      { label: 'Premium',           val: stats.premium,      color: '#7C3AED', icon: 'fa-crown',               fmt: (n: number) => n.toLocaleString('fr-FR') },
                      { label: 'CA total',          val: stats.totalRevenue, color: '#0891B2', icon: 'fa-money-bill-trend-up', fmt: (n: number) => `${fmtGNF(n)} GNF` },
                      { label: 'Commandes totales', val: stats.totalOrders,  color: '#D97706', icon: 'fa-bag-shopping',        fmt: (n: number) => n.toLocaleString('fr-FR') },
                    ] as const).map(k => (
                      <div key={k.label} className={styles.overviewCard}>
                        <div className={styles.overviewCardStripe} style={{ background: k.color }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <span className={styles.overviewCardLabel}>{k.label}</span>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${k.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className={`fas ${k.icon}`} style={{ color: k.color, fontSize: 9 }} />
                          </div>
                        </div>
                        <div className={styles.overviewCardVal} style={{ color: k.color }}>{k.fmt(k.val)}</div>
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
                <div className={base.cardSub}>Cliquez sur une carte pour modifier le paramètre correspondant</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.summaryGrid}>
                {([
                  {
                    icon: 'fa-circle-check', color: '#0284C7', bg: 'rgba(2,132,199,.10)',
                    label: 'Mode validation',
                    val: d.validationMode === 'auto' ? 'Automatique' : d.validationMode === 'manuel' ? 'Manuel' : 'Hybride',
                    sub: `Délai : ${d.validationDelayH}h`,
                    goto: 'validation' as TabId,
                  },
                  {
                    icon: 'fa-file-lines', color: '#059669', bg: 'rgba(5,150,105,.10)',
                    label: 'Documents requis',
                    val: `${d.requiredDocuments.filter((x: RequiredDocument) => x.required).length} obligatoires`,
                    sub: `${d.requiredDocuments.length} docs configurés`,
                    goto: 'documents' as TabId,
                  },
                  {
                    icon: 'fa-tags', color: '#7C3AED', bg: 'rgba(124,58,237,.10)',
                    label: 'Catégories actives',
                    val: categories.length > 0 ? `${activeCatCount} / ${categories.length}` : 'Aucune',
                    sub: 'Du catalogue Shopi',
                    goto: 'categories' as TabId,
                  },
                  {
                    icon: 'fa-ban',
                    color: d.autoSuspensionEnabled ? '#DC2626' : '#6B7280',
                    bg:    d.autoSuspensionEnabled ? 'rgba(220,38,38,.10)' : 'rgba(107,114,128,.10)',
                    label: 'Suspension auto',
                    val:   d.autoSuspensionEnabled ? 'Activée' : 'Désactivée',
                    sub:   d.autoSuspensionEnabled ? `Seuil : ${d.suspensionSignalThreshold} signalements` : 'Revue manuelle uniquement',
                    goto: 'suspensions' as TabId,
                  },
                  {
                    icon: 'fa-bag-shopping', color: '#D97706', bg: 'rgba(217,119,6,.10)',
                    label: 'Commandes max',
                    val: `${d.monthlyOrderLimit.toLocaleString('fr-FR')}/mois`,
                    sub: `${d.dailyOrderLimit.toLocaleString('fr-FR')}/jour`,
                    goto: 'regles' as TabId,
                  },
                  {
                    icon: 'fa-box-open', color: '#DB2777', bg: 'rgba(219,39,119,.10)',
                    label: 'Produits max',
                    val: d.maxProducts.toLocaleString('fr-FR'),
                    sub: `${d.maxBranches} magasin(s) max`,
                    goto: 'regles' as TabId,
                  },
                  {
                    icon: 'fa-tag', color: '#0891B2', bg: 'rgba(8,145,178,.10)',
                    label: 'Promotions max',
                    val: `${d.maxActivePromotions} actives`,
                    sub: 'Simultanément',
                    goto: 'regles' as TabId,
                  },
                  {
                    icon: 'fa-globe', color: '#0369A1', bg: 'rgba(3,105,161,.10)',
                    label: 'Périmètre produits',
                    val: `${[d.allowPhysical, d.allowDigital, d.allowServices, d.allowInternational].filter(Boolean).length} types actifs`,
                    sub: 'Sur 4 disponibles',
                    goto: 'regles' as TabId,
                  },
                ]).map(s => (
                  <button key={s.label} className={styles.summaryCard} onClick={() => setTab(s.goto)}>
                    <div className={styles.summaryCardIcon} style={{ background: s.bg, color: s.color }}>
                      <i className={`fas ${s.icon}`} />
                    </div>
                    <div className={styles.summaryCardLabel}>{s.label}</div>
                    <div className={styles.summaryCardVal}>{s.val}</div>
                    {s.sub && <div className={styles.summaryCardSub}>{s.sub}</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 2 — DOCUMENTS
          ════════════════════════════════════════════════════════ */}
      {tab === 'documents' && (
        <div className={base.card}>
          <div className={base.cardHead}>
            <div>
              <div className={base.cardTitle}><i className="fas fa-file-lines" /> Documents requis à l&apos;inscription</div>
              <div className={base.cardSub}>Pièces justificatives exigées pour valider une entreprise</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
              {d.requiredDocuments.filter((x: RequiredDocument) => x.required).length} obligatoire(s) ·{' '}
              {d.requiredDocuments.filter((x: RequiredDocument) => !x.required).length} optionnel(s)
            </span>
          </div>
          <div className={base.cardBody}>
            <div className={styles.docList}>
              {d.requiredDocuments.map((doc: RequiredDocument) => (
                <div key={doc.id} className={styles.docRow}>
                  <div className={`${base.tIc} ${base.tIcBlue}`}>
                    <i className="fas fa-file-lines" />
                  </div>
                  <div className={styles.docMain}>
                    <div className={styles.docTitle}>{doc.label}</div>
                    {doc.description && <div className={styles.docDesc}>{doc.description}</div>}
                  </div>
                  <div className={styles.docActions}>
                    <span className={`${styles.docBadge} ${doc.required ? styles.docBadgeReq : styles.docBadgeOpt}`}>
                      {doc.required ? 'Obligatoire' : 'Optionnel'}
                    </span>
                    <div
                      className={`${base.sw} ${doc.required ? base.swOn : ''}`}
                      onClick={() => toggleDoc(doc.id)}
                      title="Basculer obligatoire / optionnel"
                    />
                    <button
                      className={styles.docDelBtn}
                      onClick={() => removeDoc(doc.id)}
                      title="Supprimer ce document">
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Ajout */}
            <div className={styles.docAddRow}>
              <input className={styles.docAddInput}
                placeholder="Nom du document (ex : Attestation bancaire)"
                value={newDocLabel}
                onChange={e => setNewDocLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addDoc(); }} />
              <input className={styles.docAddInput}
                placeholder="Description (optionnel)"
                value={newDocDesc}
                onChange={e => setNewDocDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addDoc(); }} />
              <button className={styles.docAddBtn} onClick={addDoc} disabled={!newDocLabel.trim()}>
                <i className="fas fa-plus" /> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 3 — CATÉGORIES
          ════════════════════════════════════════════════════════ */}
      {tab === 'categories' && (
        <div className={base.card}>
          <div className={base.cardHead}>
            <div>
              <div className={base.cardTitle}><i className="fas fa-tags" /> Catégories autorisées</div>
              <div className={base.cardSub}>Activez / désactivez les secteurs d'activité accessibles aux entreprises</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
              {categories.length > 0
                ? `${activeCatCount} / ${categories.length} actives`
                : 'Aucune catégorie'}
            </span>
          </div>
          <div className={base.cardBody}>
            {categories.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                <i className="fas fa-tags" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: .4 }} />
                Aucune catégorie trouvée. Créez-en via le module Catalogue.
              </div>
            ) : (
              <div className={styles.catGrid}>
                {categories.map((cat: CategoryItem) => {
                  const rule = getCatRule(cat.nom);
                  return (
                    <div key={cat.id}
                      className={`${styles.catCard} ${rule.enabled ? styles.catCardActive : styles.catCardOff}`}>
                      <div className={styles.catHeader}>
                        <div className={styles.catName}>
                          {cat.icone && <span style={{ fontSize: 15 }}>{cat.icone}</span>}
                          {cat.nom}
                        </div>
                        <div
                          className={`${base.sw} ${rule.enabled ? base.swOn : ''}`}
                          onClick={() => setCatRule(cat.nom, { enabled: !rule.enabled })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 4 — VALIDATION
          ════════════════════════════════════════════════════════ */}
      {tab === 'validation' && (
        <>
          {/* Mode */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-circle-check" /> Mode de validation</div>
                <div className={base.cardSub}>Processus appliqué à chaque nouvelle inscription d'entreprise</div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px',
                borderRadius: 999, background: 'var(--sky)', color: 'var(--blue)',
              }}>
                {d.validationMode === 'auto' ? 'Automatique' : d.validationMode === 'manuel' ? 'Manuel' : 'Hybride'}
              </span>
            </div>
            <div className={base.cardBody}>
              <div className={styles.validModeGrid}>
                {VALID_MODES.map(m => (
                  <button key={m.id}
                    className={`${styles.validModeCard} ${d.validationMode === m.id ? styles.validModeCardActive : ''}`}
                    onClick={() => set('validationMode', m.id)}>
                    <div className={styles.validModeIcon} style={{ background: m.bg, color: m.color }}>
                      <i className={`fas ${m.icon}`} />
                    </div>
                    <div className={styles.validModeTitle}>
                      {d.validationMode === m.id &&
                        <i className="fas fa-circle-check" style={{ color: 'var(--blue)', fontSize: 11 }} />}
                      {m.title}
                    </div>
                    <div className={styles.validModeDesc}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Délai */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-hourglass-half" /> Délai de traitement</div>
                <div className={base.cardSub}>Durée maximale accordée pour finaliser et examiner un dossier</div>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                {d.validationDelayH}h
              </span>
            </div>
            <div className={base.cardBody}>
              <div className={styles.ruleBlock} style={{ background: 'transparent', border: 'none', padding: 0 }}>
                <div className={styles.ruleSliderRow}>
                  <input type="range" className={styles.ruleSlider}
                    min={1} max={168} step={1}
                    value={d.validationDelayH}
                    onChange={e => set('validationDelayH', +e.target.value)} />
                  <span className={styles.ruleVal}>{d.validationDelayH}h</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                  <span>1 heure (minimum)</span>
                  <span>{d.validationDelayH >= 24 ? `${Math.round(d.validationDelayH / 24)} jour(s)` : ''}</span>
                  <span>7 jours (maximum)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Info modes */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-circle-info" /> Comparatif des modes</div>
                <div className={base.cardSub}>Comprendre l'impact de chaque mode sur votre réseau</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.triggerGrid}>
                {([
                  { icon: 'fa-bolt',        color: '#059669', bg: 'rgba(5,150,105,.10)',  title: 'Automatique',   desc: "Volume élevé, approbation instantanée pour les dossiers complets et conformes." },
                  { icon: 'fa-eye',         color: '#0284C7', bg: 'rgba(2,132,199,.10)',  title: 'Manuel',        desc: "Contrôle fin sur chaque inscription. Recommandé pour les secteurs sensibles." },
                  { icon: 'fa-scale-balanced', color: '#7C3AED', bg: 'rgba(124,58,237,.10)', title: 'Hybride',    desc: "Équilibre optimal : rapidité pour les dossiers clairs, sécurité pour les cas limites." },
                  { icon: 'fa-triangle-exclamation', color: '#D97706', bg: 'rgba(217,119,6,.10)', title: 'Délai expiré', desc: "Dossier non complété dans le délai → rejeté automatiquement et notifié par email." },
                ]).map(c => (
                  <div key={c.title} className={styles.triggerCard}>
                    <div className={styles.triggerIcon} style={{ background: c.bg, color: c.color }}>
                      <i className={`fas ${c.icon}`} />
                    </div>
                    <div>
                      <div className={styles.triggerTitle}>{c.title}</div>
                      <div className={styles.triggerDesc}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 5 — SUSPENSIONS
          ════════════════════════════════════════════════════════ */}
      {tab === 'suspensions' && (
        <>
          {/* Master toggle */}
          <div className={`${styles.suspMaster} ${d.autoSuspensionEnabled ? styles.suspMasterOn : ''}`}>
            <div className={styles.suspMasterIcon} style={{
              background: d.autoSuspensionEnabled ? 'rgba(220,38,38,.12)' : 'var(--g100)',
              color: d.autoSuspensionEnabled ? '#DC2626' : 'var(--t3)',
            }}>
              <i className="fas fa-robot" />
            </div>
            <div className={styles.suspMasterBody}>
              <div className={styles.suspMasterTitle}>Suspension automatique</div>
              <div className={styles.suspMasterDesc}>
                {d.autoSuspensionEnabled
                  ? "Le moteur surveille et suspend automatiquement les entreprises non conformes selon les seuils ci-dessous."
                  : "Toutes les suspensions sont déclenchées manuellement par un administrateur."}
              </div>
            </div>
            <div
              className={`${base.sw} ${d.autoSuspensionEnabled ? base.swOn : ''}`}
              onClick={() => set('autoSuspensionEnabled', !d.autoSuspensionEnabled)}
            />
          </div>

          {d.autoSuspensionEnabled && (
            <>
              {/* Seuils */}
              <div className={base.card}>
                <div className={base.cardHead}>
                  <div>
                    <div className={base.cardTitle}><i className="fas fa-sliders" /> Seuils de déclenchement</div>
                    <div className={base.cardSub}>Valeurs à partir desquelles la suspension est appliquée automatiquement</div>
                  </div>
                </div>
                <div className={base.cardBody}>
                  <div className={styles.rulesGrid}>
                    <div className={styles.ruleBlock}>
                      <div className={styles.ruleBlockTitle}>
                        <i className="fas fa-flag" style={{ color: '#DC2626' }} />
                        Signalements avant suspension
                      </div>
                      <div className={styles.ruleSliderRow}>
                        <input type="range" className={styles.ruleSlider}
                          min={1} max={20} step={1}
                          value={d.suspensionSignalThreshold}
                          onChange={e => set('suspensionSignalThreshold', +e.target.value)} />
                        <span className={styles.ruleVal}>{d.suspensionSignalThreshold}</span>
                      </div>
                    </div>
                    <div className={styles.ruleBlock}>
                      <div className={styles.ruleBlockTitle}>
                        <i className="fas fa-gavel" style={{ color: '#D97706' }} />
                        Litiges ouverts avant suspension
                      </div>
                      <div className={styles.ruleSliderRow}>
                        <input type="range" className={styles.ruleSlider}
                          min={1} max={30} step={1}
                          value={d.suspensionLitigeThreshold}
                          onChange={e => set('suspensionLitigeThreshold', +e.target.value)} />
                        <span className={styles.ruleVal}>{d.suspensionLitigeThreshold}</span>
                      </div>
                    </div>
                    <div className={styles.ruleBlock}>
                      <div className={styles.ruleBlockTitle}>
                        <i className="fas fa-hourglass-end" style={{ color: '#6D28D9' }} />
                        Inactivité avant désactivation (jours)
                      </div>
                      <div className={styles.ruleSliderRow}>
                        <input type="range" className={styles.ruleSlider}
                          min={7} max={365} step={7}
                          value={d.inactivityDays}
                          onChange={e => set('inactivityDays', +e.target.value)} />
                        <span className={styles.ruleVal}>{d.inactivityDays}j</span>
                      </div>
                    </div>
                    <div className={styles.ruleBlock}>
                      <div className={styles.ruleBlockTitle}>
                        <i className="fas fa-clock-rotate-left" style={{ color: '#0284C7' }} />
                        Délai validation expiré (heures)
                      </div>
                      <div className={styles.ruleSliderRow}>
                        <input type="range" className={styles.ruleSlider}
                          min={1} max={168} step={1}
                          value={d.validationDelayH}
                          onChange={e => set('validationDelayH', +e.target.value)} />
                        <span className={styles.ruleVal}>{d.validationDelayH}h</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Explication des critères */}
              <div className={base.card}>
                <div className={base.cardHead}>
                  <div>
                    <div className={base.cardTitle}><i className="fas fa-circle-info" /> Critères de déclenchement</div>
                    <div className={base.cardSub}>Ce qui provoque une suspension automatique</div>
                  </div>
                </div>
                <div className={base.cardBody}>
                  <div className={styles.triggerGrid}>
                    {SUSP_TRIGGERS.map(t => (
                      <div key={t.title} className={styles.triggerCard}>
                        <div className={styles.triggerIcon} style={{ background: t.bg, color: t.color }}>
                          <i className={`fas ${t.icon}`} />
                        </div>
                        <div>
                          <div className={styles.triggerTitle}>{t.title}</div>
                          <div className={styles.triggerDesc}>{t.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 6 — RÈGLES
          ════════════════════════════════════════════════════════ */}
      {tab === 'regles' && (
        <>
          {/* Limites opérationnelles */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-gauge" /> Limites opérationnelles</div>
                <div className={base.cardSub}>Plafonds appliqués par entreprise sur votre réseau</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.rulesGrid}>
                {OP_RULES.map(rule => (
                  <div key={rule.key} className={styles.ruleBlock}>
                    <div className={styles.ruleBlockTitle}>
                      <i className={`fas ${rule.icon}`} style={{ color: rule.color }} />
                      {rule.label}
                    </div>
                    <div className={styles.ruleSliderRow}>
                      <input type="range" className={styles.ruleSlider}
                        min={rule.min} max={rule.max} step={rule.step}
                        value={d[rule.key] as number}
                        onChange={e => set(rule.key, +e.target.value as never)} />
                      <span className={styles.ruleVal}>
                        {(d[rule.key] as number).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions produits */}
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-box" /> Types de produits autorisés</div>
                <div className={base.cardSub}>Catégories de vente accessibles aux entreprises de votre réseau</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
                {[d.allowPhysical, d.allowDigital, d.allowServices, d.allowInternational].filter(Boolean).length} / 4 actifs
              </span>
            </div>
            <div className={base.cardBody}>
              <div className={styles.permGrid}>
                {PERMS.map(p => (
                  <div key={p.key} className={styles.permCard}>
                    <div className={styles.permIcon} style={{ background: p.bg, color: p.color }}>
                      <i className={`fas ${p.icon}`} />
                    </div>
                    <div className={styles.permBody}>
                      <div className={styles.permTitle}>{p.title}</div>
                      <div className={styles.permDesc}>{p.desc}</div>
                    </div>
                    <div
                      className={`${base.sw} ${d[p.key] ? base.swOn : ''}`}
                      onClick={() => set(p.key, !d[p.key])}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 7 — NOTIFICATIONS
          ════════════════════════════════════════════════════════ */}
      {tab === 'notifications' && (
        <>
          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-bell" /> Événements de notification</div>
                <div className={base.cardSub}>Alertes envoyées aux entreprises de votre réseau lors de ces événements</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 600 }}>
                {NOTIF_EVENTS.filter(ev => getNotif(ev.key)).length} / {NOTIF_EVENTS.length} actifs
              </span>
            </div>
            <div className={base.cardBody}>
              <div className={styles.notifGrid}>
                {NOTIF_EVENTS.map(ev => {
                  const on = getNotif(ev.key);
                  return (
                    <div key={ev.key} className={`${styles.notifCard} ${on ? styles.notifCardOn : ''}`}>
                      <div className={styles.notifCardIcon} style={{ background: `${ev.color}18`, color: ev.color }}>
                        <i className={`fas ${ev.icon}`} />
                      </div>
                      <div className={styles.notifCardBody}>
                        <div className={styles.notifCardTitle}>{ev.title}</div>
                        <div className={styles.notifCardDesc}>{ev.desc}</div>
                      </div>
                      <div
                        className={`${base.sw} ${on ? base.swOn : ''}`}
                        onClick={() => setNotif(ev.key, !on)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={base.card}>
            <div className={base.cardHead}>
              <div>
                <div className={base.cardTitle}><i className="fas fa-circle-info" /> Comment fonctionnent les alertes</div>
                <div className={base.cardSub}>Canaux et comportements des notifications entreprises</div>
              </div>
            </div>
            <div className={base.cardBody}>
              <div className={styles.triggerGrid}>
                {([
                  { icon: 'fa-envelope',     color: '#0284C7', bg: 'rgba(2,132,199,.10)',  title: 'Email transactionnel', desc: "Chaque événement activé génère un email automatique au représentant légal de l'entreprise." },
                  { icon: 'fa-mobile-alt',   color: '#059669', bg: 'rgba(5,150,105,.10)',  title: 'Notification in-app',  desc: "Les alertes apparaissent dans le tableau de bord de l'entreprise concernée en temps réel." },
                  { icon: 'fa-filter',       color: '#7C3AED', bg: 'rgba(124,58,237,.10)', title: 'Filtrage intelligent', desc: "Les événements désactivés ne génèrent aucun bruit — seul l'administrateur les voit." },
                  { icon: 'fa-clock-rotate-left', color: '#D97706', bg: 'rgba(217,119,6,.10)', title: 'Historique complet', desc: "Chaque notification est archivée et consultable depuis la fiche de l'entreprise." },
                ]).map(c => (
                  <div key={c.title} className={styles.triggerCard}>
                    <div className={styles.triggerIcon} style={{ background: c.bg, color: c.color }}>
                      <i className={`fas ${c.icon}`} />
                    </div>
                    <div>
                      <div className={styles.triggerTitle}>{c.title}</div>
                      <div className={styles.triggerDesc}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════
          ONGLET 8 — TABLEAU DE BORD
          ════════════════════════════════════════════════════════ */}
      {tab === 'stats' && (
        <StatsTab
          stats={stats}
          settings={settings}
          updatedAt={settings?.updatedAt}
          onRefresh={load}
        />
      )}

    </div>
  );
}

/* ── Tableau de bord ─────────────────────────────────────────── */

function StatsTab({
  stats, settings, updatedAt, onRefresh,
}: {
  stats:      CompanyStats | null;
  settings:   CompanySettings | null;
  updatedAt?: string;
  onRefresh:  () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            fontSize: '11.5px', fontWeight: 700, padding: '6px 12px',
            borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1.5px solid var(--bdr2)',
            background: 'var(--g50)', color: 'var(--t1)', fontFamily: 'var(--fb)',
          }}>
          <i className={`fas fa-rotate-right ${refreshing ? styles.spinning : ''}`} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* KPI cards */}
      {!stats ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 10 }}>
            {[1,2,3,4,5].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            {[1,2,3,4].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
          </div>
        </>
      ) : (
        <>
          <div className={styles.statsKpis} style={{ marginBottom: 10 }}>
            {([
              { label: 'Total entreprises', val: stats.total,        color: '#0284C7', fmt: (n: number) => n.toLocaleString('fr-FR') },
              { label: 'Actives',           val: stats.active,       color: '#059669', fmt: (n: number) => n.toLocaleString('fr-FR') },
              { label: 'En attente',        val: stats.pending,      color: '#D97706', fmt: (n: number) => n.toLocaleString('fr-FR') },
              { label: 'Suspendues',        val: stats.suspended,    color: '#DC2626', fmt: (n: number) => n.toLocaleString('fr-FR') },
              { label: 'Ce mois',           val: stats.newThisMonth, color: '#7C3AED', fmt: (n: number) => n.toLocaleString('fr-FR') },
            ] as const).map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiStripe} style={{ background: k.color }} />
                <div className={styles.kpiVal} style={{ color: k.color }}>{k.fmt(k.val)}</div>
                <div className={styles.kpiLabel}>{k.label}</div>
              </div>
            ))}
          </div>
          <div className={styles.overviewGrid4} style={{ marginBottom: 20 }}>
            {([
              { label: 'Vérifiées',        val: stats.verified,     color: '#059669', fmt: (n: number) => n.toLocaleString('fr-FR') },
              { label: 'Premium',           val: stats.premium,      color: '#7C3AED', fmt: (n: number) => n.toLocaleString('fr-FR') },
              { label: 'CA total',          val: stats.totalRevenue, color: '#0891B2', fmt: (n: number) => `${fmtGNF(n)} GNF` },
              { label: 'Commandes totales', val: stats.totalOrders,  color: '#D97706', fmt: (n: number) => n.toLocaleString('fr-FR') },
            ] as const).map(k => (
              <div key={k.label} className={styles.kpiCard}>
                <div className={styles.kpiStripe} style={{ background: k.color }} />
                <div className={styles.kpiVal} style={{ color: k.color }}>{k.fmt(k.val)}</div>
                <div className={styles.kpiLabel}>{k.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Répartition */}
      {stats && stats.total > 0 && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)' }}>
          <div style={{
            padding: '16px 20px 12px', borderBottom: '1px solid var(--bdr)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 700, color: 'var(--heading-color)',
          }}>
            <i className="fas fa-chart-pie" style={{ fontSize: 12.5, color: 'var(--blue)' }} />
            Répartition des statuts
          </div>
          <div style={{ padding: '16px 20px' }}>
            {([
              { label: 'Actives',    val: stats.active,    color: '#059669' },
              { label: 'En attente', val: stats.pending,   color: '#D97706' },
              { label: 'Suspendues', val: stats.suspended, color: '#DC2626' },
            ]).map(row => {
              const pct = stats.total > 0 ? Math.round((row.val / stats.total) * 100) : 0;
              return (
                <div key={row.label} style={{ marginBottom: 14 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginBottom: 5, fontSize: 12.5, fontWeight: 600, color: 'var(--t2)',
                  }}>
                    <span>{row.label}</span>
                    <span style={{ color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                      {row.val.toLocaleString('fr-FR')}{' '}
                      <span style={{ color: 'var(--t3)' }}>({pct}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 8, background: 'var(--g100)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`, background: row.color,
                      borderRadius: 999, transition: 'width .6s cubic-bezier(.34,1.56,.64,1)',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export */}
      {(settings || stats) && (
        <div style={{ background: 'var(--white)', border: '1px solid var(--bdr)', borderRadius: 'var(--r-md)', marginTop: 16 }}>
          <div style={{
            padding: '16px 20px 12px', borderBottom: '1px solid var(--bdr)',
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 13, fontWeight: 700, color: 'var(--heading-color)',
          }}>
            <i className="fas fa-file-export" style={{ fontSize: 12.5, color: 'var(--blue)' }} />
            Exporter les données
            <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--t3)', marginLeft: 4 }}>
              — Téléchargez la configuration ou les statistiques en local
            </span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div className={styles.exportGrid}>
              {settings && (
                <button className={styles.exportCard} onClick={() => exportConfigAsJson(settings)}>
                  <div className={styles.exportCardIcon} style={{ background: 'rgba(2,132,199,.10)', color: '#0284C7' }}>
                    <i className="fas fa-file-code" />
                  </div>
                  <div>
                    <div className={styles.exportCardTitle}>Configuration JSON</div>
                    <div className={styles.exportCardDesc}>Toute la configuration du moteur entreprises</div>
                  </div>
                  <i className="fas fa-download" style={{ color: 'var(--t3)', marginLeft: 'auto', fontSize: 13 }} />
                </button>
              )}
              {stats && (
                <button className={styles.exportCard} onClick={() => exportStatsAsCsv(stats)}>
                  <div className={styles.exportCardIcon} style={{ background: 'rgba(5,150,105,.10)', color: '#059669' }}>
                    <i className="fas fa-file-csv" />
                  </div>
                  <div>
                    <div className={styles.exportCardTitle}>Statistiques CSV</div>
                    <div className={styles.exportCardDesc}>Métriques réseau au format tableur</div>
                  </div>
                  <i className="fas fa-download" style={{ color: 'var(--t3)', marginLeft: 'auto', fontSize: 13 }} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {updatedAt && (
        <div className={styles.lastUpdate}>
          <i className="fas fa-clock" />
          Paramètres mis à jour le{' '}
          {new Date(updatedAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}
    </>
  );
}

/* ── Skeleton ────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={styles.skeleton} style={{ height: 44, borderRadius: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {[1,2,3,4,5].map(i => <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} />)}
      </div>
      {[1,2].map(i => (
        <div key={i} className={`${styles.skeleton} ${styles.skeletonCard}`} style={{ height: 120 }} />
      ))}
    </div>
  );
}
