/**
 * Onglet Produits du profil entreprise : recherche, catégories réelles,
 * tri, filtres (en stock, promotion, nouveautés), grille paginée « Afficher plus ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { discountPercent } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import type { ShopProduct } from '../api';
import { Empty, Chip, isNew } from './shared';
import { ShopProductCard } from './shop-product-card';

/* ── Produits ───────────────────────────────────────────────────────── */

const SORTS = ['Pertinence', 'Prix croissant', 'Prix décroissant', 'Nouveautés'] as const;
type Sort = (typeof SORTS)[number];
const PAGE = 24;

export function ProductsTab({
  products,
  loading,
  width,
  favIds,
  cartIds,
  pendingCart,
  onToggleFav,
  onAddToCart,
}: {
  products: ShopProduct[];
  loading: boolean;
  width: number;
  favIds: Set<string>;
  cartIds: Set<string>;
  pendingCart?: string;
  /** Absents = ma propre boutique (pas de favoris ni de panier). */
  onToggleFav?: (id: string) => void;
  onAddToCart?: (id: string) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);
  const [promo, setPromo] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [sort, setSort] = useState<Sort>('Pertinence');
  const [sortOpen, setSortOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  /* Catégories RÉELLES de la boutique, les plus fournies d'abord. */
  const cats = useMemo(() => {
    const m = new Map<string, { icon: string; n: number }>();
    for (const p of products) {
      const nom = p.category?.nom;
      if (!nom) continue;
      const e = m.get(nom) ?? { icon: p.category?.icone || '📦', n: 0 };
      e.n++;
      m.set(nom, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [products]);

  const list = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr');
    const out = products.filter(
      (p) =>
        (!cat || p.category?.nom === cat) &&
        (!inStock || p.stock > 0) &&
        (!promo || !!discountPercent(p.prix, p.prixAncien)) &&
        (!fresh || isNew(p)) &&
        (!q || `${p.nom} ${p.marque ?? ''} ${p.category?.nom ?? ''}`.toLocaleLowerCase('fr').includes(q)),
    );
    if (sort === 'Prix croissant') out.sort((a, b) => a.prix - b.prix);
    if (sort === 'Prix décroissant') out.sort((a, b) => b.prix - a.prix);
    if (sort === 'Nouveautés') out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  }, [products, cat, inStock, promo, fresh, search, sort]);

  const filtered = !!(cat || inStock || promo || fresh || search.trim());
  const reset = () => {
    setCat(null);
    setInStock(false);
    setPromo(false);
    setFresh(false);
    setSearch('');
  };

  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (products.length === 0) return <Empty icon="cube-outline" title="Aucun produit pour le moment" text="Cette boutique n’a encore publié aucun produit." />;

  const cardW = (width - 16 * 2 - 12) / 2;
  return (
    <View style={s.gap12}>
      <View style={[s.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setShown(PAGE);
          }}
          placeholder={`Rechercher parmi ${products.length} produit${products.length > 1 ? 's' : ''}`}
          placeholderTextColor={theme.textSecondary}
          style={[s.searchInput, { color: theme.text }]}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {cats.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label={`Tout · ${products.length}`} active={!cat} onPress={() => setCat(null)} />
          {cats.map(([nom, v]) => (
            <Chip key={nom} label={`${v.icon} ${nom} · ${v.n}`} active={cat === nom} onPress={() => setCat(cat === nom ? null : nom)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip icon="swap-vertical" label={sort} active={sort !== 'Pertinence'} onPress={() => setSortOpen(true)} />
        <Chip icon="checkmark-circle-outline" label="En stock" active={inStock} onPress={() => setInStock(!inStock)} />
        <Chip icon="pricetag-outline" label="En promotion" active={promo} onPress={() => setPromo(!promo)} />
        <Chip icon="sparkles-outline" label="Nouveautés" active={fresh} onPress={() => setFresh(!fresh)} />
      </ScrollView>

      <View style={s.between}>
        <ThemedText type="small" themeColor="textSecondary">
          {list.length} produit{list.length > 1 ? 's' : ''}
        </ThemedText>
        {filtered ? (
          <Pressable onPress={reset} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réinitialiser
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {list.length === 0 ? (
        <Empty icon="funnel-outline" title="Aucun produit ne correspond" text="Essayez d’autres filtres." />
      ) : (
        <View style={s.grid}>
          {list.slice(0, shown).map((p) => (
            <ShopProductCard
              key={p.id}
              p={p}
              width={cardW}
              fav={favIds.has(p.id)}
              inCart={cartIds.has(p.id)}
              adding={pendingCart === p.id}
              onFav={onToggleFav ? () => onToggleFav(p.id) : undefined}
              onAdd={onAddToCart ? () => onAddToCart(p.id) : undefined}
            />
          ))}
        </View>
      )}
      {list.length > shown ? (
        <Pressable onPress={() => setShown(shown + PAGE)} style={[s.more, { borderColor: theme.border }]} accessibilityRole="button">
          <ThemedText type="smallBold">Afficher plus ({list.length - shown} restants)</ThemedText>
        </Pressable>
      ) : null}

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setSortOpen(false)}>
          <View style={[s.sheet, { backgroundColor: theme.background }]}>
            <ThemedText style={s.sheetTitle}>Trier par</ThemedText>
            {SORTS.map((o) => (
              <Pressable
                key={o}
                onPress={() => {
                  setSort(o);
                  setSortOpen(false);
                }}
                style={[s.sheetRow, { borderTopColor: theme.border }]}
                accessibilityRole="button">
                <ThemedText style={{ flex: 1 }}>{o}</ThemedText>
                {sort === o ? <Ionicons name="checkmark" size={20} color={Brand.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  loader: { marginVertical: 40 },
  gap12: { gap: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  more: { borderWidth: 1, borderRadius: 999, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  sheetTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth },
});
