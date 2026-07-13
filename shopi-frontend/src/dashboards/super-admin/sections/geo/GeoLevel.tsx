/* ================================================================
 * FICHIER : sections/geo/GeoLevel.tsx
 * Tableau CRUD réutilisable pour N'IMPORTE QUEL niveau géographique.
 * Fonctionnalités : recherche, filtre statut, pagination, CRUD,
 *   activation, désactivation, export CSV, stats.
 * ================================================================ */

import { useState, useMemo } from 'react';
import s from '../GeoReferentielSection.module.css';
import type { GeoItem, GeoLevel, GeoLevelConfig, AnyGeoItem, AllGeoData } from './geo.types';
import { GEO_LEVELS } from './geo.types';
import GeoModal from './GeoModal';

/* ── Types ── */
interface GeoLevelProps {
  level:    GeoLevel;
  items:    AnyGeoItem[];
  /** Données complètes pour les sélecteurs en cascade dans le modal */
  allData?: AllGeoData;
  /** Fallback plat (rétrocompatibilité) */
  parents?: { id: string; nom: string }[];
  toast:    (type: string, msg: string) => void;
  onAdd?:   (item: Partial<GeoItem>) => void;
  onEdit?:  (id: string, data: Partial<GeoItem>) => void;
  onDelete?:(id: string) => void;
  onToggle?:(id: string) => void;
  /** Retourne true si cet item est en lecture seule (ex: créé par le super-admin) */
  readOnly?:(item: AnyGeoItem) => boolean;
  /** Libellé utilisé comme auteur lors de la création d'un nouvel item */
  creatorLabel?: string;
  /**
   * Bascule la protection d'un item (super-admin uniquement).
   * @param id         UUID de l'item
   * @param protected  true = actuellement protégé → clic pour déléguer
   *                   false = actuellement délégué → clic pour reprendre
   */
  onToggleProtection?: (id: string, isProtected: boolean) => void;
}

const PAGE_SIZE = 10;

/* Couleur par action d'audit */
const AUDIT_COLORS: Record<string, string> = {
  create: 'var(--acid)', update: 'var(--sky)', delete: 'var(--rose)',
  activate: 'var(--acid)', deactivate: 'var(--gold)',
};

/* Items dont la protection peut être gérée par le super-admin */
const SUPER_ADMIN_MANAGED = new Set(['Super Admin', 'Système', 'System', 'Délégué']);

export default function GeoLevel({ level, items, allData, parents, toast, onAdd, onEdit, onDelete, onToggle, readOnly, creatorLabel = 'Super Admin', onToggleProtection }: GeoLevelProps) {
  const cfg = GEO_LEVELS.find(l => l.level === level)! as GeoLevelConfig;

  /* ── État local ── */
  const [search,    setSearch]    = useState('');
  const [statut,    setStatut]    = useState<'all' | 'actif' | 'inactif'>('all');
  const [page,      setPage]      = useState(1);
  const [modal,     setModal]     = useState<{ mode: 'create' | 'edit'; item?: AnyGeoItem } | null>(null);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());

  /* ── Filtrage ── */
  const filtered = useMemo(() => items.filter(it =>
    (statut === 'all' || it.statut === statut) &&
    (it.nom.toLowerCase().includes(search.toLowerCase()) ||
     it.code.toLowerCase().includes(search.toLowerCase()))
  ), [items, search, statut]);

  /* ── Pagination ── */
  const pages      = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPg  = Math.min(page, pages);
  const pageItems  = filtered.slice((currentPg - 1) * PAGE_SIZE, currentPg * PAGE_SIZE);
  const actifs     = items.filter(i => i.statut === 'actif').length;

  /* ── Export CSV ── */
  const exportCSV = () => {
    const cols = ['id', 'code', 'nom', 'description', 'statut', 'createdAt', 'auteur', 'enfants'];
    const rows = filtered.map(it => cols.map(c => {
      const v = (it as Record<string, unknown>)[c];
      return `"${String(v ?? '').replace(/"/g, '""')}"`;
    }).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `shopi-${level}-${Date.now()}.csv`;
    a.click();
    toast('success', `Export CSV de ${filtered.length} ${cfg.labelPlural} lancé`);
  };

  /* ── Sélection multiple ── */
  const toggleSel = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected(selected.size === pageItems.length ? new Set() : new Set(pageItems.map(i => i.id)));

  /* ── Sauvegarde ── */
  const handleSave = (data: Partial<GeoItem>) => {
    /* Ne pas envoyer les champs générés par le serveur (ValidationPipe
     * avec forbidNonWhitelisted rejette toute propriété hors DTO). */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, enfants: __, createdAt: ___, updatedAt: ____, ...clean } = data as Record<string, unknown>;
    const payload = clean as Partial<GeoItem>;

    if (modal?.mode === 'create') {
      onAdd?.({ ...payload, auteur: creatorLabel });
      toast('success', `${cfg.label} créé(e) : ${data.nom}`);
    } else {
      onEdit?.(modal!.item!.id, payload);
      toast('success', `${cfg.label} modifié(e) : ${data.nom}`);
    }
    setModal(null);
  };

  /* ── Suppression ── */
  const confirmDelete = () => {
    if (!deleteId) return;
    const item = items.find(i => i.id === deleteId);
    onDelete?.(deleteId);
    toast('success', `${cfg.label} supprimé(e) : ${item?.nom}`);
    setDeleteId(null);
  };

  /* ── Couleur d'accent ── */
  const accentColor = `var(${cfg.color})`;

  return (
    <div className={s.body} style={{ gap: 0, padding: 0 }}>

      {/* ── Sous-header (stats rapides) ── */}
      <div className={s.subHeader}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-h)', fontWeight: 800, fontSize: 15, color: 'var(--txt-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className={`fas ${cfg.icon}`} style={{ color: accentColor }} />
            {cfg.labelPlural}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--txt-2)', marginTop: 3 }}>
            {items.length} au total · {actifs} actifs · {items.length - actifs} inactifs
          </div>
        </div>
        <div className={s.subHeaderActions}>
          <button className={`${s.btnSecondary} ${s.btnSm}`} onClick={exportCSV}>
            <i className="fas fa-download" /> Export CSV
          </button>
          <button className={`${s.btnPrimary} ${s.btnSm}`} onClick={() => setModal({ mode: 'create' })}>
            <i className="fas fa-plus" /> Nouveau
          </button>
        </div>
      </div>

      {/* ── Barre filtres ── */}
      <div className={s.filterWrap}>
        <div className={s.filterBar}>
          <div className={s.searchBox}>
            <i className="fas fa-magnifying-glass" />
            <input placeholder={`Rechercher un(e) ${cfg.label}…`}
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            {search && <i className="fas fa-xmark" style={{ cursor: 'pointer', color: 'var(--txt-3)' }} onClick={() => setSearch('')} />}
          </div>
          <select className={s.filterSel} value={statut}
            onChange={e => { setStatut(e.target.value as typeof statut); setPage(1); }}>
            <option value="all">Tous les statuts</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
          </select>
          {selected.size > 0 && (
            <button className={`${s.btnDanger} ${s.btnSm}`}
              onClick={() => { selected.forEach(id => onDelete?.(id)); setSelected(new Set()); toast('success', `${selected.size} éléments supprimés`); }}>
              <i className="fas fa-trash" /> Supprimer ({selected.size})
            </button>
          )}
        </div>

        {/* ── Tableau ── */}
        <div className={s.card}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={selected.size === pageItems.length && pageItems.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th>Code</th>
                  <th>Nom</th>
                  {level === 'pays'    && <th>ISO</th>}
                  {level === 'commune' && <th>Type</th>}
                  {level === 'zone'    && <><th>Couverture</th><th>Entités</th><th>Frais</th></>}
                  {level === 'quartier' && <th>Population</th>}
                  <th className={s.colHideXs}>Enfants</th>
                  <th>Statut</th>
                  <th className={s.colHide}>Modifié</th>
                  <th className={s.colHide}>Auteur</th>
                  <th style={{ width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 && (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '28px 0', color: 'var(--txt-3)', fontSize: 13 }}>
                      <i className="fas fa-search" style={{ marginRight: 8 }} />
                      Aucun(e) {cfg.label} trouvé(e)
                    </td>
                  </tr>
                )}
                {pageItems.map(it => {
                  const ext           = it as Record<string, unknown>;
                  const isLocked      = readOnly?.(it) ?? false;
                  const isSAManaged   = SUPER_ADMIN_MANAGED.has(it.auteur);
                  const isProtected   = ['Super Admin', 'Système', 'System'].includes(it.auteur);
                  const isDelegated   = it.auteur === 'Délégué';
                  return (
                    <tr key={it.id}>
                      <td>
                        {isLocked
                          ? <i className="fas fa-lock" title="Créé par le super-administrateur" style={{ fontSize: 10, color: 'var(--txt-3)', opacity: .6 }} />
                          : <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleSel(it.id)} />
                        }
                      </td>
                      <td><span className={s.codePill}>{it.code}</span></td>
                      <td style={{ fontWeight: 600, color: 'var(--txt-1)' }}>{it.nom}</td>

                      {level === 'pays'    && <td style={{ color: 'var(--txt-2)', fontSize: 11 }}>{String(ext.iso2 ?? '')} / {String(ext.iso3 ?? '')}</td>}
                      {level === 'commune' && <td><span className={`${s.bdg} ${s.bdgSky}`}>{String(ext.type ?? '')}</span></td>}
                      {level === 'zone'    && (() => {
                        const ct = String(ext.couvertureType ?? 'commune');
                        const ids = (ext.couvertureIds as string[] | undefined) ?? [];
                        const typeColors: Record<string, string> = {
                          quartier: 'var(--coral)', commune: 'var(--gold)',
                          prefecture: 'var(--violet)', region: 'var(--sky)', pays: 'var(--acid)',
                        };
                        const typeLabels: Record<string, string> = {
                          quartier: 'Quartiers', commune: 'Communes',
                          prefecture: 'Préfectures', region: 'Régions', pays: 'Pays',
                        };
                        return (
                          <>
                            <td>
                              <span className={s.bdg} style={{ background: `${typeColors[ct] ?? 'var(--txt-3)'}18`, color: typeColors[ct] ?? 'var(--txt-3)', border: `1px solid ${typeColors[ct] ?? 'var(--txt-3)'}30` }}>
                                {typeLabels[ct] ?? ct}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-m)', fontWeight: 700, fontSize: 13, color: 'var(--txt-1)' }}>{ids.length}</span>
                              <span style={{ fontSize: 10, color: 'var(--txt-3)', marginLeft: 3 }}>entité{ids.length > 1 ? 's' : ''}</span>
                            </td>
                            <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{Number(ext.fraisLivraison ?? 0).toLocaleString('fr-FR')} GNF</td>
                          </>
                        );
                      })()}
                      {level === 'quartier' && <td style={{ color: 'var(--txt-2)' }}>{Number(ext.population ?? 0).toLocaleString('fr-FR')}</td>}

                      <td className={s.colHideXs}>
                        <span className={`${s.enfantsBadge}`}
                          style={{ background: `var(${cfg.color})18`, color: accentColor, fontWeight: 700, fontSize: 11 }}>
                          {it.enfants}
                        </span>
                      </td>
                      <td>
                        <span className={`${s.bdg} ${it.statut === 'actif' ? s.bdgOn : s.bdgOff}`}>
                          <i className={`fas ${it.statut === 'actif' ? 'fa-circle-check' : 'fa-circle-pause'}`} />
                          {it.statut === 'actif' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className={s.colHide} style={{ color: 'var(--txt-2)', fontSize: 11 }}>{it.updatedAt}</td>
                      <td className={s.colHide} style={{ color: 'var(--txt-3)', fontSize: 11 }}>{it.auteur}</td>
                      <td>
                        {isLocked ? (
                          <span title="Créé par le super-administrateur — lecture seule"
                            style={{ fontSize: 11, color: 'var(--txt-3)', display: 'flex', alignItems: 'center', gap: 5, opacity: .55 }}>
                            <i className="fas fa-lock" /> Protégé
                          </span>
                        ) : (
                          <div className={s.rowActions}>
                            {/* ── Bouton délégation (super-admin seulement) ── */}
                            {onToggleProtection && isSAManaged && (
                              <button
                                className={`${s.btnGhost} ${s.btnSm} ${s.btnIc}`}
                                title={isProtected
                                  ? 'Déléguer à l\'administrateur (retirer la protection)'
                                  : 'Reprendre le contrôle (re-protéger)'}
                                style={{ color: isProtected ? 'var(--gold)' : 'var(--acid)' }}
                                onClick={() => {
                                  onToggleProtection(it.id, isProtected);
                                  toast('success', isProtected
                                    ? `"${it.nom}" délégué à l'administrateur`
                                    : `"${it.nom}" de nouveau protégé`);
                                }}>
                                <i className={`fas ${isProtected ? 'fa-lock-open' : 'fa-lock'}`} />
                              </button>
                            )}
                            {/* Badge "Délégué" visible même quand le bouton est absent */}
                            {!onToggleProtection && isDelegated && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(0,200,138,.1)', color: 'var(--acid)', border: '1px solid rgba(0,200,138,.25)' }}>
                                Délégué
                              </span>
                            )}
                            <button className={`${s.btnGhost} ${s.btnSm} ${s.btnIc}`} title="Modifier"
                              onClick={() => setModal({ mode: 'edit', item: it })}>
                              <i className="fas fa-pen" />
                            </button>
                            <button className={`${s.btnGhost} ${s.btnSm} ${s.btnIc}`}
                              title={it.statut === 'actif' ? 'Désactiver' : 'Activer'}
                              onClick={() => { onToggle?.(it.id); toast('success', `${it.nom} ${it.statut === 'actif' ? 'désactivé' : 'activé'}`); }}>
                              <i className={`fas ${it.statut === 'actif' ? 'fa-pause' : 'fa-play'}`} />
                            </button>
                            <button className={`${s.btnDanger} ${s.btnSm} ${s.btnIc}`} title="Supprimer"
                              onClick={() => setDeleteId(it.id)}>
                              <i className="fas fa-trash" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className={s.pagination}>
            <span className={s.pageInfo}>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
            <button className={s.pageBtn} disabled={currentPg <= 1} onClick={() => setPage(p => p - 1)}>
              <i className="fas fa-chevron-left" />
            </button>
            {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
              const p = Math.max(1, Math.min(currentPg - 2, pages - 4)) + i;
              return p <= pages ? (
                <button key={p} className={`${s.pageBtn} ${p === currentPg ? s.active : ''}`}
                  onClick={() => setPage(p)}>{p}</button>
              ) : null;
            })}
            <button className={s.pageBtn} disabled={currentPg >= pages} onClick={() => setPage(p => p + 1)}>
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Modal Création / Édition ── */}
      {modal && (
        <GeoModal mode={modal.mode} level={level} item={modal.item}
          allData={allData} parents={parents} onSave={handleSave} onClose={() => setModal(null)} />
      )}

      {/* ── Modal Confirmation suppression ── */}
      {deleteId && (
        <div className={s.modalOverlay} onClick={() => setDeleteId(null)}>
          <div className={s.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={s.modalHead}>
              <div className={s.modalTitle}><i className="fas fa-triangle-exclamation" style={{ color: 'var(--rose)' }} /> Confirmer la suppression</div>
              <button className={s.modalClose} onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className={s.modalBody}>
              <p style={{ fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.6 }}>
                Cette action est irréversible. Voulez-vous vraiment supprimer <b style={{ color: 'var(--txt-1)' }}>{items.find(i => i.id === deleteId)?.nom}</b> ?
              </p>
            </div>
            <div className={s.modalFoot}>
              <button className={s.btnSecondary} onClick={() => setDeleteId(null)}>Annuler</button>
              <button className={s.btnDanger} onClick={confirmDelete}><i className="fas fa-trash" /> Supprimer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
