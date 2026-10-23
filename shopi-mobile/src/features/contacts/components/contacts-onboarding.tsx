/**
 * Proposition de synchroniser ses contacts DÈS LA PREMIÈRE CONNEXION (comme
 * Telegram / WhatsApp), montée à la racine pour le compte connecté.
 *
 *   - affichée une fois, quelques secondes après la connexion (l'application
 *     a le temps de s'afficher ; jamais pendant un appel) ;
 *   - explication claire AVANT la fenêtre de permission Android — l'affichage
 *     bien visible exigé par Google Play pour l'accès aux contacts ;
 *   - « Autoriser » : permission Android puis première synchronisation ;
 *     « Plus tard » : reproposée une seule fois, 7 jours après ; toujours
 *     possible ensuite depuis Messages › Contacts ou ⚙ Paramètres.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useCallStore } from '@/features/calls/call-store';
import { useGroupCallStore } from '@/features/calls/group-call-store';
import { useTheme } from '@/hooks/use-theme';

import { contactsPermission, enableContactsSync, markContactsOffered, shouldOfferContactsSync } from '../sync';

/** Laisser l'application s'afficher (et les autres demandes d'autorisation passer) avant de proposer. */
const DELAY_MS = 4000;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function ContactsOnboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const userId = useSession((s) => s.user?.id ?? null);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    if (!shouldOfferContactsSync(userId)) return;
    let t: ReturnType<typeof setTimeout>;
    const tryShow = () => {
      /* Appel en cours ou qui sonne : on repropose 10 s plus tard */
      if (useCallStore.getState().status !== 'idle' || useGroupCallStore.getState().status !== 'idle') {
        t = setTimeout(tryShow, 10_000);
        return;
      }
      markContactsOffered(userId);
      setVisible(true);
    };
    t = setTimeout(tryShow, DELAY_MS);
    return () => clearTimeout(t);
  }, [userId]);

  async function allow() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      const ok = await enableContactsSync(userId);
      setVisible(false);
      if (ok) {
        markContactsOffered(userId, true);
        return;
      }
      if ((await contactsPermission()) === 'blocked') {
        Alert.alert('Accès aux contacts refusé', 'Vous pourrez l’autoriser plus tard dans les réglages du téléphone : Applications › Shoneya › Autorisations › Contacts.', [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
        ]);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={() => setVisible(false)} accessibilityLabel="Fermer">
        <Pressable style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.icon, { backgroundColor: Brand.primarySoft }]}>
            <Ionicons name="people" size={34} color={Brand.primary} />
          </View>
          <ThemedText style={styles.title}>Retrouvez vos contacts sur Shoneya</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            Shoneya peut lire les numéros et les noms de votre répertoire pour vous montrer lesquels de vos contacts utilisent déjà Shoneya, et vous prévenir quand l’un d’eux s’inscrit.
          </ThemedText>

          <View style={[styles.facts, { borderColor: theme.border }]}>
            <Fact icon="lock-closed-outline" text="Les numéros sont transformés en code chiffré sur votre téléphone : aucun numéro n’est envoyé en clair." />
            <Fact icon="eye-off-outline" text="Rien n’est vendu ni partagé, et vos contacts ne sont pas avertis de votre choix." />
            <Fact icon="trash-outline" text="Désactivable à tout moment (Messages › ⚙) : tout est alors effacé de nos serveurs." last />
          </View>

          <Pressable onPress={() => void allow()} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="people-outline" size={18} color="#fff" />}
            <ThemedText style={styles.primaryText}>Autoriser l’accès aux contacts</ThemedText>
          </Pressable>
          <Pressable onPress={() => setVisible(false)} disabled={busy} accessibilityRole="button" style={styles.later}>
            <ThemedText type="smallBold" themeColor="textSecondary">Plus tard</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Fact({ icon, text, last }: { icon: IconName; text: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon} size={17} color={Brand.primary} style={styles.factIcon} />
      <ThemedText type="small" style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.85 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: Spacing.four, alignItems: 'center', gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  facts: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  factIcon: { marginTop: 1 },
  primary: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, borderRadius: 999, paddingVertical: 14, marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  later: { paddingVertical: 8 },
});
