/* ================================================================
 * FICHIER : src/modules/home/components/compare/pages/ComparerPage.tsx
 *
 * RÔLE : Page "/comparer" — affiche côte à côte les produits ajoutés
 *        via le bouton ⚖️ "Comparer" (voir CompareContext.tsx).
 *        Purement local (localStorage, pas de compte requis).
 * ================================================================ */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../../layout/Header';
import { useCompare } from '../../../../../shared/context/CompareContext';
import { useCart } from '../../../../../shared/context/CartContext';
import { produitApi } from '../../produit/api/produit.api';
import type { ProduitApi } from '../../produit/pages/ProduitPage';

import styles from './ComparerPage.module.css';

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

function fmtPrix(n: number): string {
  return `${n.toLocaleString('fr-FR')} GNF`;
}

export default function ComparerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { ids, remove, clear } = useCompare();
  const { addToCart } = useCart();

  const [produits, setProduits] = useState<ProduitApi[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState<ToastState | null>(null);

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

  /* Liste fusionnée de toutes les caractéristiques présentes chez AU MOINS
   * un des produits comparés — chaque ligne du tableau montre la valeur de
   * chaque produit pour cette caractéristique, ou "—" s'il ne l'a pas. */
  const allSpecKeys = Array.from(new Set(produits.flatMap(p => p.specs.map(s => s.cle))));

  const handleAddToCart = async (produitId: string) => {
    try {
      await addToCart(produitId, 1);
      showToast(t('compare.ajouteAuPanierToast'), 's');
    } catch (err: any) {
      showToast(err?.message ?? t('compare.ajoutEchecToast'), 'e');
    }
  };

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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.rowLabel} />
                  {produits.map(p => (
                    <th key={p.id} className={styles.colHead}>
                      <button className={styles.removeBtn} onClick={() => remove(p.id)} title={t('compare.retirer')} aria-label={t('compare.retirer')}>
                        <i className="fas fa-xmark" />
                      </button>
                      <img
                        src={p.images.slice().sort((a, b) => a.ordre - b.ordre)[0]?.url}
                        alt={p.nom}
                        className={styles.colImg}
                        onClick={() => navigate(`/produit/${p.id}`)}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
                      />
                      <div className={styles.colNom} onClick={() => navigate(`/produit/${p.id}`)}>{p.nom}</div>
                      <button className={styles.colCartBtn} onClick={() => handleAddToCart(p.id)}>
                        <i className="fas fa-cart-shopping" /> {t('compare.ajouterPanier')}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.prix')}</td>
                  {produits.map(p => (
                    <td key={p.id} className={styles.cell}>
                      <span className={styles.prix}>{fmtPrix(p.prix)}</span>
                      {p.prixAncien && p.prixAncien > p.prix && (
                        <span className={styles.prixAncien}>{fmtPrix(p.prixAncien)}</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.boutique')}</td>
                  {produits.map(p => (
                    <td key={p.id} className={styles.cell}>
                      <span className={styles.link} onClick={() => navigate(`/boutique/${p.companyId}`)}>{p.companyName}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.categorie')}</td>
                  {produits.map(p => <td key={p.id} className={styles.cell}>{p.category?.nom ?? '—'}</td>)}
                </tr>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.marque')}</td>
                  {produits.map(p => <td key={p.id} className={styles.cell}>{p.marque ?? '—'}</td>)}
                </tr>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.etat')}</td>
                  {produits.map(p => <td key={p.id} className={styles.cell}>{p.condition || '—'}</td>)}
                </tr>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.garantie')}</td>
                  {produits.map(p => <td key={p.id} className={styles.cell}>{p.garantie || '—'}</td>)}
                </tr>
                <tr>
                  <td className={styles.rowLabel}>{t('compare.stock')}</td>
                  {produits.map(p => (
                    <td key={p.id} className={styles.cell}>
                      {p.stock > 0
                        ? <span className={styles.stockOk}>{t('compare.enStock', { count: p.stock })}</span>
                        : <span className={styles.stockOut}>{t('compare.ruptureStock')}</span>}
                    </td>
                  ))}
                </tr>
                {allSpecKeys.length > 0 && (
                  <tr><td colSpan={produits.length + 1} className={styles.sectionSep}>{t('compare.caracteristiques')}</td></tr>
                )}
                {allSpecKeys.map(cle => (
                  <tr key={cle}>
                    <td className={styles.rowLabel}>{cle}</td>
                    {produits.map(p => (
                      <td key={p.id} className={styles.cell}>
                        {p.specs.find(s => s.cle === cle)?.valeur ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {toast && (
        <div className={`${styles.toast} ${styles['toast_' + toast.type]}`}>{toast.msg}</div>
      )}
    </div>
  );
}
