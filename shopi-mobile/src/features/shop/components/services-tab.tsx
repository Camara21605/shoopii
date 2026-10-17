/**
 * Onglet Services (boutique de services) : prix ou « sur devis », modalités, durée.
 */
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { formatPrice, thumb } from '@/features/catalog/format';
import { openService } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

import type { ShopService } from '../api';
import { Empty } from './shared';

/* ── Services ───────────────────────────────────────────────────────── */

const duration = (min?: number | null, max?: number | null) => {
  const f = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
  if (min && max && max !== min) return `${f(min)} – ${f(max)}`;
  return min ? f(min) : max ? f(max) : null;
};

export function ServicesTab({ services, loading }: { services: ShopService[]; loading: boolean }) {
  const theme = useTheme();
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (services.length === 0) return <Empty icon="construct-outline" title="Aucun service pour le moment" text="Cette entreprise n’a encore publié aucun service." />;
  return (
    <View style={s.gap12}>
      {services.map((sv) => {
        const img = thumb([...sv.media].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((m) => (m.type ?? 'image') === 'image')?.url, 300);
        const price =
          sv.pricingType === 'sur_devis' ? 'Sur devis' : sv.prix != null ? `${formatPrice(sv.prix)}${sv.pricingType === 'horaire' ? ' / heure' : ''}` : '';
        const modes = [sv.surPlaceEntreprise && 'Sur place', sv.aDomicile && 'À domicile', sv.aDistance && 'À distance'].filter(Boolean) as string[];
        const d = duration(sv.dureeMinMinutes, sv.dureeMaxMinutes);
        return (
          <Pressable
            key={sv.id}
            onPress={() => openService(sv.id)}
            accessibilityRole="button"
            style={({ pressed }) => [s.svc, { borderColor: theme.border }, pressed && s.pressed]}>
            <View style={[s.svcImg, { backgroundColor: theme.backgroundElement }]}>
              {img ? <Image source={{ uri: img }} style={s.fill} contentFit="cover" /> : <ThemedText style={s.pEmoji}>{sv.category?.icone || '🛠️'}</ThemedText>}
            </View>
            <View style={s.flex}>
              {sv.category?.nom ? (
                <ThemedText numberOfLines={1} themeColor="textSecondary" style={s.pCat}>
                  {sv.category.nom}
                </ThemedText>
              ) : null}
              <ThemedText numberOfLines={2} style={s.pName}>
                {sv.nom}
              </ThemedText>
              {price ? <ThemedText style={s.pPrice}>{price}</ThemedText> : null}
              <View style={s.tags}>
                {modes.map((m) => (
                  <View key={m} style={[s.tag, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText style={[s.tagText, { color: Brand.primary }]}>{m}</ThemedText>
                  </View>
                ))}
                {d ? (
                  <View style={[s.tag, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={s.tagText}>⏱ {d}</ThemedText>
                  </View>
                ) : null}
                {sv.reservationRequise ? (
                  <View style={[s.tag, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={s.tagText}>Sur réservation</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  loader: { marginVertical: 40 },
  gap12: { gap: 12 },
  svc: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  pressed: { opacity: 0.7 },
  svcImg: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  pEmoji: { fontSize: 38, lineHeight: 46 },
  flex: { flex: 1 },
  pCat: { fontSize: 10, lineHeight: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
  pName: { fontSize: 12.5, lineHeight: 16, fontWeight: '600', minHeight: 32 },
  pPrice: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: Brand.primary, flexShrink: 0 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
