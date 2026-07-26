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
import AdresseSection, { type AdresseFormData } from '../sections/AdresseSection';
import RecapSection     from '../sections/RecapSection';
import SummaryPanel     from '../sections/SummaryPanel';

import { settingsApi }                       from '../../settings/api/settings.api';
import type { ProfilData, AdresseItem }      from '../../settings/api/settings.api';
import styles from '../styles/CommandePage.module.css';

export default function CommandePage() {
  const navigate = useNavigate();
  const { items, count, updateQty, removeItem, clearCart } = useCart();

  const delMode = 'std' as const;
  const selLvr  = null;
  const selCorr = null;
  const curSpd  = 'std';
  const payMode   = 'omo';
  const promoActif = false;
  const [termsOk,        setTermsOk]        = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [showConfirmAsk, setShowConfirmAsk] = useState(false);
  const [etaDest,        setEtaDest]        = useState('Kaloum, Conakry');
  const [clientProfil,    setClientProfil]   = useState<ProfilData | null>(null);
  const [clientAddr,      setClientAddr]     = useState<AdresseItem | null>(null);
  const [savedAddresses,  setSavedAddresses] = useState<AdresseItem[]>([]);
  const [loadingClient,   setLoadingClient]  = useState(true);
  const [adresseLivraison, setAdresseLivraison] = useState<AdresseFormData | null>(null);

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
    Promise.all([settingsApi.getProfil(), settingsApi.getAdresses()])
      .then(([profil, adresses]) => {
        setClientProfil(profil);
        const all = adresses ?? [];
        setSavedAddresses(all);
        const def = all.find(a => a.isDefault) ?? all[0] ?? null;
        setClientAddr(def);
      })
      .catch(() => {})
      .finally(() => setLoadingClient(false));
  }, []);

  /* ── Calculs ── */
  const co      = null;
  const corrFee = 0;
  const lv      = null;
  const lvFee   = 0;
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

  function askConfirm() {
    if (!termsOk)           { showToast('⚠️ Acceptez les conditions générales'); return; }
    if (items.length === 0) { showToast('⚠️ Votre panier est vide');              return; }
    const a = adresseLivraison;
    if (!a?.prenom || !a?.nom)        { showToast('⚠️ Indiquez votre prénom et nom');     return; }
    if (!a?.telephone)                { showToast('⚠️ Indiquez votre numéro de téléphone'); return; }
    if (!a?.adressePrecise)           { showToast('⚠️ Indiquez votre adresse précise');    return; }
    setShowConfirmAsk(true);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const a = adresseLivraison;
      const res = await apiFetch<{ id: string }>('/client/commandes', {
        method: 'POST',
        body: {
          items:           items.map(i => ({ panierItemId: i.id })),
          delMode,
          payMode,
          destination:     etaDest,
          /* ── Adresse de livraison ── */
          prenomLivraison:   a?.prenom            ?? undefined,
          nomLivraison:      a?.nom               ?? undefined,
          telephoneLivraison:`+224${a?.telephone ?? ''}`,
          villeLivraison:    a?.ville             ?? undefined,
          communeLivraison:  a?.commune           ?? undefined,
          adressePrecise:    a?.adressePrecise    ?? undefined,
          instructions:      a?.instructions || undefined,
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
  if (items.length === 0) {
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
            <AdresseSection
              clientProfil={clientProfil}
              savedAddresses={savedAddresses}
              loadingClient={loadingClient}
              onVilleChange={setEtaDest}
              onAdresseChange={setAdresseLivraison}
              onToast={showToast}
            />
            <RecapSection
              items={cartItemsForSections}
              delMode={delMode} selLvrObj={lv} selCorr={selCorr}
              curSpd={curSpd} payMode={payMode} promoActif={promoActif}
              total={total} termsOk={termsOk} onTerms={setTermsOk}
              clientProfil={clientProfil}
              clientAddr={clientAddr}
              loadingClient={loadingClient}
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
