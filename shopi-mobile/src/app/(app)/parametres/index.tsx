/**
 * Paramètres du compte client — écran d'accueil, organisé comme le menu
 * « Paramètres » du site sur téléphone (SettingsMobileMenu.tsx) : Général,
 * Mon compte, Sécurité, Assistance, Zone de danger. Thème blanc.
 *
 * Écrans natifs : profil, notifications, confidentialité & sécurité,
 * appareils connectés, journal d'activité, points, zone de danger, centre
 * d'aide et contact (écrans natifs de features/help).
 * Encore sur le site (↗) : paiement, export des données.
 * Apparence et langue n'y figurent pas : l'application est
 * volontairement en thème clair et en français (voir hooks/use-theme.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { fetchNotifs, fetchProfil, fetchSecurite, updateNotifs, type Notifs } from '@/features/settings/api';
import { Card, Row, Section, Toggle, useToast } from '@/features/settings/ui';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const SITE = 'https://www.shoneya.com';
const openWeb = (path: string) => void WebBrowser.openBrowserAsync(`${SITE}${path}`);
const go = (path: Href) => router.push(path);

export default function SettingsHome() {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useSession((s) => s.user);
  const signOut = useSession((s) => s.signOut);

  const profil = useQuery({ queryKey: ['settings', 'profil'], queryFn: fetchProfil });
  const notifs = useQuery({ queryKey: ['settings', 'notifs'], queryFn: fetchNotifs });
  const securite = useQuery({ queryKey: ['settings', 'securite'], queryFn: fetchSecurite });

  /* Interrupteur rapide « Notifications » : même réglage que global.push de l'écran Notifications */
  const pushMutation = useMutation({
    mutationFn: (next: boolean) => updateNotifs({ global: { push: next, email: notifs.data?.global.email ?? false } }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ['settings', 'notifs'] });
      const previous = qc.getQueryData<Notifs>(['settings', 'notifs']);
      if (previous) qc.setQueryData<Notifs>(['settings', 'notifs'], { ...previous, global: { ...previous.global, push: next } });
      return { previous };
    },
    onError: (error, _next, ctx) => {
      if (ctx?.previous) qc.setQueryData(['settings', 'notifs'], ctx.previous);
      toast.show(toUserMessage(error));
    },
    onSuccess: (view) => qc.setQueryData(['settings', 'notifs'], view),
  });

  /* Points d'attention sécurité — même calcul que le badge du site (useSecurityBadge.ts) */
  const securityBadge = securite.data
    ? [!securite.data.twoFaEnabled, securite.data.twoFaEnabled && securite.data.codesSecours === 0].filter(Boolean).length
    : 0;

  const p = profil.data;
  const name = p ? `${p.firstName} ${p.lastName}`.trim() : user ? `${user.firstName} ${user.lastName}` : '';
  const email = p?.email ?? user?.email ?? '';
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';

  const share = () =>
    void Share.share({ title: 'Shoneya', message: `Découvrez Shoneya, achetez et vendez en Guinée : ${SITE}` }).catch(() =>
      toast.show('Impossible de partager le lien'),
    );

  const confirmSignOut = () =>
    Alert.alert('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Paramètres" />
      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Résumé du profil ── */}
        <Pressable
          onPress={() => go('/parametres/profil')}
          accessibilityRole="button"
          accessibilityLabel={`Profil de ${name || 'mon compte'}`}
          style={({ pressed }) => [styles.profile, { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement }]}>
          {p?.profilePicture ? (
            <Image source={{ uri: p.profilePicture }} style={styles.avatar} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <ThemedText style={styles.avatarText}>{initials}</ThemedText>
            </View>
          )}
          <View style={styles.flex}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {name || 'Mon compte'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {email || 'Modifier mon profil'}
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </Pressable>

        <Section title="Général">
          <Card>
            <Row
              icon="notifications-outline"
              label="Notifications"
              desc="Alertes pour vos commandes et messages"
              onPress={() => go('/parametres/notifications')}
              right={
                notifs.data ? (
                  <Toggle
                    label="Notifications push"
                    value={notifs.data.global.push}
                    onChange={(v) => pushMutation.mutate(v)}
                    disabled={pushMutation.isPending}
                  />
                ) : undefined
              }
            />
          </Card>
        </Section>

        <Section title="Mon compte">
          <Card>
            <Row icon="person-outline" label="Profil" desc="Photo, identité, e-mail et téléphone" onPress={() => go('/parametres/profil')} />
            <Row icon="location-outline" label="Adresses" desc="Livraison, adresse par défaut, épingle GPS" onPress={() => go('/adresses')} />
            <Row icon="card-outline" label="Paiement" onPress={() => openWeb('/parametres?panel=paiement')} external />
            <Row icon="star-outline" label="Points Shoneya" onPress={() => go('/parametres/points')} />
          </Card>
        </Section>

        <Section title="Sécurité">
          <Card>
            <Row
              icon="shield-checkmark-outline"
              label="Confidentialité & sécurité"
              badge={securityBadge || undefined}
              onPress={() => go('/parametres/securite')}
            />
            <Row icon="phone-portrait-outline" label="Appareils connectés" onPress={() => go('/parametres/appareils')} />
            <Row icon="time-outline" label="Journal d’activité" onPress={() => go('/parametres/activite')} />
            <Row icon="server-outline" label="Mes données" onPress={() => openWeb('/parametres?panel=donnees')} external />
          </Card>
        </Section>

        <Section title="Assistance">
          <Card>
            <Row icon="book-outline" label="Centre d’aide" onPress={() => go('/aide')} />
            <Row icon="mail-outline" label="Nous contacter" onPress={() => go('/aide/contact')} />
            <Row icon="share-social-outline" label="Partager l’application" onPress={share} />
          </Card>
        </Section>

        <Section title="Zone de danger">
          <Card danger>
            <Row icon="warning-outline" label="Désactiver ou supprimer mon compte" danger onPress={() => go('/parametres/compte')} />
          </Card>
        </Section>

        <Pressable onPress={confirmSignOut} accessibilityRole="button" style={[styles.logout, { borderColor: theme.border }]}>
          <Ionicons name="log-out-outline" size={20} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Se déconnecter
          </ThemedText>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary" style={styles.foot}>
          <Ionicons name="open-outline" size={12} /> s’ouvre sur shoneya.com en attendant sa version dans l’application.
        </ThemedText>
      </ScrollView>
      {toast.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Brand.primaryInk, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  name: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  logout: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 50 },
  foot: { textAlign: 'center', marginTop: -Spacing.two },
});
