/**
 * Messagerie › Paramètres › « Contacts du téléphone » :
 *   interrupteur de synchronisation (même accord que l'onglet Contacts),
 *   dernière mise à jour, « Mettre à jour maintenant », et la désactivation
 *   qui EFFACE du serveur tout ce qui avait été envoyé.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useContactsSync } from '../hooks';
import { disableContactsSync, enableContactsSync, syncContacts } from '../sync';

function since(iso: string | null): string {
  if (!iso) return 'jamais';
  const d = new Date(iso);
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ContactsSettingsCard() {
  const theme = useTheme();
  const sync = useContactsSync();
  const [busy, setBusy] = useState(false);
  const running = sync.phase === 'reading' || sync.phase === 'sending';

  async function toggle(next: boolean) {
    if (!sync.userId || busy) return;
    if (next) {
      setBusy(true);
      try {
        const ok = await enableContactsSync(sync.userId);
        if (!ok) Alert.alert('Accès refusé', 'Autorisez l’accès aux contacts dans les réglages du téléphone pour utiliser cette fonction.');
      } finally {
        setBusy(false);
      }
      return;
    }
    Alert.alert(
      'Désactiver la synchronisation ?',
      'Vos contacts seront effacés des serveurs de Shoneya et l’onglet Contacts sera vidé. Vos discussions ne sont pas touchées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désactiver et effacer',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            disableContactsSync(sync.userId!)
              .catch((err: unknown) => Alert.alert('Effacement impossible', err instanceof Error ? err.message : 'Réessayez dans un instant.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <View>
      <View style={[styles.line, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
        <Ionicons name="people-outline" size={20} color={Brand.primary} />
        <View style={styles.flex}>
          <ThemedText style={styles.title}>Synchroniser mes contacts</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Voir qui, dans votre répertoire, est sur Shoneya et être prévenu quand un contact s’inscrit.
          </ThemedText>
        </View>
        {busy ? <ActivityIndicator color={Brand.primary} /> : (
          <Switch value={sync.enabled} onValueChange={(v) => void toggle(v)} trackColor={{ true: Brand.primary }} accessibilityLabel="Synchroniser mes contacts" />
        )}
      </View>
      {sync.enabled ? (
        <Pressable
          onPress={() => sync.userId && void syncContacts(sync.userId, { force: true })}
          disabled={running}
          accessibilityRole="button"
          style={({ pressed }) => [styles.line, pressed && { backgroundColor: theme.backgroundElement }]}>
          {running ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="refresh" size={18} color={theme.textSecondary} />}
          <View style={styles.flex}>
            <ThemedText style={styles.title}>{running ? 'Mise à jour en cours…' : 'Mettre à jour maintenant'}</ThemedText>
            <ThemedText type="small" themeColor={sync.phase === 'error' ? undefined : 'textSecondary'} style={sync.phase === 'error' ? styles.error : undefined}>
              {sync.phase === 'error' && sync.error ? sync.error : `Dernière mise à jour : ${since(sync.lastSyncAt)}`}
            </ThemedText>
          </View>
        </Pressable>
      ) : (
        <View style={styles.line}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Désactivé : rien n’est lu ni envoyé. Une fois activé, les numéros sont envoyés sous forme d’empreinte chiffrée, jamais en clair.
          </ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  error: { color: '#B45309' },
});
