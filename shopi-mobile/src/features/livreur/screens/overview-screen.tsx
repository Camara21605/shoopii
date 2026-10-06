/**
 * Espace livreur › Vue d'ensemble — équivalent mobile de
 * /dashboard/livreur (OverviewPage.tsx), données réelles uniquement :
 *   · mission active : produit, boutique, client, gain, compte à rebours
 *     jusqu'à l'échéance → Voir la commande / Détails ;
 *   · missions diffusées par son entreprise (pas encore prises) → Accepter ;
 *   · chiffres : livraisons du mois, revenus du mois, note, boutiques ;
 *   · graphique des revenus (semaine / mois) avec total et moyenne par jour ;
 *   · mes missions (2 premières) : accepter, refuser, voir ;
 *   · évaluation, activité récente.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { acceptDispo, activityIcon, fetchActivity, fetchDispos, fetchEnCours, fetchRevenus, fetchRevenusChart, gnf, relativeTime, short, type ChartPeriod, type EnCours } from '../api';
import { Box, CARD, Empty, Kpi, LivreurScreen, MissionCard, RefuseSheet } from '../components';
import { useLivreurStats, useMissions } from '../hooks';
import { useMissionActions } from '../use-mission-actions';

export default function LivreurOverviewScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const stats = useLivreurStats();
  const missions = useMissions();
  const revenus = useQuery({ queryKey: qk.livreur.revenus, queryFn: fetchRevenus });
  const encours = useQuery({ queryKey: qk.livreur.encours, queryFn: fetchEnCours, refetchInterval: 30_000 });
  const dispos = useQuery({ queryKey: qk.livreur.dispos, queryFn: fetchDispos, refetchInterval: 60_000 });
  const activity = useQuery({ queryKey: qk.livreur.activity, queryFn: fetchActivity });
  const [period, setPeriod] = useState<ChartPeriod>('semaine');
  const chart = useQuery({ queryKey: qk.livreur.chart(period), queryFn: () => fetchRevenusChart(period) });
  const actions = useMissionActions();
  const [taking, setTaking] = useState<string | null>(null);

  const refreshing = stats.isRefetching || missions.isRefetching;
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.livreur.all });

  const takeDispo = async (id: string, title: string) => {
    setTaking(id);
    try {
      await acceptDispo(id);
      actions.snack.show(`✅ Mission « ${title} » acceptée`);
      refresh();
    } catch (e) {
      actions.snack.show(toUserMessage(e) || '❌ Un autre livreur l’a peut-être déjà prise.', true);
      void dispos.refetch();
    } finally {
      setTaking(null);
    }
  };

  const rating = stats.data?.averageRating != null ? Number(stats.data.averageRating) : null;
  const data = chart.data ?? [];
  const max = Math.max(1, ...data.map((d) => d.v));
  const total = data.reduce((s, d) => s + d.v, 0);

  return (
    <LivreurScreen title="Vue d’ensemble" subtitle="Votre activité de livraison" tab="overview" snack={actions.snack.msg}>
      <ScrollView {...hideOnScroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {encours.data ? <ActiveMission m={encours.data} /> : null}

        {dispos.data?.length ? (
          <Box icon="megaphone-outline" title="Missions disponibles">
            {dispos.data.map((d) => (
              <View key={d.id} style={[styles.dispo, { backgroundColor: theme.background }]}>
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={2}>
                    {d.urgent ? '🔴 ' : ''}
                    {d.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[d.zone, d.reward ? gnf(d.reward) : null].filter(Boolean).join(' · ') || 'Détails à confirmer avec l’entreprise'}
                  </ThemedText>
                </View>
                <Pressable onPress={() => void takeDispo(d.id, d.title)} disabled={taking === d.id} accessibilityRole="button" accessibilityLabel={`Accepter ${d.title}`} style={styles.take}>
                  {taking === d.id ? <ActivityIndicator color={Brand.primaryInk} /> : <ThemedText type="smallBold">Accepter</ThemedText>}
                </Pressable>
              </View>
            ))}
          </Box>
        ) : null}

        <View style={styles.kpis}>
          <Kpi icon="🚚" value={stats.data ? String(stats.data.deliveriesThisMonth) : '—'} label="Livraisons ce mois" />
          <Kpi icon="💰" value={revenus.data ? gnf(revenus.data.revenusThisMonth) : '—'} label="Revenus ce mois" />
          <Kpi icon="⭐" value={rating != null ? rating.toFixed(1) : '—'} label="Note moyenne" />
          <Kpi icon="🏪" value={stats.data ? String(stats.data.boutiquesAbonnees) : '—'} label="Boutiques abonnées" />
        </View>

        <Box icon="trending-up-outline" title="Mes revenus">
          <View style={[styles.seg, { backgroundColor: theme.background }]}>
            {(['semaine', 'mois'] as const).map((p) => (
              <Pressable key={p} onPress={() => setPeriod(p)} accessibilityRole="tab" accessibilityState={{ selected: period === p }} style={[styles.segBtn, period === p && { backgroundColor: Brand.primarySoft }]}>
                <ThemedText type="smallBold" style={{ color: period === p ? theme.text : theme.textSecondary }}>
                  {p === 'semaine' ? 'Semaine' : 'Mois'}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          {chart.isPending ? (
            <ActivityIndicator color={Brand.primary} />
          ) : data.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucun revenu sur cette période.
            </ThemedText>
          ) : (
            <>
              <View style={styles.chart}>
                {data.map((d, i) => (
                  <View key={`${d.j}-${i}`} style={styles.barCol} accessible accessibilityLabel={`${d.j} : ${gnf(d.v)}`}>
                    <ThemedText style={styles.barV}>{d.v ? short(d.v) : ''}</ThemedText>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${Math.max(4, (d.v / max) * 100)}%`, backgroundColor: d.today ? Brand.primary : 'rgba(0,0,0,0.18)' }]} />
                    </View>
                    <ThemedText style={[styles.barL, d.today && styles.bold]} themeColor={d.today ? undefined : 'textSecondary'}>
                      {d.j}
                      {d.today ? ' ●' : ''}
                    </ThemedText>
                  </View>
                ))}
              </View>
              <View style={styles.chartFoot}>
                <ThemedText type="small">
                  Total : <ThemedText type="smallBold">{gnf(total)}</ThemedText>
                </ThemedText>
                <ThemedText type="smallBold">Moy./jour : {gnf(Math.round(total / Math.max(1, data.length)))}</ThemedText>
              </View>
            </>
          )}
        </Box>

        <Box icon="bicycle-outline" title="Mes missions" action={`Toutes (${missions.data?.length ?? 0})`} onAction={() => router.navigate('/livreur/missions')}>
          {missions.isPending ? (
            <ActivityIndicator color={Brand.primary} />
          ) : !missions.data?.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune mission assignée pour le moment.
            </ThemedText>
          ) : (
            missions.data.slice(0, 2).map((m) => (
              <MissionCard
                key={m.uuid}
                m={m}
                busy={actions.busy === m.uuid}
                onOpen={() => router.push({ pathname: '/livreur/missions/[id]', params: { id: m.uuid } })}
                onAccept={() => void actions.accept(m)}
                onRefuse={() => actions.setRefusing(m)}
              />
            ))
          )}
        </Box>

        <Box icon="star-outline" title="Mon évaluation" action="Voir" onAction={() => router.push('/livreur/evaluation')}>
          <View style={styles.eval}>
            <ThemedText style={styles.evalV}>{rating != null ? rating.toFixed(1) : '—'}</ThemedText>
            <View>
              <ThemedText style={styles.stars}>{'★'.repeat(Math.round(rating ?? 0))}{'☆'.repeat(5 - Math.round(rating ?? 0))}</ThemedText>
              {!rating ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Pas encore de note
                </ThemedText>
              ) : null}
            </View>
          </View>
        </Box>

        <Box icon="pulse-outline" title="Activité récente">
          {!activity.data?.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune activité récente.
            </ThemedText>
          ) : (
            activity.data.slice(0, 5).map((a) => (
              <View key={a.id} style={[styles.act, !a.isRead && styles.actUnread]}>
                <View style={[styles.actIco, { backgroundColor: theme.background }]}>
                  <Ionicons name={activityIcon(a.type)} size={15} color={Brand.primary} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="small" style={styles.bold} numberOfLines={2}>
                    {a.title}
                  </ThemedText>
                  <ThemedText style={styles.time} themeColor="textSecondary">
                    {relativeTime(a.createdAt)}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </Box>
        {!stats.data && stats.isError ? <Empty emoji="⚠️" title="Chargement impossible" text={toUserMessage(stats.error)} /> : null}
      </ScrollView>
      {actions.refusing ? <RefuseSheet m={actions.refusing} onClose={() => actions.setRefusing(null)} onConfirm={actions.refuse} /> : null}
    </LivreurScreen>
  );
}

/** Bannière de la mission active, avec compte à rebours (etaAt réel). */
export function ActiveMission({ m, compact }: { m: EnCours; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!m.etaAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [m.etaAt]);
  const secs = m.etaAt ? Math.max(0, Math.floor((new Date(m.etaAt).getTime() - now) / 1000)) : 0;
  const urgent = !!m.etaAt && secs < 300;
  const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <View style={styles.banner}>
      <View style={styles.bannerTop}>
        <ThemedText style={styles.bannerEmoji}>🛵</ThemedText>
        <View style={styles.flex}>
          <ThemedText style={styles.bannerLabel}>Mission active · {m.id}</ThemedText>
          <ThemedText style={styles.bannerTitle} numberOfLines={2}>
            {m.nm}
          </ThemedText>
          <ThemedText style={styles.bannerMeta} numberOfLines={2}>
            🏪 {m.shop} · 👤 {m.client.nom} · 💰 {gnf(m.fee)}
          </ThemedText>
        </View>
        {m.etaAt ? (
          <View style={[styles.timer, urgent && styles.timerUrgent]} accessible accessibilityLabel={`Temps restant ${clock}`}>
            <ThemedText style={styles.timerV}>{clock}</ThemedText>
            <ThemedText style={styles.timerL}>restant</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.bannerBtns}>
        <Pressable onPress={() => router.push({ pathname: '/livreur/missions/[id]', params: { id: m.uuid } })} accessibilityRole="button" style={[styles.bBtn, styles.bBtnMain]}>
          <Ionicons name="checkmark-circle-outline" size={17} color="#1F1F1F" />
          <ThemedText style={styles.bBtnMainText}>Voir la commande</ThemedText>
        </Pressable>
        {!compact ? (
          <Pressable onPress={() => router.navigate('/livreur/encours')} accessibilityRole="button" style={styles.bBtn}>
            <Ionicons name="navigate-outline" size={17} color="#fff" />
            <ThemedText style={styles.bBtnText}>Détails</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dispo: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 10 },
  take: { borderRadius: 999, paddingHorizontal: 14, minHeight: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  seg: { flexDirection: 'row', borderRadius: 12, padding: 3, gap: 3 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 9, minHeight: 34 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150 },
  barCol: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  barV: { fontSize: 9.5, lineHeight: 13, fontWeight: '700' },
  barTrack: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 6 },
  barL: { fontSize: 10.5, lineHeight: 14 },
  chartFoot: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  eval: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  evalV: { fontSize: 38, lineHeight: 44, fontWeight: '900' },
  stars: { fontSize: 20, lineHeight: 26, color: '#F5A524', letterSpacing: 1 },
  act: { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.75 },
  actUnread: { opacity: 1 },
  actIco: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 11.5, lineHeight: 15 },
  banner: { backgroundColor: '#1F1F1F', borderRadius: 22, padding: 16, gap: 12 },
  bannerTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bannerEmoji: { fontSize: 30, lineHeight: 38 },
  bannerLabel: { color: '#86EFAC', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  bannerTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  bannerMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  timer: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  timerUrgent: { backgroundColor: 'rgba(239,68,68,0.35)' },
  timerV: { color: '#fff', fontSize: 18, lineHeight: 23, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerL: { color: 'rgba(255,255,255,0.7)', fontSize: 10.5, lineHeight: 14 },
  bannerBtns: { flexDirection: 'row', gap: 8 },
  bBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' },
  bBtnMain: { backgroundColor: '#fff', flex: 1.4 },
  bBtnMainText: { color: '#1F1F1F', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  bBtnText: { color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '800' },
  card: { backgroundColor: CARD },
});
