/**
 * Comparaison vide — comme sur le site : le mode d'emploi en 3 étapes, un bouton
 * « Explorer les produits », puis « Par où commencer ? » : les catégories
 * (8 visibles, « Voir plus » pour le reste). Toucher une catégorie déplie ses
 * sous-catégories ; chaque puce ouvre l'Explorer filtré, où le bouton ⚖️
 * « Comparer » des fiches permet ensuite de remplir la comparaison.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchCategories } from '@/features/catalog/api';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

const APERCU = 8;
const STEPS = [
  'Ouvrez la fiche d’un produit qui vous intéresse.',
  'Touchez ⚖️ « Comparer ».',
  'Ajoutez ici d’autres produits de la même catégorie : Shoneya vous dit lequel choisir.',
];

const explore = (category: string, subCategory?: string) =>
  router.push({ pathname: '/explorer', params: subCategory ? { category, subCategory } : { category } });

export function EmptyStart() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const cats = useQuery({ queryKey: qk.categories, queryFn: fetchCategories, staleTime: 600_000 });
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const list = cats.data ?? [];
  const visible = all ? list : list.slice(0, APERCU);
  const active = list.find((c) => c.id === open) ?? null;
  const tileW = Math.floor((width - 32 - 10 * 3) / 4);

  return (
    <View>
      <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.icon, { backgroundColor: theme.background }]}>
          <Ionicons name="git-compare-outline" size={30} color={Brand.primary} />
        </View>
        <ThemedText style={styles.title}>Aucun produit à comparer</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Ajoutez des produits de la même catégorie avec le bouton ⚖️ « Comparer » pour les voir côte à côte (jusqu’à 4).
        </ThemedText>
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s} style={styles.step}>
              <View style={[styles.num, { backgroundColor: Brand.primary }]}>
                <ThemedText style={styles.numText}>{i + 1}</ThemedText>
              </View>
              <ThemedText style={styles.flex}>{s}</ThemedText>
            </View>
          ))}
        </View>
        <Pressable onPress={() => router.push('/explorer')} style={[styles.btn, { backgroundColor: Brand.primary }]} accessibilityRole="button">
          <Ionicons name="search" size={17} color="#fff" />
          <ThemedText style={styles.btnText}>Explorer les produits</ThemedText>
        </Pressable>
      </View>

      {list.length ? (
        <View style={styles.cats}>
          <ThemedText style={styles.h2}>Par où commencer ?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Choisissez une catégorie pour trouver des produits à comparer.
          </ThemedText>
          <View style={styles.grid}>
            {visible.map((c) => {
              const on = c.id === open;
              const img = thumb(c.imageUrl, 160);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => (c.subCategories.length ? setOpen(on ? null : c.id) : explore(c.id))}
                  style={[styles.tile, { width: tileW, backgroundColor: on ? theme.backgroundSelected : 'transparent', borderColor: on ? Brand.primary : 'transparent' }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: on }}
                  accessibilityLabel={c.nom}>
                  <View style={[styles.tileIcon, { backgroundColor: theme.backgroundElement }]}>
                    {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ThemedText style={styles.emoji}>{c.icone || '📁'}</ThemedText>}
                  </View>
                  <ThemedText numberOfLines={2} style={styles.tileText}>
                    {c.nom}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {list.length > APERCU ? (
            <Pressable onPress={() => setAll((v) => !v)} style={styles.moreBtn} accessibilityRole="button">
              <ThemedText style={styles.more}>{all ? 'Voir moins' : `Voir ${list.length - APERCU} autre${list.length - APERCU > 1 ? 's' : ''} catégorie${list.length - APERCU > 1 ? 's' : ''}`}</ThemedText>
              <Ionicons name={all ? 'chevron-up' : 'chevron-down'} size={16} color={Brand.primary} />
            </Pressable>
          ) : null}

          {active ? (
            <View style={[styles.subPanel, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.bold}>
                Sous-catégories · {active.nom}
              </ThemedText>
              <View style={styles.chips}>
                <Pressable onPress={() => explore(active.id)} style={[styles.chip, { backgroundColor: Brand.primary }]} accessibilityRole="button">
                  <ThemedText style={[styles.chipText, { color: '#fff' }]}>Tout voir</ThemedText>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </Pressable>
                {active.subCategories.map((s) => (
                  <Pressable key={s.id} onPress={() => explore(active.id, s.id)} style={[styles.chip, { backgroundColor: theme.background }]} accessibilityRole="button">
                    <ThemedText style={styles.chipText}>{s.nom}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  center: { textAlign: 'center' },
  box: { marginHorizontal: 16, borderRadius: 20, padding: 18, gap: 10, alignItems: 'center' },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  steps: { alignSelf: 'stretch', gap: 10, marginTop: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  num: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'stretch', borderRadius: 999, minHeight: 48, marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '800' },
  cats: { paddingHorizontal: 16, paddingTop: 28, gap: 6 },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  tile: { alignItems: 'center', gap: 6, borderRadius: 14, borderWidth: 1.5, paddingVertical: 6 },
  tileIcon: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 26, lineHeight: 32 },
  tileText: { fontSize: 12, lineHeight: 15, fontWeight: '700', textAlign: 'center', paddingHorizontal: 2 },
  moreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
  more: { fontWeight: '800' },
  subPanel: { borderRadius: 16, padding: 12, gap: 10, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
});
