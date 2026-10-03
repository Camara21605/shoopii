/**
 * Fenêtres de l'inventaire (comme les modales du site) :
 *   · StockSheet       modifier le stock et le seuil d'un produit, avec l'aperçu
 *                      en direct du nouveau statut et du niveau ;
 *   · RestockSheet     réapprovisionner un ou plusieurs produits : quantité À AJOUTER
 *                      (pré-remplie pour remonter à 3 × le seuil) et nouveau stock ;
 *   · ThresholdsSheet  appliquer un seuil d'alerte à tous les produits qui n'en ont pas.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { fmtNum, LEVEL, levelOf, patchMany, patchStock, restockTarget, stockPct, type Product } from '../api';

const digits = (t: string) => t.replace(/\D/g, '');

/** Met à jour le catalogue en cache (partagé avec la rubrique Produits). */
function useApply() {
  const qc = useQueryClient();
  return (changes: { id: string; stock?: number; seuil?: number | null }[]) => {
    qc.setQueryData<Product[]>(qk.company.products, (list) =>
      list?.map((p) => {
        const c = changes.find((x) => x.id === p.id);
        return c ? { ...p, ...(c.stock !== undefined ? { stock: c.stock } : {}), ...(c.seuil !== undefined ? { seuil: c.seuil } : {}) } : p;
      }),
    );
    changes.forEach((c) => void qc.invalidateQueries({ queryKey: qk.company.product(c.id) }));
  };
}

function Thumb({ p, size = 48 }: { p: Product; size?: number }) {
  const theme = useTheme();
  const uri = thumb(p.images[0]?.url, 160);
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: theme.backgroundElement }]}>
      {uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" /> : <Ionicons name="image-outline" size={size * 0.4} color={theme.textSecondary} />}
    </View>
  );
}

function NumberInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.numBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <TextInput value={value} onChangeText={(t) => onChange(digits(t))} keyboardType="number-pad" placeholder={placeholder} placeholderTextColor={theme.textSecondary} style={[styles.numInput, { color: theme.text }]} accessibilityLabel={label} />
      <ThemedText type="small" themeColor="textSecondary">
        unités
      </ThemedText>
    </View>
  );
}

export function StockSheet({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (m: string) => void }) {
  const theme = useTheme();
  const apply = useApply();
  const [stock, setStock] = useState(String(product.stock));
  const [seuil, setSeuil] = useState(product.seuil != null ? String(product.seuil) : '');
  const s = parseInt(stock, 10);
  const sNum = Number.isNaN(s) ? 0 : s;
  const seuilNum = seuil ? parseInt(seuil, 10) : null;
  const lvl = LEVEL[levelOf(sNum, seuilNum)];
  const pct = stockPct(sNum, seuilNum);
  const save = useMutation({
    mutationFn: () => patchStock(product.id, { stock: sNum, seuil: seuilNum }),
    onSuccess: () => {
      apply([{ id: product.id, stock: sNum, seuil: seuilNum }]);
      onDone('Stock mis à jour');
    },
  });
  return (
    <BottomSheet title="Modifier le stock" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary">
          Mise à jour rapide sans quitter l’inventaire
        </ThemedText>
        <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
          <Thumb p={product} />
          <View style={styles.flex}>
            <ThemedText style={styles.bold} numberOfLines={2}>
              {product.nom}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {product.category?.icone ?? ''} {product.category?.nom ?? ''}
              {product.reference ? ` · ${product.reference}` : ''}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="smallBold">Quantité en stock *</ThemedText>
        <NumberInput value={stock} onChange={setStock} placeholder="Ex : 25" label="Quantité en stock" />
        {stock ? (
          <View style={[styles.preview, { backgroundColor: lvl.bg }]}>
            <View style={[styles.dot, { backgroundColor: lvl.color }]} />
            <ThemedText type="small" style={{ color: lvl.color }}>
              Nouveau statut : <ThemedText type="smallBold" style={{ color: lvl.color }}>{lvl.label}</ThemedText>
            </ThemedText>
          </View>
        ) : null}
        <ThemedText type="smallBold">Seuil d’alerte (optionnel)</ThemedText>
        <NumberInput value={seuil} onChange={setSeuil} placeholder="Ex : 5" label="Seuil d'alerte" />
        <ThemedText type="small" themeColor="textSecondary">
          Une alerte apparaîtra quand le stock descend sous ce seuil.
        </ThemedText>
        <View style={styles.levelHead}>
          <ThemedText type="small" themeColor="textSecondary">
            Niveau de stock
          </ThemedText>
          <ThemedText type="smallBold">{pct}%</ThemedText>
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.bar, { width: `${pct}%`, backgroundColor: lvl.color }]} />
        </View>
        {save.isError ? <ThemedText style={styles.err}>{toUserMessage(save.error)}</ThemedText> : null}
        <PrimaryButton title="Mettre à jour le stock" onPress={() => save.mutate()} loading={save.isPending} disabled={!stock} pill />
      </ScrollView>
    </BottomSheet>
  );
}

export function RestockSheet({ products, onClose, onDone }: { products: Product[]; onClose: () => void; onDone: (m: string, error?: boolean) => void }) {
  const theme = useTheme();
  const apply = useApply();
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(products.map((p) => [p.id, String(Math.max(restockTarget(p) - p.stock, 1))])));
  const add = (p: Product) => parseInt(qty[p.id] ?? '', 10) || 0;
  const total = products.reduce((s, p) => s + add(p), 0);
  const save = useMutation({
    mutationFn: () => patchMany(products.filter((p) => add(p) > 0), (p) => ({ stock: p.stock + add(p) })),
    onSuccess: ({ ok, failed }) => {
      apply(ok.map((p) => ({ id: p.id, stock: p.stock + add(p) })));
      if (!failed) onDone(`${ok.length} produit${ok.length > 1 ? 's' : ''} réapprovisionné${ok.length > 1 ? 's' : ''}`);
      else onDone(`${failed} produit${failed > 1 ? 's n’ont' : ' n’a'} pas pu être mis à jour`, true);
    },
  });
  return (
    <BottomSheet title="Réapprovisionner" onClose={onClose} height={products.length > 3 ? 0.85 : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <ThemedText type="small" themeColor="textSecondary">
          {products.length} produit{products.length > 1 ? 's' : ''} à réapprovisionner — indiquez la quantité reçue à ajouter au stock.
        </ThemedText>
        {products.map((p) => (
          <View key={p.id} style={[styles.restockRow, { borderColor: theme.border }]}>
            <Thumb p={p} size={44} />
            <View style={styles.flex}>
              <ThemedText style={styles.bold} numberOfLines={1}>
                {p.nom}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Stock actuel : {p.stock} → <ThemedText type="smallBold">{p.stock + add(p)}</ThemedText>
              </ThemedText>
            </View>
            <View style={styles.addBox}>
              <ThemedText style={styles.plus}>+</ThemedText>
              <TextInput
                value={qty[p.id]}
                onChangeText={(t) => setQty((q) => ({ ...q, [p.id]: digits(t) }))}
                keyboardType="number-pad"
                style={[styles.addInput, { color: theme.text, borderColor: Brand.primaryLine }]}
                accessibilityLabel={`Quantité à ajouter pour ${p.nom}`}
              />
            </View>
          </View>
        ))}
        <View style={styles.info}>
          <Ionicons name="information-circle" size={16} color={Brand.primaryInk} />
          <ThemedText type="small" style={styles.infoText}>
            Quantités proposées pour remonter chaque produit à 3 fois son seuil d’alerte. Ajustez-les selon ce que vous avez reçu : le stock est mis à jour immédiatement.
          </ThemedText>
        </View>
        <ThemedText style={styles.total}>Total à ajouter : {fmtNum(total)} unités</ThemedText>
        <PrimaryButton title={`Réapprovisionner ${products.length} produit${products.length > 1 ? 's' : ''}`} onPress={() => save.mutate()} loading={save.isPending} disabled={total === 0} pill />
      </ScrollView>
    </BottomSheet>
  );
}

export function ThresholdsSheet({ products, onClose, onDone }: { products: Product[]; onClose: () => void; onDone: (m: string, error?: boolean) => void }) {
  const apply = useApply();
  const [seuil, setSeuil] = useState('5');
  const val = parseInt(seuil, 10);
  const save = useMutation({
    mutationFn: () => patchMany(products, () => ({ seuil: val })),
    onSuccess: ({ ok, failed }) => {
      apply(ok.map((p) => ({ id: p.id, seuil: val })));
      if (!failed) onDone(`Seuil défini pour ${ok.length} produit${ok.length > 1 ? 's' : ''}`);
      else onDone(`${failed} produit${failed > 1 ? 's n’ont' : ' n’a'} pas pu être mis à jour`, true);
    },
  });
  return (
    <BottomSheet title="Configurer les alertes" onClose={onClose}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          {products.length} produit{products.length > 1 ? 's' : ''} sans seuil défini
        </ThemedText>
        <ThemedText type="smallBold">Seuil d’alerte à appliquer</ThemedText>
        <NumberInput value={seuil} onChange={setSeuil} placeholder="Ex : 5" label="Seuil d'alerte à appliquer" />
        <View style={styles.info}>
          <Ionicons name="information-circle" size={16} color={Brand.primaryInk} />
          <ThemedText type="small" style={styles.infoText}>
            Ce seuil sera appliqué à tous les produits qui n’en ont pas encore un. Vous pourrez toujours l’ajuster produit par produit ensuite.
          </ThemedText>
        </View>
        <PrimaryButton title={`Appliquer à ${products.length} produit${products.length > 1 ? 's' : ''}`} onPress={() => save.mutate()} loading={save.isPending} disabled={!seuil || Number.isNaN(val)} pill />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  thumb: { borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 10 },
  numBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 50 },
  numInput: { flex: 1, fontSize: 18, fontWeight: '800', paddingVertical: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  levelHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  err: { color: Brand.danger, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  restockRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  addBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  plus: { fontSize: 18, fontWeight: '900', color: Brand.primaryInk },
  addInput: { width: 70, borderWidth: 1.5, borderRadius: 10, minHeight: 42, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  info: { flexDirection: 'row', gap: 8, backgroundColor: Brand.primarySoft, borderRadius: 12, padding: 10 },
  infoText: { flex: 1, color: Brand.primaryInk },
  total: { fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
});
