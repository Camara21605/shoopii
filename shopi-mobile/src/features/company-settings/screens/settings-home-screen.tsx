/**
 * Paramètres de la boutique — écran d'accueil, organisé comme le menu
 * « Paramètres » du site sur téléphone (ParametresMobileMenu.tsx) :
 *   en-tête Boutique (logo, nom, statut, complétion) → Boutique & identité ;
 *   Boutique : horaires, catalogue · Activité : livraison, paiement,
 *   commissions, documents · Compte : sécurité, notifications,
 *   confidentialité, langue · Zone sensible · Se déconnecter.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { initials } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { completion, statusOf } from '../api';
import { Badge, confirmAction, Hint, type IconName } from '../components/ui';
import { useSettings, useSettingsAccess } from '../hooks';

type Item = { key: string; label: string; icon: IconName; href: Href; hint?: string };

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Boutique',
    items: [
      { key: 'horaires', label: 'Horaires', icon: 'time-outline', href: '/entreprise/parametres/horaires' },
      { key: 'catalogue', label: 'Catalogue & Produits', icon: 'pricetags-outline', href: '/entreprise/parametres/catalogue' },
    ],
  },
  {
    title: 'Activité',
    items: [
      { key: 'livraison', label: 'Livraison', icon: 'bicycle-outline', href: '/entreprise/parametres/livraison' },
      { key: 'paiement', label: 'Paiement & Facturation', icon: 'card-outline', href: '/entreprise/parametres/paiement' },
      { key: 'commissions', label: 'Commissions Shoneya', icon: 'stats-chart-outline', href: '/entreprise/parametres/commissions' },
      { key: 'documents', label: 'Documents & Vérification', icon: 'document-text-outline', href: '/entreprise/parametres/documents' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { key: 'securite', label: 'Sécurité', icon: 'lock-closed-outline', href: '/entreprise/parametres/securite' },
      { key: 'notifs', label: 'Notifications', icon: 'notifications-outline', href: '/entreprise/parametres/notifications' },
      { key: 'privacy', label: 'Confidentialité', icon: 'eye-off-outline', href: '/entreprise/parametres/confidentialite' },
      { key: 'langue', label: 'Langue', icon: 'language-outline', href: '/entreprise/parametres/langue' },
    ],
  },
];

const VERIF: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  verified: { label: 'Vérifiée', tone: 'success' },
  reviewing: { label: 'En examen', tone: 'warning' },
  rejected: { label: 'Refusée', tone: 'danger' },
  pending: { label: 'À vérifier', tone: 'neutral' },
};

export default function SettingsHomeScreen() {
  const theme = useTheme();
  const access = useSettingsAccess();
  const q = useSettings();
  const signOut = useSession((s) => s.signOut);
  const d = q.data;

  const logout = async () => {
    if (await confirmAction('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', 'Se déconnecter', true)) void signOut();
  };

  let body;
  if (access.loading || (q.isPending && access.canView)) {
    body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  } else if (!access.canView) {
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={36} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les paramètres de la boutique.
        </ThemedText>
      </View>
    );
  } else if (!d) {
    body = (
      <View style={styles.center}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {toUserMessage(q.error)}
        </ThemedText>
        <PrimaryButton title="Réessayer" onPress={() => void q.refetch()} pill />
      </View>
    );
  } else {
    const st = statusOf(d.status);
    const comp = completion(d);
    const verif = VERIF[d.verificationStatus] ?? VERIF.pending;
    const logo = thumb(d.logo, 160);
    body = (
      <ScrollView contentContainerStyle={styles.content}>
        {!access.canEdit ? <Hint icon="lock-closed" tone="neutral" text="Lecture seule — vous pouvez consulter ces paramètres mais pas les modifier." /> : null}

        {/* En-tête Boutique → Boutique & identité */}
        <Pressable
          onPress={() => router.push('/entreprise/parametres/boutique')}
          accessibilityRole="button"
          accessibilityLabel={`Boutique et identité : ${d.companyName}, ${st.label}`}
          style={({ pressed }) => [styles.shop, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.shopTop}>
            <View style={[styles.logo, { backgroundColor: theme.backgroundSelected }]}>
              {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(d.companyName || 'B')}</ThemedText>}
            </View>
            <View style={styles.flex}>
              <ThemedText style={styles.shopName} numberOfLines={1}>
                {d.companyName || 'Ma boutique'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {st.emoji} {st.label} · Boutique & identité
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </View>
          <View style={styles.compRow}>
            <ThemedText style={styles.compLabel}>Profil complété à {comp.pct}%</ThemedText>
            <Badge label={`Vérification : ${verif.label}`} tone={verif.tone} />
          </View>
          <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.bar, { width: `${comp.pct}%`, backgroundColor: comp.pct === 100 ? Brand.success : Brand.primary }]} />
          </View>
          {comp.missing.length ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              À compléter : {comp.missing.join(', ')}
            </ThemedText>
          ) : null}
        </Pressable>

        {GROUPS.map((g) => (
          <View key={g.title} style={styles.group}>
            <View style={styles.groupHead}>
              <View style={styles.dash} />
              <ThemedText style={styles.groupTitle}>{g.title.toUpperCase()}</ThemedText>
            </View>
            <View style={[styles.card, { borderColor: theme.border }]}>
              {g.items.map((it, i) => (
                <Row key={it.key} item={it} first={i === 0} right={rightOf(it.key, d)} />
              ))}
            </View>
          </View>
        ))}

        <View style={[styles.card, { borderColor: '#FECACA' }]}>
          <Row item={{ key: 'danger', label: 'Zone sensible', icon: 'warning-outline', href: '/entreprise/parametres/zone-sensible' }} first danger />
        </View>

        <Pressable onPress={() => void logout()} accessibilityRole="button" style={[styles.logout, { borderColor: theme.border }]}>
          <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Se déconnecter
          </ThemedText>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Paramètres" />
      {body}
    </SafeAreaView>
  );
}

/** Petit résumé à droite de certaines rubriques (comme les pastilles du site). */
function rightOf(key: string, d: NonNullable<ReturnType<typeof useSettings>['data']>) {
  if (key === 'securite') return d.twoFaEnabled ? '2FA activée' : '2FA non activée';
  if (key === 'commissions') return d.plan.charAt(0).toUpperCase() + d.plan.slice(1);
  if (key === 'langue') return 'Français';
  if (key === 'horaires' && !(d.horaires ?? []).length) return 'À renseigner';
  return undefined;
}

function Row({ item, first, right, danger }: { item: Item; first?: boolean; right?: string; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : Brand.primary;
  return (
    <Pressable
      onPress={() => router.push(item.href)}
      accessibilityRole="button"
      accessibilityLabel={right ? `${item.label}, ${right}` : item.label}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.ico, { backgroundColor: danger ? '#FEF2F2' : theme.backgroundSelected }]}>
        <Ionicons name={item.icon} size={19} color={color} />
      </View>
      <ThemedText style={[styles.label, danger && { color: Brand.danger, fontWeight: '700' }]}>{item.label}</ThemedText>
      {right ? (
        <ThemedText type="small" themeColor="textSecondary">
          {right}
        </ThemedText>
      ) : null}
      <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 18, paddingBottom: 40 },
  shop: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  shopTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  init: { fontWeight: '900', color: Brand.primary, fontSize: 18 },
  shopName: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  compRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  compLabel: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  group: { gap: 10 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  groupTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, color: Brand.primary },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 54 },
  ico: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15 },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 50 },
});
