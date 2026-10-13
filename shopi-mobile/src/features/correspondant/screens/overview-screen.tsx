/**
 * Espace correspondant › Vue d'ensemble — équivalent mobile de
 * /dashboard/correspondant (OverviewPage.tsx), données réelles uniquement
 * (GET /dashboard/correspondant/overview) :
 *   · colis urgent (le plus ancien pas encore réceptionné au-delà du délai
 *     maximal du point relais) → ouvrir le colis pour valider sa réception ;
 *   · chiffres : missions, revenus du mois, taux de succès, partenaires ;
 *   · colis par statut (à réceptionner, en stock, transferts, retours) → liste filtrée ;
 *   · flux du point relais : boutiques → vous → livreurs ;
 *   · ce mois-ci : nouveaux colis, colis livrés, revenus (le site affiche des objectifs
 *     fixes « 160 missions / 1 000 000 GNF » inventés : pas repris) ;
 *   · activité récente (5 derniers colis).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { COLIS_STATUS, gnf, type ColisStatus } from '../api';
import { Box, CARD, CorrespondantScreen, Kpi } from '../components';
import { useCorrespondantMe, useOverview } from '../hooks';

export default function CorrespondantOverviewScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const q = useOverview();
  const me = useCorrespondantMe();
  const d = q.data;
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.correspondant.all });
  const openColis = (filter: ColisStatus) => router.navigate({ pathname: '/correspondant/colis', params: { filtre: filter } });

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !d) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else {
    const u = d.colisUrgent;
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {u ? (
          <Pressable
            onPress={() => (u.uuid ? router.push({ pathname: '/correspondant/colis/[id]', params: { id: u.uuid } }) : openColis('att'))}
            accessibilityRole="button"
            accessibilityLabel={`Colis urgent ${u.id} : ${u.nm}. Ouvrir`}
            style={styles.urgent}>
            <Ionicons name="alert-circle" size={22} color={Brand.danger} />
            <View style={styles.flex}>
              <ThemedText style={styles.urgentTitle}>Colis en attente depuis trop longtemps</ThemedText>
              <ThemedText type="small" numberOfLines={2}>
                {u.id} · {u.nm} — 🏪 {u.boutique} → 👤 {u.client} · {gnf(u.valeur ?? 0)}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Brand.danger} />
          </Pressable>
        ) : null}

        <View style={styles.kpis}>
          <Kpi icon="📦" value={String(d.kpis.missionsTotales)} label="Missions totales" />
          <Kpi icon="💰" value={gnf(d.kpis.revenusCeMois)} label="Revenus ce mois" onPress={() => router.navigate('/correspondant/revenus')} />
          <Kpi icon="✅" value={d.kpis.missionsTotales ? `${d.kpis.tauxSucces} %` : '—'} label="Taux de succès" sub="Livrés / terminés" />
          <Kpi icon="🤝" value={String(d.kpis.partenairesActifs)} label="Partenaires" sub="Boutiques et livreurs" />
        </View>

        <Box icon="cube-outline" title="Mes colis" action="Tous les colis" onAction={() => router.navigate('/correspondant/colis')}>
          <View style={styles.states}>
            {(['att', 'stock', 'dep', 'ret'] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => (s === 'dep' ? router.navigate('/correspondant/transferts') : s === 'ret' ? router.navigate('/correspondant/retours') : openColis(s))}
                accessibilityRole="button"
                accessibilityLabel={`${COLIS_STATUS[s].label} : ${d.colisCounts[s]}`}
                style={[styles.state, { backgroundColor: COLIS_STATUS[s].bg }]}>
                <ThemedText style={[styles.stateN, { color: COLIS_STATUS[s].color }]}>{d.colisCounts[s]}</ThemedText>
                <ThemedText style={[styles.stateL, { color: COLIS_STATUS[s].color }]} numberOfLines={2}>
                  {COLIS_STATUS[s].label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Box>

        <Box icon="git-network-outline" title="Flux de mon point relais">
          <View style={styles.flow}>
            <FlowNode emoji="🏪" n={d.relayFlow.sources} label={d.relayFlow.sources > 1 ? 'Boutiques' : 'Boutique'} onPress={() => router.navigate('/correspondant/boutiques')} />
            <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
            <View style={[styles.flowMe, { backgroundColor: Brand.primarySoft }]}>
              <ThemedText style={styles.flowEmoji}>🏢</ThemedText>
              <ThemedText type="smallBold" numberOfLines={1}>
                Vous
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {d.zoneNom || me.data?.depotVille || 'Point relais'}
              </ThemedText>
            </View>
            <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
            <FlowNode emoji="🛵" n={d.relayFlow.destinations} label={d.relayFlow.destinations > 1 ? 'Livreurs' : 'Livreur'} onPress={() => router.navigate('/correspondant/livreurs')} />
          </View>
        </Box>

        <Box icon="calendar-outline" title="Ce mois-ci">
          <Line label="Nouveaux colis (commandes passant par vous)" value={String(d.objectifs.missionsCeMois)} />
          <Line label="Colis livrés" value={String(d.livresCeMois)} />
          <Line label="Revenus" value={gnf(d.objectifs.revenusCeMois)} />
        </Box>

        <Box icon="pulse-outline" title="Activité récente">
          {d.activite.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune activité pour le moment. Les colis qui passent par votre point relais apparaîtront ici.
            </ThemedText>
          ) : (
            d.activite.map((a, i) => (
              <View key={`${a.msg}-${i}`} style={[styles.act, i > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.actDot, { backgroundColor: CARD }]}>
                  <Ionicons name="cube-outline" size={15} color={Brand.primary} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="small">{a.msg}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {a.t}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </Box>
      </ScrollView>
    );
  }

  return (
    <CorrespondantScreen title="Vue d’ensemble" subtitle="Votre point relais" tab="overview">
      {body}
    </CorrespondantScreen>
  );
}

function FlowNode({ emoji, n, label, onPress }: { emoji: string; n: number; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${n} ${label}`} style={[styles.flowNode, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.flowEmoji}>{emoji}</ThemedText>
      <ThemedText style={styles.flowN}>{n}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText style={styles.bold}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  urgent: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#F5C2C0' },
  urgentTitle: { color: Brand.danger, fontWeight: '900', fontSize: 14.5, lineHeight: 19 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  states: { flexDirection: 'row', gap: 8 },
  state: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 2, alignItems: 'center', gap: 2 },
  stateN: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  stateL: { fontSize: 10.5, lineHeight: 13, fontWeight: '800', textAlign: 'center' },
  flow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowNode: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 10, gap: 1 },
  flowMe: { flex: 1.2, alignItems: 'center', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, gap: 1 },
  flowEmoji: { fontSize: 22, lineHeight: 28 },
  flowN: { fontSize: 18, lineHeight: 23, fontWeight: '900' },
  line: { flexDirection: 'row', alignItems: 'center' },
  act: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingTop: 8 },
  actDot: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
