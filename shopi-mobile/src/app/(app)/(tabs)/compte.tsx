/** Onglet Compte : identité du compte connecté, accès au site, déconnexion. */
import Ionicons from '@expo/vector-icons/Ionicons';
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

export default function AccountScreen() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase() || '?';

  const rows: { icon: IconName; label: string; path: string }[] = [
    /* Pages réelles du site (onglets de /mon-profil, voir ProfilClientPage) */
    { icon: 'receipt-outline', label: 'Mes commandes', path: '/mon-profil?tab=orders' },
    { icon: 'heart-outline', label: 'Mes favoris', path: '/mon-profil?tab=favs' },
    { icon: 'settings-outline', label: 'Paramètres du compte', path: '/parametres' },
    { icon: 'help-circle-outline', label: 'Centre d’aide', path: '/aide' },
  ];

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: Brand.primary }]}>
            <ThemedText style={styles.avatarText}>{initials}</ThemedText>
          </View>
          <ThemedText style={styles.name}>
            {user ? `${user.firstName} ${user.lastName}` : 'Mon compte'}
          </ThemedText>
          {user ? (
            <ThemedText themeColor="textSecondary">
              {ROLE_LABELS[user.role] ?? user.role} · {user.email}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}>
          {rows.map((r, i) => (
            <Pressable
              key={r.label}
              onPress={() => void WebBrowser.openBrowserAsync(`${SITE}${r.path}`)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <Ionicons name={r.icon} size={22} color={theme.text} />
              <ThemedText style={styles.rowLabel}>{r.label}</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
          Ces pages s’ouvrent sur shoneya.com en attendant leur version dans l’application.
        </ThemedText>

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={[styles.logout, { borderColor: theme.border }]}>
          <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Se déconnecter
          </ThemedText>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.three },
  profile: { alignItems: 'center', gap: 4, paddingVertical: Spacing.four },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  avatarText: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '800' },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, minHeight: 54 },
  rowLabel: { flex: 1, fontSize: 15 },
  note: { textAlign: 'center', marginTop: -Spacing.one },
  logout: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    minHeight: 50,
    marginTop: Spacing.two,
  },
});
