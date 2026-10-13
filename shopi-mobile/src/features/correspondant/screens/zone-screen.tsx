/**
 * Espace correspondant › Ma zone — équivalent mobile de ZonePage du site
 * (GET /dashboard/correspondant/zone) :
 *   · type de point relais et zones actives (renseignées dans les Paramètres) ;
 *   · chiffres : communes couvertes, livreurs actifs, taux de couverture ;
 *   · par commune (tirée des vraies commandes) : colis, livreurs, taux de succès.
 * « Demander une extension » du site n'affiche qu'un message : pas repris ;
 * les zones se modifient dans Paramètres › Zone & horaires.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { zoneLabel } from '@/features/correspondant-settings/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchZone, RELAY_TYPE } from '../api';
import { Box, CorrespondantScreen, Empty, Kpi } from '../components';

const tone = (v: string) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? '#737373' : n >= 80 ? Brand.success : n >= 50 ? '#B45309' : Brand.danger;
};

export default function CorrespondantZoneScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.correspondant.zone, queryFn: fetchZone });
  const d = q.data;
  const max = Math.max(1, ...(d?.communes ?? []).map((c) => c.colis));

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !d) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <Box icon="business-outline" title="Mon point relais">
          <ThemedText>
            Type : <ThemedText style={styles.bold}>{RELAY_TYPE[d.typeCorrespondant] ?? (d.typeCorrespondant || 'Non renseigné')}</ThemedText>
          </ThemedText>
          <ThemedText type="smallBold">Zones actives</ThemedText>
          {d.zonesActives.length ? (
            <View style={styles.chips}>
              {d.zonesActives.map((z) => (
                <View key={z} style={[styles.chip, { backgroundColor: Brand.primarySoft }]}>
                  <ThemedText type="smallBold">📍 {zoneLabel(z)}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Aucune zone renseignée pour le moment.
            </ThemedText>
          )}
          <Pressable
            onPress={() => router.push('/correspondant/parametres/zone')}
            accessibilityRole="button"
            accessibilityLabel="Modifier mes zones et horaires"
            style={[styles.link, { borderColor: theme.border }]}>
            <Ionicons name="create-outline" size={16} color={Brand.primary} />
            <ThemedText type="smallBold" style={styles.flex}>
              Modifier mes zones et horaires
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </Pressable>
        </Box>

        <View style={styles.kpis}>
          <Kpi icon="🗺️" value={String(d.stats.communesCouvertes)} label="Communes" sub="Zones actives ou communes livrées" />
          <Kpi icon="🛵" value={String(d.stats.livreursActifs)} label="Livreurs actifs" />
          <Kpi icon="✅" value={d.stats.tauxCouverture.replace('%', ' %')} label="Taux de succès" sub="Colis livrés / colis traités" />
        </View>

        <Box icon="location-outline" title="Par commune">
          {d.communes.length === 0 ? (
            <Empty emoji="🗺️" title="Pas encore de données" text="La répartition par commune s’affichera dès que des colis passeront par votre point relais." />
          ) : (
            d.communes.map((c, i) => (
              <View key={`${c.commune}-${i}`} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
                <View style={styles.rowTop}>
                  <ThemedText style={[styles.bold, styles.flex]} numberOfLines={1}>
                    {c.commune || 'Commune non précisée'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {c.colis} colis · {c.livreurs} livreur{c.livreurs > 1 ? 's' : ''}
                  </ThemedText>
                </View>
                <View style={[styles.bar, { backgroundColor: theme.background }]}>
                  <View style={[styles.fill, { width: `${Math.max(4, (c.colis / max) * 100)}%` }]} />
                </View>
                <ThemedText type="small" style={{ color: tone(c.succes) }}>
                  {c.succes === '—' ? 'Aucun colis terminé pour l’instant' : `${c.succes.replace('%', ' %')} de succès`}
                </ThemedText>
              </View>
            ))
          )}
        </Box>
      </ScrollView>
    );

  return (
    <CorrespondantScreen title="Ma zone" subtitle="Où vos colis sont livrés">
      {body}
    </CorrespondantScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 4 },
  row: { gap: 6, paddingTop: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: Brand.primary },
});
