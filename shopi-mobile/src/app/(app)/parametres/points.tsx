/**
 * Paramètres › Points Shoneya — solde, niveau, progression vers le niveau
 * suivant (GET /client/parametres/points, comme la rubrique du site).
 * Tant que le programme n'a attribué aucun point (`actif: false`), on le dit
 * clairement au lieu d'afficher un faux solde.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchPoints } from '@/features/settings/api';
import { Card, LoadState, Row, Section } from '@/features/settings/ui';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function PointsScreen() {
  const theme = useTheme();
  const query = useQuery({ queryKey: ['settings', 'points'], queryFn: fetchPoints });
  const p = query.data;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Points Shoneya" />
      {!p ? (
        <LoadState loading={query.isLoading} error={query.error ? toUserMessage(query.error) : null} onRetry={() => void query.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.hero, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="star" size={28} color={Brand.primary} />
            <ThemedText style={styles.balance}>
              {fmt(p.points)} <ThemedText style={styles.pts}>pts</ThemedText>
            </ThemedText>
            {p.actif && p.niveau ? (
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Niveau {p.niveau}
              </ThemedText>
            ) : null}
          </View>

          {!p.actif ? (
            <ThemedText themeColor="textSecondary" style={styles.center}>
              Le programme Shoneya Points n’est pas encore ouvert : aucun point n’est attribué pour l’instant. Votre niveau et votre solde
              apparaîtront ici dès l’ouverture.
            </ThemedText>
          ) : (
            <>
              {p.prochainNiveau && p.seuilProchain ? (
                <Section title="Prochain niveau">
                  <Card>
                    <View style={styles.progressBox}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {p.prochainNiveau} à {fmt(p.seuilProchain)} pts
                      </ThemedText>
                      <View
                        style={[styles.track, { backgroundColor: theme.backgroundElement }]}
                        accessibilityRole="progressbar"
                        accessibilityValue={{ min: 0, max: 100, now: Math.round(p.progression) }}>
                        <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, p.progression))}%` }]} />
                      </View>
                    </View>
                  </Card>
                </Section>
              ) : null}
              <Section title="Détail">
                <Card>
                  <Row icon="trending-up-outline" label="Points gagnés ce mois" value={`${fmt(p.pointsGagnes)} pts`} />
                  <Row icon="gift-outline" label="Points utilisés" value={`${fmt(p.pointsUtilises)} pts`} />
                  {p.expirationProchaine ? (
                    <Row
                      icon="hourglass-outline"
                      label="Expiration prochaine"
                      value={new Date(p.expirationProchaine).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    />
                  ) : null}
                </Card>
              </Section>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  hero: { borderRadius: 18, alignItems: 'center', paddingVertical: Spacing.four, gap: 4 },
  balance: { fontSize: 36, lineHeight: 44, fontWeight: '800' },
  pts: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  center: { textAlign: 'center', paddingHorizontal: Spacing.two },
  progressBox: { padding: 14, gap: 10 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5, backgroundColor: Brand.primary },
});
