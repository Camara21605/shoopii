/**
 * Panier — le VRAI panier du compte (même panier que sur le site), version téléphone :
 *   · articles regroupés par boutique (une commande sera créée pour chacune),
 *     en-tête boutique (logo, Vérifié, modes de livraison réglés par la boutique)
 *   · par article : photo, variante, prix unitaire + ancien prix, remise, stock
 *     (« plus que 3 », « plus disponible », quantité au-delà du stock),
 *     quantité (plafond serveur 10 / stock), mettre de côté (favoris), retirer
 *     (avec « Annuler » pendant 5 s), vider le panier
 *   · récapitulatif : sous-total, économies, livraison (choisie à la commande),
 *     total, solde du portefeuille (le paiement y est prélevé) + alerte si insuffisant
 *   · « Vous aimerez aussi » (tendances) ; panier vide soigné
 *   · barre fixe : total + « Commander » → écran de commande natif (/commande) :
 *     adresse, choix de livraison (boutique, livreur ou point relais selon les
 *     réglages des boutiques), paiement par le portefeuille
 * Données : features/cart/api.ts (lecture + écritures optimistes).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, initials } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { cartCount, MAX_QTY, useCart, useCartActions, type CartItem } from '@/features/cart/api';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import { openProduct, openShop } from '@/features/catalog/open';
import { fetchExploreSection } from '@/features/explore/api';
import { ProductStrip } from '@/features/product/components';
import { fetchWalletBalance } from '@/features/profile/api';
import { fetchShop, toggleFavorite, type ShopDetail } from '@/features/shop/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Limite réelle d'un article : plafond serveur et stock connu. */
const maxFor = (i: CartItem) => Math.max(1, Math.min(MAX_QTY, i.stock != null && i.stock > 0 ? i.stock : MAX_QTY));

export default function CartScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const role = useSession((s) => s.user?.role);
  const isClient = role === 'client';
  const cart = useCart();
  const actions = useCartActions();
  const items = useMemo(() => cart.data ?? [], [cart.data]);

  /* ── Boutiques du panier (logo, Vérifié, modes de livraison) ── */
  const shopIds = useMemo(() => [...new Set(items.map((i) => i.shopId).filter((x): x is string => !!x))], [items]);
  const shops = useQueries({
    queries: shopIds.map((id) => ({ queryKey: qk.shop.detail(id), queryFn: () => fetchShop(id), staleTime: 5 * 60_000 })),
  });
  const shopById = useMemo(() => {
    const m = new Map<string, ShopDetail>();
    shops.forEach((q, i) => q.data && m.set(shopIds[i], q.data));
    return m;
  }, [shops, shopIds]);

  const wallet = useQuery({ queryKey: qk.wallet, queryFn: fetchWalletBalance, enabled: isClient && items.length > 0 });
  const trending = useQuery({ queryKey: qk.explore.section('tendances', null), queryFn: () => fetchExploreSection('tendances'), staleTime: 5 * 60_000 });

  /* ── Groupes par boutique ── */
  const groups = useMemo(() => {
    const m = new Map<string, { key: string; shopId?: string; nom: string; items: CartItem[] }>();
    for (const i of items) {
      const key = i.shopId || i.shopNom || 'autre';
      if (!m.has(key)) m.set(key, { key, shopId: i.shopId, nom: i.shopNom || 'Boutique', items: [] });
      m.get(key)!.items.push(i);
    }
    return [...m.values()];
  }, [items]);

  /* ── Totaux (mêmes règles que le serveur : prix × quantité) ── */
  const count = cartCount(items);
  const subtotal = items.reduce((s, i) => s + i.prix * i.qty, 0);
  const savings = items.reduce((s, i) => s + (i.prixAncien && i.prixAncien > i.prix ? (i.prixAncien - i.prix) * i.qty : 0), 0);
  const unavailable = items.filter((i) => i.stock === 0);
  const overStock = items.filter((i) => i.stock != null && i.stock > 0 && i.qty > i.stock);
  const blocked = unavailable.length > 0 || overStock.length > 0;
  const balance = wallet.data;
  const short = balance != null && balance < subtotal;

  /* ── « Annuler » après un retrait (5 s) ── */
  const [undo, setUndo] = useState<CartItem | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);
  const removeWithUndo = (item: CartItem) => {
    actions.remove(item);
    setUndo(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };

  /* Mettre de côté = ajouter aux favoris puis retirer du panier. */
  const saveForLater = useMutation({
    mutationFn: async (item: CartItem) => {
      const ids = qc.getQueryData<Set<string>>(qk.favorites.ids);
      if (!ids?.has(item.produitId)) await toggleFavorite(item.produitId);
      return item;
    },
    onSuccess: (item) => {
      actions.remove(item);
      void qc.invalidateQueries({ queryKey: qk.favorites.ids });
      void qc.invalidateQueries({ queryKey: qk.favorites.list });
      Alert.alert('Mis de côté', `« ${item.nom} » est dans vos favoris.`);
    },
    onError: (e) => Alert.alert('Favoris', toUserMessage(e)),
  });

  const confirmClear = () =>
    Alert.alert('Vider le panier ?', `${count} article${count > 1 ? 's' : ''} seront retirés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: actions.clear },
    ]);

  const checkout = () => {
    if (blocked) {
      Alert.alert('Panier à corriger', 'Retirez les articles indisponibles ou réduisez les quantités au-delà du stock avant de commander.');
      return;
    }
    router.push('/commande');
  };

  const header = (
    <ScreenHeader
      title={items.length ? `Mon panier (${count})` : 'Mon panier'}
      right={
        items.length ? (
          <Pressable onPress={confirmClear} disabled={actions.clearing} hitSlop={8} accessibilityRole="button" accessibilityLabel="Vider le panier">
            <ThemedText type="smallBold" style={{ color: Brand.danger }}>
              Vider
            </ThemedText>
          </Pressable>
        ) : null
      }
    />
  );

  if (role && !isClient) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        <EmptyState icon="lock-closed-outline" title="Panier réservé aux clients" text="Connectez-vous avec un compte client pour acheter sur Shoneya." />
      </SafeAreaView>
    );
  }

  const strip = trending.data?.length ? (
    <ProductStrip
      title="Vous aimerez aussi"
      icon="flame-outline"
      items={trending.data
        .filter((p) => !items.some((i) => i.produitId === p.id))
        .map((p) => ({
          id: p.id,
          nom: p.nom,
          prix: p.prix,
          prixAncien: p.prixAncien,
          imageUrl: [...p.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((m) => (m.type ?? 'image') === 'image')?.url ?? null,
          emoji: p.category?.icone ?? null,
          shopNom: p.companyName ?? '',
          shopId: p.companyId ?? '',
          badge: null,
        }))}
      onOpen={openProduct}
      onShop={openShop}
    />
  ) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}
      {cart.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : cart.error ? (
        <View style={styles.center}>
          <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
        </View>
      ) : items.length === 0 ? (
        <ScrollView contentContainerStyle={styles.emptyScroll} refreshControl={<RefreshControl refreshing={cart.isRefetching} onRefresh={() => void cart.refetch()} colors={[Brand.primary]} />}>
          <EmptyState icon="bag-handle-outline" title="Votre panier est vide" text="Parcourez les boutiques et ajoutez les produits qui vous plaisent : ils apparaîtront ici, sur le site comme dans l’application.">
            <View style={styles.row8}>
              <Pressable onPress={() => router.push('/explorer')} style={[styles.pillBtn, { backgroundColor: Brand.primarySoft }]} accessibilityRole="button">
                <Ionicons name="compass-outline" size={18} color={Brand.primaryInk} />
                <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
                  Explorer
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push('/boutiques')} style={[styles.pillBtn, styles.outline, { borderColor: theme.border }]} accessibilityRole="button">
                <Ionicons name="storefront-outline" size={18} color={theme.text} />
                <ThemedText type="smallBold">Boutiques</ThemedText>
              </Pressable>
            </View>
          </EmptyState>
          <View style={styles.pad}>{strip}</View>
        </ScrollView>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={cart.isRefetching} onRefresh={() => void cart.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
            {groups.length > 1 ? (
              <View style={[styles.info, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name="information-circle" size={18} color={Brand.primary} />
                <ThemedText type="small" style={styles.flex}>
                  Articles de {groups.length} boutiques : une commande sera créée pour chacune, livrée séparément.
                </ThemedText>
              </View>
            ) : null}
            {blocked ? (
              <View style={[styles.info, { backgroundColor: '#FDECEC' }]}>
                <Ionicons name="alert-circle" size={18} color={Brand.danger} />
                <ThemedText type="small" style={[styles.flex, { color: Brand.danger }]}>
                  {unavailable.length ? `${unavailable.length} article${unavailable.length > 1 ? 's ne sont' : ' n’est'} plus disponible${unavailable.length > 1 ? 's' : ''}. ` : ''}
                  {overStock.length ? 'Certaines quantités dépassent le stock. ' : ''}
                  Corrigez le panier pour pouvoir commander.
                </ThemedText>
              </View>
            ) : null}

            {groups.map((g) => (
              <ShopGroup
                key={g.key}
                group={g}
                shop={g.shopId ? shopById.get(g.shopId) : undefined}
                onQty={actions.setQty}
                onRemove={removeWithUndo}
                onSave={(i) => saveForLater.mutate(i)}
                saving={saveForLater.isPending ? saveForLater.variables?.id : undefined}
              />
            ))}

            {/* Récapitulatif */}
            <View style={[styles.card, styles.summary, { borderColor: theme.border }]}>
              <View style={styles.row8}>
                <Ionicons name="receipt-outline" size={18} color={Brand.primary} />
                <ThemedText style={styles.cardTitle}>Récapitulatif</ThemedText>
              </View>
              <Line label={`Sous-total (${count} article${count > 1 ? 's' : ''})`} value={formatPrice(subtotal)} />
              {savings > 0 ? <Line label="Vos économies" value={`− ${formatPrice(savings)}`} color={Brand.success} /> : null}
              <Line label={groups.length > 1 ? `Livraison (${groups.length} boutiques)` : 'Livraison'} value="Boutique, livreur ou point relais" muted />
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.rowBetween}>
                <ThemedText style={styles.totalLabel}>Total articles</ThemedText>
                <ThemedText style={styles.totalValue}>{formatPrice(subtotal)}</ThemedText>
              </View>
              <View style={[styles.wallet, { backgroundColor: short ? '#FDECEC' : theme.backgroundElement }]}>
                <Ionicons name="wallet-outline" size={18} color={short ? Brand.danger : Brand.success} />
                <View style={styles.flex}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Solde du portefeuille (le paiement y est prélevé)
                  </ThemedText>
                  <ThemedText style={[styles.bold, { color: short ? Brand.danger : Brand.success }]}>
                    {wallet.isPending ? 'Chargement…' : balance != null ? formatPrice(balance) : '—'}
                  </ThemedText>
                  {short ? (
                    <ThemedText type="small" style={{ color: Brand.danger }}>
                      Solde insuffisant : il manque {formatPrice(subtotal - (balance ?? 0))} (hors livraison).
                    </ThemedText>
                  ) : null}
                </View>
                {short ? (
                  <Pressable onPress={() => router.push('/portefeuille/recharger')} hitSlop={6} accessibilityRole="button">
                    <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                      Recharger
                    </ThemedText>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.trust}>
                {[
                  { icon: 'shield-checkmark-outline' as IconName, t: 'Paiement sécurisé' },
                  { icon: 'return-down-back-outline' as IconName, t: 'Retours selon la boutique' },
                  { icon: 'chatbubbles-outline' as IconName, t: 'Vendeur joignable' },
                ].map((x) => (
                  <View key={x.t} style={styles.trustItem}>
                    <Ionicons name={x.icon} size={16} color={Brand.primary} />
                    <ThemedText type="small" themeColor="textSecondary" style={styles.center2}>
                      {x.t}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            {strip}
          </ScrollView>

          {undo ? (
            <View style={styles.snack}>
              <ThemedText style={styles.snackText} numberOfLines={1}>
                « {undo.nom} » retiré
              </ThemedText>
              <Pressable
                onPress={() => {
                  actions.restore(undo);
                  setUndo(null);
                }}
                hitSlop={8}
                accessibilityRole="button">
                <ThemedText style={styles.snackAction}>ANNULER</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {/* Barre fixe */}
          <View style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Total · hors livraison
              </ThemedText>
              <ThemedText style={styles.barTotal}>{formatPrice(subtotal)}</ThemedText>
              {savings > 0 ? (
                <ThemedText type="small" style={{ color: Brand.success }}>
                  Économie {formatPrice(savings)}
                </ThemedText>
              ) : null}
            </View>
            <Pressable
              onPress={() => void checkout()}
              style={[styles.checkout, blocked && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel={`Commander, ${formatPrice(subtotal)}`}>
              <ThemedText style={styles.checkoutText}>Commander</ThemedText>
              <Ionicons name="arrow-forward" size={18} color={Brand.primaryInk} />
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

/* ── Groupe d'une boutique ──────────────────────────────────────────── */

function ShopGroup({
  group,
  shop,
  onQty,
  onRemove,
  onSave,
  saving,
}: {
  group: { shopId?: string; nom: string; items: CartItem[] };
  shop?: ShopDetail;
  onQty: (id: string, q: number) => void;
  onRemove: (i: CartItem) => void;
  onSave: (i: CartItem) => void;
  saving?: string;
}) {
  const theme = useTheme();
  const sub = group.items.reduce((s, i) => s + i.prix * i.qty, 0);
  const n = cartCount(group.items);
  const logo = thumb(shop?.logo, 120);
  const lv = shop?.livraison;
  const modes = lv
    ? ([
        lv.standard && 'Livraison boutique',
        lv.livreursShopi && 'Livreur Shoneya',
        lv.correspondants && 'Point relais',
        lv.clickCollect && 'Retrait en boutique',
      ].filter(Boolean) as string[])
    : [];

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <Pressable
        onPress={() => group.shopId && openShop(group.shopId)}
        disabled={!group.shopId}
        style={[styles.shopHead, { borderBottomColor: theme.border }]}
        accessibilityRole="button"
        accessibilityLabel={`Boutique ${group.nom}`}>
        <View style={[styles.shopLogo, { backgroundColor: theme.backgroundSelected }]}>
          {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.shopInit}>{initials(group.nom)}</ThemedText>}
        </View>
        <View style={styles.flex}>
          <View style={styles.row6}>
            <ThemedText numberOfLines={1} style={[styles.bold, styles.shrink]}>
              {group.nom}
            </ThemedText>
            {shop?.verified ? <Ionicons name="checkmark-circle" size={15} color={Brand.primary} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {modes.length ? modes.join(' · ') : `${n} article${n > 1 ? 's' : ''}`}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>

      {group.items.map((item, idx) => (
        <CartRow
          key={item.id}
          item={item}
          first={idx === 0}
          onQty={(q) => onQty(item.id, q)}
          onRemove={() => onRemove(item)}
          onSave={() => onSave(item)}
          saving={saving === item.id}
        />
      ))}

      <View style={[styles.shopFoot, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" themeColor="textSecondary">
          Sous-total boutique · {n} article{n > 1 ? 's' : ''}
        </ThemedText>
        <ThemedText style={styles.bold}>{formatPrice(sub)}</ThemedText>
      </View>
    </View>
  );
}

/* ── Ligne d'article ────────────────────────────────────────────────── */

function CartRow({
  item,
  first,
  onQty,
  onRemove,
  onSave,
  saving,
}: {
  item: CartItem;
  first: boolean;
  onQty: (q: number) => void;
  onRemove: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const theme = useTheme();
  const pct = discountPercent(item.prix, item.prixAncien);
  const out = item.stock === 0;
  const max = maxFor(item);
  const over = item.stock != null && item.stock > 0 && item.qty > item.stock;
  const low = !out && item.stock != null && item.stock < 5;

  return (
    <View style={[styles.item, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={styles.itemTop}>
        <Pressable onPress={() => openProduct(item.produitId)} style={[styles.thumb, { backgroundColor: theme.backgroundElement }]} accessibilityRole="imagebutton" accessibilityLabel={`Voir ${item.nom}`}>
          {item.imageUrl ? <Image source={{ uri: thumb(item.imageUrl, 200) }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.emoji}>{item.emoji || '📦'}</ThemedText>}
          {out ? <View style={styles.veil} /> : null}
          {pct ? (
            <View style={styles.pct}>
              <ThemedText style={styles.pctText}>−{pct}%</ThemedText>
            </View>
          ) : null}
        </Pressable>
        <View style={styles.flex}>
          <Pressable onPress={() => openProduct(item.produitId)}>
            <ThemedText numberOfLines={2} style={[styles.name, out && { color: theme.textSecondary }]}>
              {item.nom}
            </ThemedText>
          </Pressable>
          {item.variante ? (
            <View style={[styles.variant, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">{item.variante}</ThemedText>
            </View>
          ) : null}
          <View style={styles.priceLine}>
            <ThemedText style={styles.unit}>{formatPrice(item.prix)}</ThemedText>
            {pct && item.prixAncien ? <ThemedText style={styles.old}>{formatPrice(item.prixAncien)}</ThemedText> : null}
          </View>
          {out ? (
            <ThemedText type="small" style={{ color: Brand.danger }}>
              ● Plus disponible : retirez-le pour commander
            </ThemedText>
          ) : over ? (
            <Pressable onPress={() => onQty(item.stock!)} hitSlop={4}>
              <ThemedText type="small" style={{ color: Brand.danger }}>
                ● Seulement {item.stock} en stock · <ThemedText type="smallBold" style={{ color: Brand.primary }}>Ajuster</ThemedText>
              </ThemedText>
            </Pressable>
          ) : low ? (
            <ThemedText type="small" style={{ color: '#D97706' }}>
              ● Plus que {item.stock} en stock
            </ThemedText>
          ) : null}
        </View>
      </View>

      <View style={styles.itemBottom}>
        <View style={[styles.stepper, { borderColor: theme.border }]}>
          <StepBtn icon={item.qty <= 1 ? 'trash-outline' : 'remove'} label={item.qty <= 1 ? 'Retirer' : 'Diminuer'} onPress={() => (item.qty <= 1 ? onRemove() : onQty(item.qty - 1))} danger={item.qty <= 1} />
          <ThemedText style={styles.qty} accessibilityLabel={`Quantité ${item.qty}`}>
            {item.qty}
          </ThemedText>
          <StepBtn icon="add" label="Augmenter" onPress={() => onQty(item.qty + 1)} disabled={out || item.qty >= max} />
        </View>
        <View style={styles.actions}>
          <Pressable onPress={onSave} disabled={saving} hitSlop={6} style={styles.action} accessibilityRole="button" accessibilityLabel="Mettre de côté dans les favoris">
            {saving ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name="heart-outline" size={18} color={theme.textSecondary} />}
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={6} style={styles.action} accessibilityRole="button" accessibilityLabel={`Retirer ${item.nom} du panier`}>
            <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
        <ThemedText style={styles.line}>{formatPrice(item.prix * item.qty)}</ThemedText>
      </View>
    </View>
  );
}

function StepBtn({ icon, label, onPress, disabled, danger }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={4} style={[styles.stepBtn, disabled && { opacity: 0.3 }]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={17} color={danger ? Brand.danger : theme.text} />
    </Pressable>
  );
}

function Line({ label, value, color, muted }: { label: string; value: string; color?: string; muted?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={[styles.bold, color ? { color } : null, muted && styles.muted]}>{value}</ThemedText>
    </View>
  );
}

function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text: string; children?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIco, { backgroundColor: theme.backgroundSelected }]}>
        <Ionicons name={icon} size={44} color={Brand.primary} />
      </View>
      <ThemedText style={styles.emptyTitle}>{title}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.center2}>
        {text}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  fill: { width: '100%', height: '100%' },
  bold: { fontWeight: '700' },
  muted: { color: '#8A8A8A', fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  center2: { textAlign: 'center' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  scroll: { padding: 16, gap: 14, paddingBottom: 28 },
  emptyScroll: { flexGrow: 1 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  shopHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  shopLogo: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  shopInit: { fontWeight: '800', color: Brand.primary },
  shopFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  item: { padding: 12, gap: 10 },
  itemTop: { flexDirection: 'row', gap: 12 },
  thumb: { width: 84, height: 84, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.6)' },
  pct: { position: 'absolute', top: 4, left: 4, backgroundColor: Brand.danger, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  pctText: { color: '#fff', fontSize: 10, lineHeight: 14, fontWeight: '800' },
  emoji: { fontSize: 34, lineHeight: 42 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  variant: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  unit: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: Brand.primary },
  old: { fontSize: 12, lineHeight: 16, color: '#8A8A8A', textDecorationLine: 'line-through' },
  itemBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 999, paddingHorizontal: 4 },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 26, textAlign: 'center', fontSize: 16, lineHeight: 21, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 4, flex: 1 },
  action: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  line: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  summary: { padding: 16, gap: 10 },
  divider: { height: StyleSheet.hairlineWidth },
  totalLabel: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  totalValue: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: Brand.primary },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  trust: { flexDirection: 'row', gap: 8, marginTop: 2 },
  trustItem: { flex: 1, alignItems: 'center', gap: 4 },
  snack: { position: 'absolute', left: 16, right: 16, bottom: 92, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1F1F1F', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  snackText: { flex: 1, color: '#fff' },
  snackAction: { color: 'rgba(0,0,0,0.12)', fontWeight: '800' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  barTotal: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  checkout: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 22, minHeight: 50 },
  checkoutText: { color: Brand.primaryInk, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingTop: 56, paddingBottom: 28 },
  emptyIco: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 18, minHeight: 46, marginTop: 8 },
  outline: { borderWidth: 1 },
});
