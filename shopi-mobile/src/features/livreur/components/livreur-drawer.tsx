/**
 * Menu ☰ de l'espace livreur — plein écran, glisse depuis la gauche, comme le
 * menu mobile du site (Topbar/Sidebar) :
 *   · en tête : la carte de compte (photo, nom, bascule pro ↔ client) + fermer ;
 *   · gains du mois et solde du portefeuille (« Gérer » ouvre le Portefeuille,
 *     qui n'est plus une rubrique de la liste) ;
 *   · toutes les rubriques (Messages n'y figure plus : icône 💬 de l'en-tête) (pastilles : nouvelles missions, missions en cours),
 *     rubrique courante cochée, rubriques encore sur le site marquées ↗ ;
 *   · pied : Centre d'aide, Se déconnecter.
 * Le site affiche aussi un interrupteur « En ligne / Hors ligne » qui ne
 * change rien côté serveur (simple affichage) : il n'est pas repris ici.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname } from 'expo-router';
import { Animated, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { AccountSwitchCard } from '@/features/account-switch/account-switch-card';
import { useSession } from '@/features/auth/session-store';
import { openSite } from '@/features/catalog/open';
import { fetchWallet } from '@/features/wallet/api';
import { qk } from '@/lib/query-keys';

import { fetchRevenus, gnf } from '../api';
import { closeLivreurDrawer, DRAWER_WIDTH, drawerPan, drawerX, useLivreurDrawerOpen } from '../drawer';
import { useLivreurBadges, useLivreurMe } from '../hooks';
import { LIVREUR_NAV, webPath, type LivreurNavItem } from '../nav';

/* Le menu s'ouvre dans une fenêtre (Modal) qui passe sous la barre d'état sur Android, où les
 * marges de sécurité valent alors 0 : sans ce repli, le haut du menu était caché sous l'heure. */
const topInset = (inset: number) => Math.max(inset, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

export function LivreurDrawer() {
  const open = useLivreurDrawerOpen();
  if (!open) return null;
  const fade = drawerX.interpolate({ inputRange: [-DRAWER_WIDTH, 0], outputRange: [0, 1] });
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={closeLivreurDrawer}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeLivreurDrawer} accessibilityRole="button" accessibilityLabel="Fermer le menu" />
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
  const me = useLivreurMe();
  const badges = useLivreurBadges();
  const signOut = useSession((s) => s.signOut);
  const wallet = useQuery({ queryKey: qk.walletPage.summary, queryFn: fetchWallet, staleTime: 60_000 });
  const revenus = useQuery({ queryKey: qk.livreur.revenus, queryFn: fetchRevenus, staleTime: 60_000 });

  const isActive = (it: LivreurNavItem) => (it.id === 'overview' ? pathname === '/livreur' : typeof it.native === 'string' && it.native !== '/livreur' && pathname.startsWith(it.native));
  const badgeOf = (id: string) => (id === 'missions' ? badges.missions : id === 'encours' ? badges.encours : 0);

  const go = (it: LivreurNavItem) => {
    closeLivreurDrawer();
    if (!it.native) return openSite(webPath(it));
    if (isActive(it)) return;
    if (it.id === 'overview') return router.dismissTo('/livreur');
    router.push(it.native);
  };

  return (
    <View style={[styles.fill, { paddingTop: topInset(insets.top) }]}>
      {/* En-tête : la carte de compte (photo, nom, bascule pro ↔ client) + fermer.
          L'ancien bandeau photo / nom / note répétait la même identité juste au-dessus : retiré. */}
      <View style={styles.accountRow}>
        <View style={styles.flex}>
          <AccountSwitchCard
            avatarUri={me.data?.photoUrl}
            name={me.data?.fullName || undefined}
            onBeforeSwitch={closeLivreurDrawer}
            onNotifications={() => {
              closeLivreurDrawer();
              router.push('/notifications');
            }}
          />
        </View>
        <Pressable onPress={closeLivreurDrawer} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer le menu" style={styles.close}>
          <Ionicons name="close" size={24} color="#1F1F1F" />
        </Pressable>
      </View>

      <View style={styles.cards}>
        <View style={styles.card}>
          <ThemedText style={styles.cardLabel}>Gains du mois</ThemedText>
          <ThemedText style={styles.cardV} numberOfLines={1}>
            {revenus.data ? gnf(revenus.data.revenusThisMonth) : '— GNF'}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => go({ id: 'portefeuille', label: 'Portefeuille', icon: 'wallet-outline', native: '/livreur/portefeuille' })}
          accessibilityRole="button"
          accessibilityLabel="Solde disponible — gérer mon portefeuille"
          style={styles.card}>
          <ThemedText style={styles.cardLabel}>Solde disponible</ThemedText>
          <ThemedText style={styles.cardV} numberOfLines={1}>
            {wallet.data ? gnf(wallet.data.withdrawableBalance ?? wallet.data.balance) : '— GNF'}
          </ThemedText>
          <View style={styles.manage}>
            <ThemedText style={styles.manageText}>Gérer</ThemedText>
            <Ionicons name="chevron-forward" size={13} color="#737373" />
          </View>
        </Pressable>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.nav}>
        {LIVREUR_NAV.map((s) => (
          <View key={s.title} style={styles.section}>
            <ThemedText style={styles.sectionTitle}>{s.title.toUpperCase()}</ThemedText>
            {s.items.map((it) => {
              const on = isActive(it);
              const n = badgeOf(it.id);
              return (
                <Pressable
                  key={it.id}
                  onPress={() => go(it)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={n ? `${it.label}, ${n}` : it.label}
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
                  {on ? <Ionicons name="checkmark" size={16} color={Brand.primary} /> : !it.native ? <Ionicons name="open-outline" size={13} color="#A3A3A3" /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <FootBtn icon="help-circle-outline" label="Centre d’aide" onPress={() => { closeLivreurDrawer(); router.push('/aide'); }} />
        <FootBtn icon="log-out-outline" label="Se déconnecter" danger onPress={() => { closeLivreurDrawer(); void signOut(); }} />
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
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 16, paddingRight: 12, paddingTop: 14 },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  manageText: { color: Brand.primary, fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  cards: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 14, marginBottom: 4 },
  card: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', gap: 2 },
  cardLabel: { color: '#6B6B6B', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  cardV: { color: '#1F1F1F', fontSize: 16, lineHeight: 21, fontWeight: '900' },
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
