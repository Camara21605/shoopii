/**
 * Espace entreprise › Finances — équivalent mobile de
 * /dashboard/entreprise/finances (FinancesPage.tsx) :
 *   · solde disponible, revenus du mois (vs mois dernier), dépenses du mois
 *     (commissions + livraison), en attente (escrow, libéré à la livraison) ;
 *   · évolution des revenus sur 6 mois (M GNF, mois en cours mis en avant) ;
 *   · répartition du mois (ventes, livraisons facturées, commissions) ;
 *   · transactions récentes ; virements Shoneya (reçus / en attente) ;
 *   · actions : bilan mensuel (CSV partagé), demander un virement (ouvre le
 *     retrait du portefeuille), infos de paiement (paramètres › Paiement),
 *     portefeuille. Sur le site, ces boutons n'affichent qu'un message.
 * Accès : payments.view.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { useCompanyIdentity, usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { dateFr, fetchFinances, fmt, repartitionLabel, shareMonthlyReport, type Finances } from '../api';

const CARD = 'rgba(0,0,0,0.04)';

export default function FinancesScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const identity = useCompanyIdentity();
  const canView = perms.isOwner || perms.can('payments', 'view');
  const canWithdraw = perms.isOwner;
  const canSettings = perms.isOwner || perms.can('settings', 'view');
  const [exporting, setExporting] = useState(false);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.finances, queryFn: fetchFinances, enabled: canView });
  const f = q.data;

  const report = async () => {
    if (!f) return;
    setExporting(true);
    try {
      await shareMonthlyReport(f, (identity.data as { companyName?: string } | undefined)?.companyName ?? 'Boutique');
      snack.show('📊 Bilan du mois exporté');
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setExporting(false);
    }
  };

  let body: React.ReactNode;
  if (perms.loading || (q.isPending && canView)) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.h2}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les finances. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError || !f) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView {...hideOnScroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={styles.kpis}>
          <Kpi icon="💳" value={fmt(f.solde)} label="Solde disponible" sub="Wallet entreprise" />
          <Kpi icon="📈" value={fmt(f.revenusMois)} label="Revenus ce mois" sub={`${f.croissanceRevenus >= 0 ? '+' : ''}${f.croissanceRevenus} % vs mois dernier`} tone={f.croissanceRevenus > 0 ? Brand.success : f.croissanceRevenus < 0 ? Brand.danger : undefined} />
          <Kpi icon="📉" value={fmt(f.depensesMois)} label="Dépenses ce mois" sub="Commissions + livraison" />
          <Kpi icon="⏳" value={fmt(f.soldeEnAttente)} label="En attente (escrow)" sub="Libéré à la livraison" />
        </View>

        <Revenue data={f.caData} />
        <Repartition f={f} />

        <View style={styles.box}>
          <Head icon="list-outline" title="Transactions récentes" />
          {f.transactions.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune transaction pour l’instant.
            </ThemedText>
          ) : (
            f.transactions.map((t) => (
              <View key={t.id} style={[styles.tx, { borderTopColor: theme.border }]} accessible accessibilityLabel={`${t.description}, ${t.montant >= 0 ? 'plus' : 'moins'} ${fmt(Math.abs(t.montant))} GNF`}>
                <View style={[styles.txIco, { backgroundColor: t.dir === 'in' ? '#E7F6EE' : '#FDECEC' }]}>
                  <Ionicons name={t.dir === 'in' ? 'arrow-down' : 'arrow-up'} size={16} color={t.dir === 'in' ? Brand.success : Brand.danger} />
                </View>
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {t.description}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {t.reference ? `${t.reference} · ` : ''}
                    {dateFr(t.date)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.amt, { color: t.dir === 'in' ? Brand.success : Brand.danger }]}>
                  {t.montant >= 0 ? '+' : '−'}
                  {fmt(Math.abs(t.montant))}
                </ThemedText>
              </View>
            ))
          )}
        </View>

        <View style={styles.box}>
          <Head icon="business-outline" title="Virements Shoneya" />
          {f.virements.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucun virement pour l’instant.
            </ThemedText>
          ) : (
            f.virements.map((v) => (
              <View key={v.id} style={[styles.tx, { borderTopColor: theme.border }]}>
                <View style={[styles.dot, { backgroundColor: v.statut === 'done' ? Brand.success : '#F5A524' }]} />
                <View style={styles.flex}>
                  <ThemedText style={styles.bold}>+{fmt(v.montant)} GNF</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {dateFr(v.date)}
                  </ThemedText>
                </View>
                <View style={[styles.pill, { backgroundColor: v.statut === 'done' ? '#E7F6EE' : '#FEF3E2' }]}>
                  <ThemedText style={[styles.pillText, { color: v.statut === 'done' ? '#0F7B45' : '#B45309' }]}>{v.statut === 'done' ? '✓ Reçu' : '⏳ Attente'}</ThemedText>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.box}>
          <Head icon="flash-outline" title="Actions" />
          <Action icon="document-text-outline" title="Télécharger bilan mensuel" text="Chiffres, répartition et mouvements du mois (CSV)" onPress={() => void report()} busy={exporting} />
          {canWithdraw ? <Action icon="arrow-up-circle-outline" title="Demander virement anticipé" text="Retirer vers Mobile Money ou banque" onPress={() => router.push({ pathname: '/entreprise/portefeuille', params: { op: 'withdraw' } })} /> : null}
          {canSettings ? <Action icon="settings-outline" title="Modifier infos de paiement" text="Moyens de paiement de la boutique" onPress={() => router.push('/entreprise/parametres/paiement')} /> : null}
          {canWithdraw ? <Action icon="wallet-outline" title="Ouvrir le portefeuille" text="Solde, retraits, moyens de paiement" onPress={() => router.push('/entreprise/portefeuille')} /> : null}
        </View>
      </ScrollView>
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Finances" subtitle="Revenus, dépenses et virements" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="finances" />
      <Snack msg={snack.msg} bottom={96} />
    </SafeAreaView>
  );
}

function Revenue({ data }: { data: Finances['caData'] }) {
  const max = Math.max(1, ...data.map((d) => d.v));
  const allZero = data.every((d) => d.v === 0);
  return (
    <View style={styles.box}>
      <Head icon="bar-chart-outline" title="Évolution des revenus" />
      {data.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune donnée pour le moment.
        </ThemedText>
      ) : (
        <>
          <View style={styles.chart}>
            {data.map((d, i) => {
              const last = i === data.length - 1;
              return (
                <View key={`${d.m}-${i}`} style={styles.barCol} accessible accessibilityLabel={`${d.m} : ${d.v} millions de GNF`}>
                  <ThemedText style={styles.barV}>{d.v ? `${d.v}M` : ''}</ThemedText>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: `${Math.max(4, (d.v / max) * 100)}%`, backgroundColor: last ? Brand.primary : 'rgba(0,0,0,0.18)' }]} />
                  </View>
                  <ThemedText style={[styles.barL, last && styles.bold]} themeColor={last ? undefined : 'textSecondary'}>
                    {d.m}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: Brand.primary }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Revenus (M GNF)
            </ThemedText>
            <View style={[styles.legendDot, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Mois précédents
            </ThemedText>
          </View>
          {allZero ? (
            <ThemedText type="small" themeColor="textSecondary">
              Les montants sont arrondis au million de GNF : un mois sous 500 000 GNF apparaît à 0.
            </ThemedText>
          ) : null}
        </>
      )}
    </View>
  );
}

function Repartition({ f }: { f: Finances }) {
  const theme = useTheme();
  return (
    <View style={styles.box}>
      <Head icon="pie-chart-outline" title="Répartition" />
      {f.repartition.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Aucune donnée ce mois.
        </ThemedText>
      ) : (
        f.repartition.map((r) => (
          <View key={r.label} style={styles.rep}>
            <View style={styles.repTop}>
              <ThemedText type="small" style={[styles.flex, styles.bold]}>
                {repartitionLabel(r.label)}
              </ThemedText>
              <ThemedText type="smallBold" style={{ color: r.montant < 0 ? Brand.danger : theme.text }}>
                {r.montant < 0 ? '−' : ''}
                {fmt(Math.abs(r.montant))} GNF
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.repPct}>
                {r.pct > 0 ? `+${r.pct}` : r.pct} %
              </ThemedText>
            </View>
            <View style={[styles.bar, { backgroundColor: theme.background }]}>
              <View style={[styles.barFillH, { width: `${Math.abs(r.pct)}%`, backgroundColor: r.pct < 0 ? Brand.danger : Brand.primary }]} />
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function Kpi({ icon, value, label, sub, tone }: { icon: string; value: string; label: string; sub: string; tone?: string }) {
  return (
    <View style={styles.kpi} accessible accessibilityLabel={`${label} : ${value} GNF. ${sub}`}>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV} numberOfLines={1} adjustsFontSizeToFit>
        {value} <ThemedText style={styles.kpiCur}>GNF</ThemedText>
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText type="small" themeColor={tone ? undefined : 'textSecondary'} style={tone ? { color: tone, fontWeight: '700' } : undefined} numberOfLines={1}>
        {sub}
      </ThemedText>
    </View>
  );
}

function Head({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  return (
    <View style={styles.head}>
      <Ionicons name={icon} size={17} color={Brand.primary} />
      <ThemedText style={styles.headTitle}>{title}</ThemedText>
    </View>
  );
}

function Action({ icon, title, text, onPress, busy }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string; onPress: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={title} style={({ pressed }) => [styles.action, { borderTopColor: theme.border }, pressed && styles.pressed]}>
      <View style={[styles.actionIco, { backgroundColor: theme.background }]}>{busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={icon} size={18} color={Brand.primary} />}</View>
      <View style={styles.flex}>
        <ThemedText style={styles.bold}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: CARD, borderRadius: 16, padding: 12, gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 19, lineHeight: 25, fontWeight: '900' },
  kpiCur: { fontSize: 12, fontWeight: '700' },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 160 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barV: { fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barL: { fontSize: 11, lineHeight: 15 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  rep: { gap: 5 },
  repTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repPct: { width: 44, textAlign: 'right' },
  bar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  barFillH: { height: 7, borderRadius: 4 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  txIco: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  amt: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  pillText: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  actionIco: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
