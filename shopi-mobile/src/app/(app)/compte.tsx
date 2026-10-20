/**
 * Onglet Compte : identité du compte connecté (avec sa VRAIE photo de profil,
 * même cache que l'en-tête et l'écran Profil — avant : toujours les initiales),
 * accès à ses commandes et favoris (écrans natifs du profil — avant : le site),
 * paramètres, aide, déconnexion.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { ROLE_LABELS } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-store';
import { thumb } from '@/features/catalog/format';
import { fetchClientProfile } from '@/features/profile/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function AccountScreen() {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const initials = `${user?.firstName?.charAt(0) ?? ''}${user?.lastName?.charAt(0) ?? ''}`.toUpperCase() || '?';
  const isClient = user?.role === 'client';
  /* Même requête que l'en-tête et l'écran Profil : une photo changée s'affiche partout tout de suite */
  const profile = useQuery({ queryKey: qk.profile.me, queryFn: fetchClientProfile, enabled: isClient, staleTime: 300_000 });
  const photo = thumb(profile.data?.profilePicture, 240);

  /* Écrans natifs : commandes et favoris = onglets de l'écran Profil (comme le menu ☰) */
  const rows: { icon: IconName; label: string; desc?: string; to: Href }[] = [
    ...(isClient
      ? [
          { icon: 'receipt-outline' as IconName, label: 'Mes commandes', desc: 'Suivi, codes de retrait, retours', to: '/profil?tab=orders' as Href },
          { icon: 'heart-outline' as IconName, label: 'Mes favoris', desc: 'Produits et boutiques aimés', to: '/profil?tab=favs' as Href },
        ]
      : []),
    { icon: 'settings-outline', label: 'Paramètres du compte', to: '/parametres' },
    { icon: 'help-circle-outline', label: 'Centre d’aide', to: '/aide' },
  ];

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Mon compte" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <Pressable
            onPress={() => isClient && router.push('/profil')}
            disabled={!isClient}
            accessibilityRole="button"
            accessibilityLabel="Voir mon profil"
            style={[styles.avatar, { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine }]}>
            {photo ? <Image source={{ uri: photo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.avatarText}>{initials}</ThemedText>}
          </Pressable>
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
              onPress={() => router.push(r.to)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <Ionicons name={r.icon} size={22} color={theme.text} />
              <View style={styles.rowText}>
                <ThemedText style={styles.rowLabel}>{r.label}</ThemedText>
                {r.desc ? <ThemedText type="small" themeColor="textSecondary">{r.desc}</ThemedText> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

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
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  avatarText: { color: Brand.primaryInk, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 10, minHeight: 54 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15 },
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
