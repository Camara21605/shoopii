/**
 * Menu ☰ de l'espace entreprise — tiroir qui glisse depuis la GAUCHE, comme
 * le drawer mobile du site (Topbar.tsx) :
 *   · en-tête boutique (logo, nom, statut · ville) ;
 *   · solde du portefeuille (accès rapide) ;
 *   · toutes les rubriques de la barre latérale, mêmes permissions, mêmes
 *     pastilles de nouveautés, rubrique courante cochée ;
 *   · pied : Voir ma boutique, Centre d'aide, Se déconnecter.
 * Glisser vers la gauche, toucher le fond ou le bouton retour le ferme.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { thumb } from '@/features/catalog/format';
import { openShop, openSite } from '@/features/catalog/open';
import { fetchWalletSummary } from '@/features/company-settings/api';
import { qk } from '@/lib/query-keys';

import { badgeOf } from '../api';
import { closeCompanyDrawer, DRAWER_WIDTH, drawerPan, drawerX, useCompanyDrawerOpen } from '../drawer';
import { useCompanyBadges, useCompanyIdentity, usePermissions } from '../hooks';
import { buildNav, webPath, type NavItem } from '../nav';

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Boutique active', color: '#34D399' },
  pending: { label: 'En validation', color: '#FBBF24' },
  suspended: { label: 'Boutique en pause', color: '#FBBF24' },
};
const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;

export function CompanyDrawer() {
  const open = useCompanyDrawerOpen();
  if (!open) return null;
  const fade = drawerX.interpolate({ inputRange: [-DRAWER_WIDTH, 0], outputRange: [0, 1] });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={closeCompanyDrawer}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeCompanyDrawer} accessibilityRole="button" accessibilityLabel="Fermer le menu" />
      </Animated.View>
      <Animated.View style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX: drawerX }] }]} {...drawerPan.panHandlers}>
        <DrawerContent />
      </Animated.View>
    </Modal>
  );
}

function DrawerContent() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const identity = useCompanyIdentity();
  const perms = usePermissions();
  const badges = useCompanyBadges();
  const signOut = useSession((s) => s.signOut);
  const canWallet = perms.can('wallet', 'view');
  const wallet = useQuery({ queryKey: qk.company.settingsWallet, queryFn: fetchWalletSummary, enabled: canWallet, staleTime: 60_000 });
  const c = identity.data;
  const st = STATUS[c?.status ?? 'active'] ?? STATUS.active;
  const logo = thumb(c?.logo, 120);

  const sections = buildNav(c?.businessModel ?? 'products')
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || perms.can(i.perm[0], i.perm[1])) }))
    .filter((s) => s.items.length);

  const isActive = (it: NavItem) => (it.id === 'overview' ? pathname === '/entreprise' : !!it.native && typeof it.native === 'string' && it.native !== '/entreprise' && pathname.startsWith(it.native));

  const go = (it: NavItem) => {
    closeCompanyDrawer();
    if (it.id === 'boutique-preview' && c) return openShop(c.id);
    if (it.native) {
      if (isActive(it)) return;
      if (it.id === 'overview') return router.dismissTo('/entreprise');
      return router.push(it.native);
    }
    openSite(webPath(it));
  };

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.logo}>
          {logo ? <Image source={{ uri: logo }} style={styles.img} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(c?.companyName ?? 'B')}</ThemedText>}
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {c?.companyName ?? 'Ma boutique'}
          </ThemedText>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: st.color }]} />
            <ThemedText style={styles.sub} numberOfLines={1}>
              {st.label}
              {c?.ville ? ` · ${c.ville}` : ''}
            </ThemedText>
          </View>
        </View>
        <Pressable onPress={closeCompanyDrawer} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer le menu" style={styles.close}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>

      {canWallet ? (
        <Pressable onPress={() => go({ id: 'portefeuille', label: 'Portefeuille', icon: 'wallet-outline' })} accessibilityRole="button" style={styles.wallet}>
          <Ionicons name="wallet" size={20} color="#93C5FD" />
          <View style={styles.flex}>
            <ThemedText style={styles.walletLabel}>Solde disponible</ThemedText>
            <ThemedText style={styles.walletV}>{wallet.data ? gnf(wallet.data.withdrawableBalance) : '— GNF'}</ThemedText>
          </View>
          <ThemedText style={styles.walletLink}>Gérer</ThemedText>
          <Ionicons name="chevron-forward" size={14} color="#93C5FD" />
        </Pressable>
      ) : null}

      <ScrollView style={styles.flex} contentContainerStyle={styles.nav}>
        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{s.title.toUpperCase()}</ThemedText>
            {s.items.map((it) => {
              const on = isActive(it);
              const n = badgeOf(badges.data, it.id);
              const external = !it.native && it.id !== 'boutique-preview';
              return (
                <Pressable
                  key={it.id}
                  onPress={() => go(it)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={n ? `${it.label}, ${n} nouveautés` : it.label}
                  style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && !on && styles.itemPressed]}>
                  <Ionicons name={it.icon} size={19} color={on ? '#fff' : '#C7D2FE'} />
                  <ThemedText style={[styles.itemText, on && styles.itemTextOn]} numberOfLines={1}>
                    {it.label}
                  </ThemedText>
                  {n ? (
                    <View style={styles.badge}>
                      <ThemedText style={styles.badgeText}>{n > 99 ? '99+' : n}</ThemedText>
                    </View>
                  ) : null}
                  {on ? <Ionicons name="checkmark" size={16} color="#fff" /> : external ? <Ionicons name="open-outline" size={13} color="#64748B" /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <FootBtn icon="help-circle-outline" label="Centre d’aide" onPress={() => {
            closeCompanyDrawer();
            openSite('/aide');
          }} />
        <FootBtn icon="log-out-outline" label="Se déconnecter" danger onPress={() => {
            closeCompanyDrawer();
            void signOut();
          }} />
      </View>
    </View>
  );
}

function FootBtn({ icon, label, onPress, danger }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.footBtn, pressed && styles.itemPressed]}>
      <Ionicons name={icon} size={18} color={danger ? '#FCA5A5' : '#C7D2FE'} />
      <ThemedText style={[styles.footText, danger && { color: '#FCA5A5' }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,6,23,0.55)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#0B1220', borderTopRightRadius: 22, borderBottomRightRadius: 22, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14 },
  logo: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#1E3A8A' },
  img: { width: '100%', height: '100%' },
  init: { color: '#93C5FD', fontWeight: '900', fontSize: 17 },
  name: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  sub: { color: '#94A3B8', fontSize: 12.5, lineHeight: 16, fontWeight: '600' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: '#13203A', borderWidth: 1, borderColor: '#1E3A8A' },
  walletLabel: { color: '#94A3B8', fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  walletV: { color: '#fff', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  walletLink: { color: '#93C5FD', fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  nav: { paddingHorizontal: 10, paddingBottom: 16, gap: 10 },
  section: { gap: 2 },
  sectionTitle: { color: '#64748B', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1.3, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 46, borderRadius: 12 },
  itemOn: { backgroundColor: Brand.primary },
  itemPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  itemText: { flex: 1, color: '#E2E8F0', fontSize: 14.5, lineHeight: 19, fontWeight: '600' },
  itemTextOn: { color: '#fff', fontWeight: '800' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#1E293B', paddingHorizontal: 10, paddingTop: 8, gap: 2 },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 44, borderRadius: 12 },
  footText: { color: '#C7D2FE', fontSize: 14, lineHeight: 18, fontWeight: '700' },
});
