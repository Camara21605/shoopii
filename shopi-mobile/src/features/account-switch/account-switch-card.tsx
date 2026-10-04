/**
 * Carte « compte » avec bascule pro ↔ client (en haut des menus ☰) :
 *
 *   [avatar]  Prénom Nom            (⟲ mini-avatar)  (⌄ 9+)
 *             Espace entreprise
 *
 *   · les deux flèches (⟲) autour du mini-avatar de l'autre compte = basculer
 *     tout de suite sur le compte lié ; sans compte lié (compte pro), elles
 *     ouvrent « Créer / lier mon espace client » ;
 *   · le chevron (⌄) ouvre « Vos comptes » : compte actuel, compte lié,
 *     notifications non lues (le badge rouge) ;
 *   · un client sans compte pro lié ne voit pas les flèches (comme le site,
 *     AccountSwitchLink se masque).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { fetchUnreadNotifications } from '@/features/notifications/api';
import { qk } from '@/lib/query-keys';

import { fetchLinkStatus, PRO_ROLES, SPACE_ICON, SPACE_LABEL, switchAccount } from './api';
import { AccountsSheet, CodeSheet, SetupSheet } from './sheets';
import { useAccountSwitch } from './use-account-switch';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function AccountSwitchCard({
  avatarUri,
  name,
  onPressProfile,
  onNotifications,
  onBeforeSwitch,
}: {
  /** Photo / logo du compte actuel (sinon initiales). */
  avatarUri?: string | null;
  /** Nom affiché (par défaut prénom + nom du compte). */
  name?: string;
  onPressProfile?: () => void;
  onNotifications?: () => void;
  /** Ex. fermer le menu ☰ avant d'entrer dans l'autre espace. */
  onBeforeSwitch?: () => void;
}) {
  const user = useSession((s) => s.user);
  const role = user?.role ?? 'client';
  const isPro = PRO_ROLES.includes(role);
  const status = useQuery({ queryKey: qk.accountLink, queryFn: fetchLinkStatus, enabled: !!user, staleTime: 5 * 60_000 });
  const unread = useQuery({ queryKey: qk.notifications.unread, queryFn: fetchUnreadNotifications, enabled: !!user, staleTime: 30_000 });
  const sw = useAccountSwitch(onBeforeSwitch);
  const [sheet, setSheet] = useState<'accounts' | 'setup' | null>(null);

  if (!user) return null;
  const linked = !!status.data?.linked;
  const otherRole = linked ? (status.data?.otherRole ?? (isPro ? 'client' : 'company')) : 'client';
  /* Flèches visibles : compte lié, ou compte pro (proposition de créer l'espace client). */
  const showSwitch = linked || (isPro && !!status.data);
  const fullName = name || `${user.firstName} ${user.lastName}`.trim() || user.username;
  const n = unread.data ?? 0;

  const doSwitch = () => {
    if (!linked) return setSheet('setup');
    void sw.run(switchAccount).then((ok) => {
      if (!ok) setSheet('accounts');
    });
  };

  return (
    <>
      <View style={styles.card}>
        <Pressable onPress={onPressProfile} disabled={!onPressProfile} accessibilityRole="button" accessibilityLabel={`${fullName}, ${SPACE_LABEL[role] ?? role}`} style={styles.who}>
          <View style={styles.avatar}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.img} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(fullName)}</ThemedText>}
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {fullName}
            </ThemedText>
            <ThemedText style={styles.space} numberOfLines={1}>
              {SPACE_LABEL[role] ?? role}
            </ThemedText>
          </View>
        </Pressable>

        {showSwitch ? (
          <Pressable
            onPress={doSwitch}
            disabled={sw.busy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={linked ? `Basculer vers l’${SPACE_LABEL[otherRole]?.toLowerCase() ?? 'autre compte'}` : 'Créer mon espace client'}
            style={({ pressed }) => [styles.switch, pressed && styles.pressed]}>
            <Ionicons name="sync" size={46} color="#A3A3A3" style={styles.arrows} />
            <View style={[styles.mini, !linked && styles.miniGhost]}>
              {sw.busy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name={(linked ? SPACE_ICON[otherRole] : 'add') as IconName} size={14} color={linked ? '#fff' : '#1F1F1F'} />
              )}
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => setSheet('accounts')}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={n ? `Vos comptes, ${n} notification${n > 1 ? 's' : ''} non lue${n > 1 ? 's' : ''}` : 'Vos comptes'}
          style={({ pressed }) => [styles.chev, pressed && styles.pressed]}>
          <Ionicons name="chevron-down" size={18} color="#1F1F1F" />
          {n > 0 ? (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeT}>{n > 9 ? '9+' : n}</ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      {sheet === 'accounts' ? (
        <AccountsSheet
          fullName={fullName}
          avatarUri={avatarUri}
          role={role}
          isPro={isPro}
          status={status.data}
          unread={n}
          busy={sw.busy}
          error={sw.error}
          onClose={() => {
            setSheet(null);
            sw.clearError();
          }}
          onSwitch={doSwitch}
          onSetup={() => setSheet('setup')}
          onNotifications={
            onNotifications
              ? () => {
                  setSheet(null);
                  onNotifications();
                }
              : undefined
          }
        />
      ) : null}
      {sheet === 'setup' && status.data ? (
        <SetupSheet
          existing={!!status.data.existingClientFound}
          matchedBy={status.data.matchedBy}
          sw={sw}
          onClose={() => {
            setSheet(null);
            sw.clearError();
          }}
        />
      ) : null}
      {sw.challenge ? <CodeSheet sw={sw} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E5E5' },
  img: { width: '100%', height: '100%' },
  init: { fontSize: 18, lineHeight: 24, fontWeight: '900', color: '#1F1F1F' },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '900', color: '#1F1F1F' },
  space: { fontSize: 12.5, lineHeight: 17, fontWeight: '700', color: '#6B6B6B', marginTop: 1 },
  switch: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  arrows: { position: 'absolute' },
  mini: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  miniGhost: { backgroundColor: '#F1F1F1', borderColor: '#FFFFFF' },
  chev: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EDEDED', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  badge: { position: 'absolute', top: -7, right: -9, minWidth: 22, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  badgeT: { color: '#fff', fontSize: 10, lineHeight: 12, fontWeight: '900' },
});
