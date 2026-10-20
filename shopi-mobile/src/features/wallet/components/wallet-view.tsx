/**
 * Portefeuille Shoneya (contenu de l'écran) — équivalent mobile du composant
 * partagé shared/components/portefeuille/Portefeuille.tsx du site, utilisable
 * par n'importe quel espace (l'écran parent fournit l'en-tête et la barre du bas) :
 *   · carte du solde (masquable), entrées / sorties du mois, en attente ;
 *     « retirable maintenant » et part bloquée par le délai de règlement
 *     (le site ne les montre pas) ; limite de retrait du jour ;
 *   · Déposer (indisponible, expliqué), Retirer, Transférer : choix du moyen
 *     de paiement (ou ajout sur place) puis montant (raccourcis), comme le site ;
 *   · total encaissé, total retiré, commissions Shoneya ;
 *   · évolution des revenus (semaine / mois / année) ;
 *   · transactions (tout / entrées / sorties) avec « Voir plus », export CSV
 *     partagé (le bouton « Exporter » du site ne fait rien) ;
 *   · moyens de paiement : défaut, suppression (confirmée), ajout avec le
 *     formulaire propre à chaque type ; virement automatique hebdomadaire ;
 *   · commissions Shoneya (même texte que le site).
 * `canOperate` = retirer / transférer / modifier les moyens (sinon lecture seule).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, TextInput, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  addMethod,
  AMOUNT_CHIPS,
  composeMethod,
  ELECTRONIC,
  fetchChart,
  fetchTransactions,
  fetchWallet,
  FIELDS,
  fmt,
  isCredit,
  isFormValid,
  methodFormError,
  METHODS,
  removeMethod,
  setAutoTransfer,
  setDefaultMethod,
  transfer,
  TX_PAGE,
  TX_STATUS,
  txIcon,
  withdraw,
  type ChartPeriod,
  type MethodType,
  type PaymentMethod,
  type TxFilter,
  type WalletSummary,
  type WalletTx,
} from '../api';

const CARD = 'rgba(0,0,0,0.04)';
type Op = 'withdraw' | 'transfer';

export function WalletView({
  canOperate,
  initialOp,
  scrollProps,
  bottomPad = 110,
  onRecharge,
}: {
  canOperate: boolean;
  initialOp?: Op;
  scrollProps?: Partial<ScrollViewProps>;
  bottomPad?: number;
  /** Portefeuille client : « Recharger » ouvre l'écran de recharge (à la place de « Déposer » grisé). */
  onRecharge?: () => void;
}) {
  const theme = useTheme();
  const qc = useQueryClient();
  const snack = useSnack();
  const [visible, setVisible] = useState(true);
  const [period, setPeriod] = useState<ChartPeriod>('mois');
  const [filter, setFilter] = useState<TxFilter>('all');
  /* Ouvert depuis « Demander un virement » (Finances) : le retrait s'ouvre directement. */
  const [op, setOp] = useState<Op | null>(initialOp && canOperate ? initialOp : null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<PaymentMethod | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const summary = useQuery({ queryKey: qk.walletPage.summary, queryFn: fetchWallet });
  const chart = useQuery({ queryKey: qk.walletPage.chart(period), queryFn: () => fetchChart(period) });
  const txs = useInfiniteQuery({
    queryKey: qk.walletPage.transactions(filter),
    queryFn: ({ pageParam }) => fetchTransactions(filter, pageParam),
    initialPageParam: 1,
    getNextPageParam: (l) => (l.page * (l.limit || TX_PAGE) < l.total ? l.page + 1 : undefined),
  });


  const refresh = () => void qc.invalidateQueries({ queryKey: qk.walletPage.all });
  const setMethods = (methods: PaymentMethod[]) => qc.setQueryData<WalletSummary>(qk.walletPage.summary, (d) => (d ? { ...d, paymentMethods: methods } : d));

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      snack.show(msg);
      refresh();
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setBusy(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetchTransactions('all', 1, 100);
      const esc = (v: string | number) => (/[";\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      const rows = res.data.map((t) => [new Date(t.createdAt).toLocaleString('fr-FR'), t.description ?? (isCredit(t) ? 'Crédit' : 'Débit'), isCredit(t) ? 'Entrée' : 'Sortie', (isCredit(t) ? 1 : -1) * t.amount, TX_STATUS[t.status] ?? t.status].map(esc).join(';'));
      const csv = `﻿${['Date', 'Description', 'Sens', 'Montant (GNF)', 'Statut'].join(';')}\n${rows.join('\n')}`;
      const name = `releve-portefeuille-${new Date().toISOString().slice(0, 10)}.csv`;
      if (Platform.OS === 'web') {
        const doc = (globalThis as { document?: Document }).document;
        if (doc) {
          const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
          const a = doc.createElement('a');
          a.href = url;
          a.download = name;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else {
        const file = new File(Paths.cache, name);
        file.create({ overwrite: true });
        file.write(csv);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Relevé du portefeuille', UTI: 'public.comma-separated-values-text' });
      }
      snack.show(`📄 Relevé exporté (${res.data.length} opération${res.data.length > 1 ? 's' : ''})`);
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setExporting(false);
    }
  };

  if (summary.isPending) return <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  if (summary.isError || !summary.data) return <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />;
  const s = summary.data;
  const withdrawable = s.withdrawableBalance ?? s.balance;
  const list = txs.data?.pages.flatMap((p) => p.data) ?? [];
  const maxChart = Math.max(1, ...(chart.data ?? []).map((d) => d.value));
  const defaultMethod = s.paymentMethods.find((m) => m.isDefault);
  const autoMethod = s.paymentMethods.find((m) => m.id === s.autoTransferMethodId);
  const trend = s.totalCredited > 0 ? Math.round((s.thisMonthIn / s.totalCredited) * 100) : 0;

  return (
    <>
      <ScrollView {...scrollProps} contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]} refreshControl={<RefreshControl refreshing={summary.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {/* ── Carte solde ── */}
        <View style={styles.balance}>
          <View style={styles.balTop}>
            <View style={styles.balBadge}>
              <View style={styles.balDot} />
              <ThemedText style={styles.balBadgeText}>Solde disponible</ThemedText>
            </View>
            <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={visible ? 'Masquer le solde' : 'Afficher le solde'}>
              <Ionicons name={visible ? 'eye-outline' : 'eye-off-outline'} size={22} color="#fff" />
            </Pressable>
          </View>
          <ThemedText style={styles.balLabel}>Total dans votre portefeuille Shoneya</ThemedText>
          <ThemedText style={styles.balAmount} accessibilityLabel={visible ? `${fmt(s.balance)} ${s.currency}` : 'Solde masqué'}>
            {visible ? fmt(s.balance) : '•• ••• •••'} <ThemedText style={styles.balCur}>{s.currency}</ThemedText>
          </ThemedText>
          {trend > 0 ? <ThemedText style={styles.balTrend}>↗ +{trend} % ce mois</ThemedText> : null}
          <View style={styles.balMini}>
            <Mini value={`+${fmt(s.thisMonthIn)}`} label="Entrées ce mois" color="#86EFAC" />
            <Mini value={`−${fmt(s.thisMonthOut)}`} label="Sorties ce mois" color="#FCA5A5" />
            <Mini value={fmt(s.pendingBalance)} label="En attente" />
          </View>
          <View style={styles.balActions}>
            {onRecharge ? (
              <BalBtn icon="add-circle-outline" label="Recharger" onPress={onRecharge} />
            ) : (
              <BalBtn icon="arrow-down" label="Déposer" disabled onPress={() => snack.show('Dépôt indisponible pour le moment : aucun moyen de paiement réel n’est encore connecté à Shoneya.')} />
            )}
            <BalBtn icon="arrow-up" label="Retirer" disabled={!canOperate} onPress={() => setOp('withdraw')} />
            <BalBtn icon="paper-plane-outline" label="Transférer" disabled={!canOperate} onPress={() => setOp('transfer')} />
          </View>
        </View>

        <View style={styles.box}>
          <Line icon="checkmark-circle-outline" label="Retirable maintenant" value={`${fmt(withdrawable)} GNF`} strong />
          {s.settlementLocked > 0 ? <Line icon="hourglass-outline" label="En délai de règlement" value={`${fmt(s.settlementLocked)} GNF`} /> : null}
          {s.dailyWithdrawLimit > 0 ? <Line icon="speedometer-outline" label="Retraits aujourd’hui" value={`${fmt(s.todayWithdrawAmount)} / ${fmt(s.dailyWithdrawLimit)} GNF`} /> : null}
          {!canOperate ? (
            <ThemedText type="small" themeColor="textSecondary">
              Votre rôle ne permet pas de retirer ou de transférer des fonds.
            </ThemedText>
          ) : null}
        </View>

        {/* ── KPI ── */}
        <View style={styles.kpis}>
          <Kpi icon="arrow-down" value={fmt(s.totalCredited)} label="Total encaissé" />
          <Kpi icon="arrow-up" value={fmt(s.totalDebited)} label="Total retiré" />
          <Kpi icon="pricetag-outline" value={fmt(s.totalCommission)} label="Commissions Shoneya" />
        </View>

        {/* ── Graphique ── */}
        <View style={styles.box}>
          <View style={styles.boxHead}>
            <Ionicons name="bar-chart-outline" size={17} color={Brand.primary} />
            <ThemedText style={styles.boxTitle}>Évolution des revenus</ThemedText>
          </View>
          <Segmented<ChartPeriod> value={period} onChange={setPeriod} options={[['semaine', 'Semaine'], ['mois', 'Mois'], ['annee', 'Année']]} />
          {chart.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : (
            <View style={styles.chart} accessibilityLabel="Graphique des revenus">
              {(chart.data ?? []).map((d, i) => (
                <View key={`${d.label}-${i}`} style={styles.barCol} accessible accessibilityLabel={`${d.label} : ${fmt(d.value)} GNF`}>
                  <ThemedText style={styles.barV} numberOfLines={1}>
                    {d.value ? short(d.value) : ''}
                  </ThemedText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${Math.max(4, (d.value / maxChart) * 100)}%`, opacity: d.value ? 1 : 0.25 }]} />
                  </View>
                  <ThemedText style={styles.barL} themeColor="textSecondary" numberOfLines={1}>
                    {d.label}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Transactions ── */}
        <View style={styles.box}>
          <View style={styles.boxHead}>
            <Ionicons name="list-outline" size={17} color={Brand.primary} />
            <ThemedText style={[styles.boxTitle, styles.flex]}>Transactions récentes</ThemedText>
            <Pressable onPress={() => void exportCsv()} disabled={exporting} accessibilityRole="button" accessibilityLabel="Exporter le relevé" style={styles.link}>
              {exporting ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="download-outline" size={16} color={Brand.primary} />}
              <ThemedText type="smallBold">Exporter</ThemedText>
            </Pressable>
          </View>
          <Segmented<TxFilter> value={filter} onChange={setFilter} options={[['all', 'Tout'], ['in', 'Entrées'], ['out', 'Sorties']]} />
          {txs.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : list.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Aucune transaction
            </ThemedText>
          ) : (
            list.map((t) => <TxRow key={t.id} t={t} />)
          )}
          {txs.hasNextPage ? (
            <Pressable onPress={() => void txs.fetchNextPage()} disabled={txs.isFetchingNextPage} accessibilityRole="button" style={[styles.more, { borderColor: theme.border }]}>
              {txs.isFetchingNextPage ? <ActivityIndicator color={Brand.primary} /> : <ThemedText type="smallBold">Voir plus</ThemedText>}
            </Pressable>
          ) : null}
        </View>

        {/* ── Moyens de paiement ── */}
        <View style={styles.box}>
          <View style={styles.boxHead}>
            <Ionicons name="card-outline" size={17} color={Brand.primary} />
            <ThemedText style={styles.boxTitle}>Méthodes de paiement</ThemedText>
          </View>
          {s.paymentMethods.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune méthode enregistrée
            </ThemedText>
          ) : (
            s.paymentMethods.map((m) => (
              <View key={m.id} style={[styles.method, { backgroundColor: theme.background, borderColor: m.isDefault ? Brand.primaryLine : 'transparent' }]}>
                <Pressable
                  onPress={() => canOperate && !m.isDefault && void run(`def:${m.id}`, async () => setMethods(await setDefaultMethod(m.id)), '✅ Méthode par défaut mise à jour')}
                  disabled={!canOperate || m.isDefault}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.label} ${m.number}${m.isDefault ? ', par défaut' : '. Définir par défaut'}`}
                  style={styles.methodMain}>
                  <MethodLogo type={m.type} />
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold} numberOfLines={1}>
                      {m.label}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {m.number || METHODS[m.type].label}
                    </ThemedText>
                  </View>
                  {busy === `def:${m.id}` ? <ActivityIndicator size="small" color={Brand.primary} /> : m.isDefault ? <View style={styles.defTag}><ThemedText style={styles.defText}>Défaut</ThemedText></View> : null}
                </Pressable>
                {canOperate ? (
                  <Pressable onPress={() => setRemoving(m)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Supprimer ${m.label}`} style={styles.remove}>
                    <Ionicons name="trash-outline" size={18} color={Brand.danger} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
          {canOperate ? (
            <Pressable onPress={() => setAdding(true)} accessibilityRole="button" style={[styles.add, { borderColor: theme.border }]}>
              <Ionicons name="add" size={18} color={Brand.primary} />
              <ThemedText type="smallBold">Ajouter une méthode</ThemedText>
            </Pressable>
          ) : null}
          {canOperate && !defaultMethod && s.paymentMethods.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              Touchez une méthode pour la définir par défaut.
            </ThemedText>
          ) : null}
        </View>

        {/* ── Virement automatique ── */}
        <View style={styles.box}>
          <View style={styles.boxHead}>
            <Ionicons name="repeat-outline" size={17} color={Brand.primary} />
            <ThemedText style={styles.boxTitle}>Virement automatique</ThemedText>
          </View>
          <View style={styles.auto}>
            <View style={styles.flex}>
              <ThemedText style={styles.bold}>Virement hebdomadaire</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {s.autoTransferEnabled && autoMethod ? `Chaque lundi · vers ${autoMethod.label}` : 'Vers votre méthode par défaut'}
              </ThemedText>
            </View>
            {busy === 'auto' ? (
              <ActivityIndicator color={Brand.primary} />
            ) : (
              <Switch
                value={s.autoTransferEnabled}
                disabled={!canOperate}
                onValueChange={(v) => {
                  if (v && !defaultMethod) return snack.show('Ajoutez une méthode de paiement avant d’activer le virement automatique', true);
                  void run('auto', () => setAutoTransfer(v, defaultMethod?.id), v ? '✅ Virement auto activé' : '⏸️ Virement auto désactivé');
                }}
                trackColor={{ false: theme.border, true: Brand.primaryLine }}
                thumbColor={s.autoTransferEnabled ? Brand.primary : '#fff'}
                {...({ activeThumbColor: Brand.primary } as object)}
                accessibilityLabel="Virement hebdomadaire"
              />
            )}
          </View>
        </View>

        {/* ── Commissions ── */}
        <View style={[styles.box, styles.row]}>
          <Ionicons name="information-circle-outline" size={20} color={Brand.primary} />
          <ThemedText type="small" style={styles.flex}>
            Shoneya prélève une commission de <ThemedText type="smallBold">3 %</ThemedText> sur chaque transaction encaissée. Les virements vers Mobile Money sont <ThemedText type="smallBold">gratuits</ThemedText>. Virement bancaire : <ThemedText type="smallBold">1 500 GNF</ThemedText> par opération.
          </ThemedText>
        </View>
      </ScrollView>

      <Snack msg={snack.msg} bottom={bottomPad - 14} />
      {op ? (
        <OperationScreen
          op={op}
          summary={s}
          withdrawable={withdrawable}
          onMethods={setMethods}
          onClose={() => setOp(null)}
          onDone={(m) => {
            setOp(null);
            snack.show(m);
            refresh();
          }}
        />
      ) : null}
      {adding ? (
        <AddMethodSheet
          onClose={() => setAdding(false)}
          onAdded={(methods) => {
            setMethods(methods);
            setAdding(false);
            snack.show('✅ Méthode de paiement ajoutée');
          }}
        />
      ) : null}
      {removing ? (
        <BottomSheet title="Supprimer cette méthode ?" onClose={() => setRemoving(null)}>
          <View style={styles.sheet}>
            <ThemedText themeColor="textSecondary">
              {removing.label} {removing.number} ne pourra plus recevoir vos retraits.
              {removing.id === s.autoTransferMethodId ? ' Elle sert au virement automatique.' : ''}
            </ThemedText>
            <Pressable
              onPress={() => {
                const m = removing;
                setRemoving(null);
                void run(`rm:${m.id}`, async () => setMethods(await removeMethod(m.id)), '🗑️ Méthode de paiement supprimée');
              }}
              accessibilityRole="button"
              style={styles.danger}>
              <ThemedText style={styles.dangerText}>Supprimer</ThemedText>
            </Pressable>
          </View>
        </BottomSheet>
      ) : null}
    </>
  );
}

/* ══════════ Retrait / transfert (écran plein, comme le site) ══════════ */

function OperationScreen({ op, summary, withdrawable, onMethods, onClose, onDone }: { op: Op; summary: WalletSummary; withdrawable: number; onMethods: (m: PaymentMethod[]) => void; onClose: () => void; onDone: (msg: string) => void }) {
  const theme = useTheme();
  const def = summary.paymentMethods.find((m) => m.isDefault && ELECTRONIC.includes(m.type));
  const [step, setStep] = useState<'method' | 'amount'>(def ? 'amount' : 'method');
  const [methodId, setMethodId] = useState(def?.id ?? '');
  const [newType, setNewType] = useState<MethodType | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = op === 'withdraw' ? 'Retirer des fonds' : 'Transférer des fonds';
  const value = Number(amount.replace(/\D/g, '')) || 0;
  const selected = summary.paymentMethods.find((m) => m.id === methodId);

  const addAndSelect = async () => {
    if (!newType) return;
    if (!isFormValid(newType, values)) return setError('Renseignez tous les champs demandés');
    setSaving(true);
    setError(null);
    try {
      const before = new Set(summary.paymentMethods.map((m) => m.id));
      const methods = await addMethod({ type: newType, ...composeMethod(newType, values) });
      onMethods(methods);
      const created = methods.find((m) => !before.has(m.id)) ?? methods[methods.length - 1];
      if (created) {
        setMethodId(created.id);
        setStep('amount');
      }
      setNewType(null);
      setValues({});
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (value <= 0) return setError('Saisissez un montant valide');
    if (!methodId) return setStep('method');
    if (value > withdrawable && op === 'withdraw') return setError(`Montant supérieur au solde retirable (${fmt(withdrawable)} GNF).`);
    setSaving(true);
    setError(null);
    try {
      await (op === 'withdraw' ? withdraw(value, methodId) : transfer(value, methodId));
      onDone(`✅ ${op === 'withdraw' ? 'Retrait' : 'Transfert'} de ${fmt(value)} GNF effectué`);
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={step === 'amount' && !def ? () => setStep('method') : onClose}>
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <View style={[styles.opHead, { borderBottomColor: theme.border }]}>
          <Pressable onPress={step === 'amount' ? () => setStep('method') : onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.opTitle, styles.flex]} accessibilityRole="header">
            {title}
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.opBody} keyboardShouldPersistTaps="handled">
          {step === 'method' ? (
            <>
              <ThemedText themeColor="textSecondary">Choisissez un moyen de paiement électronique vers lequel transférer l’argent avec votre compte Shoneya.</ThemedText>
              <View style={styles.grid}>
                {ELECTRONIC.map((type) => {
                  const existing = summary.paymentMethods.find((m) => m.type === type);
                  const on = newType === type;
                  return (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setError(null);
                        if (existing) {
                          setMethodId(existing.id);
                          setStep('amount');
                        } else {
                          setNewType(type);
                          setValues({});
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${METHODS[type].label}${existing ? `, ${existing.number}` : ', à ajouter'}`}
                      style={[styles.tile, { borderColor: on ? Brand.primary : theme.border }]}>
                      <MethodLogo type={type} />
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {METHODS[type].label}
                      </ThemedText>
                      {existing ? (
                        <ThemedText style={styles.tileSub} themeColor="textSecondary" numberOfLines={1}>
                          {existing.number}
                        </ThemedText>
                      ) : (
                        <ThemedText style={styles.tileSub} themeColor="textSecondary">
                          + Ajouter
                        </ThemedText>
                      )}
                      {existing?.isDefault ? <ThemedText style={styles.tileDef}>Défaut</ThemedText> : null}
                    </Pressable>
                  );
                })}
              </View>
              {newType ? (
                <View style={styles.box}>
                  <ThemedText style={styles.bold}>Ajouter {METHODS[newType].label}</ThemedText>
                  <MethodForm type={newType} values={values} onChange={setValues} />
                  {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
                  <PrimaryButton title={saving ? 'Ajout…' : 'Ajouter et continuer'} onPress={() => void addAndSelect()} loading={saving} pill />
                </View>
              ) : null}
            </>
          ) : (
            <>
              {selected ? (
                <Pressable onPress={() => setStep('method')} accessibilityRole="button" accessibilityLabel={`${selected.label}. Changer de moyen de paiement`} style={[styles.selected, { borderColor: theme.border }]}>
                  <MethodLogo type={selected.type} />
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{selected.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {selected.number}
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold">Changer</ThemedText>
                </Pressable>
              ) : null}
              <ThemedText type="smallBold">Montant (GNF)</ThemedText>
              <TextInput
                value={amount}
                onChangeText={(v) => {
                  const d = v.replace(/\D/g, '');
                  setAmount(d ? fmt(Number(d)) : '');
                }}
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[styles.amountInput, { color: theme.text, borderColor: theme.border }]}
                accessibilityLabel="Montant en francs guinéens"
              />
              <View style={styles.chips}>
                {AMOUNT_CHIPS.map((v) => (
                  <Pressable key={v} onPress={() => setAmount(fmt(v))} accessibilityRole="button" style={[styles.chip, { borderColor: theme.border }]}>
                    <ThemedText type="smallBold">{fmt(v)}</ThemedText>
                  </Pressable>
                ))}
                <Pressable onPress={() => setAmount(fmt(withdrawable))} accessibilityRole="button" style={[styles.chip, { borderColor: theme.border }]}>
                  <ThemedText type="smallBold">Tout ({fmt(withdrawable)})</ThemedText>
                </Pressable>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Retirable maintenant : {fmt(withdrawable)} GNF
              </ThemedText>
              {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
              <PrimaryButton title={saving ? 'Traitement…' : op === 'withdraw' ? 'Confirmer le retrait' : 'Confirmer le transfert'} onPress={() => void confirm()} loading={saving} disabled={!value} pill />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Ajout d'un moyen de paiement — partagé avec Paramètres › Paiement (`types` : choix proposés). */
export function AddMethodSheet({ onClose, onAdded, types }: { onClose: () => void; onAdded: (m: PaymentMethod[]) => void; types?: MethodType[] }) {
  const theme = useTheme();
  const choices = types ?? (Object.keys(METHODS) as MethodType[]);
  const [type, setType] = useState<MethodType>(choices[0] ?? 'orange_money');
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!isFormValid(type, values)) return setError('Renseignez tous les champs demandés');
    const invalid = methodFormError(type, values);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    try {
      onAdded(await addMethod({ type, ...composeMethod(type, values) }));
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };
  return (
    <BottomSheet title="Ajouter une méthode de paiement" onClose={onClose} height={0.85}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <ThemedText type="smallBold">Type</ThemedText>
        <View style={styles.chips}>
          {choices.map((t) => {
            const on = t === type;
            return (
              <Pressable
                key={t}
                onPress={() => {
                  setType(t);
                  setValues({});
                  setError(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <ThemedText type="smallBold">{METHODS[t].label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <MethodForm type={type} values={values} onChange={setValues} />
        {type === 'cash' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Les espèces ne servent pas aux retraits à distance.
          </ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          🔒 Seuls les 4 derniers chiffres d’une carte sont conservés. Aucun code secret ni CVV n’est demandé.
        </ThemedText>
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title={saving ? 'Ajout…' : 'Ajouter'} onPress={() => void submit()} loading={saving} pill />
      </ScrollView>
    </BottomSheet>
  );
}

function MethodForm({ type, values, onChange }: { type: MethodType; values: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const theme = useTheme();
  return (
    <>
      {FIELDS[type].map((f) => (
        <View key={f.key} style={styles.field}>
          <ThemedText type="smallBold">{f.label}</ThemedText>
          <View style={[styles.fieldBox, { borderColor: theme.border }]}>
            {f.prefix ? <ThemedText style={styles.prefix}>{f.prefix}</ThemedText> : null}
            <TextInput
              value={values[f.key] ?? ''}
              onChangeText={(v) => onChange({ ...values, [f.key]: v })}
              placeholder={f.placeholder}
              placeholderTextColor={theme.textSecondary}
              keyboardType={f.numeric ? 'number-pad' : 'default'}
              maxLength={f.maxLength}
              autoCapitalize={f.key === 'holder' || f.key === 'bankName' ? 'words' : 'none'}
              style={[styles.fieldInput, { color: theme.text }]}
              accessibilityLabel={f.label}
            />
          </View>
        </View>
      ))}
    </>
  );
}

/* ── Petits éléments ── */

export function MethodLogo({ type }: { type: MethodType }) {
  const m = METHODS[type];
  return (
    <View style={[styles.logo, { backgroundColor: m.color }]}>
      {m.badge ? <ThemedText style={styles.logoText}>{m.badge}</ThemedText> : <Ionicons name={m.icon ?? 'wallet-outline'} size={18} color="#fff" />}
    </View>
  );
}

function TxRow({ t }: { t: WalletTx }) {
  const theme = useTheme();
  const credit = isCredit(t);
  const d = new Date(t.createdAt);
  return (
    <View style={[styles.tx, { borderTopColor: theme.border }]} accessible accessibilityLabel={`${t.description ?? (credit ? 'Crédit' : 'Débit')}, ${credit ? 'plus' : 'moins'} ${fmt(t.amount)} GNF, ${TX_STATUS[t.status] ?? t.status}`}>
      <View style={[styles.txIco, { backgroundColor: credit ? '#E7F6EE' : '#FDECEC' }]}>
        <Ionicons name={txIcon(t)} size={16} color={credit ? Brand.success : Brand.danger} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.bold} numberOfLines={1}>
          {t.description ?? (credit ? 'Crédit' : 'Débit')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {Number.isNaN(d.getTime()) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {TX_STATUS[t.status] ?? t.status}
        </ThemedText>
      </View>
      <ThemedText style={[styles.txAmt, { color: credit ? Brand.success : Brand.danger }]}>
        {credit ? '+' : '−'}
        {fmt(t.amount)}
      </ThemedText>
    </View>
  );
}

function Mini({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={styles.flex}>
      <ThemedText style={[styles.miniV, color ? { color } : null]} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText style={styles.miniL} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function BalBtn({ icon, label, onPress, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} style={[styles.balBtn, disabled && styles.dim]}>
      <Ionicons name={icon} size={18} color="#fff" />
      <ThemedText style={styles.balBtnText}>{label}</ThemedText>
    </Pressable>
  );
}

function Kpi({ icon, value, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label} : ${value} GNF`}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
      <ThemedText style={styles.kpiV} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
        {label}
      </ThemedText>
    </View>
  );
}

function Line({ icon, label, value, strong }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText style={strong ? styles.lineStrong : styles.bold}>{value}</ThemedText>
    </View>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  const theme = useTheme();
  return (
    <View style={[styles.seg, { backgroundColor: theme.background }]} accessibilityRole="tablist">
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segBtn, on && { backgroundColor: Brand.primarySoft }]}>
            <ThemedText type="smallBold" style={{ color: on ? theme.text : theme.textSecondary }}>
              {l}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dim: { opacity: 0.45 },
  loader: { marginVertical: 24 },
  centerText: { textAlign: 'center', paddingVertical: 12 },
  err: { color: Brand.danger },
  content: { padding: 16, gap: 12 },
  balance: { backgroundColor: '#1F1F1F', borderRadius: 22, padding: 18, gap: 4 },
  balTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  balBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  balDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
  balBadgeText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  balLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 18 },
  balAmount: { color: '#fff', fontSize: 32, lineHeight: 40, fontWeight: '900' },
  balCur: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '700' },
  balTrend: { color: '#86EFAC', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  balMini: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.2)' },
  miniV: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  miniL: { color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: 15 },
  balActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  balBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, minHeight: 44 },
  balBtnText: { color: '#fff', fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  boxTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lineStrong: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: Brand.success },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, backgroundColor: CARD, borderRadius: 16, padding: 12, gap: 2 },
  kpiV: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, minHeight: 34 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 170, paddingTop: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barV: { fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6, backgroundColor: Brand.primary },
  barL: { fontSize: 10.5, lineHeight: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  txIco: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txAmt: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  more: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 42 },
  method: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingRight: 6 },
  methodMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  remove: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  defTag: { backgroundColor: Brand.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  defText: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, minHeight: 46 },
  auto: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  sheet: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  danger: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 999, borderWidth: 1, borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
  dangerText: { color: Brand.danger, fontWeight: '800' },
  opHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  opTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  opBody: { padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47.5%', borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 6 },
  tileSub: { fontSize: 12, lineHeight: 16 },
  tileDef: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  selected: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 12 },
  amountInput: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 26, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  field: { gap: 6 },
  fieldBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontWeight: '800', marginRight: 8 },
  fieldInput: { flex: 1, fontSize: 16, paddingVertical: 11 },
});
