/**
 * Choix d'un livreur ou d'un point relais (bouton radio) : avatar, nom, Vérifié,
 * disponibilité, lieu, note et activité, et la provenance (« Livreur de
 * Supérette », « Vous le suivez ») pour que le client sache pourquoi il est proposé.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { Stars } from '@/features/shop/components';
import { useTheme } from '@/hooks/use-theme';

/** Livreur ou point relais proposé, fusion de l'équipe des boutiques et des abonnements du client. */
export type PickActor = {
  id: string;
  name: string;
  emoji?: string | null;
  place?: string | null;
  note: number;
  activity?: string | null; // « 120 livraisons », « 35 missions »
  status?: { label: string; color: string } | null; // Disponible, Ouvert aujourd'hui…
  verified?: boolean;
  sources: string[]; // « Livreur de Supérette chez nous », « Vous le suivez »
};

export function ActorOption({ actor, selected, onPress }: { actor: PickActor; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${actor.name}${actor.place ? `, ${actor.place}` : ''}`}
      style={[styles.card, { borderColor: selected ? Brand.primary : theme.border, backgroundColor: selected ? theme.backgroundSelected : theme.background }]}>
      <View style={[styles.ava, { backgroundColor: theme.backgroundElement }]}>
        {actor.emoji ? <ThemedText style={styles.emoji}>{actor.emoji}</ThemedText> : <ThemedText style={styles.init}>{initials(actor.name)}</ThemedText>}
      </View>
      <View style={styles.flex}>
        <View style={styles.row}>
          <ThemedText numberOfLines={1} style={[styles.name, styles.shrink]}>
            {actor.name}
          </ThemedText>
          {actor.verified ? <Ionicons name="checkmark-circle" size={15} color={Brand.primary} /> : null}
        </View>
        {actor.status ? (
          <ThemedText type="small" style={{ color: actor.status.color }}>
            ● {actor.status.label}
          </ThemedText>
        ) : null}
        {actor.place ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            📍 {actor.place}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          <Stars value={actor.note} size={11} />
          <ThemedText type="small" themeColor="textSecondary">
            {actor.note > 0 ? actor.note.toFixed(1) : '—'}
            {actor.activity ? ` · ${actor.activity}` : ''}
          </ThemedText>
        </View>
        <View style={styles.tags}>
          {actor.sources.map((s) => (
            <View key={s} style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.tagText}>{s}</ThemedText>
            </View>
          ))}
        </View>
      </View>
      <View style={[styles.radio, { borderColor: selected ? Brand.primary : theme.border }]}>{selected ? <View style={styles.radioDot} /> : null}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 10 },
  ava: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22, lineHeight: 28 },
  init: { fontWeight: '900', color: Brand.primary },
  flex: { flex: 1, gap: 1 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  tagText: { fontSize: 10.5, lineHeight: 15, fontWeight: '700', color: '#6B6B6B' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Brand.primary },
});
