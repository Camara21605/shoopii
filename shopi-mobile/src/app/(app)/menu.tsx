/**
 * Menu (bouton ☰ de l'en-tête) — même contenu que le menu latéral mobile du
 * site (Header.tsx : NAV_LINKS + portefeuille + paramètres), classé par
 * rubriques. Les pages pas encore natives s'ouvrent sur shoneya.com.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { ROLE_LABELS } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';

const SITE = 'https://www.shoneya.com';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Item = { icon: IconName; label: string; to?: Href; web?: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Découvrir',
    items: [
      { icon: 'storefront-outline', label: 'Boutiques', to: '/boutiques' },
      { icon: 'bicycle-outline', label: 'Livreurs', to: '/livreurs' },
      { icon: 'location-outline', label: 'Points relais', to: '/correspondants' },
      { icon: 'grid-outline', label: 'Catalogue', to: '/catalogue' },
      { icon: 'pricetag-outline', label: 'Offres du jour', web: '/offres' },
      { icon: 'compass-outline', label: 'Explorer', to: '/explorer' },
    ],
  },
  {
    title: 'Mon espace',
    items: [
      { icon: 'chatbubble-ellipses-outline', label: 'Messages', to: '/messages' },
      { icon: 'notifications-outline', label: 'Notifications', to: '/notifications' },
      { icon: 'bag-handle-outline', label: 'Panier', to: '/panier' },
      { icon: 'receipt-outline', label: 'Mes commandes', web: '/mon-profil?tab=orders' },
      { icon: 'heart-outline', label: 'Mes favoris', web: '/mon-profil?tab=favs' },
      { icon: 'home-outline', label: 'Mes adresses', web: '/mes-adresses' },
      { icon: 'wallet-outline', label: 'Portefeuille', web: '/dashboard/client' },
    ],
  },
  {
    title: 'Compte',
    items: [
      { icon: 'person-circle-outline', label: 'Mon compte', to: '/compte' },
      { icon: 'settings-outline', label: 'Paramètres', web: '/parametres' },
      { icon: 'help-circle-outline', label: 'Centre d’aide', web: '/aide' },
    ],
  },
];

export default function MenuScreen() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);

  const open = (it: Item) => {
    if (it.to) {
      router.back();
      router.push(it.to);
    } else if (it.web) void WebBrowser.openBrowserAsync(`${SITE}${it.web}`);
  };

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={[styles.head, { borderBottomColor: theme.border }]}>
        <ThemedText style={styles.brand}>
          Sho<ThemedText style={[styles.brand, { color: Brand.primary }]}>neya</ThemedText>
        </ThemedText>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Fermer le menu" hitSlop={10}>
          <Ionicons name="close" size={28} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {user ? (
          <Pressable onPress={() => open({ icon: 'person', label: '', to: '/compte' })} style={[styles.profile, { backgroundColor: theme.backgroundSelected }]}>
            <View style={styles.avatar}>
              <ThemedText style={styles.avatarText}>{(user.firstName?.charAt(0) || '?').toUpperCase()}</ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {user.firstName} {user.lastName}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {ROLE_LABELS[user.role] ?? user.role} · {user.email}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}

        {SECTIONS.map((s) => (
          <View key={s.title} style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.dash} />
              <ThemedText style={styles.sectionTitle}>{s.title.toUpperCase()}</ThemedText>
            </View>
            <View style={[styles.card, { borderColor: theme.border }]}>
              {s.items.map((it, i) => (
                <Pressable
                  key={it.label}
                  onPress={() => open(it)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name={it.icon} size={19} color={Brand.primary} />
                  </View>
                  <ThemedText style={styles.rowLabel}>{it.label}</ThemedText>
                  <Ionicons name={it.web ? 'open-outline' : 'chevron-forward'} size={17} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={[styles.logout, { borderColor: theme.border }]}>
          <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Se déconnecter
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          <Ionicons name="open-outline" size={12} /> s’ouvre sur shoneya.com en attendant sa version dans l’application.
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  brand: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.five },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 20, lineHeight: 26, fontWeight: '800' },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  sectionTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800', letterSpacing: 1.6, color: Brand.primary },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 54 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15 },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 50 },
  note: { textAlign: 'center', marginTop: -Spacing.two },
});
