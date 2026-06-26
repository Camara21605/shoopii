/*
 * FICHIER: src/dashboards/entreprise/pages/ProduitsPage.tsx
 * Page catalogue produits — données réelles API, modales Voir/Modifier
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../shared/context/ToastContext';
import type { EntreprisePage } from '../types';
import styles from './ProduitsPage.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ProduitsPageProps {
  onNavigate: (page: EntreprisePage, productId?: string) => void;
}

interface Produit {
  id:          string;
  nom:         string;
  description: string | null;
  prix:        number;
  prixAncien:  number | null;
  stock:       number;
  seuil:       number | null;
  visibilite:  'public' | 'draft' | 'private';
  condition:   string;
  garantie:    string;
  marque:      string | null;
  tags:        string | null;
  reference:   string | null;
  paysOrigine: string;
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  images:      { id: string; url: string; ordre: number; alt: string | null }[];
  specs:       { id: string; cle: string; valeur: string; ordre: number }[];
  variantes:   { id: string; type: string; vals: string }[];
  companyId:   string;
  createdAt:   string;
  updatedAt:   string;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const API   = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';
const token = () => localStorage.getItem('shopi_access_token') ?? '';

function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

function visibiliteLabel(v: string) {
  if (v === 'public')  return { label: 'Public',    cls: styles.badgePublic  };
  if (v === 'draft')   return { label: 'Brouillon', cls: styles.badgeDraft   };
  return                      { label: 'Privé',     cls: styles.badgePrivate };
}

// ─────────────────────────────────────────────────────────────
// MODALE — VOIR LE PRODUIT
// ─────────────────────────────────────────────────────────────

function ModalVoir({ produit, onClose, onEdit, onArchive, onDelete }: {
  produit:   Produit;
  onClose:   () => void;
  onEdit:    () => void;
  onArchive: () => void;
  onDelete:  () => void;
}) {
  const [imgIdx, setImgIdx] = useState(0);
  const vis = visibiliteLabel(produit.visibilite);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>
              {produit.category.icone && <span>{produit.category.icone}</span>}
              {produit.nom}
            </div>
            <div className={styles.modalMeta}>
              <span className={`${styles.badge} ${vis.cls}`}>{vis.label}</span>
              <span className={styles.metaItem}>
                <i className="fas fa-tag" /> {produit.category.nom}
                {produit.subCategory && ` › ${produit.subCategory.nom}`}
              </span>
              {produit.reference && (
                <span className={styles.metaItem}>
                  <i className="fas fa-barcode" /> {produit.reference}
                </span>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>

          {/* Galerie images */}
          {produit.images.length > 0 ? (
            <div className={styles.galerie}>
              <div className={styles.galerieMain}>
                <img src={produit.images[imgIdx]?.url} alt={produit.images[imgIdx]?.alt ?? produit.nom} />
              </div>
              {produit.images.length > 1 && (
                <div className={styles.galerieThumbs}>
                  {produit.images.map((img, i) => (
                    <div
                      key={img.id}
                      className={`${styles.galerieThumb} ${i === imgIdx ? styles.galerieThumbActive : ''}`}
                      onClick={() => setImgIdx(i)}
                    >
                      <img src={img.url} alt={img.alt ?? `Image ${i + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className={styles.noImage}>
              <i className="fas fa-image" />
              <span>Aucune image</span>
            </div>
          )}

          {/* Infos principales */}
          <div className={styles.infoGrid}>

            {/* Prix */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-tag" /> Prix</div>
              <div className={styles.prixMain}>{fmt(produit.prix)} <span>GNF</span></div>
              {produit.prixAncien && (
                <div className={styles.prixAncien}>
                  <span>{fmt(produit.prixAncien)} GNF</span>
                  <span className={styles.remise}>
                    -{Math.round((1 - produit.prix / produit.prixAncien) * 100)}%
                  </span>
                </div>
              )}
              <div className={styles.commission}>
                <span>Commission Shopi (3%)</span>
                <span>-{fmt(Math.round(produit.prix * 0.03))} GNF</span>
              </div>
              <div className={styles.revenuNet}>
                <span>Revenu net</span>
                <strong>{fmt(Math.round(produit.prix * 0.97))} GNF</strong>
              </div>
            </div>

            {/* Stock */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-boxes-stacked" /> Stock</div>
              <div className={`${styles.stockVal} ${
                produit.stock === 0 ? styles.stockOut :
                produit.seuil && produit.stock <= produit.seuil ? styles.stockLow : styles.stockOk
              }`}>
                {produit.stock}
                <span>unités</span>
              </div>
              {produit.seuil && (
                <div className={styles.seuilInfo}>
                  Seuil d'alerte : {produit.seuil} unités
                </div>
              )}
              <div className={styles.stockBar}>
                <div
                  className={styles.stockBarFill}
                  style={{ width: `${Math.min(100, (produit.stock / ((produit.seuil ?? 10) * 3)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Détails */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-circle-info" /> Détails</div>
              <div className={styles.detailsList}>
                {produit.marque && (
                  <div className={styles.detailRow}>
                    <span>Marque</span><strong>{produit.marque}</strong>
                  </div>
                )}
                <div className={styles.detailRow}>
                  <span>Condition</span><strong>{produit.condition}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Garantie</span><strong>{produit.garantie}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Origine</span><strong>{produit.paysOrigine}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Ajouté le</span>
                  <strong>{new Date(produit.createdAt).toLocaleDateString('fr-FR')}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {produit.description && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-align-left" /> Description</div>
              <p className={styles.description}>{produit.description}</p>
            </div>
          )}

          {/* Specs */}
          {produit.specs.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-list-check" /> Caractéristiques</div>
              <div className={styles.specsTable}>
                {produit.specs.map(s => (
                  <div key={s.id} className={styles.specRow}>
                    <span className={styles.specCle}>{s.cle}</span>
                    <span className={styles.specVal}>{s.valeur}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Variantes */}
          {produit.variantes.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-layer-group" /> Variantes</div>
              <div className={styles.variantesList}>
                {produit.variantes.map(v => (
                  <div key={v.id} className={styles.varianteItem}>
                    <span className={styles.varianteType}>{v.type}</span>
                    <div className={styles.varianteVals}>
                      {v.vals.split(',').map(val => (
                        <span key={val.trim()} className={styles.varianteTag}>{val.trim()}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {produit.tags && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-hashtag" /> Tags</div>
              <div className={styles.tagsList}>
                {produit.tags.split(',').map(t => (
                  <span key={t.trim()} className={styles.tag}>{t.trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={styles.modalFooter}>
          <button className={styles.btnDanger} onClick={onDelete}>
            <i className="fas fa-trash" /> Supprimer
          </button>
          <button className={styles.btnSecondary} onClick={onArchive}>
            <i className="fas fa-archive" /> Archiver
          </button>
          <button className={styles.btnPrimary} onClick={onEdit}>
            <i className="fas fa-pen" /> Modifier
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE — MODIFIER RAPIDE (visibilité + stock)
// ─────────────────────────────────────────────────────────────

function ModalModifier({ produit, onClose, onSaved }: {
  produit:  Produit;
  onClose:  () => void;
  onSaved:  (p: Produit) => void;
}) {
  const { pop } = useToast();
  const [stock,      setStock]      = useState(String(produit.stock));
  const [seuil,      setSeuil]      = useState(String(produit.seuil ?? ''));
  const [visibilite, setVisibilite] = useState(produit.visibilite);
  const [loading,    setLoading]    = useState(false);

  async function handleSave() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/produits/${produit.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          stock:      parseInt(stock) || 0,
          seuil:      seuil ? parseInt(seuil) : null,
          visibilite,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      const updated = await res.json();
      onSaved(updated);
      pop('✅ Produit mis à jour', 's');
      onClose();
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalSm}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <i className="fas fa-pen" /> Modification rapide
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.prodNomResume}>
            {produit.images[0] && (
              <img src={produit.images[0].url} alt={produit.nom} className={styles.miniThumb} />
            )}
            <div>
              <div className={styles.prodNom}>{produit.nom}</div>
              <div className={styles.prodRef}>{produit.category.nom}</div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Visibilité</label>
            <select
              className={styles.formSelect}
              value={visibilite}
              onChange={e => setVisibilite(e.target.value as any)}
            >
              <option value="public">🟢 Public — Visible sur la boutique</option>
              <option value="draft">🟡 Brouillon — Non publié</option>
              <option value="private">🔴 Privé — Lien direct uniquement</option>
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Stock actuel</label>
              <input
                type="number"
                className={styles.formInput}
                value={stock}
                min={0}
                onChange={e => setStock(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Seuil d'alerte</label>
              <input
                type="number"
                className={styles.formInput}
                value={seuil}
                min={0}
                placeholder="Ex: 5"
                onChange={e => setSeuil(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            Pour modifier le nom, le prix ou les images, utilisez le formulaire complet.
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> Sauvegarde…</> : <><i className="fas fa-check" /> Sauvegarder</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODALE — CONFIRMER SUPPRESSION
// ─────────────────────────────────────────────────────────────

function ModalDelete({ produit, onClose, onDeleted }: {
  produit:   Produit;
  onClose:   () => void;
  onDeleted: () => void;
}) {
  const { pop } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/produits/${produit.id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error((await res.json()).message ?? 'Erreur');
      onDeleted();
      pop('🗑️ Produit supprimé', 's');
      onClose();
    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalXs}`} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={`${styles.modalTitle} ${styles.dangerTitle}`}>
            <i className="fas fa-triangle-exclamation" /> Confirmer la suppression
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.deleteWarning}>
            <div className={styles.deleteIcon}>🗑️</div>
            <p>Voulez-vous vraiment supprimer <strong>"{produit.nom}"</strong> ?</p>
            <p className={styles.deleteNote}>Cette action est irréversible. Le produit sera définitivement effacé.</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button className={styles.btnDanger} onClick={handleDelete} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> Suppression…</> : <><i className="fas fa-trash" /> Supprimer définitivement</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function ProduitsPage({ onNavigate }: ProduitsPageProps) {
  const { pop } = useToast();

  const [produits,   setProduits]   = useState<Produit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [erreur,     setErreur]     = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [filtreVis,  setFiltreVis]  = useState('tous');

  const [modalVoir,   setModalVoir]   = useState<Produit | null>(null);
  const [modalModif,  setModalModif]  = useState<Produit | null>(null);
  const [modalDelete, setModalDelete] = useState<Produit | null>(null);

  // ── Chargement des produits ──────────────────────────────────────────────
  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const res = await fetch(`${API}/produits`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      setProduits(data.data ?? []);
    } catch (e: any) {
      setErreur(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // ── Filtrage ─────────────────────────────────────────────────────────────
  const produitsFiltres = produits.filter(p => {
    const matchSearch = !search.trim() ||
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      (p.marque ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? '').toLowerCase().includes(search.toLowerCase());
    const matchVis = filtreVis === 'tous' || p.visibilite === filtreVis;
    return matchSearch && matchVis;
  });

  // ── Actions ──────────────────────────────────────────────────────────────
  function handleSaved(updated: Produit) {
    setProduits(prev => prev.map(p => p.id === updated.id ? updated : p));
  }
  function handleDeleted(id: string) {
    setProduits(prev => prev.filter(p => p.id !== id));
  }
  async function handleArchive(produit: Produit) {
    try {
      const res = await fetch(`${API}/produits/${produit.id}/archive`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error();
      setProduits(prev => prev.map(p =>
        p.id === produit.id ? { ...p, visibilite: 'private' } : p
      ));
      pop('📦 Produit archivé', 's');
      setModalVoir(null);
    } catch {
      pop('❌ Erreur lors de l\'archivage', 'e');
    }
  }

  // ── Stats rapides ─────────────────────────────────────────────────────────
  const stats = {
    total:     produits.length,
    publics:   produits.filter(p => p.visibilite === 'public').length,
    brouillons:produits.filter(p => p.visibilite === 'draft').length,
    rupture:   produits.filter(p => p.stock === 0).length,
  };

  // ─────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titre}>Mes Produits</h1>
          <p className={styles.sousTitre}>Gérez votre catalogue et votre inventaire</p>
        </div>
        <button className={styles.btnAjouter} onClick={() => onNavigate('ajouter')}>
          <i className="fas fa-plus" /> Nouveau produit
        </button>
      </div>

      {/* ── Stats ── */}
      <div className={styles.statsRow}>
        {[
          { label: 'Total',      val: stats.total,      icon: 'fa-box',            cls: styles.statBlue    },
          { label: 'Publiés',    val: stats.publics,    icon: 'fa-globe',          cls: styles.statGreen   },
          { label: 'Brouillons', val: stats.brouillons, icon: 'fa-file-pen',       cls: styles.statAmber   },
          { label: 'Rupture',    val: stats.rupture,    icon: 'fa-triangle-exclamation', cls: styles.statRose },
        ].map(s => (
          <div key={s.label} className={`${styles.statCard} ${s.cls}`}>
            <div className={styles.statIcon}><i className={`fas ${s.icon}`} /></div>
            <div className={styles.statVal}>{s.val}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div className={styles.filtres}>
        <div className={styles.searchWrap}>
          <i className="fas fa-magnifying-glass" />
          <input
            className={styles.searchInput}
            placeholder="Rechercher par nom, marque, référence…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <i className="fas fa-xmark" />
            </button>
          )}
        </div>
        <div className={styles.filtresBtns}>
          {[
            { val: 'tous',    label: 'Tous' },
            { val: 'public',  label: '🟢 Publiés' },
            { val: 'draft',   label: '🟡 Brouillons' },
            { val: 'private', label: '🔴 Privés' },
          ].map(f => (
            <button
              key={f.val}
              className={`${styles.filtreBtn} ${filtreVis === f.val ? styles.filtreBtnActive : ''}`}
              onClick={() => setFiltreVis(f.val)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu ── */}
      {loading ? (
        <div className={styles.loading}>
          <i className="fas fa-spinner fa-spin" />
          <span>Chargement des produits…</span>
        </div>
      ) : erreur ? (
        <div className={styles.erreur}>
          <i className="fas fa-triangle-exclamation" />
          <span>{erreur}</span>
          <button onClick={charger} className={styles.btnReessayer}>Réessayer</button>
        </div>
      ) : produitsFiltres.length === 0 ? (
        <div className={styles.vide}>
          <div className={styles.videIco}>📦</div>
          <div className={styles.videTitle}>
            {produits.length === 0 ? 'Aucun produit encore' : 'Aucun résultat'}
          </div>
          <div className={styles.videSub}>
            {produits.length === 0
              ? 'Commencez par ajouter votre premier produit.'
              : 'Essayez de modifier vos filtres.'}
          </div>
          {produits.length === 0 && (
            <button className={styles.btnAjouter} onClick={() => onNavigate('ajouter')}>
              <i className="fas fa-plus" /> Ajouter un produit
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.compteur}>
            {produitsFiltres.length} produit{produitsFiltres.length > 1 ? 's' : ''}
            {search && ` pour "${search}"`}
          </div>
          <div className={styles.grid}>
            {produitsFiltres.map(p => {
              const vis = visibiliteLabel(p.visibilite);
              const stockCls = p.stock === 0 ? styles.stockOut :
                (p.seuil && p.stock <= p.seuil) ? styles.stockLow : styles.stockOk;

              return (
                <div key={p.id} className={styles.card}>

                  {/* Image */}
                  <div className={styles.cardImg} onClick={() => setModalVoir(p)}>
                    {p.images.length > 0 ? (
                      <img src={p.images[0].url} alt={p.nom} />
                    ) : (
                      <div className={styles.noImgPlaceholder}>
                        <i className="fas fa-image" />
                      </div>
                    )}
                    <div className={styles.cardBadges}>
                      <span className={`${styles.badge} ${vis.cls}`}>{vis.label}</span>
                      {p.stock === 0 && <span className={`${styles.badge} ${styles.badgeRupture}`}>Rupture</span>}
                    </div>
                    <div className={styles.cardOverlay}>
                      <span><i className="fas fa-eye" /> Voir</span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className={styles.cardBody}>
                    {p.category && (
                      <div className={styles.cardCat}>
                        {p.category.icone} {p.category.nom}
                        {p.subCategory && <span> › {p.subCategory.nom}</span>}
                      </div>
                    )}
                    <div className={styles.cardNom}>{p.nom}</div>
                    {p.marque && <div className={styles.cardMarque}>{p.marque}</div>}

                    <div className={styles.cardPrix}>
                      <span className={styles.prixVal}>{fmt(p.prix)} GNF</span>
                      {p.prixAncien && (
                        <span className={styles.prixOld}>{fmt(p.prixAncien)} GNF</span>
                      )}
                    </div>

                    <div className={styles.cardStock}>
                      <span className={`${styles.stockDot} ${stockCls}`} />
                      <span className={styles.stockTxt}>
                        {p.stock === 0 ? 'Rupture de stock' :
                         (p.seuil && p.stock <= p.seuil) ? `Stock faible — ${p.stock} restants` :
                         `${p.stock} en stock`}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => setModalVoir(p)}
                      title="Voir le détail"
                    >
                      <i className="fas fa-eye" />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      onClick={() => setModalModif(p)}
                      title="Modification rapide"
                    >
                      <i className="fas fa-pen" />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnFull}`}
                      onClick={() => onNavigate('ajouter', p.id)}
                      title="Modifier complet"
                    >
                      <i className="fas fa-sliders" /> Modifier
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setModalDelete(p)}
                      title="Supprimer"
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Modales ── */}
      {modalVoir && (
        <ModalVoir
          produit={modalVoir}
          onClose={() => setModalVoir(null)}
          onEdit={() => { setModalVoir(null); setModalModif(modalVoir); }}
          onArchive={() => handleArchive(modalVoir)}
          onDelete={() => { setModalDelete(modalVoir); setModalVoir(null); }}
        />
      )}
      {modalModif && (
        <ModalModifier
          produit={modalModif}
          onClose={() => setModalModif(null)}
          onSaved={handleSaved}
        />
      )}
      {modalDelete && (
        <ModalDelete
          produit={modalDelete}
          onClose={() => setModalDelete(null)}
          onDeleted={() => handleDeleted(modalDelete.id)}
        />
      )}
    </div>
  );
}