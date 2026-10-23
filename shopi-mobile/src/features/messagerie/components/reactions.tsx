/**
 * Réactions sur un message (❤️ 👍 😂…), discussion privée et groupes :
 *   - ReactionBar : la barre en tête du menu d'un message (appui long) —
 *     6 réactions rapides + « ＋ » pour en choisir une parmi tous les emojis ;
 *   - ReactionChips : les pastilles sous la bulle (« ❤️ 2 ») ; la mienne est
 *     surlignée, un toucher l'ajoute ou la retire.
 * Les réactions sont rattachées au compte (users.id) — voir summarizeReactions.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, ChatBubble } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { QUICK_REACTIONS, summarizeReactions } from '../emoji-data';

export function ReactionBar({ mine, onPick, onMore }: { mine: string[]; onPick: (emoji: string) => void; onMore: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { borderColor: theme.border }]}>
      {QUICK_REACTIONS.map((e) => {
        const on = mine.includes(e);
        return (
          <Pressable key={e} onPress={() => onPick(e)} accessibilityRole="button" accessibilityLabel={on ? `Retirer ${e}` : `Réagir ${e}`}
            style={({ pressed }) => [styles.quick, on && { backgroundColor: Brand.primarySoft }, pressed && styles.pressed]}>
            <ThemedText style={styles.quickEmoji}>{e}</ThemedText>
          </Pressable>
        );
      })}
      <Pressable onPress={onMore} accessibilityRole="button" accessibilityLabel="Plus de réactions" style={({ pressed }) => [styles.quick, styles.more, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
        <ThemedText style={styles.moreText}>＋</ThemedText>
      </Pressable>
    </View>
  );
}

export function ReactionChips({ reactions, myUserId, mineSide, onToggle }: {
  reactions: Record<string, string[]> | null | undefined;
  myUserId: string | undefined;
  /** Message envoyé par moi : pastilles alignées à droite */
  mineSide: boolean;
  onToggle: (emoji: string) => void;
}) {
  const theme = useTheme();
  const list = summarizeReactions(reactions, myUserId);
  if (!list.length) return null;
  return (
    <View style={[styles.chips, mineSide ? styles.chipsMine : styles.chipsTheirs]}>
      {list.map((r) => (
        <Pressable
          key={r.emoji}
          onPress={() => onToggle(r.emoji)}
          accessibilityRole="button"
          accessibilityLabel={`${r.emoji} ${r.count}${r.mine ? ', dont vous' : ''}`}
          style={[
            styles.chip,
            { backgroundColor: theme.background, borderColor: r.mine ? ChatBubble.mineAccent : theme.border },
            r.mine && { backgroundColor: ChatBubble.mine },
          ]}>
          <ThemedText style={styles.chipEmoji}>{r.emoji}</ThemedText>
          {r.count > 1 ? <ThemedText style={[styles.chipCount, r.mine && { color: ChatBubble.mineAccent }]}>{r.count}</ThemedText> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 6, paddingVertical: 4, borderWidth: 1, borderRadius: 999 },
  quick: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  quickEmoji: { fontSize: 26, lineHeight: 32 },
  more: { width: 38, height: 38, borderRadius: 19 },
  moreText: { fontSize: 20, lineHeight: 24, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: -6, marginBottom: 4 },
  chipsMine: { justifyContent: 'flex-end', paddingRight: 8 },
  chipsTheirs: { justifyContent: 'flex-start', paddingLeft: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  chipEmoji: { fontSize: 14, lineHeight: 19 },
  chipCount: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: '#5B6470' },
});
