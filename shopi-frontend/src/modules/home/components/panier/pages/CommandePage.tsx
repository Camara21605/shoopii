/*
 * CommandePage.tsx — Page panier / commande (design professionnel)
 * ✅ Connectée au backend : CartContext, POST /client/commandes
 * ✅ Livreurs SUIVIS via /suivis/mes-abonnements
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Header           from '../../layout/Header';
import { useCart }      from '../../../../../shared/context/CartContext';
import { apiFetch }     from '../../../../../shared/services/apiFetch';

import ProgressBar      from '../components/ProgressBar';
import ConfirmModal     from '../components/ConfirmModal';
import AdresseSection, { type AdresseFormData } from '../sections/AdresseSection';
import LivraisonSection from '../sections/LivraisonSection';
import RecapSection     from '../sections/RecapSection';
import SummaryPanel     from '../sections/SummaryPanel';

import { settingsApi }                       from '../../settings/api/settings.api';
import type { ProfilData, AdresseItem }      from '../../settings/api/settings.api';
import { fetchLivreursSuivis, type LivreurSuivi } from '../services/livreursSuivis.api';
import { fetchWalletSummary }                from '../../../../../shared/services/walletApi';
import { SPEEDS, lvFeeCalc }                 from '../data/panierData';
/* La position GPS du client doit être autorisée pour pouvoir commander
 * (le livreur/l'entreprise doivent pouvoir localiser la livraison en
 * temps réel — voir aussi SectionAddresses.tsx du profil client, qui
 * demande déjà cette autorisation en amont). askConfirm() bloque la
 * commande tant que geo.position n'est pas disponible. */
import { useGeolocation }                    from '../../../../../shared/location/hooks/useGeolocation';
import styles from '../styles/CommandePage.module.css';

export default function CommandePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { items, count, updateQty, removeItem, clearCart } = useCart();

  const [delMode,    setDelMode]    = useState<'std' | 'lvr'>('std');
  const [selLvr,     setSelLvr]     = useState<string | null>(null);
  const [selCorr,    setSelCorr]    = useState<number | null>(null);
  const [curSpd,     setCurSpd]     = useState('std');
  /* Paiement toujours via le portefeuille Shoneya — plus de sélection de
     mode de paiement ni de code promo (étape "Mode de paiement" retirée). */
  const payMode    = 'wallet' as const;
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

  /* ── Livreurs auxquels le client est abonné (choix "Choisir un livreur") ── */
  const [livreurs,        setLivreurs]        = useState<LivreurSuivi[]>([]);
  const [loadingLivreurs, setLoadingLivreurs]  = useState(true);

  /* ── Solde réel du portefeuille Shoneya du client (mode de paiement "Wallet") ── */
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  /* Demande la permission GPS dès l'arrivée sur le panier — pas seulement
   * au clic sur "Commander" — pour laisser le temps au client de
   * l'accorder (ou de comprendre qu'il doit l'accorder) avant d'arriver
   * au bout du formulaire. askConfirm() vérifie geo.position plus bas. */
  const geo = useGeolocation();

  /* ── Ancre pour le lien "Modifier" du panneau récapitulatif ── */
  const articlesRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    fetchLivreursSuivis()
      .then(setLivreurs)
      .catch(() => {})
      .finally(() => setLoadingLivreurs(false));
  }, []);

  useEffect(() => {
    fetchWalletSummary()
      .then(s => setWalletBalance(s.balance))
      .catch(() => {})
      .finally(() => setLoadingWallet(false));
  }, []);

  /* ── Calculs ──
     Correspondant non disponible (pas de boutique internationale détectée
     ni d'API de correspondants réels côté panier) — toujours désactivé. */
  const corrFee = 0;
  const lv      = delMode === 'lvr' ? livreurs.find(l => l.id === selLvr) ?? null : null;
  const lvFee   = lv ? lvFeeCalc(lv.base, SPEEDS[curSpd].m) : 0;
  const sub     = items.reduce((s, i) => s + i.prix * i.qty, 0);
  const disc    = promoActif ? Math.round(sub * 0.2) : 0;
  const total   = sub + corrFee + lvFee - disc;

  async function handleChangeQty(id: string, delta: number) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newQty = Math.max(1, Math.min(10, item.qty + delta));
    try { await updateQty(id, newQty); }
    catch { showToast(t('panierCommande.page.erreurQtyToast')); }
  }

  async function handleRemove(id: string) {
    try { await removeItem(id); showToast(t('panierCommande.page.articleRetireToast')); }
    catch { showToast(t('panierCommande.page.erreurSuppressionToast')); }
  }

  function askConfirm() {
    /* Position GPS obligatoire : sans elle, ni le livreur ni l'entreprise
     * ne peuvent localiser la livraison sur la carte de suivi (voir
     * OrderTrackingMap). On bloque donc la commande tant qu'elle n'est
     * pas accordée, plutôt que de laisser passer une commande impossible
     * à livrer correctement. */
    if (!geo.position) {
      showToast(geo.error
        ? `📍 ${geo.error}`
        : '📍 Autorisez la géolocalisation pour pouvoir commander.');
      geo.refresh();
      return;
    }
    if (!termsOk)           { showToast(t('panierCommande.page.acceptezCguToast')); return; }
    if (items.length === 0) { showToast(t('panierCommande.page.panierVideToast'));              return; }
    const a = adresseLivraison;
    if (!a?.prenom || !a?.nom)        { showToast(t('panierCommande.page.prenomNomToast'));     return; }
    if (!a?.telephone)                { showToast(t('panierCommande.page.telephoneToast')); return; }
    if (!a?.adressePrecise)           { showToast(t('panierCommande.page.adresseToast'));    return; }
    if (delMode === 'lvr' && !selLvr) { showToast(t('panierCommande.page.choisirLivreurToast'));             return; }
    if (loadingWallet)                { showToast(t('panierCommande.page.verificationSoldeToast')); return; }
    if (walletBalance != null && walletBalance < total) {
      showToast(t('panierCommande.page.soldeInsuffisantToast'));
      return;
    }
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
          livreurId:       delMode === 'lvr' && selLvr ? selLvr : undefined,
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
      showToast(t('panierCommande.page.erreurCommandeToast', { msg: e?.message ?? t('panierCommande.page.impossibleConfirmer') }));
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
            <div className={styles.emptyTitle}>{t('panierCommande.page.panierVideTitre')}</div>
            <div className={styles.emptyText}>
              {t('panierCommande.page.panierVideDesc')}
            </div>
            <button className={styles.emptyBtn} onClick={() => navigate('/home')}>
              <i className="fas fa-arrow-left" /> {t('panierCommande.page.explorerBoutiques')}
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

      {/* Avertissement position GPS — affiché tant que la permission n'est
       * pas accordée, pour que le client comprenne AVANT de cliquer sur
       * "Commander" pourquoi le bouton le bloquera (voir askConfirm()). */}
      {!geo.position && (
        <div style={{
          maxWidth: 1100, margin: '0 auto', padding: '0 20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            background: 'rgba(220,38,38,.08)', border: '1.5px solid rgba(220,38,38,.25)',
            borderRadius: 12, padding: '12px 16px', margin: '14px 0',
          }}>
            <i className="fas fa-location-crosshairs" style={{ color: '#DC2626', fontSize: 17 }} />
            <div style={{ flex: 1, minWidth: 220, fontSize: 12.5, color: 'var(--t2)' }}>
              {geo.error
                ? geo.error
                : 'Autorisez votre position GPS pour pouvoir commander — elle permet au livreur et à la boutique de suivre votre livraison.'}
            </div>
            <button
              onClick={geo.refresh}
              style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 9, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
            >
              <i className="fas fa-rotate-right" /> Autoriser ma position
            </button>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.grid}>

          {/* ── Colonne gauche ── */}
          <div className={styles.leftCol}>

            {/* ── Section articles ── */}
            <div className={styles.card} ref={articlesRef}>
              <div className={styles.cardHead}>
                <div className={`${styles.cardHeadIcon} ${styles.iconGreen}`}>
                  <i className="fas fa-check" />
                </div>
                <div className={styles.cardHeadText}>
                  <div className={styles.cardHeadTitle}>{t('panierCommande.page.cardHeadTitle')}</div>
                  <div className={styles.cardHeadSub}>
                    {t('panierCommande.page.cardHeadSub', { count })}
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
                            {t('panierCommande.page.plusQueEnStock', { count: item.stock })}
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
                          title={t('panierCommande.page.retirerDuPanier')}
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
            <LivraisonSection
              delMode={delMode}
              selLvr={selLvr}
              selCorr={selCorr}
              curSpd={curSpd}
              showCorr={false}
              livreurs={livreurs}
              loadingLivreurs={loadingLivreurs}
              onDel={setDelMode}
              onSelLvr={setSelLvr}
              onSelCorr={setSelCorr}
              onSpeed={setCurSpd}
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
              loading={loading}
              walletBalance={walletBalance}
              loadingWallet={loadingWallet}
              onConfirm={askConfirm}
              onEdit={() => articlesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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
