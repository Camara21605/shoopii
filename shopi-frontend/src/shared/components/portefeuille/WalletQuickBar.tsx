/* ============================================================
 * FICHIER : src/shared/components/portefeuille/WalletQuickBar.tsx
 *
 * RÔLE : Barre compacte "solde + actions rapides" (façon 1xbet) —
 *        toujours visible, avec Dépôt / Retrait / Actualiser.
 *        Autonome : ne dépend d'aucun ToastProvider externe
 *        (gère son propre petit message de retour), donc montable
 *        n'importe où (dashboard client, panier, etc.) sans wrapper.
 * ============================================================ */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fetchWalletSummary,
  depositWallet,
  withdrawWallet,
  addWalletPaymentMethod,
  getWalletMethodMeta,
  WALLET_ELECTRONIC_METHOD_TYPES,
  getWalletMethodFormFields,
  isWalletMethodFormValid,
  composeWalletMethodPayload,
  type WalletSummary,
  type WalletPaymentMethodType,
} from '../../services/walletApi';
import { ApiError } from '../../services/apiFetch';
import styles from './WalletQuickBar.module.css';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));
const AMOUNT_CHIPS = [50000, 100000, 500000, 1000000];

type ModalType = 'deposit' | 'withdraw' | null;
/** deposit/withdraw s'ouvrent toujours sur le choix du moyen de paiement
 *  électronique, avant l'étape du montant. */
type ModalStep = 'method' | 'amount';
type FeedbackType = 's' | 'e' | 'w';

interface Props {
  /** Mise en page empilée (solde au-dessus, boutons pleine largeur en dessous) —
   *  pour les emplacements étroits (ex : tiroir de menu, ~300px). */
  compact?: boolean;
  /** Version réduite : carte plus petite, tout sur une seule ligne, et les
   *  actions (Dépôt/Retrait/Actualiser) regroupées dans un menu (⋮) plutôt
   *  qu'affichées en boutons séparés — pour les sidebars de dashboard où
   *  la carte doit rester discrète. */
  mini?: boolean;
  /** Si fourni, affiche un lien "Gérer mon portefeuille" vers la page détaillée
   *  (historique, méthodes de paiement…) de ce dashboard. Omis = pas de lien. */
  onManage?: () => void;
}

export default function WalletQuickBar({ compact = false, mini = false, onManage }: Props) {
  const { t } = useTranslation();
  const [summary,    setSummary]    = useState<WalletSummary | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modal,      setModal]      = useState<ModalType>(null);
  const [step,       setStep]       = useState<ModalStep>('method');
  const [amount,     setAmount]     = useState('');
  const [methodId,   setMethodId]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [activeAddType, setActiveAddType] = useState<WalletPaymentMethodType | null>(null);
  const [formValues,    setFormValues]    = useState<Record<string, string>>({});
  const [addingMethod,  setAddingMethod]  = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const [feedback, setFeedback] = useState<{ msg: string; type: FeedbackType } | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(msg: string, type: FeedbackType) {
    setFeedback({ msg, type });
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 3200);
  }
  useEffect(() => () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }, []);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const data = await fetchWalletSummary();
      setSummary(data);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : t('wallet.errors.loadBalanceFailed'), 'e');
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  function openModal(type: ModalType) {
    setAmount('');
    setMethodId('');
    setStep('method');
    setActiveAddType(null);
    setFormValues({});
    setModal(type);
  }
  function closeModal() { setModal(null); }

  function selectMethod(id: string) {
    setMethodId(id);
    setStep('amount');
  }

  function openAddType(type: WalletPaymentMethodType) {
    setActiveAddType(type);
    setFormValues({});
  }

  async function handleAddMethod() {
    if (!activeAddType) return;
    if (!isWalletMethodFormValid(activeAddType, formValues)) {
      notify(t('wallet.errors.champsRequis'), 'w');
      return;
    }
    setAddingMethod(true);
    try {
      const before = new Set((summary?.paymentMethods ?? []).map(m => m.id));
      const payload = composeWalletMethodPayload(activeAddType, formValues, t);
      const methods = await addWalletPaymentMethod({ type: activeAddType, ...payload });
      setSummary(prev => prev ? { ...prev, paymentMethods: methods } : prev);
      const created = methods.find(m => !before.has(m.id)) ?? methods[methods.length - 1];
      setActiveAddType(null);
      setFormValues({});
      if (created) selectMethod(created.id);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : t('wallet.errors.ajoutImpossible'), 'e');
    } finally {
      setAddingMethod(false);
    }
  }

  async function confirm() {
    const amt = Number(amount.replace(/\s/g, '').replace(/[^\d]/g, ''));
    if (!amt || amt <= 0) { notify(t('wallet.errors.montantInvalide'), 'w'); return; }
    if (!methodId) { notify(t('wallet.errors.choisirMoyenPaiement'), 'w'); setStep('method'); return; }

    setSubmitting(true);
    try {
      const dto = { amount: amt, methodId };
      if (modal === 'deposit')  await depositWallet(dto);
      if (modal === 'withdraw') await withdrawWallet(dto);
      notify(t('wallet.toasts.operationEffectuee', { label: modal === 'deposit' ? t('wallet.opLabels.deposit') : t('wallet.opLabels.withdraw'), montant: fmt(amt) }), 's');
      closeModal();
      await load(true);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : t('wallet.errors.operationImpossible'), 'e');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.bar} ${compact ? styles.compact : ''} ${mini ? styles.mini : ''}`}>
      <div className={styles.top}>
      <div className={styles.left}>
        <div className={styles.icon}><i className="fas fa-wallet" /></div>
        <div>
          <div className={styles.label}>{t('wallet.quickBar.soldeShopi')}</div>
          <div className={styles.amount}>
            {loading
              ? <span className={styles.skeleton} />
              : <>{fmt(summary?.balance ?? 0)} <span className={styles.cur}>{summary?.currency ?? 'GNF'}</span></>}
          </div>
        </div>
      </div>

      {mini ? (
        <div className={styles.menuWrap} ref={menuRef}>
          <button className={styles.menuBtn} onClick={() => setMenuOpen(o => !o)} title={t('wallet.quickBar.actionsTitle')}>
            <i className="fas fa-ellipsis-vertical" />
          </button>
          {menuOpen && (
            <div className={styles.menuPop}>
              <button className={styles.menuItem} onClick={() => { openModal('deposit'); setMenuOpen(false); }}>
                <i className="fas fa-plus" /> {t('wallet.quickBar.depot')}
              </button>
              <button className={styles.menuItem} onClick={() => { openModal('withdraw'); setMenuOpen(false); }}>
                <i className="fas fa-minus" /> {t('wallet.quickBar.retrait')}
              </button>
              <button
                className={styles.menuItem}
                onClick={() => { load(true); setMenuOpen(false); }}
                disabled={loading || refreshing}
              >
                <i className={`fas fa-rotate ${refreshing ? styles.spin : ''}`} /> {t('wallet.quickBar.actualiser')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnDeposit}`} onClick={() => openModal('deposit')}>
            <i className="fas fa-plus" /> {t('wallet.quickBar.depot')}
          </button>
          <button className={`${styles.btn} ${styles.btnWithdraw}`} onClick={() => openModal('withdraw')}>
            <i className="fas fa-minus" /> {t('wallet.quickBar.retrait')}
          </button>
          <button
            className={styles.btnIcon}
            onClick={() => load(true)}
            disabled={loading || refreshing}
            title={t('wallet.quickBar.actualiserSolde')}
          >
            <i className={`fas fa-rotate ${refreshing ? styles.spin : ''}`} />
          </button>
        </div>
      )}
      </div>

      {onManage && (
        <button className={styles.manageBtn} onClick={onManage}>
          <i className="fas fa-wallet" /> {t('wallet.quickBar.gererPortefeuille')}
        </button>
      )}

      {feedback && (
        <div className={`${styles.toast} ${styles[`t_${feedback.type}`]}`}>{feedback.msg}</div>
      )}

      {modal && (
        <div className={styles.pageOverlay}>
          <div className={styles.pageHeader}>
            <button className={styles.pageBack} onClick={step === 'amount' ? () => setStep('method') : closeModal}>
              <i className="fas fa-arrow-left" />
            </button>
            <div className={styles.pageTitle}>{modal === 'deposit' ? t('wallet.modalTitles.deposit') : t('wallet.modalTitles.withdraw')}</div>
            <button className={styles.pageClose} onClick={closeModal}><i className="fas fa-xmark" /></button>
          </div>

          <div className={styles.pageBody}>
            {step === 'method' ? (
              <>
                <p className={styles.mdlIntro}>
                  {modal === 'deposit' ? t('wallet.quickBar.chooseMethodDeposit') : t('wallet.quickBar.chooseMethodWithdraw')}
                </p>

                <div className={styles.pmGrid}>
                  {WALLET_ELECTRONIC_METHOD_TYPES.map(type => {
                    const meta = getWalletMethodMeta(t)[type];
                    const existing = summary?.paymentMethods.find(m => m.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={styles.pmTile}
                        onClick={() => existing ? selectMethod(existing.id) : openAddType(type)}
                      >
                        <span className={styles.pmTileIcon} style={{ background: meta.color }}>
                          {meta.icon ? <i className={`fas ${meta.icon}`} /> : meta.badge}
                        </span>
                        <span className={styles.pmTileNm}>{meta.label}</span>
                        {existing
                          ? <span className={styles.pmTileNo}>{existing.number}</span>
                          : <span className={styles.pmTileAdd}><i className="fas fa-plus" /> {t('wallet.opPage.ajouter')}</span>}
                        {existing?.isDefault && <span className={styles.pmTileDef}>{t('wallet.methodes.defaut')}</span>}
                      </button>
                    );
                  })}
                </div>

                {activeAddType && (
                  <div className={styles.pmAddBox}>
                    <div className={styles.pmAddTtl}>
                      <i className="fas fa-plus" /> {t('wallet.opPage.ajouterType', { type: getWalletMethodMeta(t)[activeAddType].label })}
                    </div>
                    {getWalletMethodFormFields(t)[activeAddType].map(field => (
                      <div key={field.key}>
                        <label className={styles.fldL}>{field.label}</label>
                        {field.prefix ? (
                          <div className={styles.fldPrefixWrap}>
                            <span className={styles.fldPrefixTag}>{field.prefix}</span>
                            <input
                              type="text"
                              inputMode={field.inputMode}
                              maxLength={field.maxLength}
                              className={`${styles.fldIn} ${styles.fldPrefixIn}`}
                              placeholder={field.placeholder}
                              value={formValues[field.key] ?? ''}
                              onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                            />
                          </div>
                        ) : (
                          <input
                            type="text"
                            inputMode={field.inputMode}
                            maxLength={field.maxLength}
                            className={styles.fldIn}
                            placeholder={field.placeholder}
                            value={formValues[field.key] ?? ''}
                            onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                    <button className={styles.mdlBtn} onClick={handleAddMethod} disabled={addingMethod}>
                      {addingMethod ? t('wallet.opPage.ajoutEnCours') : t('wallet.opPage.ajouterEtContinuer')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {(() => {
                  const selected = summary?.paymentMethods.find(m => m.id === methodId);
                  const meta = selected ? getWalletMethodMeta(t)[selected.type] : null;
                  return selected && meta ? (
                    <button type="button" className={styles.pmSelected} onClick={() => setStep('method')}>
                      <span className={styles.pmTileIcon} style={{ background: meta.color }}>
                        {meta.icon ? <i className={`fas ${meta.icon}`} /> : meta.badge}
                      </span>
                      <span className={styles.pmPickInfo}>
                        <span className={styles.pmPickNm}>{selected.label}</span>
                        <span className={styles.pmPickNo}>{selected.number}</span>
                      </span>
                      <span className={styles.pmChange}>{t('wallet.opPage.changer')}</span>
                    </button>
                  ) : null;
                })()}

                <label className={styles.fldL}>{t('wallet.opPage.montantGnf')}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={styles.fldIn}
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                />
                <div className={styles.chips}>
                  {AMOUNT_CHIPS.map(v => (
                    <button key={v} className={styles.chip} onClick={() => setAmount(fmt(v))}>{fmt(v)}</button>
                  ))}
                </div>

                <button className={styles.mdlBtn} onClick={confirm} disabled={submitting}>
                  {submitting ? t('wallet.opPage.traitementEnCours') : modal === 'deposit' ? t('wallet.modalBtns.deposit') : t('wallet.modalBtns.withdraw')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
