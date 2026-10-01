/**
 * Onglets d'information : Description · Caractéristiques · Vente en gros ·
 * Livraison (modes réels, frais de zone, livreurs) · Avis.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice } from '@/features/catalog/format';
import type { ShopDriver } from '@/features/shop/api';
import { Stars } from '@/features/shop/components';
import { useTheme } from '@/hooks/use-theme';

import type { ProductDetail } from '../api';
import { type IconName } from './icon';

/* ── Onglets d'information ──────────────────────────────────────────── */

type InfoTab = 'desc' | 'specs' | 'gros' | 'delivery' | 'reviews';

const CONDITION: Record<string, string> = { neuf: 'Neuf', occasion: 'Occasion', reconditionne: 'Reconditionné', 'reconditionné': 'Reconditionné' };
export const conditionLabel = (c?: string | null) => (c ? (CONDITION[c.toLowerCase()] ?? c.charAt(0).toUpperCase() + c.slice(1)) : null);

export function InfoTabs({
  product,
  drivers,
  fee,
  city,
  shopRating,
  shopReviews,
  onShopReviews,
}: {
  product: ProductDetail;
  drivers: ShopDriver[];
  fee: { fraisLivraison: number; zoneNom?: string | null } | null | undefined;
  city: string | null;
  shopRating: number;
  shopReviews: number;
  onShopReviews: () => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<InfoTab>('desc');
  const tabs: { key: InfoTab; label: string }[] = [
    { key: 'desc', label: 'Description' },
    { key: 'specs', label: `Caractéristiques${product.specs.length ? ` (${product.specs.length})` : ''}` },
    ...(product.venteEnGros ? [{ key: 'gros' as InfoTab, label: 'Vente en gros' }] : []),
    { key: 'delivery', label: 'Livraison' },
    { key: 'reviews', label: 'Avis' },
  ];
  const specs = [...product.specs].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const general = [
    product.marque ? { cle: 'Marque', valeur: product.marque } : null,
    conditionLabel(product.condition) ? { cle: 'État', valeur: conditionLabel(product.condition)! } : null,
    product.garantie ? { cle: 'Garantie', valeur: product.garantie } : null,
    product.category?.nom ? { cle: 'Catégorie', valeur: [product.category.nom, product.subCategory?.nom].filter(Boolean).join(' › ') } : null,
  ].filter((x): x is { cle: string; valeur: string } => !!x);

  const modes = [
    product.livraisonStandard && {
      icon: 'cube-outline' as IconName,
      title: 'Livraison par la boutique',
      sub: product.fraisLivraisonLocal ? `${formatPrice(product.fraisLivraisonLocal)} en local` : 'Frais calculés à la commande',
    },
    product.livraisonLivreur && { icon: 'bicycle-outline' as IconName, title: 'Livreur Shoneya', sub: 'Un livreur récupère le colis à la boutique et vous le remet' },
    product.livraisonCorrespondant && {
      icon: 'location-outline' as IconName,
      title: 'Retrait en point relais',
      sub: 'Un correspondant réceptionne le colis, vérifie son état et le garde pour vous',
    },
  ].filter(Boolean) as { icon: IconName; title: string; sub: string }[];

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <FlatList
        horizontal
        data={tabs}
        keyExtractor={(t) => t.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.tabs, { borderBottomColor: theme.border }]}
        renderItem={({ item }) => {
          const on = tab === item.key;
          return (
            <Pressable
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, on && { borderBottomColor: Brand.primary }]}>
              <ThemedText style={[styles.tabText, { color: on ? Brand.primary : theme.textSecondary }]}>{item.label}</ThemedText>
            </Pressable>
          );
        }}
      />
      <View style={styles.tabBody}>
        {tab === 'desc' ? (
          product.description?.trim() ? (
            <>
              <ThemedText style={styles.h3}>À propos de ce produit</ThemedText>
              <ThemedText style={styles.para}>{product.description.trim()}</ThemedText>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Le vendeur n’a pas encore renseigné de description pour ce produit.</ThemedText>
          )
        ) : null}

        {tab === 'specs' ? (
          general.length + specs.length ? (
            <View style={[styles.table, { borderColor: theme.border }]}>
              {[...general, ...specs].map((s, i) => (
                <View key={`${s.cle}${i}`} style={[styles.specRow, i % 2 === 0 && { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={styles.specKey}>{s.cle}</ThemedText>
                  <ThemedText style={styles.specVal}>{s.valeur}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText themeColor="textSecondary">Aucune caractéristique technique renseignée pour ce produit.</ThemedText>
          )
        ) : null}

        {tab === 'gros' ? (
          <>
            {product.moq ? <ThemedText style={styles.para}>Commande minimum : {product.moq} unités.</ThemedText> : null}
            {product.wholesaleTiers.length ? (
              <View style={[styles.table, { borderColor: theme.border }]}>
                {product.wholesaleTiers.map((t, i) => (
                  <View key={i} style={[styles.specRow, i % 2 === 0 && { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={styles.specKey}>
                      {t.quantiteMin}
                      {t.quantiteMax != null ? ` – ${t.quantiteMax}` : '+'} unités
                    </ThemedText>
                    <ThemedText style={styles.specVal}>{formatPrice(t.prixUnitaire)} / unité</ThemedText>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText themeColor="textSecondary">Aucun palier de prix dégressif renseigné pour ce produit.</ThemedText>
            )}
          </>
        ) : null}

        {tab === 'delivery' ? (
          <View style={styles.gap12}>
            {product.delaiLivraison ? (
              <View style={styles.row8}>
                <Ionicons name="time-outline" size={18} color={Brand.primary} />
                <ThemedText>
                  Délai annoncé : <ThemedText style={styles.bold}>{product.delaiLivraison}</ThemedText>
                </ThemedText>
              </View>
            ) : null}
            {city && fee && fee.fraisLivraison > 0 ? (
              <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="navigate-outline" size={18} color={Brand.primary} />
                <ThemedText style={styles.flex}>
                  Livraison vers <ThemedText style={styles.bold}>{city}</ThemedText>
                  {fee.zoneNom ? ` (${fee.zoneNom})` : ''} : <ThemedText style={styles.bold}>{formatPrice(fee.fraisLivraison)}</ThemedText>
                </ThemedText>
              </View>
            ) : null}
            {modes.length ? (
              modes.map((m) => (
                <View key={m.title} style={styles.mode}>
                  <View style={[styles.modeIco, { backgroundColor: theme.backgroundSelected }]}>
                    <Ionicons name={m.icon} size={18} color={Brand.primary} />
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>{m.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {m.sub}
                    </ThemedText>
                  </View>
                </View>
              ))
            ) : (
              <ThemedText themeColor="textSecondary">Aucun mode de livraison renseigné : contactez la boutique.</ThemedText>
            )}
            {drivers.length ? (
              <>
                <ThemedText style={styles.h3}>Livreurs de la boutique</ThemedText>
                {drivers.slice(0, 3).map((d) => (
                  <View key={d.id} style={styles.row8}>
                    <ThemedText style={styles.emoji}>{d.emoji}</ThemedText>
                    <ThemedText numberOfLines={1} style={styles.flex}>
                      {d.fullName}
                    </ThemedText>
                    <Stars value={d.note} size={11} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.trips} livr.
                    </ThemedText>
                  </View>
                ))}
              </>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Vous choisissez le mode de livraison et l’adresse au moment de commander ; les frais exacts y sont calculés.
            </ThemedText>
          </View>
        ) : null}

        {tab === 'reviews' ? (
          <View style={styles.gap12}>
            <ThemedText themeColor="textSecondary">Aucun avis sur ce produit pour le moment.</ThemedText>
            <Pressable onPress={onShopReviews} style={[styles.note, { backgroundColor: theme.backgroundElement }]} accessibilityRole="button">
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Avis sur la boutique</ThemedText>
                <View style={styles.row6}>
                  <Stars value={shopRating} size={13} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {shopRating > 0 ? shopRating.toFixed(1) : '—'} · {shopReviews} avis
                  </ThemedText>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  tabs: { paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { paddingHorizontal: 10, minHeight: 46, justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  tabBody: { padding: 16, gap: 8 },
  h3: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  para: { fontSize: 15, lineHeight: 23 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  specRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  specKey: { flex: 1, fontWeight: '700', fontSize: 14, lineHeight: 19 },
  specVal: { flex: 1.4, fontSize: 14, lineHeight: 19 },
  gap12: { gap: 12 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontWeight: '700' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  flex: { flex: 1 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeIco: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20, lineHeight: 26 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
