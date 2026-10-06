/**
 * Paramètres › Zone de danger — mêmes actions que la rubrique du site
 * (DangerSection.tsx) :
 *   - désactiver le compte (mot de passe) : déconnexion, réactivation
 *     automatique à la prochaine connexion ;
 *   - réinitialiser les préférences (notifications, confidentialité, taille
 *     du texte, langue) ;
 *   - supprimer le compte (mot de passe) : refusé par le serveur tant
 *     qu'une commande est en cours ou que le portefeuille contient des fonds
 *     — le message du serveur est alors affiché tel quel.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordField } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { deactivateAccount, deleteAccount, resetPreferences } from '@/features/settings/api';
import { Card, OutlineButton, Section, TextButton, useToast } from '@/features/settings/ui';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api/errors';

type Action = 'desactiver' | 'supprimer';

export default function DangerScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const signOut = useSession((s) => s.signOut);
  const [open, setOpen] = useState<Action | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | 'reset' | null>(null);

  function start(a: Action) {
    setOpen(a);
    setPassword('');
    setError(null);
  }

  async function confirm(a: Action) {
    if (!password) return setError('Mot de passe requis pour confirmer.');
    setBusy(a);
    setError(null);
    try {
      if (a === 'desactiver') await deactivateAccount(password);
      else await deleteAccount(password);
      Alert.alert(
        a === 'desactiver' ? 'Compte désactivé' : 'Compte supprimé',
        a === 'desactiver'
          ? 'Vous êtes déconnecté. Vos données sont conservées ; votre compte sera réactivé à votre prochaine connexion.'
          : 'Votre compte est fermé. Vos données personnelles seront effacées définitivement dans 30 jours.',
        [{ text: 'OK', onPress: () => void signOut() }],
        { cancelable: false },
      );
    } catch (e) {
      const unauthorized = e instanceof ApiError && (e.status === 401 || /mot de passe/i.test(e.message));
      setError(unauthorized ? 'Mot de passe incorrect.' : toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function confirmReset() {
    Alert.alert(
      'Réinitialiser vos préférences ?',
      'Notifications, confidentialité, taille du texte et langue reviennent aux valeurs par défaut de Shoneya.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            setBusy('reset');
            try {
              await resetPreferences();
              await qc.invalidateQueries({ queryKey: ['settings'] });
              toast.show('Préférences réinitialisées');
            } catch (e) {
              toast.show(toUserMessage(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  const confirmBox = (a: Action) => (
    <View style={styles.confirm}>
      <PasswordField label="Mot de passe actuel" value={password} onChangeText={setPassword} autoComplete="current-password" error={error} />
      <OutlineButton
        icon={a === 'desactiver' ? 'pause-circle-outline' : 'trash-outline'}
        label={a === 'desactiver' ? 'Confirmer la désactivation' : 'Supprimer définitivement'}
        danger
        loading={busy === a}
        disabled={!password}
        onPress={() => void confirm(a)}
      />
      <TextButton label="Annuler" onPress={() => setOpen(null)} disabled={busy === a} />
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Zone de danger" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.banner}>
            <Ionicons name="warning-outline" size={20} color={Brand.danger} />
            <ThemedText type="small" style={styles.flex}>
              Ces actions touchent tout votre compte. Réfléchissez avant d’agir.
            </ThemedText>
          </View>

          <Section title="Désactiver">
            <Card danger>
              <View style={styles.block}>
                <ThemedText style={styles.title}>Désactiver temporairement le compte</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Vous êtes déconnecté et votre profil est masqué. Vos données sont conservées ; le compte est réactivé automatiquement à votre
                  prochaine connexion.
                </ThemedText>
                {open === 'desactiver' ? (
                  confirmBox('desactiver')
                ) : (
                  <OutlineButton icon="pause-circle-outline" label="Désactiver" danger onPress={() => start('desactiver')} />
                )}
              </View>
            </Card>
          </Section>

          <Section title="Préférences">
            <Card danger>
              <View style={styles.block}>
                <ThemedText style={styles.title}>Réinitialiser toutes mes préférences</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Remet aux valeurs par défaut vos notifications, votre confidentialité, la taille du texte et la langue.
                </ThemedText>
                <OutlineButton icon="refresh-outline" label="Réinitialiser" danger loading={busy === 'reset'} onPress={confirmReset} />
              </View>
            </Card>
          </Section>

          <Section title="Supprimer">
            <Card danger>
              <View style={styles.block}>
                <ThemedText style={styles.title}>Supprimer définitivement le compte</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Votre compte est fermé et vos données personnelles seront effacées définitivement dans 30 jours. Action irréversible. Impossible
                  tant qu’une commande est en cours ou que votre portefeuille contient des fonds.
                </ThemedText>
                {open === 'supprimer' ? (
                  confirmBox('supprimer')
                ) : (
                  <OutlineButton icon="trash-outline" label="Supprimer mon compte" danger onPress={() => start('supprimer')} />
                )}
              </View>
            </Card>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
      {toast.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  banner: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#FDECEA' },
  block: { padding: 14, gap: 10 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '800', color: Brand.danger },
  confirm: { gap: Spacing.three, marginTop: 4 },
});
