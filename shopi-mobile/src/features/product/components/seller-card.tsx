/**
 * Carte vendeur : logo, Vérifié, note, abonnés, ventes, S'abonner, Message, Boutique.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import type { ProductDetail } from '../api';

/* ── Carte vendeur ──────────────────────────────────────────────────── */

export function SellerCard({
  product,
  followers,
  rating,
  sales,
  followed,
  onShop,
  onMessage,
  onFollow,
  messaging,
  following,
}: {
  product: ProductDetail;
  followers?: number;
  rating?: number;
  sales?: number;
  followed: boolean;
  onShop: () => void;
  onMessage: () => void;
  onFollow: () => void;
  messaging: boolean;
  following: boolean;
}) {
  const theme = useTheme();
  const logo = thumb(product.companyLogo, 160);
  return (
    <View style={[styles.card, styles.pad, { borderColor: theme.border }]}>
      <ThemedText style={styles.kick}>VENDU PAR</ThemedText>
      <Pressable onPress={onShop} style={styles.row12} accessibilityRole="button" accessibilityLabel={`Voir la boutique ${product.companyName}`}>
        <View style={[styles.sellerLogo, { backgroundColor: theme.backgroundSelected }]}>
          {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.sellerInit}>{initials(product.companyName || 'B')}</ThemedText>}
        </View>
        <View style={styles.flex}>
          <View style={styles.row6}>
            <ThemedText numberOfLines={1} style={[styles.sellerName, styles.shrink]}>
              {product.companyName || 'Boutique'}
            </ThemedText>
            {product.companyVerified ? <Ionicons name="checkmark-circle" size={16} color={Brand.primary} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {product.companyVerified ? 'Boutique vérifiée Shoneya · ' : ''}
            {product.companyPays === 'GN' ? '🇬🇳 Guinée' : product.companyPays}
            {product.companyVille ? ` · ${product.companyVille}` : ''}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>
      <View style={[styles.sellerStats, { backgroundColor: theme.backgroundElement }]}>
        {[
          { v: rating && rating > 0 ? rating.toFixed(1) : '—', l: 'Note' },
          { v: followers != null ? String(followers) : '—', l: 'Abonnés' },
          { v: sales && sales > 0 ? `${sales}+` : '—', l: 'Ventes' },
        ].map((s) => (
          <View key={s.l} style={styles.sellerStat}>
            <ThemedText style={styles.sellerStatV}>{s.v}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s.l}
            </ThemedText>
          </View>
        ))}
      </View>
      <View style={styles.row8}>
        <Pressable onPress={onFollow} disabled={following} style={[styles.sellerBtn, followed ? { backgroundColor: theme.backgroundSelected } : { backgroundColor: Brand.primary }]} accessibilityRole="button">
          <Ionicons name={followed ? 'checkmark' : 'add'} size={17} color={followed ? Brand.primary : '#fff'} />
          <ThemedText type="smallBold" style={{ color: followed ? Brand.primary : '#fff' }}>
            {followed ? 'Abonné' : 'S’abonner'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onMessage} disabled={messaging} style={[styles.sellerBtn, styles.sellerOutline, { borderColor: theme.border }]} accessibilityRole="button">
          <Ionicons name="chatbubble-ellipses-outline" size={17} color={theme.text} />
          <ThemedText type="smallBold">{messaging ? '…' : 'Message'}</ThemedText>
        </Pressable>
        <Pressable onPress={onShop} style={[styles.sellerBtn, styles.sellerOutline, { borderColor: theme.border }]} accessibilityRole="button">
          <Ionicons name="storefront-outline" size={17} color={theme.text} />
          <ThemedText type="smallBold">Boutique</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  pad: { padding: 14, gap: 12 },
  kick: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 1.2, color: Brand.primary },
  row12: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerLogo: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  sellerInit: { fontWeight: '900', fontSize: 18, lineHeight: 23, color: Brand.primary },
  flex: { flex: 1 },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sellerName: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  shrink: { flexShrink: 1 },
  sellerStats: { flexDirection: 'row', borderRadius: 12, paddingVertical: 10 },
  sellerStat: { flex: 1, alignItems: 'center' },
  sellerStatV: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sellerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 999, minHeight: 42 },
  sellerOutline: { borderWidth: 1 },
});
