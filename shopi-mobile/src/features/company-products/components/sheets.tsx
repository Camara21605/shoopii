/**
 * Feuilles du catalogue (comme les modales du site) :
 *   · QuickEditSheet  modification rapide : visibilité, stock actuel, seuil d'alerte ;
 *   · DeleteSheet     confirmation de suppression définitive.
 * Nom, prix, images… se modifient dans le formulaire complet.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { deleteProduct, quickUpdate, VISIBILITY, type Product, type Visibility } from '../api';

function Summary({ p }: { p: Product }) {
  const theme = useTheme();
  const uri = thumb(p.images[0]?.url, 160);
  return (
    <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.sumImg}>{uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" /> : <Ionicons name="image-outline" size={20} color={theme.textSecondary} />}</View>
      <View style={styles.flex}>
        <ThemedText style={styles.bold} numberOfLines={2}>
          {p.nom}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {p.category?.nom ?? ''}
        </ThemedText>
      </View>
    </View>
  );
}

export function QuickEditSheet({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (msg: string) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [vis, setVis] = useState<Visibility>(product.visibilite);
  const [stock, setStock] = useState(String(product.stock));
  const [seuil, setSeuil] = useState(product.seuil != null ? String(product.seuil) : '');
  const save = useMutation({
    mutationFn: () => quickUpdate(product.id, { stock: parseInt(stock, 10) || 0, seuil: seuil ? parseInt(seuil, 10) : null, visibilite: vis }),
    onSuccess: (updated) => {
      qc.setQueryData<Product[]>(qk.company.products, (list) => list?.map((p) => (p.id === updated.id ? updated : p)));
      qc.setQueryData(qk.company.product(updated.id), updated);
      onDone('Produit mis à jour');
    },
  });

  return (
    <BottomSheet title="Modification rapide" onClose={onClose}>
      <View style={styles.body}>
        <Summary p={product} />
        <ThemedText type="smallBold">Visibilité</ThemedText>
        {(Object.keys(VISIBILITY) as Visibility[]).map((v) => {
          const on = v === vis;
          return (
            <Pressable key={v} onPress={() => setVis(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.opt, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
              <View style={[styles.dot, { backgroundColor: VISIBILITY[v].color }]} />
              <ThemedText style={[styles.flex, styles.optText]}>{VISIBILITY[v].long}</ThemedText>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? Brand.primary : theme.textSecondary} />
            </Pressable>
          );
        })}
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="smallBold">Stock actuel</ThemedText>
            <TextInput value={stock} onChangeText={(t) => setStock(t.replace(/\D/g, ''))} keyboardType="number-pad" style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]} accessibilityLabel="Stock actuel" />
          </View>
          <View style={styles.flex}>
            <ThemedText type="smallBold">Seuil d’alerte</ThemedText>
            <TextInput value={seuil} onChangeText={(t) => setSeuil(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Ex : 5" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]} accessibilityLabel="Seuil d'alerte" />
          </View>
        </View>
        <View style={styles.info}>
          <Ionicons name="information-circle" size={16} color={Brand.primaryInk} />
          <ThemedText type="small" style={styles.infoText}>
            Pour modifier le nom, le prix ou les images, utilisez le formulaire complet.
          </ThemedText>
        </View>
        {save.isError ? <ThemedText style={styles.err}>{toUserMessage(save.error)}</ThemedText> : null}
        <PrimaryButton title="Sauvegarder" onPress={() => save.mutate()} loading={save.isPending} pill />
      </View>
    </BottomSheet>
  );
}

export function DeleteSheet({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: (msg: string) => void }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => deleteProduct(product.id),
    onSuccess: () => {
      qc.setQueryData<Product[]>(qk.company.products, (list) => list?.filter((p) => p.id !== product.id));
      qc.removeQueries({ queryKey: qk.company.product(product.id) });
      onDone('Produit supprimé');
    },
  });
  return (
    <BottomSheet title="Confirmer la suppression" onClose={onClose}>
      <View style={styles.body}>
        <View style={styles.warnIco}>
          <Ionicons name="trash" size={26} color={Brand.danger} />
        </View>
        <ThemedText style={styles.center}>Voulez-vous vraiment supprimer « {product.nom} » ?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Cette action est irréversible. Le produit sera définitivement effacé.
        </ThemedText>
        {del.isError ? <ThemedText style={styles.err}>{toUserMessage(del.error)}</ThemedText> : null}
        <Pressable onPress={() => del.mutate()} disabled={del.isPending} accessibilityRole="button" style={[styles.danger, del.isPending && styles.dim]}>
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <ThemedText style={styles.dangerText}>{del.isPending ? 'Suppression…' : 'Supprimer définitivement'}</ThemedText>
        </Pressable>
        <SecondaryButton title="Annuler" onPress={onClose} disabled={del.isPending} pill />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  dim: { opacity: 0.6 },
  body: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 10 },
  sumImg: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 12, minHeight: 48 },
  optText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  dot: { width: 9, height: 9, borderRadius: 5 },
  row: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, fontSize: 16, marginTop: 6 },
  info: { flexDirection: 'row', gap: 8, backgroundColor: Brand.primarySoft, borderRadius: 12, padding: 10 },
  infoText: { flex: 1, color: Brand.primaryInk },
  err: { color: Brand.danger, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  warnIco: { alignSelf: 'center', width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  danger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.danger, borderRadius: 999, minHeight: 50 },
  dangerText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
