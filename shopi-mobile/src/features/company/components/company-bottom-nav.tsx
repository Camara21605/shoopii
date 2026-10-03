/**
 * Barre du bas de l'espace entreprise (comme la « tb-bottomnav » du site sur
 * téléphone) : Accueil · Commandes (pastille de nouveautés) · Produits (ou
 * Services pour une boutique de services), et le bouton flottant « + »
 * (Ajouter un produit / un service) juste au-dessus, comme la « fab » du site.
 * Chaque onglet n'apparaît que si le rôle de l'utilisateur y donne accès.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

import { badgeOf } from '../api';
import { useCompanyBadges, useCompanyIdentity, usePermissions } from '../hooks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Tab = { key: string; label: string; icon: IconName; iconOn: IconName; onPress: () => void; badge?: number; external?: boolean };

const dash = (path: string) => openSite(`/dashboard/entreprise/${path}`);

export function CompanyBottomNav({ active = 'overview' }: { active?: string }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const perms = usePermissions();
  const identity = useCompanyIdentity();
  const badges = useCompanyBadges();
  const services = identity.data?.businessModel === 'services';
  const catalog = services ? 'services' : 'produits';

  const tabs: Tab[] = [
    { key: 'overview', label: 'Accueil', icon: 'pie-chart-outline', iconOn: 'pie-chart', onPress: () => router.dismissTo('/entreprise') },
    ...(perms.can('orders', 'view')
      ? [{ key: 'commandes', label: 'Commandes', icon: 'cube-outline' as IconName, iconOn: 'cube' as IconName, onPress: () => router.navigate('/entreprise/commandes'), badge: badgeOf(badges.data, 'commandes') }]
      : []),
    ...(perms.can(services ? 'services' : 'products', 'view')
      ? [{ key: catalog, label: services ? 'Services' : 'Produits', icon: (services ? 'construct-outline' : 'pricetag-outline') as IconName, iconOn: (services ? 'construct' : 'pricetag') as IconName, onPress: () => (services ? dash(catalog) : router.navigate('/entreprise/produits')), external: services }]
      : []),
  ];

  const canCreate = perms.can(services ? 'services' : 'products', 'create');
  const add = () => (services ? dash('ajouter-service') : router.push('/entreprise/ajouter'));

  return (
    <>
      {canCreate ? (
        <Pressable
          onPress={add}
          accessibilityRole="button"
          accessibilityLabel={services ? 'Ajouter un service' : 'Ajouter un produit'}
          style={({ pressed }) => [styles.fab, { bottom: 64 + Math.max(insets.bottom, 8) + 14 }, pressed && styles.pressed]}>
          <Ionicons name="add" size={30} color={Brand.primaryInk} />
        </Pressable>
      ) : null}
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), borderTopColor: theme.border, backgroundColor: theme.background }]} accessibilityRole="tablist">
        {tabs.map((t) => {
          const on = t.key === active;
          const color = on ? Brand.primary : theme.textSecondary;
          return (
            <Pressable
              key={t.key}
              onPress={on ? undefined : t.onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.badge ? `${t.label}, ${t.badge} nouveautés` : t.label}
              style={styles.tab}>
              <View>
                <Ionicons name={on ? t.iconOn : t.icon} size={23} color={color} />
                {t.badge ? (
                  <View style={[styles.badge, { borderColor: theme.background }]}>
                    <ThemedText style={styles.badgeText}>{t.badge > 99 ? '99+' : t.badge}</ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={[styles.label, { color, fontWeight: on ? '800' : '600' }]}>{t.label}</ThemedText>
              {on ? <View style={styles.indicator} /> : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56 },
  label: { fontSize: 12, lineHeight: 16 },
  indicator: { position: 'absolute', top: -6, width: 28, height: 3, borderRadius: 2, backgroundColor: Brand.primary },
  badge: { position: 'absolute', top: -5, right: -11, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9.5, lineHeight: 12, fontWeight: '900' },
  fab: {
    position: 'absolute',
    right: 18,
    zIndex: 10,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Brand.primarySoft,
    borderWidth: 1,
    borderColor: Brand.primaryLine,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: Brand.primary,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
