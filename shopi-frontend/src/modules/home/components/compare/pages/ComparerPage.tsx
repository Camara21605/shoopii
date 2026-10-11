/* ================================================================
 * FICHIER : src/modules/home/components/compare/pages/ComparerPage.tsx
 *
 * RÔLE : Page "/comparer" — affiche côte à côte les produits ajoutés
 *        via le bouton ⚖️ "Comparer" (voir CompareContext.tsx).
 *        Purement local (localStorage, pas de compte requis).
 *
 * COMPARAISON « INTELLIGENTE » :
 *   - une seule catégorie par comparaison ; « Ajouter un produit » ne
 *     propose que des produits de la même catégorie et, par défaut, de
 *     la même sous-catégorie (AjouterProduitSheet + /produits/comparables) ;
 *   - suggestions rapides sous le tableau, classées par pertinence ;
 *   - « L'avis Shopi » : meilleur choix global + raisons, alertes stock
 *     (voir utils/compareInsights.ts — calcul 100 % côté client) ;
 *   - gagnants par ligne (meilleur prix, plus forte remise, meilleure
 *     garantie) et écart de prix par rapport au moins cher ;
 *   - nettoyage automatique des produits supprimés / dépubliés ;
 *   - « Seulement les différences » masque les lignes identiques.
 * ================================================================ */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header from '../../layout/Header';
import { useCompare, MAX_COMPARE } from '../../../../../shared/context/CompareContext';
import { useCart } from '../../../../../shared/context/CartContext';
import { produitApi } from '../../produit/api/produit.api';
import type { ProduitApi } from '../../produit/pages/ProduitPage';
import { categoryName, subCategoryName } from '../../../../../shared/utils/catalogueCase';

import AjouterProduitSheet from '../components/AjouterProduitSheet';
import { useComparables } from '../hooks/useComparables';
import { computeInsights, garantieMois, remisePct, STOCK_FAIBLE } from '../utils/compareInsights';
import styles from './ComparerPage.module.css';

interface ToastState { msg: string; type: 's' | 'i' | 'w' | 'e' }

/** Une ligne du tableau : valeur affichée + valeur de comparaison (pour « différences »). */
interface Row { key: string; label: string; cells: { node: ReactNode; cmp: string }[] }

function fmtPrix(n: number): string {
  return `${n.toLocaleString('fr-FR')} GNF`;
}

const metaOf = (p: ProduitApi) => ({
  categoryId:     p.category?.id ?? null,
  categoryNom:    p.category?.nom ?? null,
  subCategoryId:  p.subCategory?.id ?? null,
  subCategoryNom: p.subCategory?.nom ?? null,
});

export default function ComparerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { ids, items, remove, removeMany, clear, add, setMeta } = useCompare();
  const { addToCart } = useCart();

  /* Fiches déjà chargées : ajouter/retirer un produit ne recharge pas
   * les autres. `failed` : ids introuvables (déjà signalés). */
  const [fiches,    setFiches]    = useState<Record<string, ProduitApi>>({});
  const [failed,    setFailed]    = useState<string[]>([]);
  const [toast,     setToast]     = useState<ToastState | null>(null);
  const [diffsOnly, setDiffsOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, type: ToastState['type'] = 'i') => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    const missing = ids.filter(id => !fiches[id] && !failed.includes(id));
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(missing.map(id => produitApi.getById(id).then(p => [id, p] as const).catch(() => [id, null] as const)))
      .then(list => {
        if (cancelled) return;
        const ok: Record<string, ProduitApi> = {};
        const gone: string[] = [];
        list.forEach(([id, p]) => {
          if (!p) { gone.push(id); return; }
          ok[id] = p;
          /* Anciennes entrées sans catégorie : on la complète */
          const it = items.find(i => i.id === id);
          if (it && !it.categoryId && p.category?.id) setMeta(id, metaOf(p));
        });
        setFiches(prev => ({ ...prev, ...ok }));
        /* Produit supprimé / dépublié / boutique suspendue : retiré
         * automatiquement (le compteur « 2 produits sur 4 » restait faux). */
        if (gone.length) {
          setFailed(prev => [...prev, ...gone]);
          removeMany(gone);
          showToast(t('compare.indisponiblesRetires', { count: gone.length }), 'w');
        }
      });
    return () => { cancelled = true; };
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const produits = useMemo(
    () => ids.map(id => fiches[id]).filter((p): p is ProduitApi => !!p),
    [ids, fiches],
  );
  const loading = ids.some(id => !fiches[id] && !failed.includes(id)) && produits.length === 0;

  const insights = useMemo(() => computeInsights(produits), [produits]);
  const places   = Math.max(0, MAX_COMPARE - ids.length);

  /* Catégorie de la comparaison + produits « intrus » (anciennes données) */
  const refCat  = produits[0]?.category ?? null;
  const subs    = new Set(produits.map(p => p.subCategory?.id).filter(Boolean));
  const refSub  = subs.size === 1 ? produits.find(p => p.subCategory)?.subCategory ?? null : null;
  const intrus  = refCat ? produits.filter(p => p.category?.id !== refCat.id) : [];

  /* Suggestions rapides sous le tableau */
  const { res: sugg, loading: suggLoading } = useComparables(ids, {
    scope: 'sub', limit: 6, enabled: produits.length > 0 && places > 0,
  });
  const suggestions = (sugg?.data ?? []).filter(p => !ids.includes(p.id)).slice(0, 6);

  const handleAddToCart = async (produitId: string) => {
    try {
      await addToCart(produitId, 1);
      showToast(t('compare.ajouteAuPanierToast'), 's');
    } catch (err) {
      showToast((err as Error)?.message || t('compare.ajoutEchecToast'), 'e');
    }
  };

  const quickAdd = (p: ProduitApi) => {
    const r = add(p.id, metaOf(p));
    if (r.full) showToast(t('compare.pleinToast', { max: MAX_COMPARE }), 'w');
    else if (r.mismatch !== undefined && r.mismatch !== null) showToast(t('compare.autreCategorieToast'), 'w');
    else if (r.added) showToast(t('compare.ajouteToast', { nom: p.nom }), 's');
  };

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const nomDe = (id: string | null) => produits.find(p => p.id === id)?.nom ?? '';

  const etatLabel = (c: string | null | undefined) =>
    c ? t(`compare.etats.${c}`, { defaultValue: c.charAt(0).toUpperCase() + c.slice(1) }) : '—';

  /* Lignes du tableau (les valeurs de comparaison servent au filtre « différences ») */
  const rows: Row[] = useMemo(() => {
    const txt = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
    const multi = produits.length > 1;
    const base: Row[] = [
      {
        key: 'prix', label: t('compare.prix'),
        cells: produits.map(p => ({
          cmp: String(p.prix),
          node: (
            <>
              <span className={styles.prix}>{fmtPrix(p.prix)}</span>
              {p.prixAncien && p.prixAncien > p.prix && <span className={styles.prixAncien}>{fmtPrix(p.prixAncien)}</span>}
              {multi && insights.cheapestId === p.id && <span className={styles.bestBadge}><i className="fas fa-tag" /> {t('compare.meilleurPrix')}</span>}
              {multi && insights.cheapestId && insights.diffVsMin[p.id] > 0 && (
                <span className={styles.diffPrix}>+{fmtPrix(insights.diffVsMin[p.id])}</span>
              )}
            </>
          ),
        })),
      },
      {
        key: 'remise', label: t('compare.remise'),
        cells: produits.map(p => {
          const r = remisePct(p);
          return {
            cmp: String(r),
            node: r > 0
              ? <><span className={styles.remise}>−{r} %</span>{multi && insights.bestRemiseId === p.id && <span className={styles.bestBadge}><i className="fas fa-fire" /> {t('compare.meilleureRemise')}</span>}</>
              : '—',
          };
        }),
      },
      {
        key: 'boutique', label: t('compare.boutique'),
        cells: produits.map(p => ({
          cmp: p.companyId,
          node: (
            <span className={styles.link} onClick={() => navigate(`/boutique/${p.companyId}`)}>
              {p.companyName}{p.companyVerified && <i className={`fas fa-circle-check ${styles.verified}`} title={t('compare.boutiqueVerifiee')} />}
            </span>
          ),
        })),
      },
      {
        key: 'souscat', label: t('compare.sousCategorie'),
        cells: produits.map(p => { const v = p.subCategory?.nom ? subCategoryName(p.subCategory.nom) : '—'; return { cmp: v, node: v }; }),
      },
      { key: 'marque', label: t('compare.marque'), cells: produits.map(p => ({ cmp: txt(p.marque),    node: txt(p.marque) })) },
      { key: 'etat',   label: t('compare.etat'),   cells: produits.map(p => ({ cmp: txt(p.condition), node: etatLabel(p.condition) })) },
      {
        key: 'garantie', label: t('compare.garantie'),
        cells: produits.map(p => ({
          cmp: String(garantieMois(p.garantie) ?? txt(p.garantie)),
          node: (
            <>
              {txt(p.garantie)}
              {multi && insights.bestGarantieId === p.id && <span className={styles.bestBadge}><i className="fas fa-shield-halved" /> {t('compare.meilleureGarantie')}</span>}
            </>
          ),
        })),
      },
      {
        key: 'stock', label: t('compare.stock'),
        cells: produits.map(p => ({
          cmp: p.stock > 0 ? 'ok' : 'out',
          node: p.stock <= 0
            ? <span className={styles.stockOut}>{t('compare.ruptureStock')}</span>
            : p.stock <= STOCK_FAIBLE
              ? <span className={styles.stockLow}>{t('compare.stockFaible', { count: p.stock })}</span>
              : <span className={styles.stockOk}>{t('compare.enStock', { count: p.stock })}</span>,
        })),
      },
      {
        key: 'livraison', label: t('compare.livraison'),
        cells: produits.map(p => {
          const v = p.livraisonStandard || p.livraisonLivreur || p.livraisonCorrespondant
            ? (p.delaiLivraison || t('compare.livraisonDispo'))
            : t('compare.retraitSeulement');
          return { cmp: v, node: v };
        }),
      },
    ];
    /* Caractéristiques : union de celles de tous les produits */
    const specKeys = Array.from(new Set(produits.flatMap(p => p.specs.map(s => s.cle))));
    const specs: Row[] = specKeys.map(cle => ({
      key: `spec:${cle}`, label: cle,
      cells: produits.map(p => { const v = txt(p.specs.find(s => s.cle === cle)?.valeur); return { cmp: v, node: v }; }),
    }));
    return [...base, ...(specs.length ? [{ key: 'sep', label: t('compare.caracteristiques'), cells: [] }] : []), ...specs];
  }, [produits, insights, t, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDiff = (r: Row) => new Set(r.cells.map(c => c.cmp)).size > 1;
  /* Lignes entièrement vides (« — » partout) : inutiles, masquées */
  const nonEmpty = rows.filter(r => r.key === 'sep' || r.cells.some(c => c.cmp !== '—' && c.cmp !== '0'));
  const visibleRows = diffsOnly
    ? nonEmpty.filter(r => r.key === 'sep' ? nonEmpty.some(x => x.key.startsWith('spec:') && isDiff(x)) : isDiff(r))
    : nonEmpty;
  const colSpan = produits.length + 1 + (places > 0 ? 1 : 0);

  const reasonLabel: Record<string, string> = {
    moinsCher: t('compare.raisons.moinsCher'),
    remise:    t('compare.raisons.remise'),
    garantie:  t('compare.raisons.garantie'),
    neuf:      t('compare.raisons.neuf'),
    verifiee:  t('compare.raisons.verifiee'),
    enStock:   t('compare.raisons.enStock'),
  };

  return (
    <div className={styles.page}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />

      <main className={styles.main}>
        <div className={styles.headRow}>
          <h1 className={styles.titre}>
            <i className="fas fa-code-compare" /> {t('compare.titre')}
          </h1>
          {ids.length > 0 && (
            <button className={styles.clearBtn} onClick={() => { clear(); showToast(t('compare.videToast')); }}>
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
            <ol className={styles.steps}>
              <li>{t('compare.etape1')}</li>
              <li>{t('compare.etape2')}</li>
              <li>{t('compare.etape3')}</li>
            </ol>
            <button className={styles.emptyBtn} onClick={() => navigate('/')}>
              <i className="fas fa-magnifying-glass" /> {t('compare.explorerBtn')}
            </button>
          </div>
        ) : (
          <>
            {/* Catégorie de la comparaison */}
            {refCat && (
              <div className={styles.catLine}>
                <i className="fas fa-folder-open" />
                <span>{categoryName(refCat.nom)}</span>
                {refSub && <><i className="fas fa-chevron-right" /><span>{subCategoryName(refSub.nom)}</span></>}
              </div>
            )}

            {intrus.length > 0 && (
              <div className={styles.warnBox}>
                <i className="fas fa-triangle-exclamation" />
                <div>
                  {t('compare.melangeCategories', { categorie: categoryName(refCat?.nom) })}
                  <button className={styles.inlineBtn} onClick={() => removeMany(intrus.map(p => p.id))}>
                    {t('compare.retirerIntrus', { count: intrus.length })}
                  </button>
                </div>
              </div>
            )}

            {/* L'avis Shopi */}
            {produits.length > 1 && insights.bestId && (
              <section className={styles.verdict}>
                <div className={styles.verdictHead}>
                  <i className="fas fa-wand-magic-sparkles" /> {t('compare.avisTitre')}
                </div>
                <div className={styles.verdictMain}>
                  {insights.serre
                    ? t('compare.matchSerre', { nom: nomDe(insights.bestId) })
                    : t('compare.meilleurChoix', { nom: nomDe(insights.bestId) })}
                </div>
                {insights.reasons.length > 0 && (
                  <div className={styles.reasons}>
                    {insights.reasons.map(r => <span key={r} className={styles.reason}><i className="fas fa-check" /> {reasonLabel[r]}</span>)}
                  </div>
                )}
                <ul className={styles.facts}>
                  {insights.cheapestId && insights.ecartPrix > 0 && (
                    <li><i className="fas fa-coins" /> {t('compare.faitEconomie', { nom: nomDe(insights.cheapestId), montant: fmtPrix(insights.ecartPrix) })}</li>
                  )}
                  {insights.bestGarantieId && (
                    <li><i className="fas fa-shield-halved" /> {t('compare.faitGarantie', { nom: nomDe(insights.bestGarantieId) })}</li>
                  )}
                  {insights.outOfStock.map(id => (
                    <li key={`o${id}`} className={styles.factWarn}><i className="fas fa-ban" /> {t('compare.faitRupture', { nom: nomDe(id) })}</li>
                  ))}
                  {insights.lowStock.map(id => (
                    <li key={`l${id}`} className={styles.factWarn}><i className="fas fa-hourglass-half" /> {t('compare.faitStockFaible', { nom: nomDe(id), count: fiches[id]?.stock ?? 0 })}</li>
                  ))}
                </ul>
              </section>
            )}

            {produits.length === 1 && (
              <div className={styles.hint}>
                <i className="fas fa-lightbulb" /> {t('compare.unSeulProduit')}
              </div>
            )}

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
                      const best = produits.length > 1 && insights.bestId === p.id;
                      return (
                        <th key={p.id} className={`${styles.colHead} ${best ? styles.colBest : ''}`}>
                          {best && <span className={styles.ribbon}><i className="fas fa-crown" /> {t('compare.recommande')}</span>}
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
                        <button className={styles.addBtn} onClick={() => setSheetOpen(true)}>
                          <i className="fas fa-plus" />
                          <span>{t('compare.ajouterProduit')}</span>
                          <small>{t('compare.placesRestantes', { count: places })}</small>
                          {refCat && <small className={styles.addCat}>{refSub ? subCategoryName(refSub.nom) : categoryName(refCat.nom)}</small>}
                        </button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map(r => r.key === 'sep' ? (
                    <tr key="sep">
                      <td colSpan={colSpan} className={styles.sectionSep}>{r.label}</td>
                    </tr>
                  ) : (
                    <tr key={r.key} className={!diffsOnly && produits.length > 1 && isDiff(r) ? styles.rowDiff : undefined}>
                      <td className={styles.rowLabel}>{r.label}</td>
                      {r.cells.map((c, i) => <td key={produits[i].id} className={`${styles.cell} ${insights.bestId === produits[i].id && produits.length > 1 ? styles.cellBest : ''}`}>{c.node}</td>)}
                      {places > 0 && <td className={`${styles.cell} ${styles.addColCell}`} />}
                    </tr>
                  ))}
                  {diffsOnly && visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={colSpan} className={styles.noDiff}>{t('compare.aucuneDifference')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Suggestions rapides — même catégorie / sous-catégorie */}
            {places > 0 && (suggLoading || suggestions.length > 0) && (
              <section className={styles.suggest}>
                <div className={styles.suggestHead}>
                  <div>
                    <div className={styles.suggestTitre}>{t('compare.suggestionsTitre')}</div>
                    <div className={styles.suggestSub}>
                      {sugg?.scope === 'sub' && sugg.sousCategorie
                        ? t('compare.suggestionsSousCat', { nom: subCategoryName(sugg.sousCategorie.nom) })
                        : t('compare.suggestionsCat', { nom: categoryName(sugg?.categorie?.nom ?? refCat?.nom) })}
                    </div>
                  </div>
                  <button className={styles.inlineBtn} onClick={() => setSheetOpen(true)}>{t('compare.voirPlus')}</button>
                </div>
                <div className={styles.suggestRow}>
                  {suggLoading && suggestions.length === 0
                    ? Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.suggestSkel} />)
                    : suggestions.map(p => {
                        const img = p.images.slice().sort((a, b) => a.ordre - b.ordre)[0]?.url;
                        return (
                          <div key={p.id} className={styles.suggestCard}>
                            <div className={styles.suggestImg} onClick={() => navigate(`/produit/${p.id}`)}>
                              {img ? <img src={img} alt="" loading="lazy" /> : <i className="fas fa-box-open" />}
                            </div>
                            <div className={styles.suggestNom} title={p.nom}>{p.nom}</div>
                            <div className={styles.suggestPrix}>{fmtPrix(p.prix)}</div>
                            <button className={styles.suggestAdd} onClick={() => quickAdd(p)}>
                              <i className="fas fa-plus" /> {t('compare.comparer')}
                            </button>
                          </div>
                        );
                      })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {sheetOpen && (
        <AjouterProduitSheet
          onClose={closeSheet}
          compares={produits}
          onToast={showToast}
        />
      )}

      {toast && (
        <div className={`${styles.toast} ${styles['toast_' + toast.type]}`}>{toast.msg}</div>
      )}
    </div>
  );
}
