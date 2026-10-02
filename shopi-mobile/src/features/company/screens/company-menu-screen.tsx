/**
 * Menu de l'espace entreprise (bouton ☰) — mêmes rubriques, même ordre et
 * mêmes permissions que la barre latérale du site, avec les pastilles de
 * nouveautés (commandes, avis, stock…). Une rubrique native s'ouvre dans
 * l'application ; les autres sur le site en attendant leur version native.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { openShop, openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

import { badgeOf } from '../api';
import { useCompanyBadges, useCompanyIdentity, usePermissions } from '../hooks';
import { buildNav, webPath, type NavItem } from '../nav';

export default function CompanyMenuScreen() {
  const theme = useTheme();
  const identity = useCompanyIdentity();
  const perms = usePermissions();
  const badges = useCompanyBadges();
  const signOut = useSession((s) => s.signOut);
  const user = useSession((s) => s.user);

  const sections = buildNav(identity.data?.businessModel ?? 'products')
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || perms.can(i.perm[0], i.perm[1])) }))
    .filter((s) => s.items.length);

  const open = (it: NavItem) => {
    if (it.id === 'boutique-preview' && identity.data) {
      router.back();
      openShop(identity.data.id);
      return;
    }
    if (it.native) {
      router.back();
      if (it.id !== 'overview') router.push(it.native);
      return;
    }
    openSite(webPath(it));
  };

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={[styles.head, { borderBottomColor: theme.border }]}>
        <View style={styles.flex}>
          <ThemedText style={styles.title}>Espace entreprise</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {identity.data?.companyName ?? 'Ma boutique'} · {perms.isOwner ? 'Propriétaire' : 'Collaborateur'}
            {user?.email ? ` · ${user.email}` : ''}
          </ThemedText>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer le menu">
          <Ionicons name="close" size={28} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.dash} />
              <ThemedText style={styles.sectionTitle}>{s.title.toUpperCase()}</ThemedText>
            </View>
            <View style={[styles.card, { borderColor: theme.border }]}>
              {s.items.map((it, i) => {
                const n = badgeOf(badges.data, it.id);
                return (
                  <Pressable
                    key={it.id}
                    onPress={() => open(it)}
                    accessibilityRole="button"
                    accessibilityLabel={n ? `${it.label}, ${n} nouveautés` : it.label}
                    style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.ico, { backgroundColor: theme.backgroundSelected }]}>
                      <Ionicons name={it.icon} size={19} color={Brand.primary} />
                    </View>
                    <ThemedText style={styles.label}>{it.label}</ThemedText>
                    {n ? (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>{n > 99 ? '99+' : n}</ThemedText>
                      </View>
                    ) : null}
                    <Ionicons name={it.native || it.id === 'boutique-preview' ? 'chevron-forward' : 'open-outline'} size={17} color={theme.textSecondary} />
                  </Pressable>
                );
              })}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  content: { padding: 16, gap: 20, paddingBottom: 32 },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dash: { width: 18, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  sectionTitle: { fontSize: 12.5, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, color: Brand.primary },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 54 },
  ico: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontSize: 15 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 50 },
  note: { textAlign: 'center', marginTop: -8 },
});
