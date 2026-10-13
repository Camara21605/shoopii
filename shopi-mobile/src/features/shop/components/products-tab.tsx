/**
 * Onglet Produits du profil entreprise : recherche, catégories réelles,
 * tri, prix, disponibilité (en stock, promotion, nouveautés), grille
 * paginée « Afficher plus ». Règles communes avec le site : ../filters.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import type { ShopProduct } from '../api';
import {
  FILTRES_VIDES, TRIS_PRODUITS, filtrerProduits, isEnPromo, isEnStock, isNouveau, nbFiltresActifs,
  type FiltresProduits, type TriProduits,
} from '../filters';
import { Empty, Chip } from './shared';
import { ShopProductCard } from './shop-product-card';

/* ── Produits ───────────────────────────────────────────────────────── */

const TRI_LABELS: Record<TriProduits, string> = {
  pertinence: 'Pertinence',
  prixAsc: 'Prix croissant',
  prixDesc: 'Prix décroissant',
  nouveautes: 'Nouveautés',
  ventes: 'Meilleures ventes',
  populaires: 'Plus populaires',
};
const PAGE = 24;

/** « 12 500 » → 12500 ; vide ou invalide → null (pas de borne). */
const parsePrix = (v: string): number | null => {
  const n = Number(v.replace(/[^0-9]/g, ''));
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
};
const shortPrix = (n: number) => formatPrice(n).replace(/\s*GNF$/, '');

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
  const [f, setF] = useState<FiltresProduits>(FILTRES_VIDES);
  const [sheet, setSheet] = useState<'tri' | 'prix' | null>(null);
  const [draftMin, setDraftMin] = useState('');
  const [draftMax, setDraftMax] = useState('');
  const [shown, setShown] = useState(PAGE);

  /* Tout changement de filtre revient au début de la liste. */
  const patch = (p: Partial<FiltresProduits>) => {
    setF((cur) => ({ ...cur, ...p }));
    setShown(PAGE);
  };

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

  /* Bornes réelles des prix de la boutique (aide à la saisie). */
  const bounds = useMemo(() => {
    if (products.length === 0) return { min: 0, max: 0 };
    const prices = products.map((p) => p.prix);
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [products]);

  const counts = useMemo(
    () => ({
      enStock: products.filter(isEnStock).length,
      enPromo: products.filter(isEnPromo).length,
      nouveautes: products.filter(isNouveau).length,
    }),
    [products],
  );

  const list = useMemo(() => filtrerProduits(products, f), [products, f]);
  const nbActifs = nbFiltresActifs(f);
  const prixActif = f.prixMin != null || f.prixMax != null;
  const prixLabel = prixActif
    ? f.prixMin != null && f.prixMax != null
      ? `${shortPrix(f.prixMin)} – ${shortPrix(f.prixMax)} GNF`
      : f.prixMin != null
        ? `Dès ${shortPrix(f.prixMin)} GNF`
        : `Jusqu’à ${shortPrix(f.prixMax!)} GNF`
    : 'Prix';
  /* Réinitialiser garde le tri (ce n'est pas un filtre), comme le site. */
  const reset = () => patch({ ...FILTRES_VIDES, tri: f.tri });

  const openPrix = () => {
    setDraftMin(f.prixMin != null ? String(f.prixMin) : '');
    setDraftMax(f.prixMax != null ? String(f.prixMax) : '');
    setSheet('prix');
  };
  const draftMinN = parsePrix(draftMin);
  const draftMaxN = parsePrix(draftMax);
  const draftInvalide = draftMinN != null && draftMaxN != null && draftMinN > draftMaxN;
  const draftCount = useMemo(
    () => (sheet === 'prix' && !draftInvalide ? filtrerProduits(products, { ...f, prixMin: draftMinN, prixMax: draftMaxN }).length : 0),
    [sheet, draftInvalide, products, f, draftMinN, draftMaxN],
  );
  const applyPrix = () => {
    if (draftInvalide) return;
    patch({ prixMin: draftMinN, prixMax: draftMaxN });
    setSheet(null);
  };

  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (products.length === 0) return <Empty icon="cube-outline" title="Aucun produit pour le moment" text="Cette boutique n’a encore publié aucun produit." />;

  const cardW = (width - 16 * 2 - 12) / 2;
  return (
    <View style={s.gap12}>
      <View style={[s.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={f.recherche}
          onChangeText={(t) => patch({ recherche: t })}
          placeholder={`Rechercher parmi ${products.length} produit${products.length > 1 ? 's' : ''}`}
          placeholderTextColor={theme.textSecondary}
          style={[s.searchInput, { color: theme.text }]}
          returnKeyType="search"
        />
        {f.recherche ? (
          <Pressable onPress={() => patch({ recherche: '' })} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {cats.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label={`Tout · ${products.length}`} active={!f.categorie} onPress={() => patch({ categorie: null })} />
          {cats.map(([nom, v]) => (
            <Chip key={nom} label={`${v.icon} ${nom} · ${v.n}`} active={f.categorie === nom} onPress={() => patch({ categorie: f.categorie === nom ? null : nom })} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip icon="swap-vertical" label={TRI_LABELS[f.tri]} active={f.tri !== 'pertinence'} onPress={() => setSheet('tri')} />
        {/* Prix : inutile si tous les produits ont le même prix. */}
        {bounds.max > bounds.min ? <Chip icon="cash-outline" label={prixLabel} active={prixActif} onPress={openPrix} /> : null}
        <Chip icon="checkmark-circle-outline" label={`En stock · ${counts.enStock}`} active={f.enStock} onPress={() => patch({ enStock: !f.enStock })} />
        <Chip icon="pricetag-outline" label={`En promotion · ${counts.enPromo}`} active={f.enPromo} onPress={() => patch({ enPromo: !f.enPromo })} />
        <Chip icon="sparkles-outline" label={`Nouveautés · ${counts.nouveautes}`} active={f.nouveautes} onPress={() => patch({ nouveautes: !f.nouveautes })} />
      </ScrollView>

      <View style={s.between}>
        <ThemedText type="small" themeColor="textSecondary">
          {list.length} produit{list.length > 1 ? 's' : ''}
          {nbActifs > 0 ? ` · ${nbActifs} filtre${nbActifs > 1 ? 's' : ''}` : ''}
        </ThemedText>
        {nbActifs > 0 ? (
          <Pressable onPress={reset} hitSlop={8} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réinitialiser
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {list.length === 0 ? (
        <View style={s.gap12}>
          <Empty icon="funnel-outline" title="Aucun produit ne correspond" text="Essayez d’autres filtres." />
          <Pressable onPress={reset} style={[s.more, { borderColor: theme.border }]} accessibilityRole="button">
            <ThemedText type="smallBold">Réinitialiser les filtres</ThemedText>
          </Pressable>
        </View>
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

      {sheet === 'tri' ? (
        <BottomSheet title="Trier par" onClose={() => setSheet(null)}>
          <View style={s.sheetBody}>
            {TRIS_PRODUITS.map((o) => (
              <Pressable
                key={o}
                onPress={() => {
                  patch({ tri: o });
                  setSheet(null);
                }}
                style={[s.sheetRow, { borderTopColor: theme.border }]}
                accessibilityRole="radio"
                accessibilityState={{ checked: f.tri === o }}>
                <ThemedText style={[s.flex1, f.tri === o && s.bold]}>{TRI_LABELS[o]}</ThemedText>
                {f.tri === o ? <Ionicons name="checkmark" size={20} color={Brand.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </BottomSheet>
      ) : null}

      {sheet === 'prix' ? (
        <BottomSheet title="Prix (GNF)" onClose={() => setSheet(null)}>
          <View style={s.sheetBody}>
            <ThemedText type="small" themeColor="textSecondary">
              Dans cette boutique : de {formatPrice(bounds.min)} à {formatPrice(bounds.max)}
            </ThemedText>
            <View style={s.priceRow}>
              {([
                ['Minimum', draftMin, setDraftMin, String(bounds.min)],
                ['Maximum', draftMax, setDraftMax, String(bounds.max)],
              ] as const).map(([lbl, val, set, ph]) => (
                <View key={lbl} style={s.flex1}>
                  <ThemedText type="small" themeColor="textSecondary" style={s.priceLbl}>
                    {lbl}
                  </ThemedText>
                  <TextInput
                    value={val}
                    onChangeText={(t) => set(t.replace(/[^0-9]/g, ''))}
                    placeholder={ph}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onSubmitEditing={applyPrix}
                    accessibilityLabel={`Prix ${lbl.toLowerCase()}`}
                    style={[s.priceInput, { color: theme.text, borderColor: draftInvalide ? Brand.danger : theme.border, backgroundColor: theme.backgroundElement }]}
                  />
                </View>
              ))}
            </View>
            {draftInvalide ? (
              <ThemedText type="small" style={{ color: Brand.danger }}>
                Le minimum dépasse le maximum.
              </ThemedText>
            ) : null}
            <View style={s.priceActions}>
              <Pressable
                onPress={() => {
                  setDraftMin('');
                  setDraftMax('');
                }}
                style={[s.btn, s.btnGhost, { borderColor: theme.border }]}
                accessibilityRole="button">
                <ThemedText type="smallBold">Effacer</ThemedText>
              </Pressable>
              <Pressable
                onPress={applyPrix}
                disabled={draftInvalide}
                style={[s.btn, s.flex1, { backgroundColor: Brand.primary, opacity: draftInvalide ? 0.4 : 1 }]}
                accessibilityRole="button">
                <ThemedText type="smallBold" style={s.btnTxt}>
                  {draftInvalide ? 'Voir les produits' : `Voir ${draftCount} produit${draftCount > 1 ? 's' : ''}`}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </BottomSheet>
      ) : null}
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
  flex1: { flex: 1 },
  bold: { fontWeight: '700' },
  sheetBody: { paddingHorizontal: 18, paddingBottom: 12, gap: 12 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceLbl: { marginBottom: 6 },
  priceInput: { borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 12, fontSize: 16 },
  priceActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: { minHeight: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  btnGhost: { borderWidth: 1 },
  btnTxt: { color: '#fff' },
});
