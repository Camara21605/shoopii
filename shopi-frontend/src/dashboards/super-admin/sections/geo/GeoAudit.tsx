/* ================================================================
 * FICHIER : sections/geo/GeoAudit.tsx
 * Journal d'audit du référentiel géographique.
 * Toutes les modifications sont tracées avec auteur, date, détails.
 * ================================================================ */

import { useState, useMemo } from 'react';
import s from '../GeoReferentielSection.module.css';
import type { GeoAuditAction, GeoLevel } from './geo.types';
import { GEO_LEVELS } from './geo.types';
import { MOCK_GEO_AUDIT } from './geo.data';

/* Styles / icônes par action */
const ACTION_META: Record<GeoAuditAction, { icon: string; color: string; label: string }> = {
  create:     { icon: 'fa-plus-circle',         color: 'var(--acid)',   label: 'Création'     },
  update:     { icon: 'fa-pen',                 color: 'var(--sky)',    label: 'Modification' },
  delete:     { icon: 'fa-trash',               color: 'var(--rose)',   label: 'Suppression'  },
  activate:   { icon: 'fa-circle-check',        color: 'var(--acid)',   label: 'Activation'   },
  deactivate: { icon: 'fa-pause',               color: 'var(--gold)',   label: 'Désactivation'},
  import:     { icon: 'fa-file-import',         color: 'var(--violet)', label: 'Import'       },
};

export default function GeoAudit() {
  const [action, setAction]   = useState<GeoAuditAction | 'all'>('all');
  const [niveau, setNiveau]   = useState<GeoLevel | 'all'>('all');
  const [search, setSearch]   = useState('');

  const filtered = useMemo(() => MOCK_GEO_AUDIT.filter(e =>
    (action === 'all' || e.action === action) &&
    (niveau === 'all' || e.niveau === niveau) &&
    (e.itemNom.toLowerCase().includes(search.toLowerCase()) ||
     e.auteur.toLowerCase().includes(search.toLowerCase()))
  ), [action, niveau, search]);

  const exportCSV = () => {
    const rows = filtered.map(e => `"${e.id}","${e.action}","${e.niveau}","${e.itemNom}","${e.itemCode}","${e.auteur}","${e.quand}","${e.details}"`);
    const csv = ['id,action,niveau,nom,code,auteur,date,details', ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `audit-geo-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className={s.body}>

      {/* ── Filtres ── */}
      <div className={s.filterBar}>
        <div className={s.searchBox}>
          <i className="fas fa-magnifying-glass" />
          <input placeholder="Rechercher dans l'audit…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>

        <select className={s.filterSel} value={action}
          onChange={e => setAction(e.target.value as GeoAuditAction | 'all')}>
          <option value="all">Toutes les actions</option>
          {(Object.keys(ACTION_META) as GeoAuditAction[]).map(a => (
            <option key={a} value={a}>{ACTION_META[a].label}</option>
          ))}
        </select>

        <select className={s.filterSel} value={niveau}
          onChange={e => setNiveau(e.target.value as GeoLevel | 'all')}>
          <option value="all">Tous les niveaux</option>
          {GEO_LEVELS.map(l => <option key={l.level} value={l.level}>{l.label}</option>)}
        </select>

        <button className={`${s.btnSecondary} ${s.btnSm}`} onClick={exportCSV}>
          <i className="fas fa-download" /> Export CSV
        </button>
      </div>

      {/* ── Journal ── */}
      <div className={s.card}>
        <div className={s.cardHead} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 8 }}>
            <div>
              <div className={s.cardTitle}><i className="fas fa-clipboard-list" style={{ color: 'var(--sky)' }} /> Journal d&apos;audit géographique</div>
              <div className={s.cardSub}>{filtered.length} entrée{filtered.length > 1 ? 's' : ''} — toutes les modifications du référentiel</div>
            </div>
          </div>
          {/* Chips d'action — toujours en flex-wrap */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
            {(Object.keys(ACTION_META) as GeoAuditAction[]).map(a => {
              const m = ACTION_META[a];
              const count = MOCK_GEO_AUDIT.filter(e => e.action === a).length;
              return count > 0 ? (
                <button key={a}
                  className={`${s.btnGhost} ${s.btnSm}`}
                  style={{ color: action === a ? m.color : undefined, borderColor: action === a ? m.color : undefined }}
                  onClick={() => setAction(prev => prev === a ? 'all' : a)}>
                  <i className={`fas ${m.icon}`} />
                  {m.label} <span style={{ fontFamily: 'var(--font-m)', fontSize: 10 }}>{count}</span>
                </button>
              ) : null;
            })}
          </div>
        </div>
        <div className={s.cardBody}>
          {filtered.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--txt-3)', padding: '20px 0', fontSize: 13 }}>
              Aucune entrée correspondante
            </p>
          )}
          {filtered.map(e => {
            const am = ACTION_META[e.action];
            const lv = GEO_LEVELS.find(l => l.level === e.niveau);
            return (
              <div key={e.id} className={s.auditItem}>
                <div className={s.auditIc} style={{ background: `${am.color}18`, color: am.color }}>
                  <i className={`fas ${am.icon}`} />
                </div>
                <div className={s.auditInfo}>
                  <div className={s.auditAction}>
                    <span style={{ color: am.color }}>{am.label}</span>
                    {' '}&mdash;{' '}
                    <b>{e.itemNom}</b>
                    {' '}
                    <span className={s.codePill} style={{ fontSize: 10 }}>{e.itemCode}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 3, lineHeight: 1.45 }}>
                    {e.details}
                  </div>
                  <div className={s.auditMeta}>
                    {lv && (
                      <span className={s.auditMetaItem}>
                        <i className={`fas ${lv.icon}`} style={{ color: `var(${lv.color})` }} />
                        {lv.label}
                      </span>
                    )}
                    <span className={s.auditMetaItem}><i className="fas fa-user" />{e.auteur}</span>
                    <span className={s.auditMetaItem}><i className="fas fa-clock" />{e.quand}</span>
                    <span className={s.auditMetaItem}><i className="fas fa-fingerprint" />{e.id}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
