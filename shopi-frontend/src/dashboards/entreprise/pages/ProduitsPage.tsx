/*
 * FICHIER: src/dashboards/entreprise/pages/ProduitsPage.tsx
 * Page catalogue produits — données réelles API, modales Voir/Modifier
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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

function visibiliteLabel(v: string, t: (k: string) => string) {
  if (v === 'public')  return { label: t('produits.visibilite.public'), cls: styles.badgePublic  };
  if (v === 'draft')   return { label: t('produits.visibilite.draft'),  cls: styles.badgeDraft   };
  return                      { label: t('produits.visibilite.private'), cls: styles.badgePrivate };
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
  const { t } = useTranslation();
  const [imgIdx, setImgIdx] = useState(0);
  const vis = visibiliteLabel(produit.visibilite, t);

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
              <span>{t('produits.modalVoir.noImage')}</span>
            </div>
          )}

          {/* Infos principales */}
          <div className={styles.infoGrid}>

            {/* Prix */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-tag" /> {t('produits.modalVoir.prix')}</div>
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
                <span>{t('produits.modalVoir.commission')}</span>
                <span>-{fmt(Math.round(produit.prix * 0.03))} GNF</span>
              </div>
              <div className={styles.revenuNet}>
                <span>{t('produits.modalVoir.revenuNet')}</span>
                <strong>{fmt(Math.round(produit.prix * 0.97))} GNF</strong>
              </div>
            </div>

            {/* Stock */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardTitle}><i className="fas fa-boxes-stacked" /> {t('produits.modalVoir.stock')}</div>
              <div className={`${styles.stockVal} ${
                produit.stock === 0 ? styles.stockOut :
                produit.seuil && produit.stock <= produit.seuil ? styles.stockLow : styles.stockOk
              }`}>
                {produit.stock}
                <span>{t('produits.modalVoir.unites')}</span>
              </div>
              {produit.seuil && (
                <div className={styles.seuilInfo}>
                  {t('produits.modalVoir.seuilInfo', { count: produit.seuil })}
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
              <div className={styles.infoCardTitle}><i className="fas fa-circle-info" /> {t('produits.modalVoir.details')}</div>
              <div className={styles.detailsList}>
                {produit.marque && (
                  <div className={styles.detailRow}>
                    <span>{t('produits.modalVoir.marque')}</span><strong>{produit.marque}</strong>
                  </div>
                )}
                <div className={styles.detailRow}>
                  <span>{t('produits.modalVoir.condition')}</span><strong>{produit.condition}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{t('produits.modalVoir.garantie')}</span><strong>{produit.garantie}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{t('produits.modalVoir.origine')}</span><strong>{produit.paysOrigine}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{t('produits.modalVoir.ajouteLe')}</span>
                  <strong>{new Date(produit.createdAt).toLocaleDateString('fr-FR')}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {produit.description && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-align-left" /> {t('produits.modalVoir.description')}</div>
              <p className={styles.description}>{produit.description}</p>
            </div>
          )}

          {/* Specs */}
          {produit.specs.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}><i className="fas fa-list-check" /> {t('produits.modalVoir.caracteristiques')}</div>
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
              <div className={styles.sectionTitle}><i className="fas fa-layer-group" /> {t('produits.modalVoir.variantes')}</div>
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
              <div className={styles.sectionTitle}><i className="fas fa-hashtag" /> {t('produits.modalVoir.tags')}</div>
              <div className={styles.tagsList}>
                {produit.tags.split(',').map(tag => (
                  <span key={tag.trim()} className={styles.tag}>{tag.trim()}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={styles.modalFooter}>
          <button className={styles.btnDanger} onClick={onDelete}>
            <i className="fas fa-trash" /> {t('produits.modalVoir.supprimer')}
          </button>
          <button className={styles.btnSecondary} onClick={onArchive}>
            <i className="fas fa-archive" /> {t('produits.modalVoir.archiver')}
          </button>
          <button className={styles.btnPrimary} onClick={onEdit}>
            <i className="fas fa-pen" /> {t('produits.modalVoir.modifier')}
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
  const { t } = useTranslation();
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
      if (!res.ok) throw new Error((await res.json()).message ?? t('retours.toasts.genericError'));
      const updated = await res.json();
      onSaved(updated);
      pop(t('produits.toasts.updated'), 's');
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
            <i className="fas fa-pen" /> {t('produits.modalModifier.title')}
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
            <label className={styles.formLabel}>{t('produits.modalModifier.visibilite')}</label>
            <select
              className={styles.formSelect}
              value={visibilite}
              onChange={e => setVisibilite(e.target.value as any)}
            >
              <option value="public">{t('produits.modalModifier.optPublic')}</option>
              <option value="draft">{t('produits.modalModifier.optDraft')}</option>
              <option value="private">{t('produits.modalModifier.optPrivate')}</option>
            </select>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('produits.modalModifier.stockActuel')}</label>
              <input
                type="number"
                className={styles.formInput}
                value={stock}
                min={0}
                onChange={e => setStock(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('produits.modalModifier.seuilAlerte')}</label>
              <input
                type="number"
                className={styles.formInput}
                value={seuil}
                min={0}
                placeholder={t('produits.modalModifier.seuilPlaceholder')}
                onChange={e => setSeuil(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.infoBox}>
            <i className="fas fa-circle-info" />
            {t('produits.modalModifier.info')}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            {t('produits.modalModifier.annuler')}
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> {t('produits.modalModifier.saving')}</> : <><i className="fas fa-check" /> {t('produits.modalModifier.save')}</>}
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
  const { t } = useTranslation();
  const { pop } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/produits/${produit.id}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error((await res.json()).message ?? t('retours.toasts.genericError'));
      onDeleted();
      pop(t('produits.toasts.deleted'), 's');
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
            <i className="fas fa-triangle-exclamation" /> {t('produits.modalDelete.title')}
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.deleteWarning}>
            <div className={styles.deleteIcon}>🗑️</div>
            <p>{t('produits.modalDelete.confirm', { nom: produit.nom })}</p>
            <p className={styles.deleteNote}>{t('produits.modalDelete.irreversible')}</p>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={loading}>
            {t('produits.modalDelete.annuler')}
          </button>
          <button className={styles.btnDanger} onClick={handleDelete} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> {t('produits.modalDelete.deleting')}</> : <><i className="fas fa-trash" /> {t('produits.modalDelete.confirmBtn')}</>}
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
  const { t } = useTranslation();
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
      pop(t('produits.toasts.archived'), 's');
      setModalVoir(null);
    } catch {
      pop(`❌ ${t('produits.toasts.archiveError')}`, 'e');
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
          <h1 className={styles.titre}>{t('produits.header.title')}</h1>
          <p className={styles.sousTitre}>{t('produits.header.subtitle')}</p>
        </div>
        <button className={styles.btnAjouter} onClick={() => onNavigate('ajouter')}>
          <i className="fas fa-plus" /> {t('produits.header.nouveau')}
        </button>
      </div>

      {/* ── Stats ── */}
      <div className={styles.statsRow}>
        {[
          { label: t('produits.stats.total'),      val: stats.total,      icon: 'fa-box',            cls: styles.statBlue    },
          { label: t('produits.stats.publies'),     val: stats.publics,    icon: 'fa-globe',          cls: styles.statGreen   },
          { label: t('produits.stats.brouillons'),  val: stats.brouillons, icon: 'fa-file-pen',       cls: styles.statAmber   },
          { label: t('produits.stats.rupture'),     val: stats.rupture,    icon: 'fa-triangle-exclamation', cls: styles.statRose },
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
            placeholder={t('produits.search')}
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
            { val: 'tous',    label: t('produits.filters.tous') },
            { val: 'public',  label: t('produits.filters.publics') },
            { val: 'draft',   label: t('produits.filters.brouillons') },
            { val: 'private', label: t('produits.filters.prives') },
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
          <span>{t('produits.loading')}</span>
        </div>
      ) : erreur ? (
        <div className={styles.erreur}>
          <i className="fas fa-triangle-exclamation" />
          <span>{erreur}</span>
          <button onClick={charger} className={styles.btnReessayer}>{t('produits.retry')}</button>
        </div>
      ) : produitsFiltres.length === 0 ? (
        <div className={styles.vide}>
          <div className={styles.videIco}>📦</div>
          <div className={styles.videTitle}>
            {produits.length === 0 ? t('produits.empty.noneTitle') : t('produits.empty.noResultsTitle')}
          </div>
          <div className={styles.videSub}>
            {produits.length === 0
              ? t('produits.empty.noneSub')
              : t('produits.empty.noResultsSub')}
          </div>
          {produits.length === 0 && (
            <button className={styles.btnAjouter} onClick={() => onNavigate('ajouter')}>
              <i className="fas fa-plus" /> {t('produits.empty.addFirst')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.compteur}>
            {t('produits.count', { count: produitsFiltres.length })}
            {search && ` ${t('produits.countFor', { search })}`}
          </div>
          <div className={styles.grid}>
            {produitsFiltres.map(p => {
              const vis = visibiliteLabel(p.visibilite, t);
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
                      {p.stock === 0 && <span className={`${styles.badge} ${styles.badgeRupture}`}>{t('produits.card.rupture')}</span>}
                    </div>
                    <div className={styles.cardOverlay}>
                      <span><i className="fas fa-eye" /> {t('produits.card.voir')}</span>
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
                        {p.stock === 0 ? t('produits.card.outOfStock') :
                         (p.seuil && p.stock <= p.seuil) ? t('produits.card.lowStock', { count: p.stock }) :
                         t('produits.card.inStock', { count: p.stock })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => setModalVoir(p)}
                      title={t('produits.card.voirDetail')}
                    >
                      <i className="fas fa-eye" />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                      onClick={() => setModalModif(p)}
                      title={t('produits.card.modifRapide')}
                    >
                      <i className="fas fa-pen" />
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnFull}`}
                      onClick={() => onNavigate('ajouter', p.id)}
                      title={t('produits.card.modifComplet')}
                    >
                      <i className="fas fa-sliders" /> {t('produits.card.modifier')}
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                      onClick={() => setModalDelete(p)}
                      title={t('produits.card.supprimer')}
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