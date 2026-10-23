/**
 * Panneau 😊 de la zone de saisie (discussion privée et groupes) :
 *   - onglet « Autocollants » (⭐) : un toucher ENVOIE l'autocollant, en grand ;
 *   - 9 catégories d'emojis (Smileys, Cœurs, Gestes, Animaux, Nourriture,
 *     Fêtes, Voyages, Objets, Symboles) : un toucher l'AJOUTE au message.
 * Aussi utilisé pour choisir n'importe quelle réaction (« + » de la barre).
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { EMOJI_CATEGORIES, STICKERS } from '../emoji-data';

const STICKER_TAB = 'stickers';

export function EmojiPanel({ onEmoji, onSticker, height = 280, withStickers = true }: {
  /** Emoji choisi (ajouté au texte, ou réaction) */
  onEmoji: (emoji: string) => void;
  /** Autocollant choisi (envoyé tout de suite) */
  onSticker?: (sticker: string) => void;
  height?: number;
  withStickers?: boolean;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const stickers = withStickers && !!onSticker;
  const [tab, setTab] = useState<string>(stickers ? STICKER_TAB : EMOJI_CATEGORIES[0].key);

  const isSticker = tab === STICKER_TAB;
  const items = useMemo(
    () => (isSticker ? STICKERS : EMOJI_CATEGORIES.find((c) => c.key === tab)?.emojis ?? []),
    [isSticker, tab],
  );
  const columns = isSticker ? 5 : 8;
  const cell = Math.floor((width - 16) / columns);

  return (
    <View style={[styles.wrap, { height, borderTopColor: theme.border, backgroundColor: theme.background }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {stickers ? (
          <Tab active={isSticker} onPress={() => setTab(STICKER_TAB)} label="Autocollants" icon="⭐" />
        ) : null}
        {EMOJI_CATEGORIES.map((c) => (
          <Tab key={c.key} active={tab === c.key} onPress={() => setTab(c.key)} label={c.label} icon={c.icon} />
        ))}
      </ScrollView>
      <FlatList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(e, i) => `${tab}-${i}-${e}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.grid}
        initialNumToRender={48}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => (isSticker ? onSticker?.(item) : onEmoji(item))}
            accessibilityRole="button"
            accessibilityLabel={isSticker ? `Envoyer l’autocollant ${item}` : `Emoji ${item}`}
            style={({ pressed }) => [styles.cell, { width: cell, height: isSticker ? cell : 44 }, pressed && { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={isSticker ? styles.sticker : styles.emoji}>{item}</ThemedText>
          </Pressable>
        )}
      />
    </View>
  );
}

function Tab({ active, onPress, label, icon }: { active: boolean; onPress: () => void; label: string; icon: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: active }}
      style={[styles.tab, active && { backgroundColor: Brand.primarySoft }]}>
      <ThemedText style={styles.tabIcon}>{icon}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth },
  tabs: { paddingHorizontal: 8, paddingVertical: 6, gap: 4 },
  tab: { width: 42, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabIcon: { fontSize: 21, lineHeight: 26 },
  grid: { paddingHorizontal: 8, paddingBottom: 12 },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  emoji: { fontSize: 27, lineHeight: 34 },
  sticker: { fontSize: 46, lineHeight: 56 },
});
