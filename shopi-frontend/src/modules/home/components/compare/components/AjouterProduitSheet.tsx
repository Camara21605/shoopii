/* ================================================================
 * FICHIER : src/modules/home/components/compare/components/AjouterProduitSheet.tsx
 *
 * RÔLE : Feuille « Ajouter un produit » de la page /comparer.
 *        Ne propose QUE des produits de la même catégorie que ceux déjà
 *        comparés — et par défaut de la même sous-catégorie (puce
 *        « Toute la catégorie » pour élargir). Recherche dans ce périmètre,
 *        classement par pertinence côté serveur (prix proche, même marque…).
 *        Bas d'écran sur téléphone, fenêtre centrée sur ordinateur.
 * ================================================================ */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCompare, MAX_COMPARE } from '../../../../../shared/context/CompareContext';
import { categoryName, subCategoryName } from '../../../../../shared/utils/catalogueCase';
import type { ProduitApi } from '../../produit/pages/ProduitPage';
import { useComparables } from '../hooks/useComparables';
import { remisePct } from '../utils/compareInsights';
import styles from './AjouterProduitSheet.module.css';

/** Monté uniquement quand la feuille est ouverte (recherche remise à zéro
 *  à chaque ouverture, aucun appel réseau tant qu'elle est fermée). */
interface Props {
  onClose:    () => void;
  /** Produits actuellement comparés (pour l'écart de prix et la marque) */
  compares:   ProduitApi[];
  onToast:    (msg: string, type?: 's' | 'i' | 'w' | 'e') => void;
}

function fmt(n: number) { return `${n.toLocaleString('fr-FR')} GNF`; }

export default function AjouterProduitSheet({ onClose, compares, onToast }: Props) {
  const { t } = useTranslation();
  const { ids, add, count } = useCompare();
  const [scope,  setScope]  = useState<'sub' | 'cat'>('sub');
  const [search, setSearch] = useState('');

  const { res, loading, error } = useComparables(ids, { scope, search, limit: 24 });

  /* Fermeture au clavier + blocage du défilement de la page derrière */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const places   = MAX_COMPARE - count;
  const prixMoy  = compares.length ? compares.reduce((s, p) => s + p.prix, 0) / compares.length : 0;
  const marques  = new Set(compares.map(p => (p.marque ?? '').trim().toLowerCase()).filter(Boolean));
  const list     = (res?.data ?? []).filter(p => !ids.includes(p.id));
  const sousCat  = res?.sousCategorie;
  const cat      = res?.categorie;

  const handleAdd = (p: ProduitApi) => {
    const r = add(p.id, {
      categoryId: p.category?.id ?? null, categoryNom: p.category?.nom ?? null,
      subCategoryId: p.subCategory?.id ?? null, subCategoryNom: p.subCategory?.nom ?? null,
    });
    if (r.full) { onToast(t('compare.pleinToast', { max: MAX_COMPARE }), 'w'); return; }
    if (r.mismatch !== undefined && r.mismatch !== null) { onToast(t('compare.autreCategorieToast'), 'w'); return; }
    if (r.added) {
      onToast(t('compare.ajouteToast', { nom: p.nom }), 's');
      if (places - 1 <= 0) onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('compare.ajouterProduit')} onClick={e => e.stopPropagation()}>
        <div className={styles.grip} aria-hidden="true" />

        <div className={styles.head}>
          <div>
            <div className={styles.titre}>{t('compare.ajouterProduit')}</div>
            <div className={styles.sub}>
              {t('compare.placesRestantes', { count: places })}
              {cat?.nom && <> · <b>{categoryName(cat.nom)}</b></>}
            </div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label={t('compare.fermer')}>
            <i className="fas fa-xmark" />
          </button>
        </div>

        {/* Périmètre : même sous-catégorie ↔ toute la catégorie */}
        {(sousCat || scope === 'cat') && (
          <div className={styles.chips}>
            {sousCat && (
              <button className={`${styles.chip} ${res?.scope === 'sub' ? styles.chipOn : ''}`} onClick={() => setScope('sub')}>
                <i className="fas fa-layer-group" /> {subCategoryName(sousCat.nom)}
              </button>
            )}
            <button className={`${styles.chip} ${res?.scope === 'cat' ? styles.chipOn : ''}`} onClick={() => setScope('cat')}>
              <i className="fas fa-folder-open" /> {t('compare.touteCategorie')}
            </button>
          </div>
        )}

        <label className={styles.searchBox}>
          <i className="fas fa-magnifying-glass" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('compare.rechercherDans', { categorie: cat?.nom ? categoryName(cat.nom) : '' })}
            autoComplete="off"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label={t('compare.effacer')}><i className="fas fa-circle-xmark" /></button>
          )}
        </label>

        {res?.fallback && <div className={styles.note}><i className="fas fa-circle-info" /> {t('compare.elargiNote')}</div>}

        <div className={styles.list}>
          {loading && list.length === 0 ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className={styles.skeleton} />)
          ) : error ? (
            <div className={styles.empty}>{t('compare.erreurSuggestions')}</div>
          ) : list.length === 0 ? (
            <div className={styles.empty}>
              <i className="fas fa-box-open" />
              <span>{search ? t('compare.aucunResultat', { q: search }) : t('compare.aucunComparable')}</span>
              {res?.scope === 'sub' && sousCat && (
                <button className={styles.linkBtn} onClick={() => setScope('cat')}>{t('compare.voirToutCategorie')}</button>
              )}
            </div>
          ) : list.map(p => {
            const img   = p.images.slice().sort((a, b) => a.ordre - b.ordre)[0]?.url;
            const ecart = prixMoy > 0 ? Math.round(((p.prix - prixMoy) / prixMoy) * 100) : 0;
            const memeMarque = !!p.marque && marques.has(p.marque.trim().toLowerCase());
            const remise = remisePct(p);
            return (
              <div key={p.id} className={styles.item}>
                <div className={styles.thumb}>
                  {img ? <img src={img} alt="" loading="lazy" /> : <i className="fas fa-box-open" />}
                </div>
                <div className={styles.info}>
                  <div className={styles.nom}>{p.nom}</div>
                  <div className={styles.shop}>{p.companyName}{p.companyVerified && <i className="fas fa-circle-check" />}</div>
                  <div className={styles.priceRow}>
                    <span className={styles.prix}>{fmt(p.prix)}</span>
                    {compares.length > 0 && ecart !== 0 && (
                      <span className={ecart < 0 ? styles.moins : styles.plus}>
                        {ecart < 0 ? '−' : '+'}{Math.abs(ecart)} %
                      </span>
                    )}
                  </div>
                  <div className={styles.tags}>
                    {res?.scope === 'cat' && p.subCategory?.nom && <span className={styles.tag}>{subCategoryName(p.subCategory.nom)}</span>}
                    {memeMarque && <span className={styles.tag}>{t('compare.memeMarque')}</span>}
                    {remise > 0 && <span className={`${styles.tag} ${styles.tagPromo}`}>−{remise} %</span>}
                    {p.stock <= 0 && <span className={`${styles.tag} ${styles.tagOut}`}>{t('compare.ruptureStock')}</span>}
                  </div>
                </div>
                <button className={styles.addBtn} onClick={() => handleAdd(p)} disabled={places <= 0} aria-label={t('compare.ajouterA', { nom: p.nom })}>
                  <i className="fas fa-plus" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
