/**
 * En-tête de l'application (onglets) — même organisation que l'en-tête
 * mobile du site, en thème clair :
 *   ligne 1 : « Shoneya »            📍 adresses · 💬 messages · ☰ menu
 *   ligne 2 : [ recherche ]          🔔 notifications · 🛍 panier · avatar
 * Pastilles rouges : messages non lus, notifications non lues, articles du panier.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { cartCount, useCart } from '@/features/cart/api';
import { fetchUnreadMessages, fetchUnreadNotifications } from '@/features/catalog/api';
import { useTheme } from '@/hooks/use-theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function RoundButton({ icon, label, badge, onPress }: { icon: IconName; label: string; badge?: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label} (${badge})` : label}
      hitSlop={4}
      style={({ pressed }) => [styles.round, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
      <Ionicons name={icon} size={21} color={theme.text} />
      {badge ? <Badge n={badge} /> : null}
    </Pressable>
  );
}

function IconButton({ icon, label, badge, onPress }: { icon: IconName; label: string; badge?: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={badge ? `${label} (${badge})` : label} hitSlop={6} style={styles.icon}>
      <Ionicons name={icon} size={23} color={theme.text} />
      {badge ? <Badge n={badge} /> : null}
    </Pressable>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <View style={styles.badge}>
      <ThemedText style={styles.badgeText}>{n > 99 ? '99+' : n}</ThemedText>
    </View>
  );
}

export function AppHeader({
  search,
  onSearch,
  placeholder = 'Produits, boutiques, livreurs…',
}: {
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const user = useSession((s) => s.user);
  const cart = useCart();
  const messages = useQuery({ queryKey: ['unread', 'messages'], queryFn: fetchUnreadMessages, refetchInterval: 60_000, enabled: !!user });
  const notifications = useQuery({ queryKey: ['unread', 'notifications'], queryFn: fetchUnreadNotifications, refetchInterval: 60_000, enabled: !!user });
  const initial = (user?.firstName?.charAt(0) || user?.email?.charAt(0) || '?').toUpperCase();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
      <View style={styles.row}>
        <ThemedText style={styles.brand} accessibilityRole="header">
          Sho<ThemedText style={[styles.brand, { color: Brand.primary }]}>neya</ThemedText>
        </ThemedText>
        <View style={styles.actions}>
          <RoundButton icon="location" label="Mes adresses" onPress={() => void WebBrowser.openBrowserAsync('https://www.shoneya.com/mes-adresses')} />
          <RoundButton icon="chatbubble-ellipses" label="Messages" badge={messages.data} onPress={() => router.push('/messages')} />
          <RoundButton icon="menu" label="Menu" onPress={() => router.push('/menu')} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Rechercher"
          />
          {search ? (
            <Pressable onPress={() => onSearch?.('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <IconButton icon="notifications" label="Notifications" badge={notifications.data} onPress={() => router.push('/notifications')} />
        <IconButton icon="bag-handle" label="Panier" badge={cartCount(cart.data)} onPress={() => router.push('/panier')} />
        <Pressable onPress={() => router.push('/compte')} accessibilityRole="button" accessibilityLabel="Mon compte" hitSlop={6} style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{initial}</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontSize: 26, lineHeight: 32, fontWeight: '800', flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  icon: { width: 34, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '800' },
});
