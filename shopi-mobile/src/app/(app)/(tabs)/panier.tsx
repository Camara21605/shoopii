/**
 * Onglet Panier — le VRAI panier du compte (GET /client/panier), le même
 * que sur le site. Lecture seule pour l'instant : la commande se termine
 * sur le site (adresse, mode de livraison, paiement) en attendant l'écran
 * de commande natif.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { cartCount, useCart } from '@/features/cart/api';
import { formatPrice, thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const SITE = 'https://www.shoneya.com';

export default function CartScreen() {
  const theme = useTheme();
  const role = useSession((s) => s.user?.role);
  const cart = useCart();
  const items = cart.data ?? [];
  const total = items.reduce((s, i) => s + i.prix * i.qty, 0);

  const header = <ThemedText style={styles.title}>Panier</ThemedText>;

  if (role && role !== 'client') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
        {header}
        <Empty icon="cart-outline" text="Le panier est réservé aux comptes clients." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      {header}
      {cart.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={Brand.primary} />
        </View>
      ) : cart.error ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary">{toUserMessage(cart.error)}</ThemedText>
          <Pressable onPress={() => void cart.refetch()} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réessayer
            </ThemedText>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Empty icon="cart-outline" text="Votre panier est vide. Ajoutez des produits depuis l’accueil." />
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={cart.isRefetching} onRefresh={() => void cart.refetch()} colors={[Brand.primary]} />}
            renderItem={({ item }) => (
              <View style={[styles.item, { borderColor: theme.border }]}>
                <View style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}>
                  {item.imageUrl ? (
                    <Image source={{ uri: thumb(item.imageUrl, 160) }} style={styles.fill} contentFit="cover" />
                  ) : (
                    <ThemedText style={styles.emoji}>{item.emoji || '📦'}</ThemedText>
                  )}
                </View>
                <View style={styles.info}>
                  <ThemedText numberOfLines={2} style={styles.name}>
                    {item.nom}
                  </ThemedText>
                  {item.shopNom ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {item.shopNom}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    Quantité : {item.qty}
                  </ThemedText>
                </View>
                <ThemedText style={styles.price}>{formatPrice(item.prix * item.qty)}</ThemedText>
              </View>
            )}
          />
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <View style={styles.totalRow}>
              <ThemedText themeColor="textSecondary">Total ({cartCount(items)} articles)</ThemedText>
              <ThemedText style={styles.total}>{formatPrice(total)}</ThemedText>
            </View>
            <PrimaryButton pill title="Commander" onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/commande`)} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              La commande se termine sur shoneya.com en attendant sa version dans l’application.
            </ThemedText>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Empty({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={theme.textSecondary} />
      <ThemedText themeColor="textSecondary" style={styles.note}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  list: { padding: Spacing.three, gap: Spacing.two },
  item: { flexDirection: 'row', gap: Spacing.three, alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 10 },
  thumb: { width: 64, height: 64, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28, lineHeight: 34 },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  price: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  note: { textAlign: 'center' },
});
