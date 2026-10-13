/**
 * Carte « Vous cherchez peut-être » — comme CategoriesSuggestCard du site :
 * les catégories n'ont plus leur propre rangée sur l'accueil, elles sont
 * MÉLANGÉES à la grille produits (même gabarit qu'une carte produit, fond pêche).
 * Une ligne par catégorie : vignette ronde (image de la catégorie, sinon celle
 * d'un produit de cette catégorie, sinon son icône) + nom. Toucher une
 * catégorie ouvre l'Explorer filtré sur elle.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { Category, Product } from '@/features/catalog/api';
import { firstImage, thumb } from '@/features/catalog/format';

export interface SuggestedCategory {
  category: Category;
  /** Image d'un produit de la catégorie (repli si la catégorie n'a pas d'image). */
  productImage?: string;
}

/* Même règles que le site (RandomBloc) : 1re carte après 4 produits, puis tous les 10, 4 catégories par carte. */
export const CATEGORIES_CARTE_DEBUT = 4;
export const CATEGORIES_CARTE_PAS = 10;
export const CATEGORIES_PAR_CARTE = 4;

/** Catégories ayant des produits d'abord (leur image sert de vignette), puis les autres. */
export function suggestCategories(categories: Category[], products: Product[]): SuggestedCategory[] {
  const image = new Map<string, string>();
  for (const p of products) {
    const url = firstImage(p.images);
    if (p.category?.id && url && !image.has(p.category.id)) image.set(p.category.id, url);
  }
  const avec = categories.filter((c) => image.has(c.id));
  const autres = categories.filter((c) => !image.has(c.id));
  return [...avec, ...autres].map((category) => ({ category, productImage: image.get(category.id) }));
}

/** Les catégories de la k-ième carte (chaque carte reprend la suite de la précédente). */
export function cardItems(all: SuggestedCategory[], k: number): SuggestedCategory[] {
  const n = all.length;
  if (!n) return [];
  const debut = (k * CATEGORIES_PAR_CARTE) % n;
  return Array.from({ length: Math.min(CATEGORIES_PAR_CARTE, n) }, (_, j) => all[(debut + j) % n]);
}

const explore = (category: string) => router.push({ pathname: '/explorer', params: { category } });

export function CategorySuggestCard({ items, width }: { items: SuggestedCategory[]; width: number }) {
  if (!items.length) return null;
  return (
    <LinearGradient colors={['#FFE9D2', '#FFF4E8', '#FFF8F0']} locations={[0, 0.45, 1]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[styles.card, { width }]}>
      <ThemedText style={styles.title} accessibilityRole="header">
        Vous cherchez peut-être
      </ThemedText>
      <View style={styles.list}>
        {items.map(({ category: c, productImage }) => {
          const img = thumb(c.imageUrl ?? productImage, 96);
          return (
            <Pressable
              key={c.id}
              onPress={() => explore(c.id)}
              style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Voir la catégorie ${c.nom}`}>
              <View style={styles.thumb}>
                {img ? (
                  <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
                ) : (
                  <ThemedText style={styles.emoji}>{c.icone || '📁'}</ThemedText>
                )}
              </View>
              <ThemedText numberOfLines={2} style={styles.name}>
                {c.nom}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(249,115,22,0.14)', paddingTop: 12, paddingHorizontal: 8, paddingBottom: 10, gap: 8 },
  title: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: '#1F2937', paddingHorizontal: 4 },
  list: { gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 8,
    minHeight: 48,
    shadowColor: '#0B1F3A',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pressed: { opacity: 0.7 },
  thumb: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden', backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 17, lineHeight: 22 },
  name: { flex: 1, fontSize: 12.5, lineHeight: 16, color: '#1F2937', fontWeight: '600' },
});
