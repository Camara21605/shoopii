/**
 * Messagerie › Paramètres généraux (bouton ⚙ de l'en-tête « Messages »).
 *   - Groupes : « Créer un groupe » + vos groupes (libres et de commande)
 *     avec leur nombre de membres, admins, statut → ouvre la discussion
 *   - Rappel des règles de la messagerie (qui peut vous écrire, statut en ligne)
 * Même fonctionnalité que « ⋮ > Paramètres > Ajouter un groupe » sur le site.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { fetchGroups, groupTitle, isGroupClosed, type Group } from '@/features/messagerie/groups-api';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function MessagingSettingsScreen() {
  const theme = useTheme();
  const groups = useQuery({ queryKey: ['groups'], queryFn: fetchGroups });
  const list = groups.data ?? [];
  const custom = list.filter((g) => g.kind !== 'order');
  const orders = list.filter((g) => g.kind === 'order');

  function openGroup(g: Group) {
    router.push({ pathname: '/messages/groupe/[id]', params: { id: g.id, name: groupTitle(g), photo: g.photoUrl ?? '' } });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Paramètres" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Créer un groupe — mis en avant ── */}
        <Pressable
          onPress={() => router.push('/messages/nouveau-groupe')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.hero, { backgroundColor: Brand.primary }, pressed && styles.pressed]}>
          <View style={styles.heroIcon}>
            <Ionicons name="people" size={26} color={Brand.primary} />
            <View style={styles.heroPlus}><Ionicons name="add" size={14} color="#fff" /></View>
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.heroTitle}>Créer un groupe</ThemedText>
            <ThemedText style={styles.heroSub}>Discutez à plusieurs : clients, boutiques, livreurs… jusqu’à 50 membres.</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </Pressable>

        <Section title="MES GROUPES">
          {groups.isPending ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : custom.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Vous ne faites partie d’aucun groupe pour le moment.
            </ThemedText>
          ) : (
            custom.map((g, i) => <GroupLine key={g.id} g={g} last={i === custom.length - 1} onPress={() => openGroup(g)} />)
          )}
        </Section>

        {orders.length > 0 ? (
          <Section title="GROUPES DE COMMANDE">
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Créés automatiquement à chaque commande (vous, la boutique et le livreur). Ils se ferment 72 h après la livraison.
            </ThemedText>
            {orders.map((g, i) => <GroupLine key={g.id} g={g} last={i === orders.length - 1} onPress={() => openGroup(g)} />)}
          </Section>
        ) : null}

        <Section title="CONFIDENTIALITÉ">
          <InfoLine icon="radio-button-on" color={Brand.success} text="Votre statut « En ligne » est visible par vos contacts pendant que l’application est ouverte." />
          <InfoLine icon="search-outline" color={Brand.primary} text="Tout utilisateur de Shoneya peut vous trouver par votre nom ou votre numéro et vous écrire." />
          <InfoLine icon="navigate-outline" color="#D97706" text="« Proches » utilise votre position uniquement sur votre téléphone pour trouver boutiques, livreurs et points relais autour de vous — elle n’est jamais partagée sans votre accord." last />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }]}>{children}</View>
    </View>
  );
}

function GroupLine({ g, last, onPress }: { g: Group; last: boolean; onPress: () => void }) {
  const theme = useTheme();
  const photo = thumb(g.photoUrl, 100);
  const closed = isGroupClosed(g);
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [styles.line, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.gAvatar, { backgroundColor: g.kind === 'order' ? '#FFF4E5' : theme.backgroundSelected }]}>
        {photo ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" /> : <Ionicons name={g.kind === 'order' ? 'cube' : 'people'} size={20} color={g.kind === 'order' ? '#D97706' : Brand.primary} />}
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.lineTitle}>{groupTitle(g)}</ThemedText>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
          {[`${g.memberCount} membres`, g.myPermissions?.isAdmin ? 'Vous êtes admin' : null, closed ? 'Fermé' : null].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {g.unreadCount > 0 ? (
        <View style={styles.badge}><ThemedText style={styles.badgeText}>{g.unreadCount > 99 ? '99+' : g.unreadCount}</ThemedText></View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

function InfoLine({ icon, color, text, last }: { icon: IconName; color: string; text: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.line, styles.infoLine, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon} size={18} color={color} style={styles.infoIcon} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.88 },
  content: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.three },
  loader: { marginVertical: Spacing.three },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, padding: 16 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroPlus: { position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: Brand.success, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,.85)', fontSize: 13, lineHeight: 18, marginTop: 2 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 1.3, color: Brand.primary, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  note: { paddingHorizontal: 14, paddingVertical: 12 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  infoLine: { alignItems: 'flex-start' },
  infoIcon: { marginTop: 1 },
  lineTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  gAvatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
});
