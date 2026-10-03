/**
 * Onglet Promotions : cartes colorées par type, conditions, code à copier.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice } from '@/features/catalog/format';

import type { Promo } from '../api';
import { type IconName, Empty } from './shared';

/* ── Promotions ─────────────────────────────────────────────────────── */

const PROMO_TYPES: Record<string, { tag: string; color: string; icon: IconName }> = {
  discount: { tag: 'Réduction', color: '#1F1F1F', icon: 'pricetag' },
  'free-ship': { tag: 'Livraison offerte', color: '#059669', icon: 'bicycle' },
  bundle: { tag: 'Offre groupée', color: '#7C3AED', icon: 'gift' },
  flash: { tag: 'Vente flash', color: '#DC2626', icon: 'flash' },
};

const shortDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function PromosTab({ promos, loading }: { promos: Promo[]; loading: boolean }) {
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (promos.length === 0) return <Empty icon="pricetags-outline" title="Aucune promotion en cours" text="Abonnez-vous pour être prévenu des prochaines offres." />;
  return (
    <View style={s.gap12}>
      <ThemedText type="small" themeColor="textSecondary">
        {promos.length} promotion{promos.length > 1 ? 's' : ''} active{promos.length > 1 ? 's' : ''} · touchez « Copier » puis collez le code au moment de commander.
      </ThemedText>
      {promos.map((p) => {
        const cfg = PROMO_TYPES[p.type] ?? PROMO_TYPES.discount;
        const value =
          p.type === 'free-ship'
            ? 'Offerte'
            : p.valueType === 'percent' && p.valeur
              ? `−${p.valeur}%`
              : p.valueType === 'fixed' && p.valeur
                ? `−${formatPrice(p.valeur)}`
                : cfg.tag;
        const left = p.maxUtilisations ? p.maxUtilisations - p.usesCount : null;
        const cond = [
          p.montantMinimum ? `Dès ${formatPrice(p.montantMinimum)} d’achat` : null,
          p.endDate ? `Jusqu’au ${shortDate(p.endDate)}` : null,
          p.flashStock ? `${p.flashStock} restants` : null,
          left && left > 0 ? `${left} utilisation${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}` : null,
        ].filter(Boolean);
        return (
          <View key={p.id} style={[s.promo, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon} size={90} color="rgba(255,255,255,0.12)" style={s.promoDeco} />
            <View style={s.promoTag}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <ThemedText style={[s.promoTagText, { color: cfg.color }]}>{cfg.tag.toUpperCase()}</ThemedText>
            </View>
            <ThemedText style={s.promoValue}>{value}</ThemedText>
            <ThemedText style={s.promoName}>{p.nom}</ThemedText>
            {cond.length ? <ThemedText style={s.promoCond}>{cond.join(' · ')}</ThemedText> : null}
            <View style={s.promoCodeRow}>
              <View style={s.promoCode}>
                <ThemedText style={s.promoCodeText}>{p.code}</ThemedText>
              </View>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(p.code);
                  Alert.alert('Code copié', `« ${p.code} » est copié. Collez-le au moment de commander.`);
                }}
                style={s.promoCopy}
                accessibilityRole="button">
                <Ionicons name="copy-outline" size={15} color={cfg.color} />
                <ThemedText type="smallBold" style={{ color: cfg.color }}>
                  Copier
                </ThemedText>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  loader: { marginVertical: 40 },
  gap12: { gap: 12 },
  promo: { borderRadius: 16, padding: 16, gap: 4, overflow: 'hidden' },
  promoDeco: { position: 'absolute', right: -10, top: -6 },
  promoTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  promoTagText: { fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.6 },
  promoValue: { color: '#fff', fontSize: 30, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  promoName: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  promoCond: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },
  promoCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  promoCode: { flex: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  promoCodeText: { color: '#fff', fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace' },
  promoCopy: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, minHeight: 40 },
});
