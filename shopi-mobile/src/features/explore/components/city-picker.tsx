/**
 * Choix « Ville › Commune » (Explorer) :
 *   1. les villes de Guinée (référentiel : préfectures), ma ville en premier,
 *      recherche à la frappe ;
 *   2. pour une ville qui a des communes (Conakry : ses 13 communes), « Toute la
 *      ville » ou une commune précise.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchVilles } from '@/features/auth/api';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchVilleCommunes } from '../api';
import { prettyPlace, type ChosenCity } from '../city';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function CityPicker({ current, homeCity, onSelect, onClose }: {
  current: ChosenCity;
  /** Ville de l'adresse par défaut (proposée en premier). */
  homeCity: string | null;
  onSelect: (c: ChosenCity) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [ville, setVille] = useState<string | null>(current?.ville ?? null);
  const [q, setQ] = useState('');

  const villes = useQuery({ queryKey: qk.villes('+224'), queryFn: () => fetchVilles('+224'), staleTime: 60 * 60_000 });
  const communes = useQuery({
    queryKey: qk.villeCommunes(ville ? fold(ville) : ''),
    queryFn: () => fetchVilleCommunes(ville!),
    enabled: !!ville,
    staleTime: 60 * 60_000,
  });

  /* Liste des villes : ma ville d'abord, Conakry ensuite, puis l'ordre alphabétique. */
  const names = [...new Map(
    [...(homeCity ? [homeCity] : []), 'Conakry', ...(villes.data ?? []).map((v) => v.nom)].map((n) => [fold(n), prettyPlace(n)]),
  ).values()];
  const shown = q.trim() ? names.filter((n) => fold(n).includes(fold(q))) : names;

  /* Étape 2 : communes de la ville choisie. */
  if (ville) {
    const list = communes.data ?? [];
    return (
      <BottomSheet
        title={prettyPlace(ville)}
        onClose={onClose}
        height={0.75}
        left={(
          <Pressable onPress={() => setVille(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Autre ville" style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
        )}>
        <ScrollView contentContainerStyle={styles.body}>
          <Row
            icon="business-outline"
            label={`Toute la ville de ${prettyPlace(ville)}`}
            active={!!current && fold(current.ville) === fold(ville) && !current.commune}
            onPress={() => onSelect({ ville: prettyPlace(ville) })}
          />
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.groupTitle}>
            {list.length ? `OU UNE COMMUNE · ${list.length}` : 'COMMUNES'}
          </ThemedText>
          {communes.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          {!communes.isPending && !list.length ? (
            <ThemedText type="small" themeColor="textSecondary">Pas encore de communes enregistrées pour cette ville.</ThemedText>
          ) : null}
          <View style={styles.grid}>
            {list.map((c) => {
              const name = prettyPlace(c.nom);
              const on = !!current?.commune && fold(current.commune) === fold(c.nom) && fold(current.ville) === fold(ville);
              return (
                <Pressable key={`${c.id ?? ''}${c.nom}`} onPress={() => onSelect({ ville: prettyPlace(ville), commune: name })} accessibilityRole="button"
                  style={[styles.commune, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                  <Ionicons name="location" size={15} color={on ? Brand.primary : theme.textSecondary} />
                  <ThemedText numberOfLines={1} style={[styles.communeText, on && { color: Brand.primary }]}>{name}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Choisir une ville" onClose={onClose} height={0.75}>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput value={q} onChangeText={setQ} placeholder="Rechercher une ville (Kindia, Labé…)" placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]} autoCorrect={false} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Row icon="earth-outline" label="Toute la Guinée" active={!current} onPress={() => onSelect(null)} />
        {villes.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
        {shown.map((n) => (
          <Row
            key={n}
            icon={homeCity && fold(n) === fold(homeCity) ? 'home-outline' : 'location-outline'}
            label={n}
            sub={homeCity && fold(n) === fold(homeCity) ? 'Ma ville' : fold(n) === 'conakry' ? '13 communes' : undefined}
            active={!!current && fold(current.ville) === fold(n)}
            chevron
            onPress={() => setVille(n)}
          />
        ))}
        {!villes.isPending && q.trim() && !shown.length ? (
          <Row icon="add-circle-outline" label={`Utiliser « ${q.trim()} »`} active={false} onPress={() => onSelect({ ville: q.trim() })} />
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function Row({ icon, label, sub, active, chevron, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; label: string; sub?: string; active: boolean; chevron?: boolean; onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={20} color={active ? Brand.primary : theme.textSecondary} />
      <View style={styles.flex}>
        <ThemedText style={[styles.rowText, active && { color: Brand.primary }]}>{label}</ThemedText>
        {sub ? <ThemedText type="small" themeColor="textSecondary">{sub}</ThemedText> : null}
      </View>
      {active ? <Ionicons name="checkmark-circle" size={20} color={Brand.primary} /> : chevron ? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { paddingRight: 6 },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  loader: { marginVertical: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 6, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  rowText: { fontSize: 15.5, fontWeight: '600' },
  groupTitle: { marginTop: 16, marginBottom: 8, letterSpacing: 0.8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  commune: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, width: '48%' },
  communeText: { flex: 1, fontSize: 14.5, fontWeight: '600' },
});
