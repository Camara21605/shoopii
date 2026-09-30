/**
 * Notifications du compte (GET /notifications) — non lues en évidence,
 * « Tout marquer comme lu » (PATCH /notifications/read-all). Une
 * notification avec un lien s'ouvre sur le site en attendant les écrans natifs.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchNotifications, markAllNotificationsRead, type AppNotification } from '@/features/catalog/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

/** « il y a 5 min », « hier », « 12 sept. » */
function ago(iso: string) {
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172_800) return 'hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
  const unread = (list.data ?? []).some((n) => !n.isRead);

  async function readAll() {
    await markAllNotificationsRead().catch(() => undefined);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
    void qc.invalidateQueries({ queryKey: ['unread', 'notifications'] });
  }

  const open = (n: AppNotification) => {
    if (n.actionUrl) void WebBrowser.openBrowserAsync(n.actionUrl.startsWith('http') ? n.actionUrl : `https://www.shoneya.com${n.actionUrl}`);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Notifications"
        right={
          unread ? (
            <Pressable onPress={() => void readAll()} accessibilityRole="button" hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Tout marquer lu
              </ThemedText>
            </Pressable>
          ) : undefined
        }
      />
      {list.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.center} />
      ) : list.error ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{toUserMessage(list.error)}</ThemedText>
          <Pressable onPress={() => void list.refetch()} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réessayer
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={list.data}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} colors={[Brand.primary]} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={44} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary">Aucune notification pour le moment.</ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              style={[
                styles.item,
                { borderColor: theme.border, backgroundColor: item.isRead ? theme.background : theme.backgroundSelected },
              ]}>
              <View style={[styles.icon, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="notifications" size={18} color={Brand.primary} />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.title} numberOfLines={2}>
                  {item.title}
                </ThemedText>
                {item.body ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                    {item.body}
                  </ThemedText>
                ) : null}
                <ThemedText style={styles.time} themeColor="textSecondary">
                  {ago(item.createdAt)}
                </ThemedText>
              </View>
              {!item.isRead ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  list: { padding: Spacing.three, gap: 10, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingVertical: 80 },
  item: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  time: { fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Brand.primary, marginTop: 6 },
});
