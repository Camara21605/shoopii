/**
 * Espace entreprise › Fiche d'un produit (fenêtre « Voir » du site, en plein écran) :
 *   · galerie (image principale + vignettes) ;
 *   · visibilité, catégorie › sous-catégorie, référence ;
 *   · prix (+ ancien prix, remise), commission Shoneya RÉELLE de la boutique, revenu net ;
 *   · stock (couleur selon le seuil, barre), détails (marque, état, garantie, origine, date) ;
 *   · description, caractéristiques, variantes, tags ;
 *   · stories du produit (publier les images en un toucher, vues, retirer) ;
 *   · actions : voir côté client, modification rapide, modifier, archiver, supprimer.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openProduct } from '@/features/catalog/open';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { confirmAction } from '@/lib/confirm';
import { qk } from '@/lib/query-keys';

import { archiveProduct, fetchCommissionRate, fetchProduct, gnf, STOCK_COLOR, stockLevel, type Product } from '../api';
import { VisibilityPill } from '../components/product-card';
import { DeleteSheet, QuickEditSheet } from '../components/sheets';
import { StoriesManager } from '../components/stories';
import { openFullEdit } from './products-screen';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ask = (title: string, message: string, ok: string) => confirmAction(title, message, ok, true);

export default function ProductManageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = String(id ?? '');
  const theme = useTheme();
  const qc = useQueryClient();
  const snack = useSnack();
  const [sheet, setSheet] = useState<'quick' | 'delete' | null>(null);
  const cached = qc.getQueryData<Product[]>(qk.company.products)?.find((p) => p.id === pid);
  const q = useQuery({ queryKey: qk.company.product(pid), queryFn: () => fetchProduct(pid), enabled: !!pid, placeholderData: cached });
  const p = q.data;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={p?.nom ?? 'Produit'} />
      {!p && q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : !p ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <Content
          p={p}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          onQuick={() => setSheet('quick')}
          onDelete={() => setSheet('delete')}
          onMessage={snack.show}
        />
      )}
      <Snack msg={snack.msg} />
      {sheet === 'quick' && p ? (
        <QuickEditSheet
          product={p}
          onClose={() => setSheet(null)}
          onDone={(m) => {
            setSheet(null);
            snack.show(m);
          }}
        />
      ) : null}
      {sheet === 'delete' && p ? (
        <DeleteSheet
          product={p}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null);
            router.back();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Content({ p, refreshing, onRefresh, onQuick, onDelete, onMessage }: { p: Product; refreshing: boolean; onRefresh: () => void; onQuick: () => void; onDelete: () => void; onMessage: (t: string, e?: boolean) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const { width } = useWindowDimensions();
  const canEdit = perms.can('products', 'edit');
  const canDelete = perms.can('products', 'delete');
  const [img, setImg] = useState(0);
  const rate = useQuery({ queryKey: qk.company.commissionRate, queryFn: fetchCommissionRate, staleTime: 30 * 60_000 });
  const pct = rate.data ?? 0;
  const commission = Math.round((p.prix * pct) / 100);
  const level = stockLevel(p);
  const barPct = Math.min(100, (p.stock / ((p.seuil ?? 10) * 3)) * 100);
  const main = p.images[img] ?? p.images[0];

  const archive = useMutation({
    mutationFn: () => archiveProduct(p.id),
    onSuccess: () => {
      const patch = (x: Product) => (x.id === p.id ? { ...x, visibilite: 'private' as const } : x);
      qc.setQueryData<Product[]>(qk.company.products, (l) => l?.map(patch));
      qc.setQueryData<Product>(qk.company.product(p.id), (x) => (x ? patch(x) : x));
      onMessage('Produit archivé (privé)');
    },
    onError: () => onMessage('Erreur lors de l’archivage', true),
  });

  const confirmArchive = async () => {
    if (await ask('Archiver ce produit ?', 'Il passera en « Privé » : retiré de la boutique, accessible seulement par son lien direct.', 'Archiver')) archive.mutate();
  };

  return (
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
      {/* Galerie */}
      {main ? (
        <View style={styles.gap8}>
          <View style={[styles.mainImg, { height: Math.min(width - 32, 420), backgroundColor: theme.backgroundElement }]}>
            <Image source={{ uri: thumb(main.url, 900) ?? main.url }} style={styles.fill} contentFit="contain" transition={150} />
            {p.images.length > 1 ? (
              <View style={styles.counter}>
                <ThemedText style={styles.counterText}>
                  {img + 1} / {p.images.length}
                </ThemedText>
              </View>
            ) : null}
          </View>
          {p.images.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
              {p.images.map((m, i) => (
                <Pressable key={m.id} onPress={() => setImg(i)} accessibilityRole="button" accessibilityLabel={`Image ${i + 1}`} style={[styles.thumb, { borderColor: i === img ? Brand.primary : theme.border }]}>
                  <Image source={{ uri: thumb(m.url, 160) ?? m.url }} style={styles.fill} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : (
        <View style={[styles.noImg, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="image-outline" size={34} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Aucune image
          </ThemedText>
        </View>
      )}

      {/* Titre */}
      <View style={styles.gap6}>
        <ThemedText style={styles.name}>
          {p.category?.icone ? `${p.category.icone} ` : ''}
          {p.nom}
        </ThemedText>
        <View style={styles.metaRow}>
          <VisibilityPill v={p.visibilite} />
          {p.category?.nom ? <Meta icon="pricetag-outline" text={`${p.category.nom}${p.subCategory ? ` › ${p.subCategory.nom}` : ''}`} /> : null}
          {p.reference ? <Meta icon="barcode-outline" text={p.reference} /> : null}
        </View>
      </View>

      {/* Prix */}
      <Card icon="pricetag-outline" title="Prix">
        <ThemedText style={styles.price}>{gnf(p.prix)}</ThemedText>
        {p.prixAncien ? (
          <View style={styles.rowGap}>
            <ThemedText style={styles.old}>{gnf(p.prixAncien)}</ThemedText>
            <View style={styles.remise}>
              <ThemedText style={styles.remiseText}>-{Math.round((1 - p.prix / p.prixAncien) * 100)}%</ThemedText>
            </View>
          </View>
        ) : null}
        <View style={[styles.sep, { backgroundColor: theme.border }]} />
        <Row label={`Commission Shoneya (${rate.isPending ? '…' : `${Number(pct.toFixed(2))}%`})`} value={`-${gnf(commission)}`} />
        <Row label="Revenu net par vente" value={gnf(p.prix - commission)} strong />
      </Card>

      {/* Stock */}
      <Card icon="file-tray-stacked-outline" title="Stock">
        <View style={styles.rowGap}>
          <ThemedText style={[styles.stockV, { color: STOCK_COLOR[level] }]}>{p.stock}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            unités {level === 'out' ? '· rupture' : level === 'low' ? '· stock faible' : ''}
          </ThemedText>
        </View>
        {p.seuil ? (
          <ThemedText type="small" themeColor="textSecondary">
            Seuil d’alerte : {p.seuil} unités
          </ThemedText>
        ) : null}
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.bar, { width: `${barPct}%`, backgroundColor: STOCK_COLOR[level] }]} />
        </View>
      </Card>

      {/* Détails */}
      <Card icon="information-circle-outline" title="Détails">
        {p.marque ? <Row label="Marque" value={p.marque} /> : null}
        {p.condition ? <Row label="Condition" value={p.condition} /> : null}
        {p.garantie ? <Row label="Garantie" value={p.garantie} /> : null}
        {p.paysOrigine ? <Row label="Origine" value={p.paysOrigine} /> : null}
        {p.createdAt ? <Row label="Ajouté le" value={new Date(p.createdAt).toLocaleDateString('fr-FR')} /> : null}
      </Card>

      {p.description ? (
        <Card icon="reorder-three-outline" title="Description">
          <ThemedText style={styles.desc}>{p.description}</ThemedText>
        </Card>
      ) : null}

      {p.specs.length ? (
        <Card icon="list-outline" title="Caractéristiques">
          {p.specs.map((s, i) => (
            <View key={s.id} style={[styles.spec, i % 2 === 0 && { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.specKey}>
                {s.cle}
              </ThemedText>
              <ThemedText type="small" style={styles.specVal}>
                {s.valeur}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {p.variantes.length ? (
        <Card icon="layers-outline" title="Variantes">
          {p.variantes.map((v) => (
            <View key={v.id} style={styles.gap6}>
              <ThemedText type="smallBold">{v.type}</ThemedText>
              <View style={styles.tags}>
                {v.vals
                  .split(',')
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .map((x) => (
                    <View key={x} style={[styles.tag, { borderColor: theme.border }]}>
                      <ThemedText style={styles.tagText}>{x}</ThemedText>
                    </View>
                  ))}
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {p.tags ? (
        <Card icon="pricetags-outline" title="Tags">
          <View style={styles.tags}>
            {p.tags
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean)
              .map((x) => (
                <View key={x} style={[styles.tag, { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine }]}>
                  <ThemedText style={[styles.tagText, { color: Brand.primaryInk }]}>#{x}</ThemedText>
                </View>
              ))}
          </View>
        </Card>
      ) : null}

      <Card icon="time-outline" title="Stories">
        <StoriesManager product={p} canEdit={canEdit} onMessage={onMessage} onConfirm={ask} />
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Action icon="storefront-outline" label="Voir comme un client" onPress={() => openProduct(p.id)} />
        {canEdit ? <Action icon="flash-outline" label="Modification rapide" onPress={onQuick} /> : null}
        {canEdit ? <Action icon="create-outline" label="Modifier le produit (formulaire complet)" onPress={() => openFullEdit(p.id)} primary /> : null}
        {canEdit && p.visibilite !== 'private' ? <Action icon="archive-outline" label={archive.isPending ? 'Archivage…' : 'Archiver'} onPress={() => void confirmArchive()} /> : null}
        {canDelete ? <Action icon="trash-outline" label="Supprimer" onPress={onDelete} danger /> : null}
      </View>
    </ScrollView>
  );
}

function Card({ icon, title, children }: { icon: IconName; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.rowGap}>
        <Ionicons name={icon} size={17} color={Brand.primary} />
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor={strong ? undefined : 'textSecondary'} style={[styles.flex, strong && styles.bold]}>
        {label}
      </ThemedText>
      <ThemedText style={strong ? styles.net : styles.rowV}>{value}</ThemedText>
    </View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={13} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </View>
  );
}

function Action({ icon, label, onPress, primary, danger }: { icon: IconName; label: string; onPress: () => void; primary?: boolean; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : primary ? Brand.primaryInk : theme.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        { borderColor: danger ? '#FECACA' : primary ? Brand.primaryLine : theme.border, backgroundColor: primary ? Brand.primarySoft : danger ? '#FEF2F2' : theme.background },
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={18} color={color} />
      <ThemedText style={[styles.actionText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.75 },
  loader: { marginTop: 48 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  mainImg: { borderRadius: 18, overflow: 'hidden' },
  counter: { position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  counterText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  thumbs: { gap: 8 },
  thumb: { width: 62, height: 62, borderRadius: 12, overflow: 'hidden', borderWidth: 2 },
  noImg: { height: 180, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 6 },
  name: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 8, backgroundColor: '#fff' },
  cardTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 24, lineHeight: 30, fontWeight: '900' },
  old: { fontSize: 14, lineHeight: 19, color: '#8A8A8A', textDecorationLine: 'line-through' },
  remise: { backgroundColor: '#FEF2F2', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  remiseText: { color: '#B91C1C', fontSize: 12, lineHeight: 16, fontWeight: '900' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowV: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  net: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#047857' },
  bold: { fontWeight: '800' },
  stockV: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  desc: { fontSize: 14.5, lineHeight: 21 },
  spec: { flexDirection: 'row', gap: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  specKey: { width: '40%' },
  specVal: { flex: 1, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  actions: { gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 50 },
  actionText: { flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
});
