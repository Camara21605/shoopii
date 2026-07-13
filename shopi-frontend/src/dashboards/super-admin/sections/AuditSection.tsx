/* ============================================================
 * FICHIER  : src/dashboards/super-admin/sections/AuditSection.tsx
 * ROLE     : Centre d'audit enterprise — journal complet des actions admin
 * RESPONSABILITES :
 *   – Enrichissement des entrées brutes (sévérité, module, catégorie)
 *   – KPI dérivés en temps réel depuis les données chargées
 *   – Filtres avancés (recherche, sévérité, module, période)
 *   – Tableau professionnel paginé et triable
 *   – Modale de détail au clic sur une ligne
 *   – Export CSV / JSON de la vue filtrée
 * COMPATIBILITE : store existant — aucune modification du hook requise
 * ============================================================ */

import React, {
  useState, useMemo, useCallback, useEffect, memo,
} from 'react';
import type { AuditEntry } from '../types/codes.types';
import type { SuperAdminStore } from '../hooks/useSuperAdminState';

/* ─────────────────────────────────────────────────────────────
 * TYPES INTERNES
 * ───────────────────────────────────────────────────────────── */

type Severity  = 'critical' | 'warning' | 'info' | 'success';
type SortField = 'date' | 'user' | 'severity' | 'module';
type SortDir   = 'asc' | 'desc';
type Period    = 'all' | 'today' | '7d' | '30d';

interface AuditEntryEnriched extends AuditEntry {
  _idx:        number;   // indice stable pour la clé React (si id manquant)
  severity:    Severity;
  module:      string;
  dateStr:     string;   // "04/07/2026"
  timeDisplay: string;   // "14:32:05"
  ts:          number;   // timestamp ms pour tri
}

interface Filters {
  search:   string;
  severity: Severity | 'all';
  module:   string;
  period:   Period;
}

/* ─────────────────────────────────────────────────────────────
 * CONFIGURATION SÉVÉRITÉ
 * ───────────────────────────────────────────────────────────── */

const SEV_CFG: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critique',      color: '#ef4444', bg: 'rgba(239,68,68,.12)'  },
  warning:  { label: 'Avertissement', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  info:     { label: 'Information',   color: '#38bdf8', bg: 'rgba(56,189,248,.12)'  },
  success:  { label: 'Succès',        color: '#10b981', bg: 'rgba(16,185,129,.12)'  },
};

const SEV_ORDER: Severity[] = ['critical', 'warning', 'info', 'success'];

/* ─────────────────────────────────────────────────────────────
 * CONFIGURATION MODULES
 * ───────────────────────────────────────────────────────────── */

const MODULES = [
  'Tous les modules', 'Utilisateurs', 'Sécurité',
  'Invitations', 'Support', 'Système', 'Général',
];

const MODULE_COLORS: Record<string, string> = {
  Utilisateurs: '#38bdf8',
  Sécurité:     '#ef4444',
  Invitations:  '#a78bfa',
  Support:      '#f59e0b',
  Système:      '#10b981',
  Général:      '#64748b',
};

/* ─────────────────────────────────────────────────────────────
 * UTILITAIRES PURS
 * ───────────────────────────────────────────────────────────── */

function deriveSeverity(icon: string, action: string): Severity {
  const a = action.toLowerCase();
  if (icon === '🗑'  || a.includes('supprimé') || a.includes('suppression')) return 'critical';
  if (icon === '⏸'  || a.includes('suspendu'))                              return 'warning';
  if (icon === '🔐'  || a.includes('bloqué') || a.includes('tentative'))    return 'warning';
  if (icon === '✔'   || icon === '✅' || a.includes('vérifié'))              return 'success';
  if (icon === '🔓'  || a.includes('débloqué'))                              return 'success';
  return 'info';
}

function deriveModule(action: string): string {
  const a = action.toLowerCase();
  if (a.includes('compte') || a.includes('bloqué') || a.includes('suspendu') ||
      a.includes('vérifié') || a.includes('supprimé')) return 'Utilisateurs';
  if (a.includes('permission') || a.includes('admin') || a.includes('rôle')) return 'Sécurité';
  if (a.includes('code') || a.includes('invitation'))   return 'Invitations';
  if (a.includes('ticket') || a.includes('support'))    return 'Support';
  if (a.includes('paramètre') || a.includes('config'))  return 'Système';
  return 'Général';
}

function enrichEntry(e: AuditEntry, idx: number): AuditEntryEnriched {
  let ts = Date.now() - idx * 60_000; // fallback séquentiel si pas de date
  let dateStr = '';
  let timeDisplay = e.time;

  if (e.createdAt) {
    const d = new Date(e.createdAt);
    ts = d.getTime();
    dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    timeDisplay = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } else {
    dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return {
    ...e,
    _idx: idx,
    severity:    deriveSeverity(e.icon, e.action),
    module:      deriveModule(e.action),
    dateStr,
    timeDisplay,
    ts,
  };
}

function applyFilters(
  entries: AuditEntryEnriched[],
  f: Filters,
  debSearch: string,
): AuditEntryEnriched[] {
  const now = Date.now();
  const DAY = 86_400_000;

  return entries.filter(e => {
    if (f.period === 'today') {
      if (new Date(e.ts).toDateString() !== new Date().toDateString()) return false;
    } else if (f.period === '7d'  && e.ts < now - 7  * DAY) return false;
    else if   (f.period === '30d' && e.ts < now - 30 * DAY) return false;

    if (f.severity !== 'all' && e.severity !== f.severity) return false;
    if (f.module   !== 'Tous les modules' && e.module !== f.module) return false;

    if (debSearch) {
      const q = debSearch.toLowerCase();
      const hay = [e.user, e.email ?? '', e.action, e.module, e.targetType ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortEntries(
  entries: AuditEntryEnriched[],
  field: SortField,
  dir: SortDir,
): AuditEntryEnriched[] {
  const m = dir === 'asc' ? 1 : -1;
  return [...entries].sort((a, b) => {
    switch (field) {
      case 'date':     return m * (a.ts - b.ts);
      case 'user':     return m * a.user.localeCompare(b.user);
      case 'severity': return m * (SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
      case 'module':   return m * a.module.localeCompare(b.module);
      default:         return 0;
    }
  });
}

/* ─────────────────────────────────────────────────────────────
 * EXPORT
 * ───────────────────────────────────────────────────────────── */

function exportCsv(entries: AuditEntryEnriched[]): void {
  const header = ['Date','Heure','Utilisateur','Email','Sévérité','Module','Action','Type cible','ID cible'];
  const rows = entries.map(e => [
    e.dateStr, e.timeDisplay, e.user, e.email ?? '',
    SEV_CFG[e.severity].label, e.module,
    `"${e.action.replace(/"/g, '""')}"`,
    e.targetType ?? '', e.targetId ?? '',
  ].join(','));
  dl('﻿' + [header.join(','), ...rows].join('\n'), 'audit-log.csv', 'text/csv;charset=utf-8');
}

function exportJson(entries: AuditEntryEnriched[]): void {
  const data = entries.map(({ _idx, ts, dateStr, timeDisplay, ...rest }) => rest);
  dl(JSON.stringify(data, null, 2), 'audit-log.json', 'application/json');
}

function dl(content: string, filename: string, mime: string): void {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─────────────────────────────────────────────────────────────
 * SOUS-COMPOSANTS
 * ───────────────────────────────────────────────────────────── */

const SeverityBadge = memo(({ severity }: { severity: Severity }) => {
  const cfg = SEV_CFG[severity];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
      letterSpacing: '.4px', textTransform: 'uppercase' as const,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}40`, whiteSpace: 'nowrap' as const,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
});
SeverityBadge.displayName = 'SeverityBadge';

const ModuleBadge = memo(({ mod }: { mod: string }) => {
  const color = MODULE_COLORS[mod] ?? '#64748b';
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 10,
      background: `${color}20`, color, border: `1px solid ${color}35`,
      whiteSpace: 'nowrap' as const,
    }}>
      {mod}
    </span>
  );
});
ModuleBadge.displayName = 'ModuleBadge';

/* KPI card */
const KpiCard = memo(({
  label, value, icon, color, sub,
}: { label: string; value: number | string; icon: string; color: string; sub?: string }) => (
  <div style={{
    flex: '1 1 130px', minWidth: 120,
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px',
    display: 'flex', flexDirection: 'column' as const, gap: 6,
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase' as const, letterSpacing: '.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: 16 }}>{icon}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-m)', lineHeight: 1 }}>
      {typeof value === 'number' ? value.toLocaleString('fr') : value}
    </div>
    {sub && <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>{sub}</div>}
  </div>
));
KpiCard.displayName = 'KpiCard';

/* Icône de tri */
function SortIcon({ field, cur, dir }: { field: SortField; cur: SortField; dir: SortDir }) {
  if (field !== cur) return <span style={{ opacity: .3, fontSize: 9 }}>⇅</span>;
  return <span style={{ fontSize: 9, color: 'var(--sky)' }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

/* ─────────────────────────────────────────────────────────────
 * MODALE DÉTAIL
 * ───────────────────────────────────────────────────────────── */

const AuditDetailModal = memo(({
  entry, onClose,
}: { entry: AuditEntryEnriched; onClose: () => void }) => {
  const cfg = SEV_CFG[entry.severity];

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 16, width: '100%', maxWidth: 600,
        boxShadow: '0 24px 48px rgba(0,0,0,.35)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: cfg.bg, borderBottom: `2px solid ${cfg.color}35`, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>{entry.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.action}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 3 }}>
              {entry.dateStr} à {entry.timeDisplay}
            </div>
          </div>
          <SeverityBadge severity={entry.severity} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--txt-3)', padding: '0 4px', lineHeight: 1 }}>×</button>
        </div>

        {/* Corps */}
        <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {/* Acteur */}
          <div>
            <SectionLabel>Acteur</SectionLabel>
            <DRow label="Nom"   val={entry.user} />
            {entry.email && <DRow label="Email"  val={entry.email} mono />}
            {entry.id    && <DRow label="Log ID" val={entry.id.slice(0, 16) + '…'} mono small />}
          </div>

          {/* Cible */}
          <div>
            <SectionLabel>Cible</SectionLabel>
            <DRow label="Type"   val={entry.targetType ?? '—'} />
            {entry.targetId && <DRow label="ID" val={entry.targetId.slice(0, 16) + '…'} mono small />}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Module</div>
              <ModuleBadge mod={entry.module} />
            </div>
          </div>

          {/* Action complète */}
          <div style={{ gridColumn: '1 / -1' }}>
            <SectionLabel>Description</SectionLabel>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--txt-1)', lineHeight: 1.6 }}>
              {entry.action}
            </div>
          </div>

          {/* Horodatage */}
          {entry.createdAt && (
            <div style={{ gridColumn: '1 / -1' }}>
              <SectionLabel>Horodatage exact</SectionLabel>
              <div style={{ background: 'var(--surface)', border: `1px solid ${cfg.color}30`, borderRadius: 8, padding: '10px 14px', fontFamily: 'var(--font-m)', fontSize: 12, color: cfg.color }}>
                {new Date(entry.createdAt).toLocaleString('fr-FR', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
AuditDetailModal.displayName = 'AuditDetailModal';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.6px', color: 'var(--txt-3)', marginBottom: 10 }}>
      {children}
    </div>
  );
}

function DRow({ label, val, mono, small }: { label: string; val: React.ReactNode; mono?: boolean; small?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: small ? 10 : 12, color: 'var(--txt-1)', fontFamily: mono ? 'var(--font-m)' : undefined, wordBreak: 'break-all' as const }}>
        {val}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * LIGNE DU TABLEAU (mémoïsée)
 * ───────────────────────────────────────────────────────────── */

const AuditRow = memo(({
  entry, onSelect,
}: { entry: AuditEntryEnriched; onSelect: (e: AuditEntryEnriched) => void }) => {
  const cfg = SEV_CFG[entry.severity];
  return (
    <tr
      style={{ cursor: 'pointer', transition: 'background .12s' }}
      onClick={() => onSelect(entry)}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
    >
      <td><SeverityBadge severity={entry.severity} /></td>

      <td>
        <div style={{ fontFamily: 'var(--font-m)', fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ color: 'var(--txt-1)', fontWeight: 600 }}>{entry.dateStr || '—'}</div>
          <div style={{ color: 'var(--txt-3)', fontSize: 10 }}>{entry.timeDisplay}</div>
        </div>
      </td>

      <td>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {entry.user}
          </div>
          {entry.email && (
            <div style={{ color: 'var(--txt-3)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
              {entry.email}
            </div>
          )}
        </div>
      </td>

      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, flexShrink: 0 }}>{entry.icon}</span>
          <span style={{ fontSize: 11.5, color: 'var(--txt-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {entry.action}
          </span>
        </div>
      </td>

      <td><ModuleBadge mod={entry.module} /></td>

      <td>
        {entry.targetType
          ? (
            <div style={{ fontSize: 10.5, lineHeight: 1.4 }}>
              <div style={{ color: 'var(--txt-3)', textTransform: 'capitalize' as const }}>{entry.targetType}</div>
              {entry.targetId && (
                <div style={{ fontFamily: 'var(--font-m)', color: 'var(--txt-2)', fontSize: 9.5 }}>
                  {entry.targetId.slice(0, 8)}…
                </div>
              )}
            </div>
          )
          : <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>—</span>
        }
      </td>

      <td style={{ textAlign: 'center' as const }}>
        <button
          className="btn btn-ghost btn-xs"
          style={{ color: cfg.color, border: `1px solid ${cfg.color}35` }}
          onClick={e => { e.stopPropagation(); onSelect(entry); }}
          aria-label={`Détail : ${entry.action}`}
        >
          👁
        </button>
      </td>
    </tr>
  );
});
AuditRow.displayName = 'AuditRow';

/* ─────────────────────────────────────────────────────────────
 * COMPOSANT PRINCIPAL
 * ───────────────────────────────────────────────────────────── */

interface Props {
  store:    SuperAdminStore;
  isActive: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

export default function AuditSection({ store, isActive }: Props) {
  const { auditLog, auditLoading, auditError, reloadAudit } = store;

  /* ── États ───────────────────────────────────────────────── */
  const [filters,    setFilters]   = useState<Filters>({ search: '', severity: 'all', module: 'Tous les modules', period: 'all' });
  const [debSearch,  setDebSearch] = useState('');
  const [sortField,  setSortField] = useState<SortField>('date');
  const [sortDir,    setSortDir]   = useState<SortDir>('desc');
  const [page,       setPage]      = useState(1);
  const [pageSize,   setPageSize]  = useState(25);
  const [selected,   setSelected]  = useState<AuditEntryEnriched | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  /* Débounce recherche 350ms */
  useEffect(() => {
    const t = setTimeout(() => setDebSearch(filters.search), 350);
    return () => clearTimeout(t);
  }, [filters.search]);

  /* Retour page 1 sur changement de filtre/tri */
  useEffect(() => { setPage(1); }, [filters, debSearch, sortField, sortDir]);

  /* ── Enrichissement ──────────────────────────────────────── */
  const enriched = useMemo(
    () => auditLog.map((e, i) => enrichEntry(e, i)),
    [auditLog],
  );

  /* ── KPI stats ───────────────────────────────────────────── */
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const w7    = Date.now() - 7 * 86_400_000;
    return {
      total:    enriched.length,
      today:    enriched.filter(e => new Date(e.ts).toDateString() === today).length,
      week:     enriched.filter(e => e.ts >= w7).length,
      critical: enriched.filter(e => e.severity === 'critical').length,
      warning:  enriched.filter(e => e.severity === 'warning').length,
      success:  enriched.filter(e => e.severity === 'success').length,
    };
  }, [enriched]);

  /* ── Filtrage + tri ──────────────────────────────────────── */
  const filtered = useMemo(
    () => sortEntries(applyFilters(enriched, filters, debSearch), sortField, sortDir),
    [enriched, filters, debSearch, sortField, sortDir],
  );

  /* ── Pagination ──────────────────────────────────────────── */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated  = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  );

  /* ── Callbacks ───────────────────────────────────────────── */
  const setFilter = useCallback(<K extends keyof Filters>(key: K, val: Filters[K]) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDir('desc');
      return field;
    });
  }, []);

  const handleExportCsv  = useCallback(() => { exportCsv(filtered);  setExportOpen(false); }, [filtered]);
  const handleExportJson = useCallback(() => { exportJson(filtered); setExportOpen(false); }, [filtered]);
  const resetFilters = useCallback(() => {
    setFilters({ search: '', severity: 'all', module: 'Tous les modules', period: 'all' });
    setDebSearch('');
  }, []);

  const activeFilters = [
    filters.severity !== 'all',
    filters.module   !== 'Tous les modules',
    filters.period   !== 'all',
    debSearch !== '',
  ].filter(Boolean).length;

  if (!isActive) return null;

  /* ── Rendu ───────────────────────────────────────────────── */
  return (
    <div className="section active">

      {/* ── En-tête ── */}
      <div className="page-header">
        <div>
          <div className="ph-title">Journal <mark>d'Audit</mark></div>
          <div className="ph-sub">
            {auditLoading
              ? 'Chargement…'
              : `${enriched.length} événement${enriched.length > 1 ? 's' : ''} · immuable · traçable`
            }
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={reloadAudit} disabled={auditLoading} title="Actualiser">
            {auditLoading ? '⏳' : '🔄'}
          </button>

          {/* Menu export */}
          <div style={{ position: 'relative' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setExportOpen(v => !v)}>
              ⬇ Exporter ▾
            </button>
            {exportOpen && (
              <>
                {/* Fermer au clic extérieur */}
                <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setExportOpen(false)} />
                <div style={{
                  position: 'absolute', top: '110%', right: 0, zIndex: 50,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                  minWidth: 160, overflow: 'hidden',
                }}>
                  {([
                    { label: '📄 CSV',  fn: handleExportCsv  },
                    { label: '📦 JSON', fn: handleExportJson },
                  ] as const).map(item => (
                    <button key={item.label} onClick={item.fn}
                      style={{ width: '100%', background: 'none', border: 'none', padding: '10px 16px', textAlign: 'left' as const, fontSize: 13, color: 'var(--txt-1)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Erreur ── */}
      {auditError && (
        <div style={{ marginBottom: 16, padding: '10px 16px', background: 'rgba(220,38,38,.08)', border: '1px solid rgba(220,38,38,.25)', borderRadius: 10, fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
          ⚠️ {auditError}
          <button onClick={reloadAudit} style={{ marginLeft: 'auto', background: 'none', border: '1px solid currentColor', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'inherit' }}>
            Réessayer
          </button>
        </div>
      )}

      {/* ── KPI ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total chargé"   value={stats.total}    icon="📋" color="var(--txt-1)"           sub="entrées disponibles" />
        <KpiCard label="Aujourd'hui"    value={stats.today}    icon="📅" color="var(--sky)"             sub="depuis minuit" />
        <KpiCard label="Cette semaine"  value={stats.week}     icon="📆" color="var(--acid)"            sub="7 derniers jours" />
        <KpiCard label="Critiques"      value={stats.critical} icon="🔴" color={SEV_CFG.critical.color} sub="suppressions" />
        <KpiCard label="Avertissements" value={stats.warning}  icon="🟡" color={SEV_CFG.warning.color}  sub="blocages / suspensions" />
        <KpiCard label="Succès"         value={stats.success}  icon="🟢" color={SEV_CFG.success.color}  sub="vérifications" />
      </div>

      {/* ── Filtres ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>

          <div className="tbl-search" style={{ flex: '1 1 240px', minWidth: 200 }}>
            <span style={{ color: 'var(--txt-3)' }}>🔍</span>
            <input
              type="text"
              placeholder="Utilisateur, action, email, ressource…"
              value={filters.search}
              onChange={e => setFilter('search', e.target.value)}
            />
            {filters.search && (
              <button onClick={() => setFilter('search', '')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', fontSize: 14, lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>

          <select className="sel" value={filters.severity}
            onChange={e => setFilter('severity', e.target.value as Severity | 'all')}>
            <option value="all">🎚 Toutes sévérités</option>
            {SEV_ORDER.map(s => <option key={s} value={s}>{SEV_CFG[s].label}</option>)}
          </select>

          <select className="sel" value={filters.module}
            onChange={e => setFilter('module', e.target.value)}>
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select className="sel" value={filters.period}
            onChange={e => setFilter('period', e.target.value as Period)}>
            <option value="all">📅 Toute période</option>
            <option value="today">Aujourd'hui</option>
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
          </select>

          {activeFilters > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              ✕ Reset
              <span style={{ marginLeft: 5, background: 'var(--rose)', color: '#fff', borderRadius: '50%', width: 15, height: 15, fontSize: 9, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {activeFilters}
              </span>
            </button>
          )}
        </div>

        {/* Infos résultats + taille de page */}
        <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            {filtered.length !== enriched.length ? ` sur ${enriched.length}` : ''}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>Lignes :</span>
            <select className="sel" style={{ padding: '2px 6px', fontSize: 11 }}
              value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ tableLayout: 'fixed' as const, minWidth: 860 }}>
            <colgroup>
              <col style={{ width: 112 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 155 }} />
              <col />
              <col style={{ width: 115 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 48 }}  />
            </colgroup>
            <thead>
              <tr>
                <th><ThBtn label="Sévérité" field="severity" sort={sortField} dir={sortDir} onSort={handleSort} /></th>
                <th><ThBtn label="Date & Heure" field="date" sort={sortField} dir={sortDir} onSort={handleSort} /></th>
                <th><ThBtn label="Utilisateur" field="user" sort={sortField} dir={sortDir} onSort={handleSort} /></th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Action</th>
                <th><ThBtn label="Module" field="module" sort={sortField} dir={sortDir} onSort={handleSort} /></th>
                <th style={{ fontWeight: 700, fontSize: 11 }}>Cible</th>
                <th style={{ fontWeight: 700, fontSize: 11, textAlign: 'center' as const }}>ℹ</th>
              </tr>
            </thead>
            <tbody>
              {auditLoading && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--txt-3)' }}>
                    ⏳ Chargement du journal…
                  </td>
                </tr>
              )}
              {!auditLoading && paginated.map(entry => (
                <AuditRow
                  key={entry.id ?? String(entry._idx)}
                  entry={entry}
                  onSelect={setSelected}
                />
              ))}
              {!auditLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--txt-3)' }}>
                    {activeFilters > 0 ? '🔍 Aucun résultat pour ces filtres' : 'Aucune entrée'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!auditLoading && filtered.length > pageSize && (
          <div className="pager">
            <span style={{ flex: 1, fontSize: 11, color: 'var(--txt-3)' }}>
              Page {page} / {totalPages} — {filtered.length} entrée{filtered.length > 1 ? 's' : ''}
            </span>
            <button className="pager-btn" disabled={page === 1} onClick={() => setPage(1)} title="Première">«</button>
            <button className="pager-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
            {buildPageNums(page, totalPages).map((p, i) =>
              p === '…'
                ? <span key={i} style={{ color: 'var(--txt-3)', padding: '0 4px' }}>…</span>
                : <button key={i} className={`pager-btn${p === page ? ' active' : ''}`} onClick={() => setPage(p as number)}>{p}</button>
            )}
            <button className="pager-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            <button className="pager-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)} title="Dernière">»</button>
          </div>
        )}
      </div>

      {/* ── Modale détail ── */}
      {selected && <AuditDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * HELPERS
 * ───────────────────────────────────────────────────────────── */

function ThBtn({
  label, field, sort, dir, onSort,
}: { label: string; field: SortField; sort: SortField; dir: SortDir; onSort: (f: SortField) => void }) {
  return (
    <button
      onClick={() => onSort(field)}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'inherit', fontWeight: 700, fontSize: 11, padding: 0 }}
    >
      {label} <SortIcon field={field} cur={sort} dir={dir} />
    </button>
  );
}

/** Génère les numéros de page avec ellipses */
function buildPageNums(cur: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (cur > 3) pages.push('…');
  for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
  if (cur < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
