/**
 * Espace entreprise › Fournisseurs › catalogue de gros d'un fournisseur
 * (fenêtre « Catalogue » du site, GET /fournisseurs/:companyId/catalogue) :
 * chaque produit avec photo, prix de détail, quantité minimum (MOQ), unités
 * par carton et paliers de prix dégressifs. En plus du site : recherche, tri
 * et simulateur « combien je paie pour N unités » (palier appliqué, économie
 * par rapport au prix de détail, MOQ vérifié). Toucher la photo ouvre la fiche produit.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openProduct } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { bestPrice, fetchCatalogue, gnf, normalize, tierRange, type CatalogueItem } from '../api';
import { SupplierLogo } from './suppliers-screen';

type Sort = 'recent' | 'prix' | 'nom';
const SORTS: { key: Sort; label: string }[] = [{ key: 'recent', label: 'Récents' }, { key: 'prix', label: 'Meilleur prix' }, { key: 'nom', label: 'A → Z' }];

export default function SupplierCatalogueScreen() {
  const { id, name, logo } = useLocalSearchParams<{ id: string; name?: string; logo?: string }>();
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const q = useQuery({ queryKey: qk.companySuppliers.catalogue(id), queryFn: () => fetchCatalogue(id), enabled: !!id });

  const term = normalize(search.trim());
  const items = (q.data ?? []).filter((p) => !term || normalize(p.nom).includes(term));
  if (sort === 'prix') items.sort((a, b) => bestPrice(a) - bestPrice(b));
  if (sort === 'nom') items.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <View style={[styles.top, { borderBottomColor: theme.border }]}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/entreprise/fournisseurs'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <SupplierLogo uri={logo || null} size={38} />
        <View style={styles.flex}>
          <ThemedText style={styles.topTitle} numberOfLines={1}>{name || 'Fournisseur'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Catalogue de vente en gros</ThemedText>
        </View>
      </View>

      {q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={q.isPending ? [] : items}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="search" size={17} color={theme.textSecondary} />
                <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un produit" placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher un produit" />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {SORTS.map((s) => (
                  <Pressable key={s.key} onPress={() => setSort(s.key)} accessibilityRole="tab" accessibilityState={{ selected: sort === s.key }}
                    style={[styles.chip, { borderColor: sort === s.key ? Brand.primary : theme.border, backgroundColor: sort === s.key ? Brand.primary : theme.background }]}>
                    <ThemedText type="smallBold" style={sort === s.key ? styles.white : undefined}>{s.label}</ThemedText>
                  </Pressable>
                ))}
              </ScrollView>
              {q.data ? <ThemedText type="small" themeColor="textSecondary">{items.length} produit{items.length > 1 ? 's' : ''} en gros</ThemedText> : null}
              {q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
            </View>
          }
          ListEmptyComponent={q.isPending ? null : (
            <View style={styles.empty}>
              <ThemedText style={styles.emptyEmoji}>📦</ThemedText>
              <ThemedText style={styles.emptyTitle}>{term ? 'Aucun résultat' : 'Catalogue vide'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {term ? `Aucun produit ne correspond à « ${search.trim()} ».` : 'Ce fournisseur n’a pas encore de produit public en vente en gros.'}
              </ThemedText>
            </View>
          )}
          renderItem={({ item }) => <CatalogueCard p={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function CatalogueCard({ p }: { p: CatalogueItem }) {
  const theme = useTheme();
  const [qty, setQty] = useState('');
  const n = Number(qty) || 0;
  const tiers = [...p.wholesaleTiers].sort((a, b) => a.quantiteMin - b.quantiteMin);
  /* Palier appliqué : le plus élevé dont le minimum est atteint. */
  const tier = n ? [...tiers].reverse().find((t) => n >= t.quantiteMin) : undefined;
  const unit = tier?.prixUnitaire ?? p.prix;
  const belowMoq = !!p.moq && n > 0 && n < p.moq;
  const img = p.image?.startsWith('http') ? thumb(p.image, 300) : undefined;

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardHead}>
        <Pressable onPress={() => openProduct(p.id)} accessibilityRole="button" accessibilityLabel={`Voir la fiche ${p.nom}`} style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
          {img ? <Image source={{ uri: img }} style={styles.fill} contentFit="cover" /> : <Ionicons name="image-outline" size={24} color={theme.textSecondary} />}
        </Pressable>
        <View style={styles.flex}>
          <ThemedText numberOfLines={2} style={styles.name}>{p.nom}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Prix de détail : {gnf(p.prix)}</ThemedText>
          <View style={styles.tags}>
            {p.moq ? <Tag icon="layers-outline" text={`Min. ${p.moq} unités`} /> : null}
            {p.conditionnement ? <Tag icon="cube-outline" text={`${p.conditionnement} / carton`} /> : null}
          </View>
        </View>
      </View>

      {tiers.length ? (
        <View style={[styles.tiers, { borderColor: theme.border }]}>
          {tiers.map((t, i) => {
            const on = tier === t;
            const save = p.prix > t.prixUnitaire ? Math.round((1 - t.prixUnitaire / p.prix) * 100) : 0;
            return (
              <View key={i} style={[styles.tier, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, on && { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" style={styles.flex}>{tierRange(t)} unités</ThemedText>
                {save ? <ThemedText type="small" style={styles.save}>-{save} %</ThemedText> : null}
                <ThemedText type="smallBold">{gnf(t.prixUnitaire)}</ThemedText>
              </View>
            );
          })}
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">Pas de palier : prix de détail appliqué.</ThemedText>
      )}

      <View style={styles.calc}>
        <View style={[styles.qty, { backgroundColor: theme.backgroundElement }]}>
          <TextInput value={qty} onChangeText={(v) => setQty(v.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad"
            placeholder={p.moq ? `Quantité (min. ${p.moq})` : 'Quantité'} placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]} accessibilityLabel="Quantité à simuler" />
        </View>
        <View style={styles.calcRes}>
          {n ? (
            <>
              <ThemedText style={styles.total}>{gnf(unit * n)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{gnf(unit)} / unité{p.prix > unit ? ` · économie ${gnf((p.prix - unit) * n)}` : ''}</ThemedText>
            </>
          ) : <ThemedText type="small" themeColor="textSecondary">Simulez le coût d’une commande</ThemedText>}
        </View>
      </View>
      {belowMoq ? <ThemedText type="small" style={styles.warn}>Sous la quantité minimum ({p.moq}) : le fournisseur n’acceptera pas cette commande en gros.</ThemedText> : null}
    </View>
  );
}

function Tag({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={12} color={theme.text} />
      <ThemedText style={styles.tagText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  white: { color: '#fff' },
  center: { textAlign: 'center' },
  loader: { marginTop: 20 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  header: { gap: 10 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8 },
  chip: { borderWidth: 1.2, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyEmoji: { fontSize: 40, lineHeight: 48 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 18, padding: 12, gap: 10 },
  cardHead: { flexDirection: 'row', gap: 12 },
  img: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  tiers: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  save: { color: Brand.success, fontWeight: '800' },
  calc: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qty: { width: 150, borderRadius: 12, paddingHorizontal: 12, minHeight: 42, justifyContent: 'center' },
  calcRes: { flex: 1, alignItems: 'flex-end' },
  total: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  warn: { color: '#B45309', fontWeight: '600' },
});
