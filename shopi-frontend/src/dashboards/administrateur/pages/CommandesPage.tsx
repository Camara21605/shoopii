/* ================================================================
 * FICHIER : src/dashboards/administrateur/pages/CommandesPage.tsx
 *
 * Commandes de la zone : toutes les commandes sur lesquelles intervient
 * un acteur que l'administrateur a invité (entreprise, livreur,
 * partenaire — directement ou via l'un de ses partenaires).
 *
 * GET /dashboard/admin/commandes  (onglet, recherche, période, pagination)
 * GET /dashboard/admin/commandes/export   → export CSV réel
 * GET /dashboard/admin/commandes/:id      → fenêtre de détail
 * ================================================================ */

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from '../styles/CommandesPage.module.css';
import { apiFetch } from '../../../shared/services/apiFetch';
import Pagination from '../components/Pagination';
import CommandeDetailModal from '../components/CommandeDetailModal';
import type { Commande, CommandeOnglet, CommandePeriode, CommandeStats } from '../data/types';
import { ST_LABEL, fmtGnf } from './commandes.constants';

interface CommandesPageProps {
  onToast:    (msg: string, type?: 's' | 'i' | 'w') => void;
  onGenerate: () => void;
}

interface CommandesResponse {
  list: Commande[]; stats: CommandeStats; total: number; zoneVide: boolean;
}

const LIMIT = 20;

const ONGLETS: { id: CommandeOnglet; label: string }[] = [
  { id: 'toutes',   label: 'Toutes' },
  { id: 'encours',  label: 'En cours' },
  { id: 'livrees',  label: 'Livrées' },
  { id: 'litiges',  label: 'Litiges' },
  { id: 'annulees', label: 'Annulées' },
];

const PERIODES: { id: CommandePeriode; label: string }[] = [
  { id: 'tout', label: 'Toute la période' },
  { id: '7',    label: '7 derniers jours' },
  { id: '30',   label: '30 derniers jours' },
  { id: '90',   label: '90 derniers jours' },
];

const EMPTY_STATS: CommandeStats = { total: 0, livrees: 0, tauxReussite: 0, enCours: 0, litiges: 0, annulees: 0, volumeLivre: 0 };

/* Cellule CSV : guillemets doublés + neutralisation des formules Excel (=, +, -, @) */
const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export default function CommandesPage({ onToast, onGenerate }: CommandesPageProps) {
  const [onglet,  setOnglet]  = useState<CommandeOnglet>('toutes');
  const [periode, setPeriode] = useState<CommandePeriode>('tout');
  const [input,   setInput]   = useState('');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);

  const [data,    setData]    = useState<CommandesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detail,  setDetail]  = useState<{ uuid: string; numero: string } | null>(null);

  /* Recherche : on attend la fin de la frappe (350 ms) avant d'interroger l'API */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [input]);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<CommandesResponse>('/dashboard/admin/commandes', {
      params: { onglet, periode, search, page: String(page), limit: String(LIMIT) },
    })
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e?.message ?? 'Impossible de charger les commandes.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [onglet, periode, search, page]);

  useEffect(() => load(), [load]);

  const stats     = data?.stats ?? EMPTY_STATS;
  const commandes = data?.list  ?? [];
  const total     = data?.total ?? 0;
  const zoneVide  = data?.zoneVide === true;
  const filtered  = onglet !== 'toutes' || periode !== 'tout' || search !== '';

  const resetFilters = () => { setOnglet('toutes'); setPeriode('tout'); setInput(''); setSearch(''); setPage(1); };

  /* ── Export CSV (mêmes filtres que la liste) ── */
  const exporting_ = useRef(false);
  const exportCsv = async () => {
    if (exporting_.current) return;
    exporting_.current = true;
    setExporting(true);
    try {
      const { list } = await apiFetch<{ list: Commande[] }>('/dashboard/admin/commandes/export', {
        params: { onglet, periode, search },
      });
      if (!list.length) { onToast('Aucune commande à exporter', 'i'); return; }
      const head = ['Numéro', 'Date', 'Client', 'Entreprise', 'Livreur', 'Montant (GNF)', 'Validations', 'Statut'];
      const rows = list.map(c => [
        c.id, new Date(c.createdAt).toLocaleString('fr-FR'), c.client, c.entreprise, c.livreur ?? '',
        c.montant, `${c.chaine.valides}/${c.chaine.total}`, ST_LABEL[c.statut] ?? c.statut,
      ]);
      const csv = '﻿' + [head, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `commandes-zone-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      onToast(`Export CSV : ${list.length} commande${list.length > 1 ? 's' : ''}`, 's');
    } catch (e: any) {
      onToast(e?.message ?? "Échec de l'export", 'w');
    } finally {
      exporting_.current = false;
      setExporting(false);
    }
  };

  return (
    <div>
      {/* ── Stats (toute la zone, indépendantes des filtres) ── */}
      <div className={styles.stats}>
        <div className={styles.cstat}><div className={styles.cstatV}>{stats.total.toLocaleString('fr-FR')}</div><div className={styles.cstatL}>Commandes (total)</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vg}`}>{stats.tauxReussite}%</div><div className={styles.cstatL}>Livrées avec succès</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.va}`}>{stats.enCours}</div><div className={styles.cstatL}>En cours de livraison</div></div>
        <div className={styles.cstat}><div className={`${styles.cstatV} ${styles.vr}`}>{stats.litiges}</div><div className={styles.cstatL}>Litiges ouverts</div></div>
        <div className={styles.cstat}>
          <div className={styles.cstatV}>{stats.volumeLivre.toLocaleString('fr-FR')}<small> GNF</small></div>
          <div className={styles.cstatL}>Volume livré</div>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div className={styles.card}>
        <div className={styles.ch}>
          <div className={styles.chT}><i className="fas fa-box" /> Commandes de la zone</div>
          <div className={styles.chRight}>
            <div className={styles.chTabs}>
              {ONGLETS.map(o => (
                <button key={o.id} className={`${styles.chTab} ${onglet === o.id ? styles.chTabOn : ''}`}
                  onClick={() => { setOnglet(o.id); setPage(1); }}>
                  {o.label}
                  {o.id === 'litiges' && stats.litiges > 0 && <span className={styles.chBadge}>{stats.litiges}</span>}
                </button>
              ))}
            </div>
            <button className={styles.exportBtn} onClick={exportCsv} disabled={exporting || zoneVide} title="Exporter en CSV">
              <i className={`fas ${exporting ? 'fa-spinner fa-spin' : 'fa-download'}`} /> <span>Exporter</span>
            </button>
          </div>
        </div>

        {/* Barre de recherche + période */}
        <div className={styles.filters}>
          <div className={styles.search}>
            <i className="fas fa-magnifying-glass" />
            <input placeholder="Rechercher : n° de commande, client, entreprise, téléphone…"
              value={input} onChange={e => setInput(e.target.value)} maxLength={100} />
            {input && <button onClick={() => setInput('')} aria-label="Effacer"><i className="fas fa-xmark" /></button>}
          </div>
          <select className={styles.sel} value={periode}
            onChange={e => { setPeriode(e.target.value as CommandePeriode); setPage(1); }}>
            {PERIODES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>

        {loading && !data ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: .4 }}>
            <i className="fas fa-spinner fa-spin fa-2x" />
          </div>
        ) : error ? (
          <div className={styles.empty}>
            <i className="fas fa-triangle-exclamation" style={{ color: '#DC2626' }} />
            <div className={styles.emptyT}>{error}</div>
            <button className={styles.emptyBtn} onClick={load}>Réessayer</button>
          </div>
        ) : zoneVide ? (
          <div className={styles.empty}>
            <i className="fas fa-people-group" />
            <div className={styles.emptyT}>Aucun acteur rattaché à votre zone</div>
            <p className={styles.emptyS}>
              Les commandes apparaissent ici dès qu&apos;une entreprise, un livreur ou un partenaire
              que vous avez invité s&apos;est inscrit avec votre code de création.
            </p>
            <button className={styles.emptyBtn} onClick={onGenerate}><i className="fas fa-plus" /> Générer un code</button>
          </div>
        ) : commandes.length === 0 ? (
          <div className={styles.empty}>
            <i className="fas fa-box-open" />
            <div className={styles.emptyT}>{filtered ? 'Aucune commande ne correspond à ces filtres' : 'Aucune commande pour le moment'}</div>
            {filtered
              ? <button className={styles.emptyBtn} onClick={resetFilters}>Réinitialiser les filtres</button>
              : <p className={styles.emptyS}>Les commandes de vos acteurs s&apos;afficheront ici dès la première vente.</p>}
          </div>
        ) : (
          <div className={`${styles.tblWrap} ${loading ? styles.dim : ''}`}>
            <table className={styles.table}>
              <thead>
                <tr><th>Commande</th><th>Client</th><th>Entreprise</th><th>Montant</th><th>Chaîne de validation</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {commandes.map(c => (
                  <tr key={c.uuid} onClick={() => setDetail({ uuid: c.uuid, numero: c.id })} className={styles.rowClick}>
                    <td><b>{c.id}</b><div className={styles.uMeta}>{c.quand}</div></td>
                    <td>{c.client}</td>
                    <td>{c.entreprise}{c.livreur && <div className={styles.uMeta}><i className="fas fa-motorcycle" /> {c.livreur}</div>}</td>
                    <td className={styles.nowrap}>{fmtGnf(c.montant)}</td>
                    <td>
                      <div className={styles.miniProg} title={`${c.chaine.valides} validation(s) sur ${c.chaine.total}`}>
                        {Array.from({ length: Math.max(c.chaine.total, 1) }, (_, i) => (
                          <span key={i} className={i < c.chaine.valides ? styles.done : ''} />
                        ))}
                      </div>
                      <div className={styles.uMeta}>{c.chaine.valides}/{c.chaine.total}</div>
                    </td>
                    <td><span className={`${styles.ordSt} ${styles['ord_' + c.statut]}`}>{ST_LABEL[c.statut] ?? c.statut}</span></td>
                    <td>
                      <button className={c.statut === 'dispute' ? styles.arbBtn : styles.raBtn}
                        title="Voir le détail"
                        onClick={e => { e.stopPropagation(); setDetail({ uuid: c.uuid, numero: c.id }); }}>
                        <i className="fas fa-eye" />{c.statut === 'dispute' && <span> Voir le litige</span>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!zoneVide && !error && <Pagination page={page} limit={LIMIT} total={total} onChange={setPage} />}
      </div>

      {detail && <CommandeDetailModal commandeId={detail.uuid} numero={detail.numero} onClose={() => setDetail(null)} />}
    </div>
  );
}
