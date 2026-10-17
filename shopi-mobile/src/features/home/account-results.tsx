/**
 * Recherche de l'accueil — les COMPTES qui correspondent (boutiques,
 * livreurs, points relais), y compris ceux que l'on suit déjà : l'accueil ne
 * les propose plus, c'est donc ici qu'on les retrouve pour rouvrir leur
 * page (et se désabonner). Les comptes suivis passent en premier, marqués
 * « Abonné ». Les produits correspondants restent affichés juste en dessous.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { initials, SectionHeader } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchDrivers, fetchRelays, fetchShops } from '@/features/catalog/api';
import { useFollowedShops } from '@/features/catalog/follow';
import { thumb } from '@/features/catalog/format';
import { openDriver, openRelay, openShop } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

type Kind = 'shop' | 'driver' | 'relay';
type Account = { key: string; id: string; kind: Kind; name: string; photo: string | null; followed: boolean };

const KIND_LABEL: Record<Kind, string> = { shop: 'Boutique', driver: 'Livreur', relay: 'Point relais' };
const KIND_ICON: Record<Kind, React.ComponentProps<typeof Ionicons>['name']> = { shop: 'storefront', driver: 'bicycle', relay: 'location' };
const open = (a: Account) => (a.kind === 'shop' ? openShop(a.id) : a.kind === 'driver' ? openDriver(a.id) : openRelay(a.id));

export function AccountResults({ search }: { search: string }) {
  const theme = useTheme();
  const term = search.trim();
  const enabled = term.length >= 2;
  const followedShops = useFollowedShops();

  const shops = useQuery({ queryKey: qk.accountSearch('shops', term), queryFn: () => fetchShops(8, term), enabled, staleTime: 30_000 });
  const drivers = useQuery({ queryKey: qk.accountSearch('livreurs', term), queryFn: () => fetchDrivers(term), enabled, staleTime: 30_000 });
  const relays = useQuery({ queryKey: qk.accountSearch('correspondants', term), queryFn: () => fetchRelays(term), enabled, staleTime: 30_000 });

  const accounts = useMemo<Account[]>(() => {
    const list: Account[] = [
      ...(shops.data ?? []).map((s) => ({ key: `shop:${s.id}`, id: s.id, kind: 'shop' as const, name: s.companyName, photo: s.logo ?? null, followed: !!followedShops.data?.has(s.id) })),
      ...(drivers.data ?? []).slice(0, 8).map((d) => ({ key: `driver:${d.id}`, id: d.id, kind: 'driver' as const, name: d.fullName, photo: d.profilePicture ?? null, followed: !!d.isSuivi })),
      ...(relays.data ?? []).slice(0, 8).map((r) => ({ key: `relay:${r.id}`, id: r.id, kind: 'relay' as const, name: r.fullName, photo: r.profilePicture ?? null, followed: !!r.isSuivi })),
    ];
    /* Suivis d'abord : c'est surtout eux qu'on cherche ici (ils ne sont plus proposés sur l'accueil). */
    return list.sort((a, b) => Number(b.followed) - Number(a.followed));
  }, [shops.data, drivers.data, relays.data, followedShops.data]);

  if (!enabled || !accounts.length) return null;

  return (
    <View style={styles.section}>
      <SectionHeader title="Comptes" />
      <FlatList
        horizontal
        data={accounts}
        keyExtractor={(a) => a.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const img = item.photo?.startsWith('http') ? thumb(item.photo, 160) : null;
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${KIND_LABEL[item.kind]}${item.followed ? ', abonné' : ''}. Ouvrir le profil`}
              style={({ pressed }) => [styles.card, { borderColor: item.followed ? Brand.primary : theme.border, backgroundColor: theme.background }, pressed && styles.pressed]}>
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
                {img ? <Image source={{ uri: img }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.initials}>{initials(item.name)}</ThemedText>}
              </View>
              <ThemedText style={styles.name} numberOfLines={1}>
                {item.name}
              </ThemedText>
              <View style={styles.kindRow}>
                <Ionicons name={KIND_ICON[item.kind]} size={11} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {KIND_LABEL[item.kind]}
                </ThemedText>
              </View>
              {item.followed ? (
                <View style={styles.badge}>
                  <Ionicons name="checkmark" size={11} color={Brand.primaryInk} />
                  <ThemedText style={styles.badgeText}>Abonné</ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  list: { gap: 10, paddingHorizontal: Spacing.three },
  card: { width: 118, alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8 },
  pressed: { opacity: 0.85 },
  avatar: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  initials: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  name: { fontSize: 13.5, lineHeight: 18, fontWeight: '800', textAlign: 'center' },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Brand.primary, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  badgeText: { color: Brand.primaryInk, fontSize: 11, lineHeight: 15, fontWeight: '800' },
});
