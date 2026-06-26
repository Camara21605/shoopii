/*
 * CommandePage.tsx — Page panier / commande (design professionnel)
 * ✅ Connectée au backend : CartContext, POST /client/commandes
 * ✅ Livreurs SUIVIS via /suivis/mes-abonnements
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import Header           from '../../layout/Header';
import { useCart }      from '../../../../../shared/context/CartContext';
import { apiFetch }     from '../../../../../shared/services/apiFetch';

import ProgressBar      from '../components/ProgressBar';
import ConfirmModal     from '../components/ConfirmModal';
import AdresseSection   from '../sections/AdresseSection';
import LivraisonSection from '../sections/LivraisonSection';
import PaiementSection  from '../sections/PaiementSection';
import RecapSection     from '../sections/RecapSection';
import SummaryPanel     from '../sections/SummaryPanel';

import { CORRESPONDANTS, SPEEDS, lvFeeCalc } from '../data/panierData';
import { fetchLivreursSuivis }               from '../services/livreursSuivis.api';
import type { LivreurSuivi }                 from '../services/livreursSuivis.api';
import styles from '../styles/CommandePage.module.css';

export default function CommandePage() {
  const navigate = useNavigate();
  const { items, count, loading: cartLoading, updateQty, removeItem, clearCart } = useCart();

  const [delMode,        setDelMode]        = useState<'std' | 'lvr'>('std');
  const [selLvr,         setSelLvr]         = useState<string | null>(null);
  const [selCorr,        setSelCorr]        = useState<number | null>(null);
  const [curSpd,         setCurSpd]         = useState('std');
  const [payMode,        setPayMode]        = useState('omo');
  const [promoActif,     setPromoActif]     = useState(false);
  const [termsOk,        setTermsOk]        = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [showConfirmAsk, setShowConfirmAsk] = useState(false);
  const [etaDest,        setEtaDest]        = useState('Kaloum, Conakry');
  const [livreurs,        setLivreurs]      = useState<LivreurSuivi[]>([]);
  const [loadingLivreurs, setLoadingLivreurs] = useState(true);

  /* ── Toast ── */
  const [toastMsg, setToastMsg]     = useState('');
  const [toastVis, setToastVis]     = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string) {
    setToastMsg(msg); setToastVis(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToastVis(false), 2800);
  }
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  useEffect(() => {
    fetchLivreursSuivis()
      .then(setLivreurs)
      .catch(() => setLivreurs([]))
      .finally(() => setLoadingLivreurs(false));
  }, []);

  /* ── Calculs ── */
  const co      = selCorr ? CORRESPONDANTS.find(c => c.id === selCorr) : null;
  const corrFee = co?.fee || 0;
  const lv      = selLvr ? livreurs.find(l => l.id === selLvr) : null;
  const spd     = SPEEDS[curSpd];
  const lvFee   = lv ? lvFeeCalc(lv.base, spd.m) : 0;
  const sub     = items.reduce((s, i) => s + i.prix * i.qty, 0);
  const disc    = promoActif ? Math.round(sub * 0.2) : 0;
  const total   = sub + corrFee + lvFee - disc;

  async function handleChangeQty(id: string, delta: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(1, Math.min(10, item.qty + delta));
    try { await updateQty(id, newQty); }
    catch { showToast('❌ Impossible de modifier la quantité'); }
  }

  async function handleRemove(id: string) {
    try { await removeItem(id); showToast('🗑️ Article retiré du panier'); }
    catch { showToast('❌ Impossible de supprimer'); }
  }

  function handleDelMode(m: 'std' | 'lvr') {
    setDelMode(m);
    if (m === 'std') setSelLvr(null);
  }

  function askConfirm() {
    if (!termsOk)                     { showToast('⚠️ Acceptez les conditions générales'); return; }
    if (delMode === 'lvr' && !selLvr) { showToast('⚠️ Sélectionnez un livreur');           return; }
    if (items.length === 0)           { showToast('⚠️ Votre panier est vide');              return; }
    setShowConfirmAsk(true);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await apiFetch<{ id: string }>('/client/commandes', {
        method: 'POST',
        body: {
          items:           items.map(i => ({ panierItemId: i.id })),
          delMode,
          livreurId:       selLvr  ?? undefined,
          correspondantId: selCorr ?? undefined,
          payMode,
          destination:     etaDest,
          promoCode:       promoActif ? 'SHOPI20' : undefined,
        },
      });
      await clearCart();
      navigate(`/commande/${res.id}/suivi`);
      setShowConfirmAsk(false);
    } catch (e: any) {
      showToast(`❌ ${e?.message ?? 'Impossible de confirmer la commande'}`);
    } finally {
      setLoading(false);
    }
  }

  const cartItemsForSections = items.map((i, index) => ({
    id: index + 1, em: i.emoji ?? '📦', name: i.nom, shop: i.shopNom,
    price: i.prix, old: i.prixAncien, qty: i.qty, vt: i.variante ?? '',
  }));

  /* ── Panier vide ── */
  if (!cartLoading && items.length === 0) {
    return (
      <div className={styles.root}>
        <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
        <ProgressBar />
        <main className={styles.main}>
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🛒</div>
            <div className={styles.emptyTitle}>Votre panier est vide</div>
            <div className={styles.emptyText}>
              Parcourez les boutiques et ajoutez vos produits préférés pour passer commande.
            </div>
            <button className={styles.emptyBtn} onClick={() => navigate('/home')}>
              <i className="fas fa-arrow-left" /> Explorer les boutiques
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <Header onToast={showToast} onLogin={() => navigate('/login')} onRegister={() => navigate('/register')} />
      <ProgressBar />

      <main className={styles.main}>
        <div className={styles.grid}>

          {/* ── Colonne gauche ── */}
          <div className={styles.leftCol}>

            {/* ── Section articles ── */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div className={`${styles.cardHeadIcon} ${styles.iconGreen}`}>
                  <i className="fas fa-check" />
                </div>
                <div className={styles.cardHeadText}>
                  <div className={styles.cardHeadTitle}>Vos articles</div>
                  <div className={styles.cardHeadSub}>
                    {count} article{count > 1 ? 's' : ''} · Prêt pour la commande
                    {cartLoading && <i className="fas fa-circle-notch fa-spin" style={{ marginLeft: 8, color: 'var(--cart-blue)' }} />}
                  </div>
                </div>
              </div>

              <div className={styles.articlesList}>
                {items.map(item => {
                  const hasDiscount = !!(item.prixAncien && item.prixAncien > item.prix);
                  const discPct     = hasDiscount ? Math.round((1 - item.prix / item.prixAncien!) * 100) : 0;

                  return (
                    <div
                      key={item.id}
                      className={styles.articleItem}
                      onClick={() => navigate(`/produit/${item.produitId}`)}
                    >
                      {/* Miniature */}
                      <div className={styles.articleThumb}>
                        {item.imageUrl
                          ? <img src={item.imageUrl} alt={item.nom} />
                          : <span>{item.emoji ?? '📦'}</span>
                        }
                      </div>

                      {/* Infos */}
                      <div className={styles.articleInfo}>
                        <div className={styles.articleShop}>{item.shopNom}</div>
                        <div className={styles.articleName}>{item.nom}</div>
                        {item.variante && (
                          <div className={styles.articleVariant}>{item.variante}</div>
                        )}
                        {item.stock > 0 && item.stock < 5 && (
                          <div className={styles.articleStockWarn}>
                            <i className="fas fa-triangle-exclamation" style={{ marginRight: 4 }} />
                            Plus que {item.stock} en stock
                          </div>
                        )}
                        {/* Quantité */}
                        <div className={styles.qtyRow} onClick={e => e.stopPropagation()}>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => handleChangeQty(item.id, -1)}
                            disabled={item.qty <= 1}
                          >
                            <i className="fas fa-minus" style={{ fontSize: 10 }} />
                          </button>
                          <span className={styles.qtyNum}>{item.qty}</span>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => handleChangeQty(item.id, 1)}
                            disabled={item.qty >= item.stock}
                          >
                            <i className="fas fa-plus" style={{ fontSize: 10 }} />
                          </button>
                        </div>
                      </div>

                      {/* Droite : prix + supprimer */}
                      <div className={styles.articleRight} onClick={e => e.stopPropagation()}>
                        <div>
                          <div className={styles.articlePrice}>
                            {(item.prix * item.qty).toLocaleString('fr')} GNF
                          </div>
                          {hasDiscount && (
                            <div className={styles.articleOld}>
                              {(item.prixAncien! * item.qty).toLocaleString('fr')} GNF
                            </div>
                          )}
                          {hasDiscount && (
                            <div className={styles.articleDiscount}>−{discPct}%</div>
                          )}
                        </div>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleRemove(item.id)}
                          title="Retirer du panier"
                        >
                          <i className="fas fa-trash-can" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sections suivantes */}
            <AdresseSection   onVilleChange={setEtaDest} onToast={showToast} />
            <LivraisonSection
              delMode={delMode} selLvr={selLvr} selCorr={selCorr}
              curSpd={curSpd} showCorr={false}
              livreurs={livreurs} loadingLivreurs={loadingLivreurs}
              onDel={handleDelMode} onSelLvr={setSelLvr}
              onSelCorr={setSelCorr} onSpeed={setCurSpd} onToast={showToast}
            />
            <PaiementSection
              payMode={payMode} promoActif={promoActif}
              onPayMode={setPayMode} onPromo={setPromoActif} onToast={showToast}
            />
            <RecapSection
              items={cartItemsForSections}
              delMode={delMode} selLvrObj={lv} selCorr={selCorr}
              curSpd={curSpd} payMode={payMode} promoActif={promoActif}
              total={total} termsOk={termsOk} onTerms={setTermsOk}
            />
          </div>

          {/* ── Colonne droite sticky ── */}
          <div className={styles.rightCol}>
            <SummaryPanel
              items={cartItemsForSections}
              delMode={delMode} selLvrObj={lv}
              corrFee={corrFee} curSpd={curSpd}
              promoActif={promoActif} etaDest={etaDest}
              loading={loading} onToast={showToast}
              onConfirm={askConfirm}
            />
          </div>
        </div>
      </main>

      {showConfirmAsk && (
        <ConfirmModal
          loading={loading}
          onCancel={() => setShowConfirmAsk(false)}
          onConfirm={handleConfirm}
        />
      )}

      <div className={`${styles.toast} ${toastVis ? styles.toastVisible : ''}`}>
        <i className="fas fa-circle-check" />
        <span>{toastMsg}</span>
      </div>
    </div>
  );
}
