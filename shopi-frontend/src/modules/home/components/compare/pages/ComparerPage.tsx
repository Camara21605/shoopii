/* ================================================================
 * FICHIER : src/modules/home/components/compare/pages/ComparerPage.tsx
 *
 * RÔLE : Page "/comparer" — affiche côte à côte les produits ajoutés
 *        via le bouton ⚖️ "Comparer" (voir CompareContext.tsx).
 *        Purement local (localStorage, pas de compte requis).
 *
 * LISIBILITÉ :
 *   - colonnes de largeur FIXE (2 produits côte à côte sur un téléphone,
 *     pas de colonnes démesurées sur ordinateur) ;
 *   - « Meilleur prix » sur le produit le moins cher ;
 *   - « Seulement les différences » masque les lignes identiques ;
 *   - colonne « Ajouter un produit » tant qu'il reste de la place.
 * ================================================================ */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../../layout/Header';
import { useCompare, MAX_COMPARE } from '../../../../../shared/context/CompareContext';
import { useCart } from '../../../../../shared/context/CartContext';
import { produitApi } from '../../produit/api/produit.api';
import type { ProduitApi } from '../../produit/pages/ProduitPage';

import styles from './ComparerPage.module.css';
import { categoryName } from '../../../../../shared/utils/catalogueCase';

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

/** Une ligne du tableau : valeur affichée + valeur de comparaison (pour « différences »). */
interface Row { key: string; label: string; cells: { node: ReactNode; cmp: string }[] }

function fmtPrix(n: number): string {
  return `${n.toLocaleString('fr-FR')} GNF`;
}

export default function ComparerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { ids, remove, clear } = useCompare();
  const { addToCart } = useCart();

  const [produits,  setProduits]  = useState<ProduitApi[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState<ToastState | null>(null);
  const [diffsOnly, setDiffsOnly] = useState(false);

  const showToast = (msg: string, type: ToastState['type'] = 'i') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    if (ids.length === 0) { setProduits([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    Promise.all(ids.map(id => produitApi.getById(id).catch(() => null)))
      .then(list => {
        if (cancelled) return;
        setProduits(list.filter((p): p is ProduitApi => p !== null));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [ids]);

  const handleAddToCart = async (produitId: string) => {
    try {
      await addToCart(produitId, 1);
      showToast(t('compare.ajouteAuPanierToast'), 's');
    } catch (err: any) {
      showToast(err?.message ?? t('compare.ajoutEchecToast'), 'e');
    }
  };

  /* Prix le plus bas (seulement s'il départage vraiment les produits) */
  const minPrix = produits.length > 1 ? Math.min(...produits.map(p => p.prix)) : null;
  const prixDifferents = produits.length > 1 && new Set(produits.map(p => p.prix)).size > 1;

  const etatLabel = (c: string | null | undefined) =>
    c ? t(`compare.etats.${c}`, { defaultValue: c.charAt(0).toUpperCase() + c.slice(1) }) : '—';

  /* Lignes du tableau (les valeurs de comparaison servent au filtre « différences ») */
  const rows: Row[] = useMemo(() => {
    const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
    const base: Row[] = [
      {
        key: 'prix', label: t('compare.prix'),
        cells: produits.map(p => ({
          cmp: String(p.prix),
          node: (
            <>
              <span className={styles.prix}>{fmtPrix(p.prix)}</span>
              {p.prixAncien && p.prixAncien > p.prix && <span className={styles.prixAncien}>{fmtPrix(p.prixAncien)}</span>}
              {prixDifferents && p.prix === minPrix && <span className={styles.bestBadge}><i className="fas fa-tag" /> {t('compare.meilleurPrix')}</span>}
            </>
          ),
        })),
      },
      {
        key: 'boutique', label: t('compare.boutique'),
        cells: produits.map(p => ({
          cmp: p.companyId,
          node: <span className={styles.link} onClick={() => navigate(`/boutique/${p.companyId}`)}>{p.companyName}</span>,
        })),
      },
      { key: 'categorie', label: t('compare.categorie'), cells: produits.map(p => { const v = p.category?.nom ? categoryName(p.category.nom) : '—'; return { cmp: v, node: v }; }) },
      { key: 'marque',    label: t('compare.marque'),    cells: produits.map(p => ({ cmp: txt(p.marque),   node: txt(p.marque) })) },
      { key: 'etat',      label: t('compare.etat'),      cells: produits.map(p => ({ cmp: txt(p.condition), node: etatLabel(p.condition) })) },
      { key: 'garantie',  label: t('compare.garantie'),  cells: produits.map(p => ({ cmp: txt(p.garantie), node: txt(p.garantie) })) },
      {
        key: 'stock', label: t('compare.stock'),
        cells: produits.map(p => ({
          cmp: p.stock > 0 ? 'ok' : 'out',
          node: p.stock > 0
            ? <span className={styles.stockOk}>{t('compare.enStock', { count: p.stock })}</span>
            : <span className={styles.stockOut}>{t('compare.ruptureStock')}</span>,
        })),
      },
    ];
    /* Caractéristiques : union de celles de tous les produits */
    const specKeys = Array.from(new Set(produits.flatMap(p => p.specs.map(s => s.cle))));
    const specs: Row[] = specKeys.map(cle => ({
      key: `spec:${cle}`, label: cle,
      cells: produits.map(p => { const v = txt(p.specs.find(s => s.cle === cle)?.valeur); return { cmp: v, node: v }; }),
    }));
    return [...base, ...(specs.length ? [{ key: 'sep', label: t('compare.caracteristiques'), cells: [] }] : []), ...specs];
  }, [produits, t, navigate, minPrix, prixDifferents]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDiff = (r: Row) => new Set(r.cells.map(c => c.cmp)).size > 1;
  const visibleRows = diffsOnly
    ? rows.filter(r => r.key === 'sep' ? rows.some(x => x.key.startsWith('spec:') && isDiff(x)) : isDiff(r))
    : rows;
  const places = Math.max(0, MAX_COMPARE - produits.length);

  return (
    <div className={styles.page}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />

      <main className={styles.main}>
        <div className={styles.headRow}>
          <h1 className={styles.titre}>
            <i className="fas fa-code-compare" /> {t('compare.titre')}
          </h1>
          {produits.length > 0 && (
            <button className={styles.clearBtn} onClick={() => clear()}>
              <i className="fas fa-trash-can" /> {t('compare.toutRetirer')}
            </button>
          )}
        </div>

        {loading ? (
          <div className={styles.empty}>
            <i className="fas fa-spinner fa-spin" />
          </div>
        ) : produits.length === 0 ? (
          <div className={styles.empty}>
            <i className="fas fa-code-compare" />
            <div className={styles.emptyTitre}>{t('compare.videTitre')}</div>
            <div className={styles.emptySub}>{t('compare.videSub')}</div>
            <button className={styles.emptyBtn} onClick={() => navigate('/explorer')}>
              <i className="fas fa-magnifying-glass" /> {t('compare.explorerBtn')}
            </button>
          </div>
        ) : (
          <>
            {/* Barre d'options */}
            <div className={styles.toolbar}>
              <span className={styles.count}>{t('compare.produitsCount', { count: produits.length, max: MAX_COMPARE })}</span>
              {produits.length > 1 && (
                <label className={styles.diffToggle}>
                  <input type="checkbox" checked={diffsOnly} onChange={e => setDiffsOnly(e.target.checked)} />
                  {t('compare.differencesSeules')}
                </label>
              )}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={`${styles.rowLabel} ${styles.cornerCell}`} aria-hidden="true" />
                    {produits.map(p => {
                      const img = p.images.slice().sort((a, b) => a.ordre - b.ordre)[0]?.url;
                      return (
                        <th key={p.id} className={styles.colHead}>
                          <button className={styles.removeBtn} onClick={() => remove(p.id)} title={t('compare.retirer')} aria-label={t('compare.retirer')}>
                            <i className="fas fa-xmark" />
                          </button>
                          <div className={styles.colImg} onClick={() => navigate(`/produit/${p.id}`)}>
                            {img
                              ? <img src={img} alt={p.nom} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                              : <i className="fas fa-box-open" aria-hidden="true" />}
                          </div>
                          <div className={styles.colNom} title={p.nom} onClick={() => navigate(`/produit/${p.id}`)}>{p.nom}</div>
                          <button className={styles.colCartBtn} onClick={() => handleAddToCart(p.id)} disabled={p.stock <= 0}>
                            <i className="fas fa-cart-plus" /> <span>{t('compare.ajouterPanier')}</span>
                          </button>
                        </th>
                      );
                    })}
                    {places > 0 && (
                      <th className={`${styles.colHead} ${styles.addCol}`}>
                        <button className={styles.addBtn} onClick={() => navigate('/explorer')}>
                          <i className="fas fa-plus" />
                          <span>{t('compare.ajouterProduit')}</span>
                          <small>{t('compare.placesRestantes', { count: places })}</small>
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(r => r.key === 'sep' ? (
                    <tr key="sep">
                      <td colSpan={produits.length + 1 + (places > 0 ? 1 : 0)} className={styles.sectionSep}>{r.label}</td>
                    </tr>
                  ) : (
                    <tr key={r.key} className={!diffsOnly && produits.length > 1 && isDiff(r) ? styles.rowDiff : undefined}>
                      <td className={styles.rowLabel}>{r.label}</td>
                      {r.cells.map((c, i) => <td key={produits[i].id} className={styles.cell}>{c.node}</td>)}
                      {places > 0 && <td className={`${styles.cell} ${styles.addColCell}`} />}
                    </tr>
                  ))}
                  {diffsOnly && visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={produits.length + 1 + (places > 0 ? 1 : 0)} className={styles.noDiff}>{t('compare.aucuneDifference')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {toast && (
        <div className={`${styles.toast} ${styles['toast_' + toast.type]}`}>{toast.msg}</div>
      )}
    </div>
  );
}
