/* ============================================================
 * FICHIER : src/shared/components/portefeuille/Portefeuille.tsx
 *
 * RÔLE : Composant Portefeuille partagé — réutilisable dans
 *        tous les dashboards Shoneya (entreprise, livreur,
 *        correspondant, partenaire, client, administrateur,
 *        super-admin). Chaque utilisateur gère son propre
 *        wallet via l'API /api/wallet.
 * ============================================================ */

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../context/ToastContext';
import {
  fetchWalletSummary,
  fetchWalletTransactions,
  fetchWalletChart,
  depositWallet,
  withdrawWallet,
  transferWallet,
  addWalletPaymentMethod,
  setDefaultWalletPaymentMethod,
  removeWalletPaymentMethod,
  setWalletAutoTransfer,
  getWalletMethodMeta,
  WALLET_ELECTRONIC_METHOD_TYPES,
  getWalletMethodFormFields,
  isWalletMethodFormValid,
  composeWalletMethodPayload,
  type WalletSummary,
  type WalletTransaction,
  type WalletChartPoint,
  type WalletChartPeriod,
  type WalletTxFilter,
  type WalletPaymentMethodType,
} from '../../services/walletApi';
import { ApiError } from '../../services/apiFetch';
import styles from './Portefeuille.module.css';

/* ── Helpers ── */
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n));

const PM_LOGOS: Record<WalletPaymentMethodType, { cls: string; icon: string | null; text: string | null }> = {
  orange_money: { cls: styles.pmOm,      icon: null, text: 'OM' },
  mtn_money:    { cls: styles.pmMtn,     icon: null, text: 'MM' },
  kulu:         { cls: styles.pmKulu,    icon: null, text: 'KU' },
  paycard:      { cls: styles.pmPaycard, icon: 'fa-money-check-dollar', text: null },
  card:         { cls: styles.pmCard,    icon: 'fa-credit-card', text: null },
  bank:         { cls: styles.pmBank,    icon: 'fa-building-columns', text: null },
  cash:         { cls: styles.pmCash,    icon: 'fa-money-bill-wave', text: null },
};

const AMOUNT_CHIPS = [50000, 100000, 500000, 1000000];

type ModalType = 'deposit' | 'withdraw' | 'transfer' | 'add-method' | null;

export default function Portefeuille() {
  const { t } = useTranslation();
  const { pop } = useToast();

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const [txFilter, setTxFilter] = useState<WalletTxFilter>('all');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [chartPeriod, setChartPeriod] = useState<WalletChartPeriod>('mois');
  const [chartData, setChartData] = useState<WalletChartPoint[]>([]);

  const [modal, setModal] = useState<ModalType>(null);
  const [opStep, setOpStep] = useState<'method' | 'amount'>('method');
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /** Tuile active dans la grille d'icônes de l'étape "choisir un moyen de
   *  paiement" (dépôt/retrait/transfert). */
  const [activeAddType, setActiveAddType] = useState<WalletPaymentMethodType | null>(null);
  const [formValues,    setFormValues]    = useState<Record<string, string>>({});

  /** Modale "Ajouter une méthode" de la colonne droite — type sélectionné
   *  au clavier (pas une tuile) + ses propres valeurs de formulaire,
   *  distincts de la grille ci-dessus. */
  const [standaloneType,   setStandaloneType]   = useState<WalletPaymentMethodType>('orange_money');
  const [standaloneValues, setStandaloneValues] = useState<Record<string, string>>({});

  /* ── Chargement ── */
  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchWalletSummary();
      setSummary(data);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.loadWalletFailed'), 'e');
    }
  }, [pop, t]);

  const loadTransactions = useCallback(async (filter: WalletTxFilter) => {
    try {
      const res = await fetchWalletTransactions(filter, 1, 10);
      setTransactions(res.data);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.loadTransactionsFailed'), 'e');
    }
  }, [pop, t]);

  const loadChart = useCallback(async (period: WalletChartPeriod) => {
    try {
      const data = await fetchWalletChart(period);
      setChartData(data);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.loadChartFailed'), 'e');
    }
  }, [pop, t]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadSummary(), loadTransactions('all'), loadChart('mois')]);
      setLoading(false);
    })();
  }, [loadSummary, loadTransactions, loadChart]);

  useEffect(() => { loadTransactions(txFilter); }, [txFilter, loadTransactions]);
  useEffect(() => { loadChart(chartPeriod); }, [chartPeriod, loadChart]);

  /* ── Modal opération (dépôt / retrait / transfert) ── */
  function openModal(type: ModalType) {
    setAmount('');
    setMethodId('');
    setOpStep('method');
    setActiveAddType(null);
    setModal(type);
  }
  function closeModal() { setModal(null); }

  function selectMethodForOp(id: string) {
    setMethodId(id);
    setOpStep('amount');
  }

  function openAddType(type: WalletPaymentMethodType) {
    setActiveAddType(type);
    setFormValues({});
  }

  async function addMethodAndSelect() {
    if (!activeAddType) return;
    if (!isWalletMethodFormValid(activeAddType, formValues)) {
      pop(t('wallet.errors.champsRequis'), 'w');
      return;
    }
    setSubmitting(true);
    try {
      const before = new Set((summary?.paymentMethods ?? []).map(m => m.id));
      const payload = composeWalletMethodPayload(activeAddType, formValues, t);
      const methods = await addWalletPaymentMethod({ type: activeAddType, ...payload });
      setSummary(prev => prev ? { ...prev, paymentMethods: methods } : prev);
      const created = methods.find(m => !before.has(m.id)) ?? methods[methods.length - 1];
      setActiveAddType(null);
      setFormValues({});
      if (created) selectMethodForOp(created.id);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.ajoutImpossible'), 'e');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmOperation() {
    const amt = Number(amount.replace(/\s/g, '').replace(/[^\d]/g, ''));
    if (!amt || amt <= 0) { pop(t('wallet.errors.montantInvalide'), 'w'); return; }
    if (!methodId) { pop(t('wallet.errors.choisirMoyenPaiement'), 'w'); setOpStep('method'); return; }

    setSubmitting(true);
    try {
      const dto = { amount: amt, methodId };
      if (modal === 'deposit')  await depositWallet(dto);
      if (modal === 'withdraw') await withdrawWallet(dto);
      if (modal === 'transfer') await transferWallet(dto);

      const labels: Record<string, string> = { deposit: t('wallet.opLabels.deposit'), withdraw: t('wallet.opLabels.withdraw'), transfer: t('wallet.opLabels.transfer') };
      pop(t('wallet.toasts.operationEffectuee', { label: labels[modal as string], montant: fmt(amt) }), 's');
      closeModal();
      await Promise.all([loadSummary(), loadTransactions(txFilter), loadChart(chartPeriod)]);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.operationImpossible'), 'e');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Méthodes de paiement ── */
  async function handleAddMethod() {
    if (!isWalletMethodFormValid(standaloneType, standaloneValues)) {
      pop(t('wallet.errors.champsRequis'), 'w');
      return;
    }
    setSubmitting(true);
    try {
      const payload = composeWalletMethodPayload(standaloneType, standaloneValues, t);
      await addWalletPaymentMethod({ type: standaloneType, ...payload });
      pop(t('wallet.toasts.methodeAjoutee'), 's');
      setStandaloneType('orange_money');
      setStandaloneValues({});
      closeModal();
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.ajoutImpossible'), 'e');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultWalletPaymentMethod(id);
      pop(t('wallet.toasts.methodeParDefautMaj'), 's');
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.actionImpossible'), 'e');
    }
  }

  async function handleRemoveMethod(id: string) {
    try {
      await removeWalletPaymentMethod(id);
      pop(t('wallet.toasts.methodeSupprimee'), 'i');
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.suppressionImpossible'), 'e');
    }
  }

  async function handleToggleAutoTransfer(enabled: boolean) {
    const defaultMethod = summary?.paymentMethods.find(m => m.isDefault);
    if (enabled && !defaultMethod) {
      pop(t('wallet.errors.activerAutoTransferRequisMethode'), 'w');
      return;
    }
    try {
      await setWalletAutoTransfer({ enabled, methodId: defaultMethod?.id });
      pop(enabled ? t('wallet.toasts.virementAutoActive') : t('wallet.toasts.virementAutoDesactive'), enabled ? 's' : 'w');
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : t('wallet.errors.actionImpossible'), 'e');
    }
  }

  /* ── Rendu transaction ── */
  function renderTxIcon(tx: WalletTransaction) {
    if (tx.referenceType === 'commission') return { icon: 'fa-percent', cls: 'com' };
    if (tx.referenceType === 'withdraw')   return { icon: 'fa-arrow-up', cls: 'wd' };
    if (tx.referenceType === 'transfer')   return { icon: 'fa-paper-plane', cls: tx.type === 'credit' ? 'in' : 'out' };
    if (tx.referenceType === 'deposit')    return { icon: 'fa-arrow-down', cls: 'in' };
    return { icon: tx.type === 'credit' ? 'fa-bag-shopping' : 'fa-arrow-up', cls: tx.type === 'credit' ? 'in' : 'out' };
  }

  if (loading) {
    return (
      <div className={styles.wallet}>
        <div className={styles.loading}><i className="fas fa-spinner fa-spin"></i> {t('wallet.loadingWallet')}</div>
      </div>
    );
  }
  if (!summary) return null;

  const maxChart = Math.max(1, ...chartData.map(d => d.value));
  const trendPct = summary.totalCredited > 0
    ? Math.round((summary.thisMonthIn / summary.totalCredited) * 100)
    : 0;

  return (
    <div className={styles.wallet}>

      {/* ── EN-TÊTE ── */}
      <div className={styles.wlHead}>
        <div>
          <div className={styles.wlTitle}><i className="fas fa-wallet"></i> {t('wallet.header.title')}</div>
          <div className={styles.wlSub}>{t('wallet.header.subtitle')}</div>
        </div>
        <div className={styles.wlHeadActs}>
          <button className={styles.btnSec} onClick={() => pop(t('wallet.header.exportToast'), 'i')}>
            <i className="fas fa-file-arrow-down"></i> {t('wallet.header.exporter')}
          </button>
          <button className={styles.btnPri} onClick={() => openModal('withdraw')}>
            <i className="fas fa-arrow-up-from-bracket"></i> {t('wallet.header.retirerDesFonds')}
          </button>
        </div>
      </div>

      <div className={styles.wlGrid}>

        {/* ── COLONNE GAUCHE ── */}
        <div>

          {/* Carte solde */}
          <div className={styles.balCard}>
            <div className={styles.balBg}></div>
            <div className={styles.balGridDec}></div>
            <div className={styles.balIn}>
              <div className={styles.balTop}>
                <div className={styles.balBadge}><span></span> {t('wallet.balance.soldeDisponible')}</div>
                <button className={styles.balEye} onClick={() => setBalanceVisible(v => !v)} title={t('wallet.balance.masquerSolde')}>
                  <i className={`fas ${balanceVisible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                </button>
              </div>
              <div className={styles.balLbl}>{t('wallet.balance.totalPortefeuille')}</div>
              <div className={styles.balAmount}>
                <span>{balanceVisible ? fmt(summary.balance) : '•• •••  •••'}</span>
                <span className={styles.cur}>{summary.currency}</span>
              </div>
              {trendPct > 0 && (
                <div className={styles.balTrend}><i className="fas fa-arrow-trend-up"></i> {t('wallet.balance.ceMois', { pct: trendPct })}</div>
              )}

              <div className={styles.balMini}>
                <div><div className={`${styles.bmV} ${styles.bmIn}`}>+{fmt(summary.thisMonthIn)}</div><div className={styles.bmL}>{t('wallet.balance.entreesCeMois')}</div></div>
                <div><div className={`${styles.bmV} ${styles.bmOut}`}>−{fmt(summary.thisMonthOut)}</div><div className={styles.bmL}>{t('wallet.balance.sortiesCeMois')}</div></div>
                <div><div className={styles.bmV}>{fmt(summary.pendingBalance)}</div><div className={styles.bmL}>{t('wallet.balance.enAttente')}</div></div>
              </div>

              <div className={styles.balActions}>
                <button className={`${styles.baBtn} ${styles.baDeposit}`} onClick={() => openModal('deposit')}>
                  <i className="fas fa-arrow-down"></i> {t('wallet.balance.deposer')}
                </button>
                <button className={`${styles.baBtn} ${styles.baWithdraw}`} onClick={() => openModal('withdraw')}>
                  <i className="fas fa-arrow-up"></i> {t('wallet.balance.retirer')}
                </button>
                <button className={`${styles.baBtn} ${styles.baTransfer}`} onClick={() => openModal('transfer')}>
                  <i className="fas fa-paper-plane"></i> {t('wallet.balance.transferer')}
                </button>
              </div>
            </div>
          </div>

          {/* KPI */}
          <div className={styles.wlKpis}>
            <div className={`${styles.wk} ${styles.k1}`}>
              <div className={styles.wkStripe}></div>
              <div className={styles.wkTop}>
                <div className={styles.wkIc}><i className="fas fa-arrow-down"></i></div>
              </div>
              <div className={styles.wkV}>{fmt(summary.totalCredited)}</div>
              <div className={styles.wkL}>{t('wallet.kpi.totalEncaisse')}</div>
            </div>
            <div className={`${styles.wk} ${styles.k2}`}>
              <div className={styles.wkStripe}></div>
              <div className={styles.wkTop}>
                <div className={styles.wkIc}><i className="fas fa-arrow-up"></i></div>
              </div>
              <div className={styles.wkV}>{fmt(summary.totalDebited)}</div>
              <div className={styles.wkL}>{t('wallet.kpi.totalRetire')}</div>
            </div>
            <div className={`${styles.wk} ${styles.k3}`}>
              <div className={styles.wkStripe}></div>
              <div className={styles.wkTop}>
                <div className={styles.wkIc}><i className="fas fa-percent"></i></div>
              </div>
              <div className={styles.wkV}>{fmt(summary.totalCommission)}</div>
              <div className={styles.wkL}>{t('wallet.kpi.commissionsShopi')}</div>
            </div>
          </div>

          {/* Graphique */}
          <div className={styles.card}>
            <div className={styles.ch}>
              <div className={styles.chT}><i className="fas fa-chart-column"></i> {t('wallet.chart.title')}</div>
              <div className={styles.chartTabs}>
                {(['semaine', 'mois', 'annee'] as WalletChartPeriod[]).map(p => (
                  <button
                    key={p}
                    className={`${styles.ctab} ${chartPeriod === p ? styles.on : ''}`}
                    onClick={() => setChartPeriod(p)}
                  >
                    {p === 'semaine' ? t('wallet.chart.semaine') : p === 'mois' ? t('wallet.chart.mois') : t('wallet.chart.annee')}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.cb}>
              <div className={styles.chartBars}>
                {chartData.map((d, i) => (
                  <div className={styles.cbw} key={i}>
                    <div className={styles.cbar} style={{ height: `${Math.max(4, (d.value / maxChart) * 100)}%` }}>
                      <span className={styles.cbv}>{fmt(d.value)} {t('finances.gnf')}</span>
                    </div>
                    <div className={styles.cbl}>{d.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions */}
          <div className={styles.card}>
            <div className={styles.ch}>
              <div className={styles.chT}><i className="fas fa-list-ul"></i> {t('wallet.transactions.title')}</div>
              <div className={styles.txFilter}>
                {(['all', 'in', 'out'] as WalletTxFilter[]).map(f => (
                  <button
                    key={f}
                    className={`${styles.txf} ${txFilter === f ? styles.on : ''}`}
                    onClick={() => setTxFilter(f)}
                  >
                    {f === 'all' ? t('wallet.transactions.tout') : f === 'in' ? t('wallet.transactions.entrees') : t('wallet.transactions.sorties')}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.cb}>
              <div className={styles.txList}>
                {transactions.length === 0 && <div className={styles.txEmpty}>{t('wallet.transactions.aucune')}</div>}
                {transactions.map(tx => {
                  const { icon, cls } = renderTxIcon(tx);
                  const isCredit = tx.type === 'credit' || tx.type === 'refund';
                  return (
                    <div className={styles.txRow} key={tx.id}>
                      <div className={`${styles.txIc} ${styles[cls]}`}><i className={`fas ${icon}`}></i></div>
                      <div className={styles.txInf}>
                        <div className={styles.txNm}>{tx.description ?? (isCredit ? t('wallet.transactions.credit') : t('wallet.transactions.debit'))}</div>
                        <div className={styles.txMeta}>
                          <span>{new Date(tx.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`${styles.txSt} ${tx.status === 'completed' ? styles.ok : styles.pend}`}>
                            {tx.status === 'completed' ? t('wallet.transactions.statutValide') : tx.status === 'pending' ? t('wallet.transactions.statutEnAttente') : tx.status === 'failed' ? t('wallet.transactions.statutEchoue') : t('wallet.transactions.statutAnnule')}
                          </span>
                        </div>
                      </div>
                      <div className={`${styles.txAmt} ${isCredit ? styles.in : styles.out}`}>
                        {isCredit ? '+' : '−'}{fmt(tx.amount)} {t('finances.gnf')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* ── COLONNE DROITE ── */}
        <div>

          {/* Méthodes de paiement */}
          <div className={styles.card}>
            <div className={styles.ch}><div className={styles.chT}><i className="fas fa-credit-card"></i> {t('wallet.methodes.title')}</div></div>
            <div className={styles.cb}>
              {summary.paymentMethods.length === 0 && (
                <div className={styles.pmEmpty}>{t('wallet.methodes.aucune')}</div>
              )}
              <div className={styles.pmList}>
                {summary.paymentMethods.map(m => {
                  const logo = PM_LOGOS[m.type];
                  return (
                    <div className={`${styles.pm} ${m.isDefault ? styles.def : ''}`} key={m.id} onClick={() => !m.isDefault && handleSetDefault(m.id)}>
                      <div className={`${styles.pmLogo} ${logo.cls}`}>
                        {logo.icon ? <i className={`fas ${logo.icon}`}></i> : logo.text}
                      </div>
                      <div className={styles.pmInf}>
                        <div className={styles.pmNm}>{m.label}</div>
                        <div className={styles.pmNo}>{m.number}</div>
                      </div>
                      {m.isDefault && <span className={styles.pmDefTag}>{t('wallet.methodes.defaut')}</span>}
                      <button
                        className={styles.pmRemove}
                        title={t('wallet.methodes.supprimer')}
                        onClick={(e) => { e.stopPropagation(); handleRemoveMethod(m.id); }}
                      >
                        <i className="fas fa-xmark"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className={styles.pmAdd} onClick={() => { setStandaloneType('orange_money'); setStandaloneValues({}); setModal('add-method'); }}>
                <i className="fas fa-plus"></i> {t('wallet.methodes.ajouter')}
              </button>
            </div>
          </div>

          {/* Virement automatique */}
          <div className={styles.card}>
            <div className={styles.ch}><div className={styles.chT}><i className="fas fa-clock-rotate-left"></i> {t('wallet.autoTransfer.title')}</div></div>
            <div className={styles.cb}>
              <div className={styles.sched}>
                <div className={styles.schedIc}><i className="fas fa-calendar-check"></i></div>
                <div>
                  <div className={styles.schedNm}>{t('wallet.autoTransfer.hebdomadaire')}</div>
                  <div className={styles.schedSub}>
                    {summary.autoTransferEnabled && summary.paymentMethods.find(m => m.id === summary.autoTransferMethodId)
                      ? t('wallet.autoTransfer.chaqueVersMethode', { label: summary.paymentMethods.find(m => m.id === summary.autoTransferMethodId)?.label })
                      : t('wallet.autoTransfer.versMethodeParDefaut')}
                  </div>
                </div>
                <label className={`${styles.tog} ${styles.schedTog}`}>
                  <input
                    type="checkbox"
                    checked={summary.autoTransferEnabled}
                    onChange={(e) => handleToggleAutoTransfer(e.target.checked)}
                  />
                  <span className={styles.togSl}></span>
                </label>
              </div>
            </div>
          </div>

          {/* Commission Shoneya */}
          <div className={styles.card}>
            <div className={styles.ch}><div className={styles.chT}><i className="fas fa-circle-info"></i> {t('wallet.commission.title')}</div></div>
            <div className={styles.cb}>
              <div className={styles.comBox}>
                <i className="fas fa-percent"></i>
                <p>
                  {t('wallet.commission.textPart1')} <strong>{t('wallet.commission.textPct')}</strong> {t('wallet.commission.textPart2')} <strong>{t('wallet.commission.textGratuits')}</strong>{t('wallet.commission.textPart3')} <strong>{t('wallet.commission.textMontant')}</strong> {t('wallet.commission.textPart4')}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── PAGE OPÉRATION (dépôt / retrait / transfert) — pas une petite
           modale : un écran plein qui couvre tout, avec les moyens de
           paiement affichés en grille d'icônes ── */}
      {(modal === 'deposit' || modal === 'withdraw' || modal === 'transfer') && (
        <div className={styles.pageOverlay}>
          <div className={styles.pageHeader}>
            <button className={styles.pageBack} onClick={opStep === 'amount' ? () => setOpStep('method') : closeModal}>
              <i className="fas fa-arrow-left"></i>
            </button>
            <div className={styles.pageTitle}>{t(`wallet.modalTitles.${modal}`)}</div>
            <button className={styles.pageClose} onClick={closeModal}><i className="fas fa-xmark"></i></button>
          </div>

          <div className={styles.pageBody}>
            {opStep === 'method' ? (
              <>
                <p className={styles.mdlIntro}>
                  {modal === 'deposit' ? t('wallet.opPage.chooseMethodFrom') : t('wallet.opPage.chooseMethodTo')}
                </p>

                <div className={styles.pmGrid}>
                  {WALLET_ELECTRONIC_METHOD_TYPES.map(type => {
                    const meta = getWalletMethodMeta(t)[type];
                    const existing = summary.paymentMethods.find(m => m.type === type);
                    return (
                      <button
                        key={type}
                        type="button"
                        className={styles.pmTile}
                        onClick={() => existing ? selectMethodForOp(existing.id) : openAddType(type)}
                      >
                        <span className={styles.pmTileIcon} style={{ background: meta.color }}>
                          {meta.icon ? <i className={`fas ${meta.icon}`}></i> : meta.badge}
                        </span>
                        <span className={styles.pmTileNm}>{meta.label}</span>
                        {existing
                          ? <span className={styles.pmTileNo}>{existing.number}</span>
                          : <span className={styles.pmTileAdd}><i className="fas fa-plus"></i> {t('wallet.opPage.ajouter')}</span>}
                        {existing?.isDefault && <span className={styles.pmTileDef}>{t('wallet.methodes.defaut')}</span>}
                      </button>
                    );
                  })}
                </div>

                {activeAddType && (
                  <div className={styles.pmAddBox}>
                    <div className={styles.pmAddTtl}>
                      <i className="fas fa-plus"></i> {t('wallet.opPage.ajouterType', { type: getWalletMethodMeta(t)[activeAddType].label })}
                    </div>
                    {getWalletMethodFormFields(t)[activeAddType].map(field => (
                      <div className={styles.fld} key={field.key}>
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
                              onChange={(e) => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
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
                            onChange={(e) => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                          />
                        )}
                      </div>
                    ))}
                    <button className={styles.mdlBtn} onClick={addMethodAndSelect} disabled={submitting}>
                      {submitting ? t('wallet.opPage.ajoutEnCours') : t('wallet.opPage.ajouterEtContinuer')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {(() => {
                  const selected = summary.paymentMethods.find(m => m.id === methodId);
                  const meta = selected ? getWalletMethodMeta(t)[selected.type] : null;
                  return selected && meta ? (
                    <button type="button" className={styles.pmSelected} onClick={() => setOpStep('method')}>
                      <span className={styles.pmTileIcon} style={{ background: meta.color }}>
                        {meta.icon ? <i className={`fas ${meta.icon}`}></i> : meta.badge}
                      </span>
                      <span className={styles.pmPickInfo}>
                        <span className={styles.pmPickNm}>{selected.label}</span>
                        <span className={styles.pmPickNo}>{selected.number}</span>
                      </span>
                      <span className={styles.pmChange}>{t('wallet.opPage.changer')}</span>
                    </button>
                  ) : null;
                })()}

                <div className={styles.fld}>
                  <label className={styles.fldL}>{t('wallet.opPage.montantGnf')}</label>
                  <input
                    type="text"
                    className={styles.fldIn}
                    placeholder="0"
                    inputMode="numeric"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <div className={styles.amtChips}>
                    {AMOUNT_CHIPS.map(v => (
                      <button key={v} className={styles.amtChip} onClick={() => setAmount(fmt(v))}>{fmt(v)}</button>
                    ))}
                  </div>
                </div>
                <button className={styles.mdlBtn} onClick={confirmOperation} disabled={submitting}>
                  {submitting ? t('wallet.opPage.traitementEnCours') : t(`wallet.modalBtns.${modal}`)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL AJOUT MÉTHODE ── */}
      {modal === 'add-method' && (
        <div className={styles.mdlBg} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={styles.mdl}>
            <div className={styles.mdlH}>
              <div className={styles.mdlT}>{t('wallet.addMethodModal.title')}</div>
              <button className={styles.mdlX} onClick={closeModal}><i className="fas fa-xmark"></i></button>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>{t('wallet.addMethodModal.typeLabel')}</label>
              <select
                className={styles.fldIn}
                value={standaloneType}
                onChange={(e) => { setStandaloneType(e.target.value as WalletPaymentMethodType); setStandaloneValues({}); }}
              >
                {Object.entries(getWalletMethodMeta(t)).map(([type, meta]) => (
                  <option key={type} value={type}>{meta.label}</option>
                ))}
              </select>
            </div>
            {getWalletMethodFormFields(t)[standaloneType].map(field => (
              <div className={styles.fld} key={field.key}>
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
                      value={standaloneValues[field.key] ?? ''}
                      onChange={(e) => setStandaloneValues(v => ({ ...v, [field.key]: e.target.value }))}
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    inputMode={field.inputMode}
                    maxLength={field.maxLength}
                    className={styles.fldIn}
                    placeholder={field.placeholder}
                    value={standaloneValues[field.key] ?? ''}
                    onChange={(e) => setStandaloneValues(v => ({ ...v, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
            <button className={styles.mdlBtn} onClick={handleAddMethod} disabled={submitting}>
              {submitting ? t('wallet.opPage.ajoutEnCours') : t('wallet.opPage.ajouter')}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
