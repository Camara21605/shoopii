/**
 * Menu ☰ de l'espace entreprise — plein écran, fond blanc, accents orange, qui glisse depuis la GAUCHE, comme
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
import { router, usePathname, type Href } from 'expo-router';
import { Animated, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { AccountSwitchCard } from '@/features/account-switch/account-switch-card';
import { useSession } from '@/features/auth/session-store';
import { openShop, openSite } from '@/features/catalog/open';
import { fetchWalletSummary } from '@/features/company-settings/api';
import { qk } from '@/lib/query-keys';

import { badgeOf } from '../api';
import { closeCompanyDrawer, DRAWER_WIDTH, drawerPan, drawerX, useCompanyDrawerOpen } from '../drawer';
import { useCompanyBadges, useCompanyIdentity, usePermissions } from '../hooks';
import { buildNav, webPath, type NavItem } from '../nav';

const gnf = (n: number) => `${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} GNF`;

/* Le menu s'ouvre dans une fenêtre (Modal) qui passe sous la barre d'état sur Android, où les
 * marges de sécurité valent alors 0 : sans ce repli, le haut du menu était caché sous l'heure. */
const topInset = (inset: number) => Math.max(inset, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

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
    <View style={[styles.fill, { paddingTop: topInset(insets.top) }]}>
      {/* En-tête : la carte de compte (photo, nom, bascule pro ↔ client) + fermer.
          L'ancien bandeau logo / nom / statut répétait la même identité juste au-dessus : retiré. */}
      <View style={styles.accountRow}>
        <View style={styles.flex}>
          <AccountSwitchCard
            onBeforeSwitch={closeCompanyDrawer}
            onNotifications={() => {
              closeCompanyDrawer();
              router.push('/notifications');
            }}
          />
        </View>
        <Pressable onPress={closeCompanyDrawer} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer le menu" style={styles.close}>
          <Ionicons name="close" size={24} color="#1F1F1F" />
        </Pressable>
      </View>

      {canWallet ? (
        <Pressable onPress={() => go({ id: 'portefeuille', label: 'Portefeuille', icon: 'wallet-outline', native: '/entreprise/portefeuille' as Href })} accessibilityRole="button" style={styles.wallet}>
          <Ionicons name="wallet" size={20} color={Brand.primary} />
          <View style={styles.flex}>
            <ThemedText style={styles.walletLabel}>Solde disponible</ThemedText>
            <ThemedText style={styles.walletV}>{wallet.data ? gnf(wallet.data.withdrawableBalance) : '— GNF'}</ThemedText>
          </View>
          <ThemedText style={styles.walletLink}>Gérer</ThemedText>
          <Ionicons name="chevron-forward" size={14} color="#737373" />
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
                  <Ionicons name={it.icon} size={19} color={on ? Brand.primary : '#525252'} />
                  <ThemedText style={[styles.itemText, on && styles.itemTextOn]} numberOfLines={1}>
                    {it.label}
                  </ThemedText>
                  {n ? (
                    <View style={styles.badge}>
                      <ThemedText style={styles.badgeText}>{n > 99 ? '99+' : n}</ThemedText>
                    </View>
                  ) : null}
                  {on ? <Ionicons name="checkmark" size={16} color={Brand.primary} /> : external ? <Ionicons name="open-outline" size={13} color="#A3A3A3" /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <FootBtn icon="help-circle-outline" label="Centre d’aide" onPress={() => {
            closeCompanyDrawer();
            router.push('/aide');
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
      <Ionicons name={icon} size={18} color={danger ? Brand.danger : '#404040'} />
      <ThemedText style={[styles.footText, danger && { color: Brand.danger }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 12, paddingTop: 14 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 14, marginBottom: 4, padding: 14, borderRadius: 16, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)' },
  walletLabel: { color: '#6B6B6B', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  walletV: { color: '#1F1F1F', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  walletLink: { color: Brand.primary, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  nav: { paddingHorizontal: 12, paddingBottom: 16, gap: 12 },
  section: { gap: 2 },
  sectionTitle: { color: '#8A8A8A', fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 1.3, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, minHeight: 50, borderRadius: 14 },
  itemOn: { backgroundColor: Brand.primarySoft },
  itemPressed: { backgroundColor: '#F6F6F6' },
  itemText: { flex: 1, color: '#1F1F1F', fontSize: 15.5, lineHeight: 20, fontWeight: '600' },
  itemTextOn: { color: Brand.primary, fontWeight: '800' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5E5', paddingHorizontal: 12, paddingTop: 8, gap: 2 },
  footBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, minHeight: 48, borderRadius: 14 },
  footText: { color: '#1F1F1F', fontSize: 15, lineHeight: 19, fontWeight: '700' },
});
