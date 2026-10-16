/**
 * Menu latéral ☰ de l'espace client (bouton ☰ de l'en-tête, à droite) — il
 * sort du côté du bouton et glisse vers la gauche ; glisser vers la droite,
 * toucher le fond ou le bouton retour le ferme.
 *
 *   · carte du compte (bascule vers le compte lié, notifications) ;
 *   · SOLDE du portefeuille, comme les espaces entreprise, livreur et point
 *     relais : « Gérer » ouvre le portefeuille (recharge, retrait, historique) ;
 *   · seulement ce qui n'est pas déjà ailleurs à l'écran : Boutiques, Livreurs,
 *     Points relais et Catalogue sont dans la barre du bas ; Notifications,
 *     Panier, Messages et Localisation dans l'en-tête ; le compte est la carte
 *     du haut — aucun de ces onglets n'est répété ici ;
 *   · VISITEUR : « Se connecter / Créer un compte » à la place de la carte ;
 *     les rubriques personnelles demandent de se connecter.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, usePathname, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Animated, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShareAppButton } from '@/components/share-app-button';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { AccountSwitchCard } from '@/features/account-switch/account-switch-card';
import { requireAuth, requireClient } from '@/features/auth/auth-gate';
import { useSession } from '@/features/auth/session-store';
import { fetchWalletBalance } from '@/features/profile/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { closeClientDrawer, DRAWER_WIDTH, drawerPan, drawerX, useClientDrawerOpen } from '../drawer';

const SITE = 'https://www.shoneya.com';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
/** auth : 'client' = réservé aux clients ; 'any' = tout compte connecté ; absent = public. */
type Item = { icon: IconName; label: string; sub?: string; to?: Href; web?: string; auth?: 'client' | 'any' };

const SECTIONS: { title: string; items: Item[]; guest?: boolean }[] = [
  {
    title: 'Mon espace',
    items: [
      { icon: 'receipt-outline', label: 'Mes commandes', sub: 'Suivi, codes de retrait, retours', to: '/profil?tab=orders', auth: 'client' },
      { icon: 'heart-outline', label: 'Mes favoris', sub: 'Produits et boutiques aimés', to: '/profil?tab=favs', auth: 'client' },
      { icon: 'home-outline', label: 'Mes adresses', sub: 'Lieux de livraison', to: '/adresses', auth: 'client' },
    ],
  },
  {
    title: 'Découvrir',
    guest: true,
    items: [
      { icon: 'pricetag-outline', label: 'Offres du jour', web: '/offres' },
      { icon: 'compass-outline', label: 'Explorer', sub: 'Vidéos, nouveautés, tendances', to: '/explorer' },
    ],
  },
  {
    title: 'Aide et réglages',
    guest: true,
    items: [
      { icon: 'settings-outline', label: 'Paramètres', to: '/parametres', auth: 'any' },
      { icon: 'help-circle-outline', label: 'Centre d’aide', to: '/aide' },
    ],
  },
];

const gnf = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} GNF`;

/* Le menu s'ouvre dans une fenêtre (Modal) qui passe sous la barre d'état sur Android, où les
 * marges de sécurité valent alors 0 : sans ce repli, le haut du menu serait caché sous l'heure. */
const topInset = (inset: number) => Math.max(inset, Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0);

export function ClientDrawer() {
  const open = useClientDrawerOpen();
  if (!open) return null;
  const fade = drawerX.interpolate({ inputRange: [0, DRAWER_WIDTH], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => closeClientDrawer()}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => closeClientDrawer()} accessibilityRole="button" accessibilityLabel="Fermer le menu" />
      </Animated.View>
      <Animated.View style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX: drawerX }] }]} {...drawerPan.panHandlers}>
        <DrawerContent />
      </Animated.View>
    </Modal>
  );
}

function DrawerContent() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const isClient = user?.role === 'client';
  const wallet = useQuery({ queryKey: qk.wallet, queryFn: fetchWalletBalance, enabled: isClient, staleTime: 30_000 });
  const [hidden, setHidden] = useState(false);

  /* Fermer d'abord (animation), puis ouvrir : jamais deux fenêtres l'une sur l'autre. */
  const after = (fn: () => void) => closeClientDrawer(fn);

  const navigate = (it: Item) => {
    if (it.to) {
      const target = String(it.to);
      if (pathname === target.split('?')[0] && !target.includes('?')) return;
      router.push(it.to);
    } else if (it.web) void WebBrowser.openBrowserAsync(`${SITE}${it.web}`);
  };

  const open = (it: Item) =>
    after(() => {
      if (it.auth === 'client') return requireClient(() => navigate(it));
      if (it.auth === 'any') return requireAuth(() => navigate(it));
      navigate(it);
    });

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => after(() => void signOut()) },
    ]);

  const sections = user ? SECTIONS : SECTIONS.filter((s) => s.guest);

  return (
    <View style={[styles.fill, { backgroundColor: theme.background, paddingTop: topInset(insets.top) }]}>
      <View style={styles.head}>
        <ThemedText style={styles.brand}>
          Sho<ThemedText style={[styles.brand, { color: Brand.primary }]}>neya</ThemedText>
        </ThemedText>
        <Pressable
          onPress={() => closeClientDrawer()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu"
          style={[styles.close, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView style={styles.fill} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        {user ? (
          <AccountSwitchCard
            onBeforeSwitch={() => closeClientDrawer()}
            onPressProfile={() => after(() => router.push('/compte'))}
            onNotifications={() => after(() => router.push('/notifications'))}
          />
        ) : (
          <View style={[styles.guest, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.guestTitle}>Bienvenue sur Shoneya</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Connectez-vous pour commander, suivre vos boutiques et discuter avec elles.
            </ThemedText>
            <View style={styles.guestBtns}>
              <Pressable onPress={() => after(() => router.push('/login'))} accessibilityRole="button" style={[styles.guestBtn, styles.guestBtnMain]}>
                <ThemedText type="smallBold" style={styles.onPrimary}>
                  Se connecter
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => after(() => router.push('/register'))}
                accessibilityRole="button"
                style={[styles.guestBtn, styles.guestBtnOutline, { borderColor: theme.border, backgroundColor: theme.background }]}>
                <ThemedText type="smallBold">Créer un compte</ThemedText>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Solde : même accès rapide que les espaces pro ; « Gérer » ouvre le portefeuille ── */}
        {isClient ? (
          <Pressable
            onPress={() => after(() => router.push('/portefeuille'))}
            accessibilityRole="button"
            accessibilityLabel={`Solde disponible ${wallet.data != null && !hidden ? gnf(wallet.data) : ''}. Gérer le portefeuille`}
            style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet" size={20} color="#fff" />
            </View>
            <View style={styles.fill}>
              <ThemedText style={styles.walletLabel}>Solde disponible</ThemedText>
              <ThemedText style={styles.walletV} numberOfLines={1} adjustsFontSizeToFit>
                {hidden ? '•• ••• GNF' : wallet.data != null ? gnf(wallet.data) : wallet.isError ? '— GNF' : '…'}
              </ThemedText>
            </View>
            <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'Afficher le solde' : 'Masquer le solde'}>
              <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={19} color="rgba(255,255,255,0.8)" />
            </Pressable>
            <View style={styles.manage}>
              <ThemedText style={styles.manageText}>Gérer</ThemedText>
              <Ionicons name="chevron-forward" size={13} color="#1F1F1F" />
            </View>
          </Pressable>
        ) : null}

        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>{s.title.toUpperCase()}</ThemedText>
            <View style={[styles.card, { borderColor: theme.border }]}>
              {s.items.map((it, i) => (
                <Pressable
                  key={it.label}
                  onPress={() => open(it)}
                  accessibilityRole="button"
                  accessibilityHint={it.web ? 'S’ouvre sur shoneya.com' : undefined}
                  style={({ pressed }) => [
                    styles.row,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                    pressed && { backgroundColor: theme.backgroundElement },
                  ]}>
                  <View style={[styles.rowIcon, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name={it.icon} size={19} color={Brand.primary} />
                  </View>
                  <View style={styles.fill}>
                    <ThemedText style={styles.rowLabel}>{it.label}</ThemedText>
                    {it.sub ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {it.sub}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Ionicons name={it.web ? 'open-outline' : 'chevron-forward'} size={16} color={theme.textSecondary} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <ShareAppButton />

        {user ? (
          <Pressable onPress={confirmSignOut} accessibilityRole="button" style={[styles.logout, { borderColor: theme.border }]}>
            <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
            <ThemedText type="smallBold" style={{ color: Brand.danger }}>
              Se déconnecter
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pressed: { opacity: 0.9 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  /* Ancré à DROITE : côté du bouton ☰ */
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    overflow: 'hidden',
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: -4, height: 0 },
    elevation: 24,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 },
  brand: { fontSize: 24, lineHeight: 30, fontWeight: '800' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 18 },
  guest: { borderRadius: 16, padding: 16, gap: 6 },
  guestTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  guestBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  guestBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999, minHeight: 46 },
  guestBtnMain: { backgroundColor: Brand.primary },
  guestBtnOutline: { borderWidth: 1.5 },
  onPrimary: { color: Brand.primaryInk },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: '#1F1F1F' },
  walletIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  walletLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  walletV: { color: '#fff', fontSize: 19, lineHeight: 25, fontWeight: '900' },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#fff', borderRadius: 999, paddingLeft: 12, paddingRight: 8, minHeight: 32 },
  manageText: { color: '#1F1F1F', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11.5, lineHeight: 15, fontWeight: '800', letterSpacing: 1.3, paddingHorizontal: 4 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 56, paddingVertical: 8 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 50 },
});
