/*
 * ============================================================
 * FICHIER : src/dashboards/entreprise/pages/InventairePage.tsx
 *
 * RÔLE    : Gestion complète du stock et de l'inventaire.
 *           Connecté à l'API réelle GET /produits.
 *
 * FONCTIONNALITÉS :
 *  - Chargement des produits depuis l'API (données réelles)
 *  - Filtrage par niveau de stock (critique / faible / ok)
 *  - Recherche par nom ou référence
 *  - Modale de modification rapide du stock via PATCH /produits/:id
 *  - Alertes critiques en temps réel
 *  - Barre de progression visuelle du niveau de stock
 *  - Export CSV (simulation)
 *  - Actions rapides groupées
 * ============================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../shared/context/ToastContext';
import styles from './InventairePage.module.css';

// ─────────────────────────────────────────────────────────────
// TYPES
// Ces types correspondent exactement à ce que retourne l'API
// GET /produits (défini dans produits.service.ts → ProductResponse)
// ─────────────────────────────────────────────────────────────

interface Produit {
  id:          string;
  nom:         string;
  prix:        number;
  stock:       number;
  seuil:       number | null;   // Seuil d'alerte (null = pas défini)
  visibilite:  string;
  condition:   string;
  marque:      string | null;
  reference:   string | null;
  category:    { id: string; nom: string; icone: string | null };
  subCategory: { id: string; nom: string } | null;
  images:      { id: string; url: string; ordre: number }[];
}

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────

// URL de base de l'API (définie dans .env → VITE_API_URL)
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

// Récupère le token JWT depuis le localStorage
const token = () => localStorage.getItem('shopi_access_token') ?? '';

// ─────────────────────────────────────────────────────────────
// HELPER — Formate un nombre avec des espaces insécables
// Exemple : 1500000 → "1 500 000"
// ─────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('fr-FR');
}

// ─────────────────────────────────────────────────────────────
// HELPER — Calcule le statut de stock d'un produit
// Retourne le label et la classe CSS selon le niveau
// ─────────────────────────────────────────────────────────────
function stockStatus(stock: number, seuil: number | null, t: (key: string) => string): {
  label: string;
  cls:   'out' | 'low' | 'ok';
} {
  if (stock === 0)                          return { label: t('inventaire.status.rupture'),  cls: 'out' };
  if (seuil !== null && stock <= seuil)     return { label: t('inventaire.status.faible'),   cls: 'low' };
  if (stock < 5)                            return { label: t('inventaire.status.critique'), cls: 'low' };
  return                                           { label: t('inventaire.status.enStock'),  cls: 'ok'  };
}

// ─────────────────────────────────────────────────────────────
// HELPER — Calcule le pourcentage de remplissage pour la barre
// Barre pleine = stock >= 3× le seuil (ou 30 si pas de seuil)
// ─────────────────────────────────────────────────────────────
function stockPct(stock: number, seuil: number | null): number {
  const max = (seuil ?? 10) * 3;
  return Math.min(100, Math.round((stock / max) * 100));
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT — Modale de modification rapide du stock
//
// Permet de changer rapidement :
//  - La quantité en stock
//  - Le seuil d'alerte
// Sans quitter la page inventaire.
// Appelle PATCH /produits/:id
// ─────────────────────────────────────────────────────────────
function ModalStock({ produit, onClose, onSaved }: {
  produit:  Produit;
  onClose:  () => void;
  onSaved:  (id: string, stock: number, seuil: number | null) => void;
}) {
  const { pop } = useToast();
  const { t } = useTranslation();

  // État local du formulaire
  const [stock,   setStock]   = useState(String(produit.stock));
  const [seuil,   setSeuil]   = useState(String(produit.seuil ?? ''));
  const [loading, setLoading] = useState(false);

  // Empêche le scroll du body pendant que la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Sauvegarde via PATCH /produits/:id ──────────────────────
  async function handleSave() {
    const newStock = parseInt(stock);
    const newSeuil = seuil ? parseInt(seuil) : null;

    // Validation simple côté client
    if (isNaN(newStock) || newStock < 0) {
      pop(t('inventaire.modal.invalidStock'), 'w');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/produits/${produit.id}`, {
        method:  'PATCH',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token()}`,
        },
        body: JSON.stringify({ stock: newStock, seuil: newSeuil }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? `Erreur ${res.status}`);
      }

      // Notifie le parent pour mettre à jour l'état local
      onSaved(produit.id, newStock, newSeuil);
      pop(t('inventaire.modal.updated'), 's');
      onClose();

    } catch (e: any) {
      pop(`❌ ${e.message}`, 'e');
    } finally {
      setLoading(false);
    }
  }

  const stockNum  = parseInt(stock) || 0;
  const seuilNum  = seuil ? parseInt(seuil) : null;
  const { cls }   = stockStatus(stockNum, seuilNum, t);

  return (
    // Overlay sombre — clic dessus ferme la modale
    <div className={styles.overlay} onClick={onClose}>
      {/* Arrête la propagation pour éviter de fermer en cliquant dans la modale */}
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* ── En-tête de la modale ── */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>
              <i className="fas fa-boxes-stacked" />
              {t('inventaire.modal.title')}
            </div>
            <div className={styles.modalSub}>
              {t('inventaire.modal.subtitle')}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* ── Corps de la modale ── */}
        <div className={styles.modalBody}>

          {/* Résumé du produit */}
          <div className={styles.prodResume}>
            {/* Miniature image ou placeholder emoji */}
            {produit.images[0] ? (
              <img
                src={produit.images[0].url}
                alt={produit.nom}
                className={styles.prodThumb}
              />
            ) : (
              <div className={styles.prodThumbEmpty}>
                <i className="fas fa-image" />
              </div>
            )}
            <div className={styles.prodInfo}>
              <div className={styles.prodNom}>{produit.nom}</div>
              <div className={styles.prodMeta}>
                {/* Catégorie */}
                <span>{produit.category.icone} {produit.category.nom}</span>
                {/* Référence SKU si disponible */}
                {produit.reference && (
                  <span><i className="fas fa-barcode" /> {produit.reference}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Champ stock actuel ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <i className="fas fa-cube" />
              {t('inventaire.modal.quantite')}
            </label>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                className={styles.formInput}
                value={stock}
                min={0}
                onChange={e => setStock(e.target.value)}
                placeholder={t('inventaire.modal.placeholder1')}
              />
              <span className={styles.inputUnit}>{t('inventaire.modal.unites')}</span>
            </div>
            {/* Aperçu du nouveau statut en temps réel */}
            {stock && (
              <div className={`${styles.statusPreview} ${styles[`status_${cls}`]}`}>
                <span className={styles.statusDot} />
                {t('inventaire.modal.nouveauStatut')} <strong>{stockStatus(parseInt(stock) || 0, seuilNum, t).label}</strong>
              </div>
            )}
          </div>

          {/* ── Champ seuil d'alerte ── */}
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              <i className="fas fa-bell" />
              {t('inventaire.modal.seuilAlerte')}
            </label>
            <div className={styles.inputWithUnit}>
              <input
                type="number"
                className={styles.formInput}
                value={seuil}
                min={0}
                onChange={e => setSeuil(e.target.value)}
                placeholder={t('inventaire.modal.seuilPlaceholder')}
              />
              <span className={styles.inputUnit}>{t('inventaire.modal.unites')}</span>
            </div>
            {/* Explication du seuil */}
            <p className={styles.formHint}>
              <i className="fas fa-circle-info" />
              {t('inventaire.modal.seuilHint')}
            </p>
          </div>

          {/* Barre de progression visuelle */}
          <div className={styles.stockVisuel}>
            <div className={styles.stockBarLabel}>
              <span>{t('inventaire.modal.niveauStock')}</span>
              <span className={styles.stockBarPct}>{stockPct(parseInt(stock) || 0, seuilNum)}%</span>
            </div>
            <div className={styles.stockBar}>
              <div
                className={`${styles.stockBarFill} ${styles[`fill_${cls}`]}`}
                style={{ width: `${stockPct(parseInt(stock) || 0, seuilNum)}%` }}
              />
            </div>
          </div>

        </div>

        {/* ── Pied de la modale ── */}
        <div className={styles.modalFooter}>
          <button
            className={styles.btnSecondary}
            onClick={onClose}
            disabled={loading}
          >
            {t('inventaire.modal.annuler')}
          </button>
          <button
            className={styles.btnPrimary}
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? <><i className="fas fa-spinner fa-spin" /> {t('inventaire.modal.saving')}</>
              : <><i className="fas fa-check" /> {t('inventaire.modal.update')}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL — InventairePage
// ─────────────────────────────────────────────────────────────
export default function InventairePage() {
  const { pop } = useToast();
  const { t } = useTranslation();

  // ── États principaux ─────────────────────────────────────────
  const [produits,  setProduits]  = useState<Produit[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [erreur,    setErreur]    = useState<string | null>(null);

  // Filtre actif : 'all' | 'out' | 'low' | 'ok'
  const [filtre,    setFiltre]    = useState<'all' | 'out' | 'low' | 'ok'>('all');

  // Texte de recherche
  const [search,    setSearch]    = useState('');

  // Produit en cours de modification (null = modale fermée)
  const [modalProd, setModalProd] = useState<Produit | null>(null);

  // ── Chargement des produits depuis l'API ─────────────────────
  const charger = useCallback(async () => {
    setLoading(true);
    setErreur(null);
    try {
      const res = await fetch(`${API}/produits?limit=100`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const data = await res.json();
      // L'API retourne { data: Produit[], total, page, pages }
      setProduits(data.data ?? []);
    } catch (e: any) {
      setErreur(e.message ?? 'Impossible de charger les produits.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Charge les produits au montage du composant
  useEffect(() => { charger(); }, [charger]);

  // ── Mise à jour locale après modification du stock ────────────
  // Évite un rechargement complet de la page
  function handleStockSaved(id: string, stock: number, seuil: number | null) {
    setProduits(prev =>
      prev.map(p => p.id === id ? { ...p, stock, seuil } : p)
    );
  }

  // ── Calcul des statistiques ───────────────────────────────────
  // Calculées depuis les données réelles, pas des mockData
  const stats = {
    total:      produits.length,
    rupture:    produits.filter(p => p.stock === 0).length,
    faible:     produits.filter(p => p.stock > 0 && p.seuil !== null && p.stock <= p.seuil).length,
    critique:   produits.filter(p => p.stock > 0 && p.stock < 5 && (p.seuil === null || p.stock > p.seuil)).length,
    totalUnits: produits.reduce((acc, p) => acc + p.stock, 0),
    valeurStock:produits.reduce((acc, p) => acc + (p.prix * p.stock), 0),
  };

  // ── Filtrage et recherche ─────────────────────────────────────
  const produitsFiltres = produits.filter(p => {
    // Filtre par niveau de stock
    const matchFiltre = (() => {
      if (filtre === 'all') return true;
      if (filtre === 'out') return p.stock === 0;
      if (filtre === 'low') return p.stock > 0 && p.seuil !== null && p.stock <= p.seuil;
      if (filtre === 'ok')  return p.stock > (p.seuil ?? 4);
      return true;
    })();

    // Filtre par texte (nom, marque, référence)
    const matchSearch = !search.trim() ||
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      (p.marque ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.reference ?? '').toLowerCase().includes(search.toLowerCase());

    return matchFiltre && matchSearch;
  });

  // ── Alertes critiques — produits en rupture ou sous seuil ─────
  const alertes = produits
    .filter(p => p.stock === 0 || (p.seuil !== null && p.stock <= p.seuil))
    .sort((a, b) => a.stock - b.stock) // Les plus critiques en premier
    .slice(0, 8); // Maximum 8 alertes affichées

  // ─────────────────────────────────────────────────────────────
  // RENDU
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ════════════════════════════════════════════════════════
          EN-TÊTE DE PAGE
          ════════════════════════════════════════════════════════ */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.titre}>{t('inventaire.header.title')}</h1>
          <p className={styles.sousTitre}>
            {t('inventaire.header.subtitle')}
          </p>
        </div>
        {/* Actions de la barre du haut */}
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondaryOutline}
            onClick={() => pop(t('inventaire.header.exportToast'), 's')}
          >
            <i className="fas fa-file-export" /> {t('inventaire.header.exportCsv')}
          </button>
          <button
            className={styles.btnRecharger}
            onClick={charger}
            disabled={loading}
          >
            <i className={`fas fa-rotate-right ${loading ? 'fa-spin' : ''}`} />
            {loading ? t('inventaire.header.loading') : t('inventaire.header.refresh')}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          CARTES STATISTIQUES
          4 KPIs visibles en un coup d'œil
          ════════════════════════════════════════════════════════ */}
      <div className={styles.statsGrid}>

        {/* Total produits */}
        <div className={`${styles.statCard} ${styles.statBlue}`}>
          <div className={styles.statLeft}>
            <div className={styles.statIcon}>
              <i className="fas fa-box" />
            </div>
          </div>
          <div className={styles.statRight}>
            <div className={styles.statVal}>{stats.total}</div>
            <div className={styles.statLabel}>{t('inventaire.stats.produitsCatalogues')}</div>
            <div className={styles.statSub}>{t('inventaire.stats.unitesTotal', { count: fmt(stats.totalUnits) })}</div>
          </div>
        </div>

        {/* Ruptures de stock — alerte rouge */}
        <div className={`${styles.statCard} ${styles.statRose}`}>
          <div className={styles.statLeft}>
            <div className={styles.statIcon}>
              <i className="fas fa-circle-xmark" />
            </div>
          </div>
          <div className={styles.statRight}>
            <div className={styles.statVal}>{stats.rupture}</div>
            <div className={styles.statLabel}>{t('inventaire.stats.rupturesStock')}</div>
            <div className={styles.statSub}>
              {stats.rupture === 0 ? t('inventaire.stats.aucuneRupture') : t('inventaire.stats.actionRequise')}
            </div>
          </div>
          {/* Badge pulsant si ruptures */}
          {stats.rupture > 0 && <div className={styles.pulseDot} />}
        </div>

        {/* Stocks faibles — alerte orange */}
        <div className={`${styles.statCard} ${styles.statAmber}`}>
          <div className={styles.statLeft}>
            <div className={styles.statIcon}>
              <i className="fas fa-triangle-exclamation" />
            </div>
          </div>
          <div className={styles.statRight}>
            <div className={styles.statVal}>{stats.faible + stats.critique}</div>
            <div className={styles.statLabel}>{t('inventaire.stats.stocksFaibles')}</div>
            <div className={styles.statSub}>{t('inventaire.stats.sousLeSeuil')}</div>
          </div>
        </div>

        {/* Valeur totale du stock */}
        <div className={`${styles.statCard} ${styles.statGreen}`}>
          <div className={styles.statLeft}>
            <div className={styles.statIcon}>
              <i className="fas fa-chart-line" />
            </div>
          </div>
          <div className={styles.statRight}>
            {/* Valeur en millions de GNF pour lisibilité */}
            <div className={styles.statVal}>
              {stats.valeurStock >= 1_000_000
                ? `${(stats.valeurStock / 1_000_000).toFixed(1)}M`
                : fmt(stats.valeurStock)
              }
            </div>
            <div className={styles.statLabel}>{t('inventaire.stats.valeurStock')}</div>
            <div className={styles.statSub}>{t('inventaire.stats.prixParQuantite')}</div>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          LAYOUT PRINCIPAL : Tableau + Panneau latéral
          Le tableau prend 2/3 de l'espace, le panneau 1/3
          ════════════════════════════════════════════════════════ */}
      <div className={styles.layout}>

        {/* ────────────────────────────────────────────────────
            COLONNE PRINCIPALE : Tableau inventaire
            ──────────────────────────────────────────────────── */}
        <div className={styles.colMain}>

          {/* ── Barre filtres + recherche ── */}
          <div className={styles.toolbar}>

            {/* Boutons de filtre par niveau de stock */}
            <div className={styles.filtresBtns}>
              {[
                { val: 'all', label: t('inventaire.filters.tous'),    count: stats.total },
                { val: 'out', label: t('inventaire.filters.rupture'), count: stats.rupture },
                { val: 'low', label: t('inventaire.filters.faibles'), count: stats.faible + stats.critique },
                { val: 'ok',  label: t('inventaire.filters.enStock'), count: stats.total - stats.rupture - stats.faible - stats.critique },
              ].map(f => (
                <button
                  key={f.val}
                  className={`${styles.filtreBtn} ${filtre === f.val ? styles.filtreBtnActive : ''}`}
                  onClick={() => setFiltre(f.val as any)}
                >
                  {f.label}
                  {/* Badge avec le nombre */}
                  <span className={styles.filtreCount}>{f.count}</span>
                </button>
              ))}
            </div>

            {/* Barre de recherche */}
            <div className={styles.searchWrap}>
              <i className="fas fa-magnifying-glass" />
              <input
                className={styles.searchInput}
                placeholder={t('inventaire.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className={styles.clearBtn}
                  onClick={() => setSearch('')}
                >
                  <i className="fas fa-xmark" />
                </button>
              )}
            </div>
          </div>

          {/* ── Tableau inventaire ── */}
          {loading ? (
            // État de chargement
            <div className={styles.stateBox}>
              <i className="fas fa-spinner fa-spin" style={{ fontSize: 24, color: 'var(--t2)' }} />
              <span>{t('inventaire.loadingInventaire')}</span>
            </div>
          ) : erreur ? (
            // État d'erreur
            <div className={styles.stateBox}>
              <i className="fas fa-triangle-exclamation" style={{ fontSize: 24, color: 'var(--t2)' }} />
              <span style={{ color: 'var(--t2)' }}>{erreur}</span>
              <button className={styles.btnRecharger} onClick={charger}>
                <i className="fas fa-rotate-right" /> {t('inventaire.retry')}
              </button>
            </div>
          ) : produitsFiltres.length === 0 ? (
            // État vide
            <div className={styles.stateBox}>
              <span style={{ fontSize: 40 }}>📦</span>
              <strong style={{ color: 'var(--navy)' }}>
                {produits.length === 0 ? t('inventaire.empty.noneTitle') : t('inventaire.empty.noResultsTitle')}
              </strong>
              <span style={{ fontSize: 13, color: 'var(--t3)' }}>
                {produits.length === 0
                  ? t('inventaire.empty.noneSub')
                  : t('inventaire.empty.noResultsSub')}
              </span>
            </div>
          ) : (
            // Tableau des produits
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>{t('inventaire.table.produit')}</th>
                    <th className={styles.th}>{t('inventaire.table.categorie')}</th>
                    <th className={styles.th}>{t('inventaire.table.prixUnitaire')}</th>
                    <th className={styles.th}>{t('inventaire.table.stockActuel')}</th>
                    <th className={styles.th}>{t('inventaire.table.niveauVisuel')}</th>
                    <th className={styles.th}>{t('inventaire.table.statut')}</th>
                    <th className={styles.th}>{t('inventaire.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {produitsFiltres.map(p => {
                    // Calcule le statut pour ce produit
                    const { label, cls } = stockStatus(p.stock, p.seuil, t);
                    // Calcule le % pour la barre de progression
                    const pct = stockPct(p.stock, p.seuil);

                    return (
                      <tr key={p.id} className={styles.tr}>

                        {/* ── Colonne : Produit (image + nom + référence) ── */}
                        <td className={styles.td}>
                          <div className={styles.prodCell}>
                            {/* Miniature image ou placeholder */}
                            {p.images[0] ? (
                              <img
                                src={p.images[0].url}
                                alt={p.nom}
                                className={styles.prodImg}
                              />
                            ) : (
                              <div className={styles.prodImgEmpty}>
                                <i className="fas fa-image" />
                              </div>
                            )}
                            <div>
                              <div className={styles.prodNomTable}>{p.nom}</div>
                              {/* Référence SKU sous le nom */}
                              {p.reference && (
                                <div className={styles.prodRef}>
                                  <i className="fas fa-barcode" /> {p.reference}
                                </div>
                              )}
                              {/* Marque si disponible */}
                              {p.marque && (
                                <div className={styles.prodMarque}>{p.marque}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ── Colonne : Catégorie ── */}
                        <td className={styles.td}>
                          <span className={styles.catTag}>
                            {p.category.icone} {p.category.nom}
                          </span>
                          {p.subCategory && (
                            <div className={styles.subCatTag}>
                              › {p.subCategory.nom}
                            </div>
                          )}
                        </td>

                        {/* ── Colonne : Prix unitaire ── */}
                        <td className={styles.td}>
                          <div className={styles.prixCell}>{fmt(p.prix)} GNF</div>
                          {/* Valeur totale du stock pour ce produit */}
                          <div className={styles.prixSub}>
                            {t('inventaire.table.valeurStockLigne', { montant: fmt(p.prix * p.stock) })}
                          </div>
                        </td>

                        {/* ── Colonne : Stock actuel (chiffre coloré) ── */}
                        <td className={styles.td}>
                          <div className={styles.stockCell}>
                            {/* Grand chiffre coloré selon le statut */}
                            <span className={`${styles.stockNum} ${styles[`stockNum_${cls}`]}`}>
                              {p.stock}
                            </span>
                            <span className={styles.stockUnit}>{t('inventaire.modal.unites')}</span>
                          </div>
                          {/* Seuil d'alerte affiché en dessous si défini */}
                          {p.seuil !== null && (
                            <div className={styles.seuilLabel}>
                              <i className="fas fa-bell" /> {t('inventaire.table.seuil', { count: p.seuil })}
                            </div>
                          )}
                        </td>

                        {/* ── Colonne : Barre de progression visuelle ── */}
                        <td className={styles.td}>
                          <div className={styles.barWrap}>
                            {/* Pourcentage au-dessus de la barre */}
                            <div className={styles.barPct}>{pct}%</div>
                            {/* Barre colorée selon le statut */}
                            <div className={styles.bar}>
                              <div
                                className={`${styles.barFill} ${styles[`barFill_${cls}`]}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* ── Colonne : Badge de statut ── */}
                        <td className={styles.td}>
                          <span className={`${styles.badge} ${styles[`badge_${cls}`]}`}>
                            {/* Icône selon le statut */}
                            <i className={`fas ${
                              cls === 'out' ? 'fa-circle-xmark' :
                              cls === 'low' ? 'fa-triangle-exclamation' :
                              'fa-circle-check'
                            }`} />
                            {label}
                          </span>
                        </td>

                        {/* ── Colonne : Boutons d'action ── */}
                        <td className={styles.td}>
                          <div className={styles.actions}>
                            {/* Bouton principal : modifier le stock */}
                            <button
                              className={styles.btnModif}
                              onClick={() => setModalProd(p)}
                              title={t('inventaire.table.modifierTitle')}
                            >
                              <i className="fas fa-pen" /> {t('inventaire.table.modifier')}
                            </button>
                            {/* Bouton réappro (simulation) */}
                            <button
                              className={styles.btnReappro}
                              onClick={() => pop(t('inventaire.table.reapproToast', { nom: p.nom }), 's')}
                              title={t('inventaire.table.reapproTitle')}
                            >
                              <i className="fas fa-truck" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pied du tableau : compteur de résultats */}
              <div className={styles.tableFooter}>
                <span>
                  {t('inventaire.footer.count', { count: produitsFiltres.length })}
                  {filtre !== 'all' && ` ${t('inventaire.footer.filtres')}`}
                  {search && ` ${t('inventaire.footer.pourRecherche', { search })}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ────────────────────────────────────────────────────
            PANNEAU LATÉRAL DROIT : Alertes + Actions rapides
            ──────────────────────────────────────────────────── */}
        <div className={styles.colSide}>

          {/* ── Alertes critiques ── */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <div className={styles.sideCardTitle}>
                <i className="fas fa-bell" />
                {t('inventaire.alertes.title')}
              </div>
              {/* Nombre d'alertes */}
              {alertes.length > 0 && (
                <span className={styles.alerteBadge}>{alertes.length}</span>
              )}
            </div>
            <div className={styles.sideCardBody}>
              {alertes.length === 0 ? (
                // Aucune alerte : message positif
                <div className={styles.noAlerte}>
                  <span>✅</span>
                  <div>
                    <strong>{t('inventaire.alertes.allGood')}</strong>
                    <p>{t('inventaire.alertes.noneDetected')}</p>
                  </div>
                </div>
              ) : (
                // Liste des alertes
                <div className={styles.alerteList}>
                  {alertes.map(p => {
                    const { cls } = stockStatus(p.stock, p.seuil, t);
                    return (
                      <div key={p.id} className={`${styles.alerteItem} ${styles[`alerte_${cls}`]}`}>
                        {/* Icône selon criticité */}
                        <div className={styles.alerteIco}>
                          <i className={`fas ${cls === 'out' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}`} />
                        </div>
                        {/* Nom + stock */}
                        <div className={styles.alerteInfo}>
                          <div className={styles.alerteNom}>{p.nom}</div>
                          <div className={styles.alerteSub}>
                            {t('inventaire.alertes.stock')} <strong>{p.stock}</strong>
                            {p.seuil !== null && ` ${t('inventaire.alertes.min', { count: p.seuil })}`}
                          </div>
                        </div>
                        {/* Bouton action rapide */}
                        <button
                          className={styles.alerteAction}
                          onClick={() => setModalProd(p)}
                          title={t('inventaire.table.modifierTitle')}
                        >
                          <i className="fas fa-pen" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Actions rapides ── */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <div className={styles.sideCardTitle}>
                <i className="fas fa-bolt" />
                {t('inventaire.quickActions.title')}
              </div>
            </div>
            <div className={styles.sideCardBody}>
              <div className={styles.actionsList}>
                {[
                  {
                    ico:    '📦',
                    label:  t('inventaire.quickActions.reapproAll'),
                    sub:    t('inventaire.quickActions.reapproAllSub', { count: stats.rupture + stats.faible }),
                    action: t('inventaire.quickActions.reapproAllToast'),
                    type:   's' as const,
                  },
                  {
                    ico:    '📊',
                    label:  t('inventaire.quickActions.exportInventaire'),
                    sub:    t('inventaire.quickActions.exportInventaireSub', { count: stats.total, units: fmt(stats.totalUnits) }),
                    action: t('inventaire.quickActions.exportInventaireToast'),
                    type:   'i' as const,
                  },
                  {
                    ico:    '🔔',
                    label:  t('inventaire.quickActions.configAlertes'),
                    sub:    t('inventaire.quickActions.configAlertesSub'),
                    action: t('inventaire.quickActions.configAlertesToast'),
                    type:   'i' as const,
                  },
                  {
                    ico:    '🔄',
                    label:  t('inventaire.quickActions.syncStock'),
                    sub:    t('inventaire.quickActions.syncStockSub'),
                    action: t('inventaire.quickActions.syncStockToast'),
                    type:   'i' as const,
                  },
                ].map((a, i) => (
                  <button
                    key={i}
                    className={styles.quickAction}
                    onClick={() => pop(a.action, a.type)}
                  >
                    <span className={styles.quickActionIco}>{a.ico}</span>
                    <div className={styles.quickActionText}>
                      <div className={styles.quickActionLabel}>{a.label}</div>
                      <div className={styles.quickActionSub}>{a.sub}</div>
                    </div>
                    <i className="fas fa-arrow-right" />
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          MODALE DE MODIFICATION DU STOCK
          Affichée quand modalProd n'est pas null
          ════════════════════════════════════════════════════════ */}
      {modalProd && (
        <ModalStock
          produit={modalProd}
          onClose={() => setModalProd(null)}
          onSaved={handleStockSaved}
        />
      )}
    </div>
  );
}