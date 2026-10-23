/**
 * Noter les acteurs d'une commande livrée (comme la fenêtre du site) :
 * boutique, livreur, point relais — chacun 1 à 5 étoiles + commentaire
 * facultatif. Seuls les acteurs pas encore notés sont proposés ; le serveur
 * n'accepte qu'une note par acteur et seulement une fois la commande livrée.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { RATE_LABELS, sendRatings, type RatedRole } from '../api';

const STAR = '#F5A524';
const ROLE_LABEL: Record<RatedRole, { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  entreprise: { label: 'La boutique', icon: 'storefront-outline' },
  livreur: { label: 'Le livreur', icon: 'bicycle-outline' },
  correspondant: { label: 'Le point relais', icon: 'business-outline' },
};

export function RatingSheet({ uuid, actors, onClose, onDone }: {
  uuid: string;
  /** Acteurs à noter (pas encore notés), avec leur nom */
  actors: { role: RatedRole; nom: string }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const theme = useTheme();
  const [notes, setNotes] = useState<Partial<Record<RatedRole, number>>>({});
  const [comments, setComments] = useState<Partial<Record<RatedRole, string>>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rated = actors.filter((a) => notes[a.role]);

  async function send() {
    if (!rated.length) { setError('Touchez les étoiles pour donner au moins une note.'); return; }
    setSending(true);
    setError(null);
    try {
      await sendRatings(uuid, rated.map((a) => ({ role: a.role, note: notes[a.role]!, commentaire: comments[a.role] })));
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet title="Comment s’est passée la livraison ?" onClose={onClose} height={0.86}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary">
          Votre avis aide les acteurs à s’améliorer et guide les autres clients.
        </ThemedText>
        {actors.map((a) => {
          const n = notes[a.role] ?? 0;
          return (
            <View key={a.role} style={[styles.card, { borderColor: theme.border }]}>
              <View style={styles.head}>
                <View style={[styles.ico, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name={ROLE_LABEL[a.role].icon} size={18} color={theme.text} />
                </View>
                <View style={styles.flex}>
                  <ThemedText type="small" themeColor="textSecondary">{ROLE_LABEL[a.role].label}</ThemedText>
                  <ThemedText numberOfLines={1} style={styles.name}>{a.nom || ROLE_LABEL[a.role].label}</ThemedText>
                </View>
              </View>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <Pressable key={v} onPress={() => { setNotes((p) => ({ ...p, [a.role]: v })); setError(null); }} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel={`${v} étoile${v > 1 ? 's' : ''} pour ${ROLE_LABEL[a.role].label.toLowerCase()}`}>
                    <Ionicons name={v <= n ? 'star' : 'star-outline'} size={32} color={v <= n ? STAR : theme.textSecondary} />
                  </Pressable>
                ))}
              </View>
              <ThemedText type="small" style={[styles.rateLabel, { color: n ? STAR : theme.textSecondary }]}>{n ? RATE_LABELS[n] : 'Touchez une étoile'}</ThemedText>
              {n ? (
                <TextInput
                  value={comments[a.role] ?? ''}
                  onChangeText={(t) => setComments((p) => ({ ...p, [a.role]: t.slice(0, 500) }))}
                  placeholder="Un commentaire ? (facultatif)"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  maxLength={500}
                  style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                />
              ) : null}
            </View>
          );
        })}
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title={rated.length ? `Envoyer ${rated.length > 1 ? `mes ${rated.length} notes` : 'ma note'}` : 'Envoyer'} onPress={() => void send()} loading={sending} pill />
        <Pressable onPress={onClose} accessibilityRole="button" style={styles.later}>
          <ThemedText type="small" themeColor="textSecondary">Plus tard</ThemedText>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: 12, paddingBottom: 24 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ico: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  stars: { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 2 },
  rateLabel: { textAlign: 'center', fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, padding: 10, minHeight: 64, textAlignVertical: 'top', fontSize: 14 },
  err: { color: Brand.danger, fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  later: { alignSelf: 'center', paddingVertical: 6 },
});
