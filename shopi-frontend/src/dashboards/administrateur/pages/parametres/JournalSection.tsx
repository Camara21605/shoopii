/* ================================================================
 * FICHIER : pages/parametres/JournalSection.tsx
 * Section — Journal d'activité de l'administrateur.
 * Données réelles via GET /dashboard/admin/audit (AuditLog, filtrées
 * par actorId = admin courant — voir AdminAuditService.getAudit).
 * Le filtrage par type/recherche reste appliqué côté frontend, sur
 * le lot chargé, pour éviter des allers-retours réseau à chaque frappe.
 * ================================================================ */

import { useEffect, useState } from 'react';
import styles from '../../styles/ParametresPage.module.css';
import type { SectionProps, JournalEntry, JournalKind } from './types';
import { apiFetch } from '../../../../shared/services/apiFetch';

interface AuditResponse {
  list:  JournalEntry[];
  page:  number;
  limit: number;
  total: number;
}

const FILTRES: { id: 'all' | JournalKind; label: string; icon: string }[] = [
  { id: 'all',  label: 'Toutes',      icon: 'fa-list' },
  { id: 'ok',   label: 'Validations', icon: 'fa-check' },
  { id: 'ban',  label: 'Sanctions',   icon: 'fa-ban' },
  { id: 'code', label: 'Codes',       icon: 'fa-qrcode' },
  { id: 'warn', label: 'Alertes',     icon: 'fa-triangle-exclamation' },
];

const DOT_CLS: Record<JournalKind, string> = {
  ok:   'tlOk',
  code: 'tlCode',
  ban:  'tlBan',
  warn: 'tlWarn',
};

const DOT_ICON: Record<JournalKind, string> = {
  ok:   'fa-check',
  code: 'fa-qrcode',
  ban:  'fa-ban',
  warn: 'fa-triangle-exclamation',
};

/** Retire les balises HTML (issues de dangerouslySetInnerHTML) pour l'export CSV. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/** Échappe une cellule pour le format CSV (guillemets doublés, entourage). */
function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export default function JournalSection({ onToast }: SectionProps) {
  const [entries,   setEntries]   = useState<JournalEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filtre,    setFiltre]    = useState<'all' | JournalKind>('all');
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    apiFetch<AuditResponse>('/dashboard/admin/audit?limit=100')
      .then(res => setEntries(res.list))
      .catch(() => onToast('Impossible de charger le journal d\'activité', 'w'))
      .finally(() => setLoading(false));
  }, []);

  const visibles = entries.filter(e =>
    (filtre === 'all' || e.kind === filtre) &&
    e.texte.toLowerCase().includes(recherche.toLowerCase()),
  );

  function handleExport() {
    if (visibles.length === 0) {
      onToast('Aucune entrée à exporter', 'i');
      return;
    }
    const header = ['ID', 'Type', 'Action', 'Auteur', 'IP', 'Appareil', 'Quand'];
    const rows = visibles.map(e => [
      e.id, e.kind, stripHtml(e.texte), e.auteur, e.ip, e.device, e.quand,
    ]);
    const csv = [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `journal-activite-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast('Export du journal terminé (CSV)', 's');
  }

  return (
    <div className={styles.secBody}>

      {/* ── Barre filtres + export ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Filtres par type */}
        <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
          {FILTRES.map(f => (
            <button key={f.id}
              className={`${styles.btn} ${filtre === f.id ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
              onClick={() => setFiltre(f.id)}>
              <i className={`fas ${f.icon}`} /> {f.label}
            </button>
          ))}
        </div>
        {/* Recherche */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--white)', border: '1.5px solid var(--bdr2)', borderRadius: 'var(--r-md)', padding: '8px 14px', minWidth: 200 }}>
          <i className="fas fa-magnifying-glass" style={{ color: 'var(--t3)', fontSize: 12 }} />
          <input style={{ border: 'none', outline: 'none', background: 'none', fontSize: 12.5, color: 'var(--t1)', fontFamily: 'var(--fb)', width: '100%' }}
            placeholder="Rechercher dans le journal…"
            value={recherche} onChange={e => setRecherche(e.target.value)} />
        </div>
        {/* Export */}
        <button className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
          onClick={handleExport}>
          <i className="fas fa-download" /> Exporter
        </button>
      </div>

      {/* ── Timeline ── */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <div className={styles.cardTitle}><i className="fas fa-clipboard-list" /> Journal d&apos;activité</div>
            <div className={styles.cardSub}>
              {loading ? 'Chargement…' : `${visibles.length} entrée${visibles.length > 1 ? 's' : ''} — toutes les actions de l'administrateur sont consignées`}
            </div>
          </div>
        </div>
        <div className={styles.cardBody}>
          {loading && (
            <p style={{ textAlign: 'center', color: 'var(--t3)', padding: '24px 0', fontSize: 13 }}>
              <i className="fas fa-spinner fa-spin" /> Chargement du journal…
            </p>
          )}
          {!loading && visibles.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--t3)', padding: '24px 0', fontSize: 13 }}>
              Aucune entrée correspondant à votre recherche.
            </p>
          )}
          {!loading && (
            <div className={styles.timeline}>
              {visibles.map(e => (
                <div key={e.id} className={styles.tlItem}>
                  {/* Dot coloré selon le type */}
                  <div className={`${styles.tlDot} ${styles[DOT_CLS[e.kind] as keyof typeof styles]}`}>
                    <i className={`fas ${DOT_ICON[e.kind]}`} />
                  </div>
                  <div className={styles.tlBody}>
                    {/* Texte de l'action — échappé côté backend avant stockage (voir escapeHtml/admin.helpers.ts) */}
                    <div className={styles.tlText} dangerouslySetInnerHTML={{ __html: e.texte }} />
                    <div className={styles.tlMeta}>
                      <span className={styles.tlMetaItem}><i className="fas fa-user" /> {e.auteur}</span>
                      <span className={styles.tlMetaItem}><i className="fas fa-network-wired" /> {e.ip}</span>
                      <span className={styles.tlMetaItem}><i className="fas fa-laptop" /> {e.device}</span>
                      <span className={styles.tlMetaItem}><i className="fas fa-clock" /> {e.quand}</span>
                      <span className={styles.tlMetaItem}><i className="fas fa-fingerprint" /> {e.id}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
