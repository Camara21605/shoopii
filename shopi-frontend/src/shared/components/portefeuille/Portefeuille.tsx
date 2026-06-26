/* ============================================================
 * FICHIER : src/shared/components/portefeuille/Portefeuille.tsx
 *
 * RÔLE : Composant Portefeuille partagé — réutilisable dans
 *        tous les dashboards Shopi (entreprise, livreur,
 *        correspondant, partenaire, client, administrateur,
 *        super-admin). Chaque utilisateur gère son propre
 *        wallet via l'API /api/wallet.
 * ============================================================ */

import { useEffect, useState, useCallback } from 'react';
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
  orange_money: { cls: styles.pmOm,   icon: null, text: 'OM' },
  mtn_money:    { cls: styles.pmMtn,  icon: null, text: 'MM' },
  card:         { cls: styles.pmCard, icon: 'fa-credit-card', text: null },
  bank:         { cls: styles.pmBank, icon: 'fa-building-columns', text: null },
  cash:         { cls: styles.pmCash, icon: 'fa-money-bill-wave', text: null },
};

const PM_LABELS: Record<WalletPaymentMethodType, string> = {
  orange_money: 'Orange Money',
  mtn_money: 'MTN Money',
  card: 'Carte bancaire',
  bank: 'Virement bancaire',
  cash: 'Espèces (Cash)',
};

const AMOUNT_CHIPS = [50000, 100000, 500000, 1000000];

type ModalType = 'deposit' | 'withdraw' | 'transfer' | 'add-method' | null;

const MODAL_TITLES: Record<string, string> = {
  deposit: 'Déposer des fonds',
  withdraw: 'Retirer des fonds',
  transfer: 'Transférer des fonds',
};
const MODAL_BTNS: Record<string, string> = {
  deposit: 'Confirmer le dépôt',
  withdraw: 'Confirmer le retrait',
  transfer: 'Confirmer le transfert',
};
const MODAL_LBLS: Record<string, string> = {
  deposit: 'Depuis',
  withdraw: 'Vers',
  transfer: 'Vers',
};

export default function Portefeuille() {
  const { pop } = useToast();

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const [txFilter, setTxFilter] = useState<WalletTxFilter>('all');
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const [chartPeriod, setChartPeriod] = useState<WalletChartPeriod>('mois');
  const [chartData, setChartData] = useState<WalletChartPoint[]>([]);

  const [modal, setModal] = useState<ModalType>(null);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [newMethod, setNewMethod] = useState<{ type: WalletPaymentMethodType; label: string; number: string }>({
    type: 'orange_money',
    label: '',
    number: '',
  });

  /* ── Chargement ── */
  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchWalletSummary();
      setSummary(data);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Impossible de charger le portefeuille', 'e');
    }
  }, [pop]);

  const loadTransactions = useCallback(async (filter: WalletTxFilter) => {
    try {
      const res = await fetchWalletTransactions(filter, 1, 10);
      setTransactions(res.data);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Impossible de charger les transactions', 'e');
    }
  }, [pop]);

  const loadChart = useCallback(async (period: WalletChartPeriod) => {
    try {
      const data = await fetchWalletChart(period);
      setChartData(data);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Impossible de charger le graphique', 'e');
    }
  }, [pop]);

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
    setMethodId(summary?.paymentMethods.find(m => m.isDefault)?.id ?? summary?.paymentMethods[0]?.id ?? '');
    setModal(type);
  }
  function closeModal() { setModal(null); }

  async function confirmOperation() {
    const amt = Number(amount.replace(/\s/g, '').replace(/[^\d]/g, ''));
    if (!amt || amt <= 0) { pop('Saisissez un montant valide', 'w'); return; }

    setSubmitting(true);
    try {
      const dto = { amount: amt, methodId: methodId || undefined };
      if (modal === 'deposit')  await depositWallet(dto);
      if (modal === 'withdraw') await withdrawWallet(dto);
      if (modal === 'transfer') await transferWallet(dto);

      const labels: Record<string, string> = { deposit: 'Dépôt', withdraw: 'Retrait', transfer: 'Transfert' };
      pop(`✅ ${labels[modal as string]} de ${fmt(amt)} GNF effectué`, 's');
      closeModal();
      await Promise.all([loadSummary(), loadTransactions(txFilter), loadChart(chartPeriod)]);
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Opération impossible', 'e');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Méthodes de paiement ── */
  async function handleAddMethod() {
    if (!newMethod.label.trim() || !newMethod.number.trim()) {
      pop('Renseignez le libellé et le numéro', 'w');
      return;
    }
    setSubmitting(true);
    try {
      await addWalletPaymentMethod(newMethod);
      pop('✅ Méthode de paiement ajoutée', 's');
      setNewMethod({ type: 'orange_money', label: '', number: '' });
      closeModal();
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Ajout impossible', 'e');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultWalletPaymentMethod(id);
      pop('✅ Méthode par défaut mise à jour', 's');
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Action impossible', 'e');
    }
  }

  async function handleRemoveMethod(id: string) {
    try {
      await removeWalletPaymentMethod(id);
      pop('🗑️ Méthode de paiement supprimée', 'i');
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Suppression impossible', 'e');
    }
  }

  async function handleToggleAutoTransfer(enabled: boolean) {
    const defaultMethod = summary?.paymentMethods.find(m => m.isDefault);
    if (enabled && !defaultMethod) {
      pop('Ajoutez une méthode de paiement avant d\'activer le virement automatique', 'w');
      return;
    }
    try {
      await setWalletAutoTransfer({ enabled, methodId: defaultMethod?.id });
      pop(enabled ? '✅ Virement auto activé' : '⏸️ Virement auto désactivé', enabled ? 's' : 'w');
      await loadSummary();
    } catch (err) {
      pop(err instanceof ApiError ? err.message : 'Action impossible', 'e');
    }
  }

  /* ── Rendu transaction ── */
  function renderTxIcon(t: WalletTransaction) {
    if (t.referenceType === 'commission') return { icon: 'fa-percent', cls: 'com' };
    if (t.referenceType === 'withdraw')   return { icon: 'fa-arrow-up', cls: 'wd' };
    if (t.referenceType === 'transfer')   return { icon: 'fa-paper-plane', cls: t.type === 'credit' ? 'in' : 'out' };
    if (t.referenceType === 'deposit')    return { icon: 'fa-arrow-down', cls: 'in' };
    return { icon: t.type === 'credit' ? 'fa-bag-shopping' : 'fa-arrow-up', cls: t.type === 'credit' ? 'in' : 'out' };
  }

  if (loading) {
    return (
      <div className={styles.wallet}>
        <div className={styles.loading}><i className="fas fa-spinner fa-spin"></i> Chargement du portefeuille…</div>
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
          <div className={styles.wlTitle}><i className="fas fa-wallet"></i> Portefeuille</div>
          <div className={styles.wlSub}>Gérez votre solde, vos retraits et vos transactions Shopi</div>
        </div>
        <div className={styles.wlHeadActs}>
          <button className={styles.btnSec} onClick={() => pop('📄 Export du relevé en cours…', 'i')}>
            <i className="fas fa-file-arrow-down"></i> Exporter
          </button>
          <button className={styles.btnPri} onClick={() => openModal('withdraw')}>
            <i className="fas fa-arrow-up-from-bracket"></i> Retirer des fonds
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
                <div className={styles.balBadge}><span></span> Solde disponible</div>
                <button className={styles.balEye} onClick={() => setBalanceVisible(v => !v)} title="Masquer le solde">
                  <i className={`fas ${balanceVisible ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                </button>
              </div>
              <div className={styles.balLbl}>Total dans votre portefeuille Shopi</div>
              <div className={styles.balAmount}>
                <span>{balanceVisible ? fmt(summary.balance) : '•• •••  •••'}</span>
                <span className={styles.cur}>{summary.currency}</span>
              </div>
              {trendPct > 0 && (
                <div className={styles.balTrend}><i className="fas fa-arrow-trend-up"></i> +{trendPct} % ce mois</div>
              )}

              <div className={styles.balMini}>
                <div><div className={`${styles.bmV} ${styles.bmIn}`}>+{fmt(summary.thisMonthIn)}</div><div className={styles.bmL}>Entrées ce mois</div></div>
                <div><div className={`${styles.bmV} ${styles.bmOut}`}>−{fmt(summary.thisMonthOut)}</div><div className={styles.bmL}>Sorties ce mois</div></div>
                <div><div className={styles.bmV}>{fmt(summary.pendingBalance)}</div><div className={styles.bmL}>En attente</div></div>
              </div>

              <div className={styles.balActions}>
                <button className={`${styles.baBtn} ${styles.baDeposit}`} onClick={() => openModal('deposit')}>
                  <i className="fas fa-arrow-down"></i> Déposer
                </button>
                <button className={`${styles.baBtn} ${styles.baWithdraw}`} onClick={() => openModal('withdraw')}>
                  <i className="fas fa-arrow-up"></i> Retirer
                </button>
                <button className={`${styles.baBtn} ${styles.baTransfer}`} onClick={() => openModal('transfer')}>
                  <i className="fas fa-paper-plane"></i> Transférer
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
              <div className={styles.wkL}>Total encaissé</div>
            </div>
            <div className={`${styles.wk} ${styles.k2}`}>
              <div className={styles.wkStripe}></div>
              <div className={styles.wkTop}>
                <div className={styles.wkIc}><i className="fas fa-arrow-up"></i></div>
              </div>
              <div className={styles.wkV}>{fmt(summary.totalDebited)}</div>
              <div className={styles.wkL}>Total retiré</div>
            </div>
            <div className={`${styles.wk} ${styles.k3}`}>
              <div className={styles.wkStripe}></div>
              <div className={styles.wkTop}>
                <div className={styles.wkIc}><i className="fas fa-percent"></i></div>
              </div>
              <div className={styles.wkV}>{fmt(summary.totalCommission)}</div>
              <div className={styles.wkL}>Commissions Shopi</div>
            </div>
          </div>

          {/* Graphique */}
          <div className={styles.card}>
            <div className={styles.ch}>
              <div className={styles.chT}><i className="fas fa-chart-column"></i> Évolution des revenus</div>
              <div className={styles.chartTabs}>
                {(['semaine', 'mois', 'annee'] as WalletChartPeriod[]).map(p => (
                  <button
                    key={p}
                    className={`${styles.ctab} ${chartPeriod === p ? styles.on : ''}`}
                    onClick={() => setChartPeriod(p)}
                  >
                    {p === 'semaine' ? 'Semaine' : p === 'mois' ? 'Mois' : 'Année'}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.cb}>
              <div className={styles.chartBars}>
                {chartData.map((d, i) => (
                  <div className={styles.cbw} key={i}>
                    <div className={styles.cbar} style={{ height: `${Math.max(4, (d.value / maxChart) * 100)}%` }}>
                      <span className={styles.cbv}>{fmt(d.value)} GNF</span>
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
              <div className={styles.chT}><i className="fas fa-list-ul"></i> Transactions récentes</div>
              <div className={styles.txFilter}>
                {(['all', 'in', 'out'] as WalletTxFilter[]).map(f => (
                  <button
                    key={f}
                    className={`${styles.txf} ${txFilter === f ? styles.on : ''}`}
                    onClick={() => setTxFilter(f)}
                  >
                    {f === 'all' ? 'Tout' : f === 'in' ? 'Entrées' : 'Sorties'}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.cb}>
              <div className={styles.txList}>
                {transactions.length === 0 && <div className={styles.txEmpty}>Aucune transaction</div>}
                {transactions.map(t => {
                  const { icon, cls } = renderTxIcon(t);
                  const isCredit = t.type === 'credit' || t.type === 'refund';
                  return (
                    <div className={styles.txRow} key={t.id}>
                      <div className={`${styles.txIc} ${styles[cls]}`}><i className={`fas ${icon}`}></i></div>
                      <div className={styles.txInf}>
                        <div className={styles.txNm}>{t.description ?? (isCredit ? 'Crédit' : 'Débit')}</div>
                        <div className={styles.txMeta}>
                          <span>{new Date(t.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          <span className={`${styles.txSt} ${t.status === 'completed' ? styles.ok : styles.pend}`}>
                            {t.status === 'completed' ? 'Validé' : t.status === 'pending' ? 'En attente' : t.status === 'failed' ? 'Échoué' : 'Annulé'}
                          </span>
                        </div>
                      </div>
                      <div className={`${styles.txAmt} ${isCredit ? styles.in : styles.out}`}>
                        {isCredit ? '+' : '−'}{fmt(t.amount)} GNF
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
            <div className={styles.ch}><div className={styles.chT}><i className="fas fa-credit-card"></i> Méthodes de paiement</div></div>
            <div className={styles.cb}>
              {summary.paymentMethods.length === 0 && (
                <div className={styles.pmEmpty}>Aucune méthode enregistrée</div>
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
                      {m.isDefault && <span className={styles.pmDefTag}>Défaut</span>}
                      <button
                        className={styles.pmRemove}
                        title="Supprimer"
                        onClick={(e) => { e.stopPropagation(); handleRemoveMethod(m.id); }}
                      >
                        <i className="fas fa-xmark"></i>
                      </button>
                    </div>
                  );
                })}
              </div>
              <button className={styles.pmAdd} onClick={() => setModal('add-method')}>
                <i className="fas fa-plus"></i> Ajouter une méthode
              </button>
            </div>
          </div>

          {/* Virement automatique */}
          <div className={styles.card}>
            <div className={styles.ch}><div className={styles.chT}><i className="fas fa-clock-rotate-left"></i> Virement automatique</div></div>
            <div className={styles.cb}>
              <div className={styles.sched}>
                <div className={styles.schedIc}><i className="fas fa-calendar-check"></i></div>
                <div>
                  <div className={styles.schedNm}>Virement hebdomadaire</div>
                  <div className={styles.schedSub}>
                    {summary.autoTransferEnabled && summary.paymentMethods.find(m => m.id === summary.autoTransferMethodId)
                      ? `Chaque lundi · vers ${summary.paymentMethods.find(m => m.id === summary.autoTransferMethodId)?.label}`
                      : 'Vers votre méthode par défaut'}
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

          {/* Commission Shopi */}
          <div className={styles.card}>
            <div className={styles.ch}><div className={styles.chT}><i className="fas fa-circle-info"></i> Commissions Shopi</div></div>
            <div className={styles.cb}>
              <div className={styles.comBox}>
                <i className="fas fa-percent"></i>
                <p>
                  Shopi prélève une commission de <strong>3 %</strong> sur chaque transaction encaissée.
                  Les virements vers Mobile Money sont <strong>gratuits</strong>.
                  Virement bancaire : <strong>1 500 GNF</strong> par opération.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── MODAL OPÉRATION ── */}
      {(modal === 'deposit' || modal === 'withdraw' || modal === 'transfer') && (
        <div className={styles.mdlBg} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={styles.mdl}>
            <div className={styles.mdlH}>
              <div className={styles.mdlT}>{MODAL_TITLES[modal]}</div>
              <button className={styles.mdlX} onClick={closeModal}><i className="fas fa-xmark"></i></button>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Montant (GNF)</label>
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
            {summary.paymentMethods.length > 0 && (
              <div className={styles.fld}>
                <label className={styles.fldL}>{MODAL_LBLS[modal]}</label>
                <select className={styles.fldIn} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
                  {summary.paymentMethods.map(m => (
                    <option key={m.id} value={m.id}>{m.label} — {m.number}</option>
                  ))}
                </select>
              </div>
            )}
            <button className={styles.mdlBtn} onClick={confirmOperation} disabled={submitting}>
              {submitting ? 'Traitement…' : MODAL_BTNS[modal]}
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL AJOUT MÉTHODE ── */}
      {modal === 'add-method' && (
        <div className={styles.mdlBg} onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className={styles.mdl}>
            <div className={styles.mdlH}>
              <div className={styles.mdlT}>Ajouter une méthode de paiement</div>
              <button className={styles.mdlX} onClick={closeModal}><i className="fas fa-xmark"></i></button>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Type</label>
              <select
                className={styles.fldIn}
                value={newMethod.type}
                onChange={(e) => setNewMethod(m => ({ ...m, type: e.target.value as WalletPaymentMethodType, label: PM_LABELS[e.target.value as WalletPaymentMethodType] }))}
              >
                {Object.entries(PM_LABELS).map(([type, label]) => (
                  <option key={type} value={type}>{label}</option>
                ))}
              </select>
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Libellé</label>
              <input
                type="text"
                className={styles.fldIn}
                placeholder="Ex : Orange Money"
                value={newMethod.label}
                onChange={(e) => setNewMethod(m => ({ ...m, label: e.target.value }))}
              />
            </div>
            <div className={styles.fld}>
              <label className={styles.fldL}>Numéro / référence</label>
              <input
                type="text"
                className={styles.fldIn}
                placeholder="Ex : +224 622 00 00 01"
                value={newMethod.number}
                onChange={(e) => setNewMethod(m => ({ ...m, number: e.target.value }))}
              />
            </div>
            <button className={styles.mdlBtn} onClick={handleAddMethod} disabled={submitting}>
              {submitting ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
