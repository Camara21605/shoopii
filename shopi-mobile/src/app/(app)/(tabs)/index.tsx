/**
 * Accueil du client — comme l'accueil du site (www.shoneya.com) :
 *   recherche · types d'entreprise · catégories · produits (grille) ·
 *   vente en gros (rangée) · boutiques (rangée).
 * Recherche, type et catégorie filtrent réellement les produits
 * (GET /public/produits?search=&companyTypeId=&categoryId=).
 * Tirer vers le bas recharge tout. Fiche produit / boutique : ouverte sur
 * le site dans le navigateur intégré, en attendant les écrans natifs.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChip, ProductCard, SectionHeader, SectionState, ShopCard, TypeItem } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import {
  fetchCategories,
  fetchCompanyTypes,
  fetchProducts,
  fetchShops,
  type Product,
} from '@/features/catalog/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const SITE = 'https://www.shoneya.com';
const GAP = 12;
const PAD = Spacing.three;

const openProduct = (p: Product) => void WebBrowser.openBrowserAsync(`${SITE}/produit/${p.id}`);
const openShop = (id: string) => void WebBrowser.openBrowserAsync(`${SITE}/boutique/${id}`);

export default function HomeScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const firstName = useSession((s) => s.user?.firstName);
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - PAD * 2 - GAP) / 2);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [typeId, setTypeId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /* Recherche lancée 400 ms après la dernière frappe (pas une requête par lettre) */
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  const filtering = !!(search || typeId || categoryId);

  const types = useQuery({ queryKey: ['company-types'], queryFn: fetchCompanyTypes, staleTime: 600_000 });
  const categories = useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 600_000 });
  const products = useQuery({ queryKey: ['products', 'detail'], queryFn: () => fetchProducts({ type: 'detail', limit: 20 }) });
  const wholesale = useQuery({ queryKey: ['products', 'gros'], queryFn: () => fetchProducts({ type: 'gros', limit: 10 }) });
  const shops = useQuery({ queryKey: ['shops'], queryFn: () => fetchShops(10) });
  const results = useQuery({
    queryKey: ['products', 'search', search, typeId, categoryId],
    queryFn: () =>
      fetchProducts({ search, companyTypeId: typeId ?? undefined, categoryId: categoryId ?? undefined, limit: 30 }),
    enabled: filtering,
  });

  /* Catégories du type choisi (toutes si aucun type) */
  const visibleCategories = useMemo(
    () => (categories.data ?? []).filter((c) => !typeId || c.companyTypeId === typeId),
    [categories.data, typeId],
  );

  async function refresh() {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  }

  const clearFilters = () => {
    setQuery('');
    setSearch('');
    setTypeId(null);
    setCategoryId(null);
  };

  const grid = (list: Product[]) => (
    <View style={styles.grid}>
      {list.map((p) => (
        <ProductCard key={p.id} product={p} width={cardWidth} onPress={() => openProduct(p)} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {/* En-tête : logo + salutation, puis recherche */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/icon.png')} style={styles.logo} accessibilityLabel="Shoneya" />
          <View style={styles.flex}>
            <ThemedText style={styles.brand}>
              Sho<ThemedText style={[styles.brand, { color: Brand.primary }]}>neya</ThemedText>
            </ThemedText>
            {firstName ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                Bonjour {firstName} 👋
              </ThemedText>
            ) : null}
          </View>
        </View>
        <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un produit…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            onSubmitEditing={() => setSearch(query.trim())}
            autoCorrect={false}
            accessibilityLabel="Rechercher un produit"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[Brand.primary]} />}>
        {/* Types d'entreprise */}
        {(types.data?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Types d’entreprise" />
            <FlatList
              horizontal
              data={types.data}
              keyExtractor={(t) => t.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hList}
              renderItem={({ item }) => (
                <TypeItem
                  type={item}
                  selected={item.id === typeId}
                  onPress={() => {
                    setTypeId((cur) => (cur === item.id ? null : item.id));
                    setCategoryId(null);
                  }}
                />
              )}
            />
          </View>
        )}

        {/* Catégories */}
        {visibleCategories.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Catégories" />
            <FlatList
              horizontal
              data={visibleCategories}
              keyExtractor={(c) => c.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipList}
              renderItem={({ item }) => (
                <CategoryChip
                  category={item}
                  selected={item.id === categoryId}
                  onPress={() => setCategoryId((cur) => (cur === item.id ? null : item.id))}
                />
              )}
            />
          </View>
        )}

        {filtering ? (
          /* Résultats de la recherche / des filtres */
          <View style={styles.section}>
            <SectionHeader title="Résultats" action="Tout effacer" onAction={clearFilters} />
            {results.isPending ? (
              <SectionState>
                <ActivityIndicator color={Brand.primary} />
              </SectionState>
            ) : results.error ? (
              <ErrorState error={results.error} onRetry={() => void results.refetch()} />
            ) : results.data?.length ? (
              grid(results.data)
            ) : (
              <SectionState>
                <Ionicons name="search-outline" size={32} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.center}>
                  Aucun produit ne correspond. Essayez un autre mot ou retirez un filtre.
                </ThemedText>
              </SectionState>
            )}
          </View>
        ) : (
          <>
            {/* Produits (détail) */}
            <View style={styles.section}>
              <SectionHeader title="Produits" />
              {products.isPending ? (
                <SectionState>
                  <ActivityIndicator color={Brand.primary} />
                </SectionState>
              ) : products.error ? (
                <ErrorState error={products.error} onRetry={() => void products.refetch()} />
              ) : products.data?.length ? (
                grid(products.data)
              ) : (
                <SectionState>
                  <ThemedText themeColor="textSecondary">Aucun produit pour le moment.</ThemedText>
                </SectionState>
              )}
            </View>

            {/* Vente en gros */}
            {(wholesale.data?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Vente en gros" />
                <FlatList
                  horizontal
                  data={wholesale.data}
                  keyExtractor={(p) => p.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hListCards}
                  renderItem={({ item }) => <ProductCard product={item} width={150} onPress={() => openProduct(item)} />}
                />
              </View>
            )}

            {/* Boutiques */}
            {(shops.data?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <SectionHeader title="Boutiques" />
                <FlatList
                  horizontal
                  data={shops.data}
                  keyExtractor={(s) => s.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hListCards}
                  renderItem={({ item }) => <ShopCard shop={item} onPress={() => openShop(item.id)} />}
                />
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <SectionState>
      <ThemedText themeColor="textSecondary" style={styles.center}>
        {toUserMessage(error)}
      </ThemedText>
      <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={8}>
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          Réessayer
        </ThemedText>
      </Pressable>
    </SectionState>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: PAD, paddingTop: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.three },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 38, height: 38, borderRadius: 10 },
  brand: { fontSize: 22, lineHeight: 26, fontWeight: '800' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  content: { paddingBottom: Spacing.five },
  section: { marginTop: Spacing.three },
  hList: { paddingHorizontal: PAD, gap: Spacing.two },
  chipList: { paddingHorizontal: PAD, gap: Spacing.two },
  hListCards: { paddingHorizontal: PAD, gap: GAP },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, paddingHorizontal: PAD },
  center: { textAlign: 'center' },
});
