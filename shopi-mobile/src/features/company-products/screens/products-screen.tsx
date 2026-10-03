/**
 * Espace entreprise › Mes Produits — équivalent mobile de /dashboard/entreprise/produits :
 *   · « Nouveau produit » (products.create) ;
 *   · bandeau stories : « Créer une story » + mes stories actives par produit ;
 *   · chiffres : total, publiés, brouillons, ruptures (sur TOUT le catalogue) ;
 *   · recherche (nom, marque, référence) et filtres de visibilité avec compteurs ;
 *   · grille 2 colonnes : voir, modification rapide, modifier, supprimer selon les droits.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openSite } from '@/features/catalog/open';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchAllProducts, normalize, type Product, type Visibility } from '../api';
import { ProductCard } from '../components/product-card';
import { DeleteSheet, QuickEditSheet } from '../components/sheets';
import { CreateStorySheet, StoriesTray, StoryViewer, useMyStoryGroups, type StoryGroup } from '../components/stories';

type Filter = Visibility | 'tous';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'public', label: 'Publiés' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'private', label: 'Privés' },
];

export const openFullEdit = (id: string) => openSite(`/dashboard/entreprise/ajouter/${id}`);
const ask = (title: string, message: string, ok: string) => confirmAction(title, message, ok, true);

export default function CompanyProductsScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const perms = usePermissions();
  const canView = perms.can('products', 'view');
  const canCreate = perms.can('products', 'create');
  const canEdit = perms.can('products', 'edit');
  const canDelete = perms.can('products', 'delete');
  const [filter, setFilter] = useState<Filter>('tous');
  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<StoryGroup | null>(null);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.products, queryFn: fetchAllProducts, enabled: canView });
  const stories = useMyStoryGroups();
  const products = q.data ?? [];

  const count = (f: Filter) => (f === 'tous' ? products.length : products.filter((p) => p.visibilite === f).length);
  const term = normalize(search.trim());
  const list = products
    .filter((p) => filter === 'tous' || p.visibilite === filter)
    .filter((p) => !term || normalize(`${p.nom} ${p.marque ?? ''} ${p.reference ?? ''}`).includes(term));
  const cardW = Math.floor((Math.min(width, 800) - 16 * 2 - 12) / 2);

  const STATS = [
    { label: 'Total', value: products.length, icon: 'cube-outline' as const, color: Brand.primaryInk, bg: Brand.primarySoft, onPress: () => setFilter('tous') },
    { label: 'Publiés', value: count('public'), icon: 'globe-outline' as const, color: '#047857', bg: '#ECFDF5', onPress: () => setFilter('public') },
    { label: 'Brouillons', value: count('draft'), icon: 'document-text-outline' as const, color: '#B45309', bg: '#FFF7E6', onPress: () => setFilter('draft') },
    { label: 'Rupture', value: products.filter((p) => p.stock === 0).length, icon: 'warning-outline' as const, color: '#B91C1C', bg: '#FEF2F2', onPress: () => setFilter('tous') },
  ];

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les produits. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.cols}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.title}>Mes Produits</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Gérez votre catalogue et votre inventaire
                </ThemedText>
              </View>
              {canCreate ? (
                <Pressable onPress={() => router.push('/entreprise/ajouter')} accessibilityRole="button" style={styles.newBtn}>
                  <Ionicons name="add" size={18} color={Brand.primaryInk} />
                  <ThemedText style={styles.newText}>Nouveau</ThemedText>
                </Pressable>
              ) : null}
            </View>

            <StoriesTray groups={stories.groups} canCreate={canEdit} onCreate={() => setCreating(true)} onOpen={setViewing} />

            <View style={styles.stats}>
              {STATS.map((s) => (
                <Pressable key={s.label} onPress={s.onPress} accessibilityRole="button" accessibilityLabel={`${s.label} : ${s.value}`} style={[styles.stat, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                  <ThemedText style={[styles.statV, { color: s.color }]}>{s.value}</ThemedText>
                  <ThemedText style={[styles.statL, { color: s.color }]} numberOfLines={1}>
                    {s.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={17} color={theme.textSecondary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher par nom, marque, référence…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher un produit" returnKeyType="search" />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
                  <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText style={[styles.chipText, on && { color: Brand.primaryInk }]}>{f.label}</ThemedText>
                    <View style={[styles.chipCount, { backgroundColor: on ? '#fff' : theme.backgroundElement }]}>
                      <ThemedText style={[styles.chipCountText, on && { color: Brand.primaryInk }]}>{count(f.key)}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {q.isPending ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={Brand.primary} />
                <ThemedText type="small" themeColor="textSecondary">
                  Chargement des produits…
                </ThemedText>
              </View>
            ) : list.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                {list.length} produit{list.length > 1 ? 's' : ''}
                {term ? ` pour « ${search.trim()} »` : ''}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? null : (
            <View style={styles.empty}>
              <View style={[styles.emptyIco, { backgroundColor: Brand.primarySoft }]}>
                <Ionicons name="cube-outline" size={28} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{products.length ? 'Aucun résultat' : 'Aucun produit encore'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {products.length ? 'Essayez de modifier vos filtres.' : 'Commencez par ajouter votre premier produit.'}
              </ThemedText>
              {!products.length && canCreate ? (
                <Pressable onPress={() => router.push('/entreprise/ajouter')} accessibilityRole="button" style={[styles.newBtn, styles.emptyBtn]}>
                  <Ionicons name="add" size={18} color={Brand.primaryInk} />
                  <ThemedText style={styles.newText}>Ajouter un produit</ThemedText>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item }) => (
          <ProductCard
            p={item}
            width={cardW}
            canEdit={canEdit}
            canDelete={canDelete}
            onOpen={() => router.push({ pathname: '/entreprise/produits/[id]', params: { id: item.id } })}
            onQuickEdit={() => setQuick(item)}
            onFullEdit={() => openFullEdit(item.id)}
            onDelete={() => setToDelete(item)}
          />
        )}
      />
    );

  const done = (setter: (v: null) => void) => (m: string) => {
    setter(null);
    snack.show(m);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Produits" subtitle={`${products.length} produit${products.length > 1 ? 's' : ''}`} />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="produits" />
      <Snack msg={snack.msg} bottom={96} />
      {quick ? <QuickEditSheet product={quick} onClose={() => setQuick(null)} onDone={done(setQuick)} /> : null}
      {toDelete ? <DeleteSheet product={toDelete} onClose={() => setToDelete(null)} onDone={done(setToDelete)} /> : null}
      {creating ? (
        <CreateStorySheet products={products} activeProductIds={new Set(stories.groups.map((g) => g.productId))} onClose={() => setCreating(false)} onMessage={snack.show} onConfirm={ask} />
      ) : null}
      {viewing ? <StoryViewer group={viewing} canEdit={canEdit} onClose={() => setViewing(null)} onMessage={snack.show} onConfirm={ask} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  cols: { gap: 12 },
  header: { gap: 14, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  newText: { color: Brand.primaryInk, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, gap: 2 },
  statV: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  statL: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16, width: '100%' },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  emptyBtn: { marginTop: 8 },
});
