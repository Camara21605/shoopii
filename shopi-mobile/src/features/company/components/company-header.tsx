/**
 * Barre du haut de l'espace entreprise — comme la Topbar du site sur téléphone :
 *   ☰ (menu latéral) · titre + sous-titre de la page · 🔍 recherche globale ·
 *   💬 messages · 🔔 notifications (pastilles de non-lus) · avatar de la
 *   boutique → menu du compte (profil, boutique, paramètres, aide, déconnexion).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { fetchUnreadMessages } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import { openShop, openSite } from '@/features/catalog/open';
import { fetchUnreadNotifications } from '@/features/notifications/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { openCompanyDrawer } from '../drawer';
import { useCompanyIdentity, usePermissions } from '../hooks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS: Record<string, { label: string; color: string }> = {
  active: { label: 'Boutique active', color: Brand.success },
  pending: { label: 'En validation', color: '#D97706' },
  suspended: { label: 'Boutique en pause', color: '#D97706' },
};

export function CompanyHeader({ title = 'Vue d’ensemble', subtitle = 'Tableau de bord de votre boutique' }: { title?: string; subtitle?: string }) {
  const theme = useTheme();
  const perms = usePermissions();
  const identity = useCompanyIdentity();
  const notifs = useQuery({ queryKey: qk.notifications.unread, queryFn: fetchUnreadNotifications, refetchInterval: 60_000 });
  const messages = useQuery({ queryKey: qk.messages.unread, queryFn: fetchUnreadMessages, refetchInterval: 60_000 });
  const [menu, setMenu] = useState(false);
  const c = identity.data;
  const logo = thumb(c?.logo, 120);

  return (
    <View style={[styles.bar, { borderBottomColor: theme.border, backgroundColor: theme.background }]}>
      <Pressable onPress={openCompanyDrawer} hitSlop={8} style={styles.burger} accessibilityRole="button" accessibilityLabel="Menu de l’espace entreprise">
        <Ionicons name="menu" size={26} color={theme.text} />
      </Pressable>
      <View style={styles.flex}>
        <ThemedText numberOfLines={1} style={styles.title} accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary" style={styles.sub}>
          {subtitle}
        </ThemedText>
      </View>
      <IconBtn icon="search" label="Rechercher commandes, produits, clients" onPress={() => router.push('/entreprise/recherche')} />
      {perms.can('messaging', 'read') ? <IconBtn icon="chatbubble-ellipses" label="Messages" count={messages.data} onPress={() => router.push('/messages')} /> : null}
      <IconBtn icon="notifications" label="Notifications" count={notifs.data} onPress={() => router.push('/notifications')} />
      <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel="Mon compte" style={[styles.ava, { backgroundColor: theme.backgroundSelected }]}>
        {logo ? <Image source={{ uri: logo }} style={styles.img} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(c?.companyName ?? 'B')}</ThemedText>}
      </Pressable>
      {menu ? <AccountMenu onClose={() => setMenu(false)} /> : null}
    </View>
  );
}

function IconBtn({ icon, label, count, onPress }: { icon: IconName; label: string; count?: number; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={4} style={styles.btn} accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count} non lus` : label}>
      <Ionicons name={icon} size={21} color={theme.textSecondary} />
      {count ? (
        <View style={[styles.badge, { borderColor: theme.background }]}>
          <ThemedText style={styles.badgeText}>{count > 99 ? '99+' : count}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Menu du compte (avatar) — même contenu que le menu déroulant du site. */
function AccountMenu({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const identity = useCompanyIdentity();
  const perms = usePermissions();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);
  const c = identity.data;
  const st = STATUS[c?.status ?? 'active'] ?? STATUS.active;
  const logo = thumb(c?.logo, 120);

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={[styles.menu, { top: insets.top + 58, backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={[styles.menuHead, { borderBottomColor: theme.border }]}>
          <View style={[styles.menuAva, { backgroundColor: theme.backgroundSelected }]}>
            {logo ? <Image source={{ uri: logo }} style={styles.img} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(c?.companyName ?? 'B')}</ThemedText>}
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.menuName} numberOfLines={1}>
              {c?.companyName ?? 'Ma boutique'}
            </ThemedText>
            <View style={styles.row}>
              <View style={[styles.dot, { backgroundColor: st.color }]} />
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {st.label}
                {c?.ville ? ` · ${c.ville}` : ''}
              </ThemedText>
            </View>
            {user?.email ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {user.email} · {perms.isOwner ? 'Propriétaire' : 'Collaborateur'}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <MenuItem icon="person-outline" label="Mon profil" onPress={run(() => openSite('/dashboard/entreprise/profil'))} external />
        {c && perms.can('boutique', 'view') ? <MenuItem icon="storefront-outline" label="Voir ma boutique" onPress={run(() => openShop(c.id))} /> : null}
        {perms.can('settings', 'view') ? <MenuItem icon="settings-outline" label="Paramètres" onPress={run(() => router.push('/entreprise/parametres'))} /> : null}
        <MenuItem icon="help-circle-outline" label="Centre d’aide" onPress={run(() => openSite('/aide'))} external />
        <View style={[styles.sep, { backgroundColor: theme.border }]} />
        <MenuItem icon="log-out-outline" label="Se déconnecter" danger onPress={run(() => void signOut())} />
      </View>
    </Modal>
  );
}

function MenuItem({ icon, label, onPress, danger, external }: { icon: IconName; label: string; onPress: () => void; danger?: boolean; external?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : theme.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={19} color={danger ? Brand.danger : theme.textSecondary} />
      <ThemedText style={[styles.menuText, { color }]}>{label}</ThemedText>
      {external ? <Ionicons name="open-outline" size={13} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 8, paddingRight: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  burger: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  sub: { fontSize: 12, lineHeight: 16, marginTop: -1 },
  btn: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9.5, lineHeight: 12, fontWeight: '900' },
  ava: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginLeft: 4, borderWidth: 2, borderColor: 'rgba(0,0,0,0.05)' },
  img: { width: '100%', height: '100%' },
  init: { fontWeight: '900', color: Brand.primary },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  menu: { position: 'absolute', right: 12, width: 280, borderRadius: 18, borderWidth: 1, paddingBottom: 6, overflow: 'hidden', elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  menuHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  menuAva: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  menuName: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 46 },
  menuText: { flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '600' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
});
