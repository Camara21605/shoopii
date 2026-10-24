/**
 * Explorer — même contenu que la page /explorer du site, en version téléphone :
 *   · recherche (délai 300 ms) + bouton « Filtres » (prix) + catégories
 *   · « 📍 Ville › Commune » : toute la Guinée, une ville, ou une commune précise
 *     (Conakry : ses 13 communes) — gardé sur le téléphone ; filtre la grille et
 *     « Proches de vous » (sans choix : ville de l'adresse par défaut)
 *   · sans recherche ni filtre : carrousels Pour vous · Tendances · Nouveautés ·
 *     Proches de vous
 *   · grille « Tous les produits » paginée (chargement au défilement)
 * Ouverture filtrée possible : /explorer?category=…[&subCategory=…] (ex. depuis
 * l'écran Comparer vide, « Par où commencer ? »).
 * Cartes : ❤ favori, « Ajouter » au panier, boutique cliquable (profil natif).
 * Données : voir features/explore/api.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { fetchCategories } from '@/features/catalog/api';
import { formatPrice } from '@/features/catalog/format';
import { openShop } from '@/features/catalog/open';
import { useProductActions } from '@/features/catalog/product-actions';
import {
  fetchDefaultCity,
  fetchExplorePage,
  fetchExploreSection,
  PAGE_SIZE,
  type ExploreFilters,
  type ExploreProduct,
  type ExploreSection,
} from '@/features/explore/api';
import { ShopProductCard } from '@/features/shop/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { cityLabel, useChosenCity, type ChosenCity } from '../city';
import { CityPicker } from '../components';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const PRICE_RANGES: { label: string; min?: number; max?: number }[] = [
  { label: 'Moins de 50 000', max: 50_000 },
  { label: '50 000 – 200 000', min: 50_000, max: 200_000 },
  { label: '200 000 – 1 M', min: 200_000, max: 1_000_000 },
  { label: 'Plus de 1 M', min: 1_000_000 },
];

const SECTIONS: { kind: Exclude<ExploreSection, 'proches'>; kick: string; title: string; icon: IconName; color: string }[] = [
  { kind: 'pour-vous', kick: 'RECOMMANDÉ', title: 'Pour vous', icon: 'sparkles', color: '#7C3AED' },
  { kind: 'tendances', kick: 'POPULAIRE', title: 'Tendances', icon: 'flame', color: '#EA580C' },
  { kind: 'nouveautes', kick: 'FRAÎCHEMENT AJOUTÉS', title: 'Nouveautés', icon: 'flash', color: Brand.success },
];

/** Même valeur que la saisie, mais seulement 300 ms après la dernière frappe. */
function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function ExplorerScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const isClient = useSession((s) => s.user?.role) === 'client';
  const actions = useProductActions();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounced(searchInput);
  const params = useLocalSearchParams<{ category?: string; subCategory?: string }>();
  const [category, setCategoryState] = useState<string | undefined>(params.category || undefined);
  const [subCategory, setSubCategory] = useState<string | undefined>(params.subCategory || undefined);
  /* Changer de catégorie retire la sous-catégorie (elle n'appartient qu'à l'ancienne) */
  const setCategory = (id: string | undefined) => {
    setCategoryState(id);
    setSubCategory(undefined);
  };
  /* Écran déjà ouvert puis rouvert avec d'autres paramètres : on les applique
   * pendant le rendu (motif React « état dérivé des props »), sans effet. */
  const paramsKey = `${params.category ?? ''}|${params.subCategory ?? ''}`;
  const [seenParams, setSeenParams] = useState(paramsKey);
  if (paramsKey !== seenParams) {
    setSeenParams(paramsKey);
    if (params.category) {
      setCategoryState(params.category);
      setSubCategory(params.subCategory || undefined);
    }
  }
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const chosen = useChosenCity((st) => st.city);
  const setChosen = useChosenCity((st) => st.set);
  const ville = chosen?.ville;
  const commune = chosen?.commune;
  const [sheet, setSheet] = useState(false);
  const [cityPicker, setCityPicker] = useState(false);

  const filters: ExploreFilters = { search: search.trim() || undefined, category, subCategory, minPrice, maxPrice, ville, commune };
  /* La ville choisie ne masque pas les carrousels : elle est permanente (barre « 📍 »). */
  const filtering = !!(filters.search || category || subCategory || minPrice != null || maxPrice != null);
  const filterCount = [minPrice != null || maxPrice != null].filter(Boolean).length;

  /* ── Données ── */
  const cats = useQuery({ queryKey: qk.categories, queryFn: fetchCategories, staleTime: 10 * 60_000 });
  const homeCity = useQuery({ queryKey: qk.defaultCity, queryFn: fetchDefaultCity, enabled: isClient, staleTime: 10 * 60_000 });
  const nearCity: ChosenCity = chosen ?? (homeCity.data ? { ville: homeCity.data } : null);

  const grid = useInfiniteQuery({
    queryKey: qk.explore.grid(filters),
    queryFn: ({ pageParam }) => fetchExplorePage(pageParam, filters),
    initialPageParam: 1,
    getNextPageParam: (last, all) => (all.reduce((n, p) => n + p.data.length, 0) < last.total && last.data.length === PAGE_SIZE ? all.length + 1 : undefined),
  });
  const items = useMemo(() => grid.data?.pages.flatMap((p) => p.data) ?? [], [grid.data]);
  const total = grid.data?.pages[0]?.total ?? 0;

  const cat = cats.data?.find((c) => c.id === category);
  const catName = cat?.nom;
  const subName = cat?.subCategories.find((s) => s.id === subCategory)?.nom;
  const cardW = (width - 16 * 2 - 12) / 2;

  const resetAll = () => {
    setSearchInput('');
    setCategory(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
  };

  const onRefresh = () => {
    void qc.invalidateQueries({ queryKey: qk.explore.all });
    actions.refresh();
  };

  const card = (p: ExploreProduct, w: number) => (
    <ShopProductCard
      p={p}
      width={w}
      fav={actions.favIds.has(p.id)}
      inCart={actions.cartIds.has(p.id)}
      adding={actions.pendingCart === p.id}
      onFav={() => actions.toggleFav(p.id)}
      onAdd={() => actions.addToCart(p.id)}
      shopName={p.companyName}
      shopVerified={p.companyVerified}
      onShop={p.companyId ? () => openShop(p.companyId!) : undefined}
    />
  );

  const header = (
    <View style={styles.headerBlock}>
      {/* Recherche + filtres */}
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Rechercher un produit…"
            placeholderTextColor={theme.textSecondary}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
          />
          {searchInput ? (
            <Pressable onPress={() => setSearchInput('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Filtres"
          style={[styles.filterBtn, filterCount ? { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine } : { borderColor: theme.border }]}>
          <Ionicons name="options-outline" size={19} color={filterCount ? Brand.primaryInk : theme.text} />
          <ThemedText type="smallBold" style={filterCount ? { color: Brand.primaryInk } : undefined}>
            Filtres{filterCount ? ` · ${filterCount}` : ''}
          </ThemedText>
        </Pressable>
      </View>

      {/* Ville › commune */}
      <Pressable onPress={() => setCityPicker(true)} accessibilityRole="button" accessibilityLabel={`Lieu : ${chosen ? cityLabel(chosen) : 'toute la Guinée'}. Changer`}
        style={[styles.cityBar, { borderColor: chosen ? Brand.primaryLine : theme.border, backgroundColor: chosen ? Brand.primarySoft : theme.background }]}>
        <Ionicons name="location" size={17} color={chosen ? Brand.primaryInk : theme.textSecondary} />
        <ThemedText numberOfLines={1} style={[styles.cityBarText, chosen && { color: Brand.primaryInk }]}>
          {chosen ? cityLabel(chosen) : 'Toute la Guinée'}
        </ThemedText>
        <ThemedText type="small" style={{ color: chosen ? Brand.primaryInk : Brand.primary }}>{chosen ? 'Changer' : 'Choisir une ville'}</ThemedText>
        <Ionicons name="chevron-down" size={16} color={chosen ? Brand.primaryInk : Brand.primary} />
      </Pressable>

      {/* Catégories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Tout" active={!category} onPress={() => setCategory(undefined)} />
        {(cats.data ?? []).map((c) => (
          <Chip key={c.id} label={`${c.icone ? `${c.icone} ` : ''}${c.nom}`} active={category === c.id} onPress={() => setCategory(category === c.id ? undefined : c.id)} />
        ))}
      </ScrollView>

      {/* Filtres actifs (touchez pour retirer) */}
      {filtering ? (
        <View style={styles.activeRow}>
          {catName ? <ActiveChip label={catName} onRemove={() => setCategory(undefined)} /> : null}
          {subName ? <ActiveChip label={subName} onRemove={() => setSubCategory(undefined)} /> : null}
          {minPrice != null || maxPrice != null ? (
            <ActiveChip
              label={minPrice != null && maxPrice != null ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}` : minPrice != null ? `Dès ${formatPrice(minPrice)}` : `Jusqu’à ${formatPrice(maxPrice!)}`}
              onRemove={() => {
                setMinPrice(undefined);
                setMaxPrice(undefined);
              }}
            />
          ) : null}
          <Pressable onPress={resetAll} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Tout effacer
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {/* Sections intelligentes — seulement quand on ne cherche rien de précis */}
      {!filtering ? (
        <>
          {SECTIONS.map((s) => (
            <Carousel key={s.kind} kind={s.kind} kick={s.kick} title={s.title} icon={s.icon} color={s.color} render={(p) => card(p, 160)} />
          ))}
          <NearSection city={nearCity} onChooseCity={() => setCityPicker(true)} render={(p) => card(p, 160)} />
        </>
      ) : null}

      <View style={styles.gridHead}>
        <View style={styles.flex}>
          <ThemedText style={styles.kick}>EXPLORER</ThemedText>
          <ThemedText style={styles.sectionTitle} numberOfLines={1}>
            {filtering ? 'Résultats' : 'Tous les produits'}{chosen ? ` · ${cityLabel(chosen)}` : ''}
          </ThemedText>
        </View>
        {grid.data ? (
          <ThemedText type="small" themeColor="textSecondary">
            {total} produit{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <ScreenHeader title="Explorer" />
      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={styles.col}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        renderItem={({ item }) => card(item, cardW)}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (grid.hasNextPage && !grid.isFetchingNextPage) void grid.fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={grid.isRefetching && !grid.isFetchingNextPage} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListEmptyComponent={
          grid.isLoading ? (
            <ActivityIndicator color={Brand.primary} style={styles.loader} />
          ) : grid.isError ? (
            <ErrorState error={grid.error} onRetry={() => void grid.refetch()} />
          ) : (
            <View style={styles.empty}>
              <View style={[styles.emptyIco, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="cube-outline" size={28} color={theme.textSecondary} />
              </View>
              <ThemedText style={styles.emptyTitle}>Aucun produit trouvé{chosen ? ` à ${cityLabel(chosen)}` : ''}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {chosen?.commune
                  ? `Aucune boutique de ${cityLabel({ ville: chosen.commune })} ne propose encore ce produit. Élargissez à toute la ville de ${cityLabel({ ville: chosen.ville })}.`
                  : 'Essayez d’autres filtres ou une autre recherche.'}
              </ThemedText>
              {chosen?.commune ? (
                <Pressable onPress={() => setChosen({ ville: chosen.ville })} style={[styles.outline, { borderColor: theme.border }]} accessibilityRole="button">
                  <ThemedText type="smallBold">Toute la ville de {cityLabel({ ville: chosen.ville })}</ThemedText>
                </Pressable>
              ) : null}
              {filtering ? (
                <Pressable onPress={resetAll} style={[styles.outline, { borderColor: theme.border }]} accessibilityRole="button">
                  <ThemedText type="smallBold">Tout effacer</ThemedText>
                </Pressable>
              ) : null}
            </View>
          )
        }
        ListFooterComponent={
          grid.isFetchingNextPage ? (
            <ActivityIndicator color={Brand.primary} style={styles.footer} />
          ) : grid.hasNextPage && items.length ? (
            <Pressable onPress={() => void grid.fetchNextPage()} style={[styles.outline, styles.footer, { borderColor: theme.border }]} accessibilityRole="button">
              <ThemedText type="smallBold">Charger plus</ThemedText>
            </Pressable>
          ) : items.length ? (
            <ThemedText type="small" themeColor="textSecondary" style={[styles.center, styles.footer]}>
              Vous avez tout vu 👍
            </ThemedText>
          ) : null
        }
      />

      {sheet ? (
      <FilterSheet
        visible
        onClose={() => setSheet(false)}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onApply={(f) => {
          setMinPrice(f.minPrice);
          setMaxPrice(f.maxPrice);
          setSheet(false);
        }}
      />
      ) : null}
      {cityPicker ? (
        <CityPicker
          current={chosen}
          homeCity={homeCity.data ?? null}
          onClose={() => setCityPicker(false)}
          onSelect={(c) => { setChosen(c); setCityPicker(false); }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/* ── Carrousels ─────────────────────────────────────────────────────── */

function SectionTitle({ kick, title, icon, color }: { kick: string; title: string; icon: IconName; color: string }) {
  return (
    <View style={styles.secHead}>
      <View style={[styles.secIco, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View>
        <ThemedText style={[styles.kick, { color }]}>{kick}</ThemedText>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      </View>
    </View>
  );
}

function Carousel({
  kind,
  kick,
  title,
  icon,
  color,
  city,
  render,
}: {
  kind: ExploreSection;
  kick: string;
  title: string;
  icon: IconName;
  color: string;
  city?: ChosenCity;
  render: (p: ExploreProduct) => React.ReactElement;
}) {
  const theme = useTheme();
  const cityKey = city ? `${city.ville}|${city.commune ?? ''}` : null;
  const q = useQuery({ queryKey: qk.explore.section(kind, cityKey), queryFn: () => fetchExploreSection(kind, city?.ville, city?.commune), staleTime: 5 * 60_000 });
  if (q.isSuccess && q.data.length === 0 && kind !== 'proches') return null;
  return (
    <View style={styles.section}>
      <SectionTitle kick={kick} title={title} icon={icon} color={color} />
      {q.isLoading ? (
        <View style={styles.row12}>
          {[0, 1].map((i) => (
            <View key={i} style={[styles.skel, { backgroundColor: theme.backgroundElement }]} />
          ))}
        </View>
      ) : q.isError ? (
        <ThemedText type="small" themeColor="textSecondary">
          {title} — indisponible pour le moment.
        </ThemedText>
      ) : q.data?.length ? (
        <FlatList
          horizontal
          data={q.data}
          keyExtractor={(p) => p.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row12}
          renderItem={({ item }) => render(item)}
        />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Aucun produit trouvé à {cityLabel(city ?? null)} pour le moment.
        </ThemedText>
      )}
    </View>
  );
}

function NearSection({ city, onChooseCity, render }: { city: ChosenCity; onChooseCity: () => void; render: (p: ExploreProduct) => React.ReactElement }) {
  const theme = useTheme();
  if (!city) {
    return (
      <View style={styles.section}>
        <SectionTitle kick="AUTOUR DE VOUS" title="Proches de vous" icon="location" color={Brand.primary} />
        <Pressable onPress={onChooseCity} style={[styles.cityCard, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="button">
          <Ionicons name="navigate-circle-outline" size={28} color={Brand.primary} />
          <ThemedText style={styles.flex}>Indiquez votre ville pour voir les produits des boutiques proches de vous.</ThemedText>
          <Ionicons name="chevron-forward" size={18} color={Brand.primary} />
        </Pressable>
      </View>
    );
  }
  return (
    <View>
      <Carousel kind="proches" kick={`AUTOUR DE VOUS · ${cityLabel(city).toUpperCase()}`} title="Proches de vous" icon="location" color={Brand.primary} city={city} render={render} />
      <Pressable onPress={onChooseCity} hitSlop={8} style={styles.changeCity}>
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          Changer de ville ou de commune
        </ThemedText>
      </Pressable>
    </View>
  );
}

/* ── Petits éléments ────────────────────────────────────────────────── */

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine } : { borderColor: theme.border }]}>
      <ThemedText type="small" style={[styles.chipText, active && { color: Brand.primaryInk }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onRemove} style={[styles.active, { backgroundColor: theme.backgroundSelected }]} accessibilityRole="button" accessibilityLabel={`Retirer ${label}`}>
      <ThemedText type="small" style={styles.activeText}>
        {label}
      </ThemedText>
      <Ionicons name="close" size={14} color={Brand.primary} />
    </Pressable>
  );
}

/* ── Feuille « Filtres » (prix) ──────────────────────────────── */

function FilterSheet({
  visible,
  onClose,
  minPrice,
  maxPrice,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  minPrice?: number;
  maxPrice?: number;
  onApply: (f: { minPrice?: number; maxPrice?: number }) => void;
}) {
  const theme = useTheme();
  /* Monté seulement quand la feuille s'ouvre : reprend les valeurs en cours. */
  const [min, setMin] = useState(minPrice != null ? String(minPrice) : '');
  const [max, setMax] = useState(maxPrice != null ? String(maxPrice) : '');

  const toNum = (v: string) => {
    const n = Number(v.replace(/\D/g, ''));
    return v.trim() && Number.isFinite(n) ? n : undefined;
  };
  const minN = toNum(min);
  const maxN = toNum(max);
  const invalid = minN != null && maxN != null && minN > maxN;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={() => {}}>
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          <View style={styles.sheetHead}>
            <ThemedText style={styles.sheetTitle}>Filtres</ThemedText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            <ThemedText type="smallBold">Prix (GNF)</ThemedText>
            <View style={styles.wrap}>
              {PRICE_RANGES.map((r) => {
                const on = minN === r.min && maxN === r.max;
                return (
                  <Chip
                    key={r.label}
                    label={r.label}
                    active={on}
                    onPress={() => {
                      setMin(on || r.min == null ? '' : String(r.min));
                      setMax(on || r.max == null ? '' : String(r.max));
                    }}
                  />
                );
              })}
            </View>
            <View style={styles.row12}>
              <PriceInput label="Minimum" value={min} onChange={setMin} placeholder="0" />
              <PriceInput label="Maximum" value={max} onChange={setMax} placeholder="Sans limite" />
            </View>
            {invalid ? (
              <ThemedText type="small" style={{ color: Brand.danger }}>
                Le minimum doit être inférieur au maximum.
              </ThemedText>
            ) : null}

          </ScrollView>
          <View style={styles.sheetActions}>
            <Pressable
              onPress={() => {
                setMin('');
                setMax('');
              }}
              style={[styles.outline, styles.flex, { borderColor: theme.border }]}
              accessibilityRole="button">
              <ThemedText type="smallBold">Réinitialiser</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => onApply({ minPrice: minN, maxPrice: maxN })}
              disabled={invalid}
              style={[styles.apply, styles.flex, invalid && { opacity: 0.5 }]}
              accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
                Afficher les produits
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PriceInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const theme = useTheme();
  return (
    <View style={styles.flex}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.priceInput, { borderColor: theme.border, color: theme.text }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  col: { gap: 12, marginBottom: 12 },
  headerBlock: { gap: 14, paddingTop: 12, paddingBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34, justifyContent: 'center' },
  chipText: { fontWeight: '600' },
  activeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  active: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  activeText: { color: Brand.primary, fontWeight: '600' },
  section: { gap: 10 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secIco: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kick: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2, color: Brand.primary },
  sectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  row12: { flexDirection: 'row', gap: 12 },
  skel: { width: 160, height: 290, borderRadius: 14 },
  cityCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14 },
  cityBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, marginTop: 10 },
  cityBarText: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  changeCity: { alignSelf: 'flex-start', marginTop: 8 },
  gridHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 6 },
  loader: { marginVertical: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  outline: { borderWidth: 1, borderRadius: 999, minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  footer: { marginTop: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%', paddingBottom: 20 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  sheetTitle: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  sheetBody: { paddingHorizontal: 16, gap: 10, paddingBottom: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priceInput: { borderWidth: 1, borderRadius: 12, minHeight: 44, paddingHorizontal: 12, fontSize: 15, marginTop: 4 },
  mt: { marginTop: 8 },
  sheetActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  apply: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
