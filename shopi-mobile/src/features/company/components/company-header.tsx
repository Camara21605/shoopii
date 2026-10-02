/**
 * En-tête de l'espace entreprise (équivalent de la barre du haut du site) :
 * logo + nom de la boutique + statut, notifications 🔔, messages 💬 et menu ☰
 * (toutes les rubriques du tableau de bord).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchUnreadMessages } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import { fetchUnreadNotifications } from '@/features/notifications/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { useCompanyIdentity } from '../hooks';

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: Brand.success },
  pending: { label: 'En validation', color: '#D97706' },
  paused: { label: 'En pause', color: '#D97706' },
  suspended: { label: 'Suspendue', color: Brand.danger },
};

export function CompanyHeader() {
  const theme = useTheme();
  const identity = useCompanyIdentity();
  const notifs = useQuery({ queryKey: qk.notifications.unread, queryFn: fetchUnreadNotifications, refetchInterval: 60_000 });
  const messages = useQuery({ queryKey: qk.messages.unread, queryFn: fetchUnreadMessages, refetchInterval: 60_000 });
  const c = identity.data;
  const logo = thumb(c?.logo, 120);
  const st = STATUS[c?.status ?? 'active'] ?? STATUS.active;

  return (
    <View style={[styles.bar, { borderBottomColor: theme.border }]}>
      <View style={[styles.logo, { backgroundColor: theme.backgroundSelected }]}>
        {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(c?.companyName ?? 'B')}</ThemedText>}
      </View>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.name}>
          {c?.companyName ?? 'Ma boutique'}
        </ThemedText>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: st.color }]} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Boutique {st.label.toLowerCase()}
          </ThemedText>
        </View>
      </View>
      <IconBtn icon="notifications-outline" label="Notifications" count={notifs.data} onPress={() => router.push('/notifications')} />
      <IconBtn icon="chatbubble-ellipses-outline" label="Messages" count={messages.data} onPress={() => router.push('/messages')} />
      <IconBtn icon="menu" label="Menu de l’espace entreprise" onPress={() => router.push('/entreprise/menu')} />
    </View>
  );
}

function IconBtn({ icon, label, count, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; count?: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6} style={[styles.btn, { backgroundColor: theme.backgroundElement }]} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count} non lus` : label}>
      <Ionicons name={icon} size={20} color={theme.text} />
      {count ? (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{count > 99 ? '99+' : count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  logo: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  init: { fontWeight: '900', color: Brand.primary },
  flex: { flex: 1 },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, lineHeight: 13, fontWeight: '800' },
});
