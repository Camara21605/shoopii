/**
 * Onglet À propos : présentation, chiffres, infos pratiques cliquables,
 * horaires par jour, modes et zones de livraison, livreurs.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openDriver } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

import type { ShopDetail, ShopDriver } from '../api';
import { DAY_LABEL, sortedHours, todayKey } from '../hours';
import { type IconName, Stars, call, place } from './shared';

/* ── À propos ───────────────────────────────────────────────────────── */

const yearsSince = (d?: string | null) => {
  if (!d) return '—';
  const y = Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 86_400_000));
  return y > 0 ? `${y}+` : '< 1';
};

export function AboutTab({ shop, drivers }: { shop: ShopDetail; drivers: ShopDriver[] }) {
  const theme = useTheme();
  const hours = sortedHours(shop.horaires);
  const today = todayKey();
  const address = shop.adresse || place(shop);
  const wa = shop.whatsapp?.replace(/\D/g, '');
  const site = shop.website ? (/^https?:\/\//.test(shop.website) ? shop.website : `https://${shop.website}`) : null;

  const infos: { icon: IconName; title: string; value: string; onPress?: () => void }[] = [
    address ? { icon: 'location-outline' as IconName, title: 'Adresse', value: address } : null,
    shop.businessPhone ? { icon: 'call-outline' as IconName, title: 'Téléphone', value: shop.businessPhone, onPress: () => call(shop.businessPhone) } : null,
    wa ? { icon: 'logo-whatsapp' as IconName, title: 'WhatsApp', value: shop.whatsapp!, onPress: () => void Linking.openURL(`https://wa.me/${wa}`) } : null,
    shop.businessEmail ? { icon: 'mail-outline' as IconName, title: 'E-mail', value: shop.businessEmail, onPress: () => void Linking.openURL(`mailto:${shop.businessEmail}`) } : null,
    site ? { icon: 'globe-outline' as IconName, title: 'Site web', value: shop.website!, onPress: () => void Linking.openURL(site) } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  const lv = shop.livraison;
  const methods = lv
    ? ([
        lv.standard && { icon: 'cube-outline', label: 'Livraison standard par la boutique' },
        lv.livreursShopi && { icon: 'bicycle-outline', label: 'Livreurs Shoneya' },
        lv.correspondants && { icon: 'location-outline', label: 'Retrait en point relais' },
        lv.clickCollect && { icon: 'storefront-outline', label: 'Retrait en boutique (Click & Collect)' },
      ].filter(Boolean) as { icon: IconName; label: string }[])
    : [];

  return (
    <View style={s.gap12}>
      <View style={[s.card, s.pad, { borderColor: theme.border }]}>
        <ThemedText style={s.cardTitle}>À propos de la boutique</ThemedText>
        {shop.description ? <ThemedText style={s.desc}>{shop.description}</ThemedText> : (
          <ThemedText type="small" themeColor="textSecondary">
            La boutique n’a pas encore ajouté de présentation.
          </ThemedText>
        )}
        <View style={s.statGrid}>
          {[
            { v: yearsSince(shop.createdAt), l: 'Années sur Shoneya' },
            { v: shop.totalOrders > 0 ? `${shop.totalOrders}+` : '—', l: 'Commandes' },
            { v: shop.averageRating > 0 ? shop.averageRating.toFixed(1) : '—', l: 'Note moyenne' },
            { v: String(shop.totalAbonnes), l: 'Abonnés' },
          ].map((x) => (
            <View key={x.l} style={[s.statBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={s.statV}>{x.v}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={s.center}>
                {x.l}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {infos.length ? (
        <View style={[s.card, { borderColor: theme.border }]}>
          <ThemedText style={[s.cardTitle, s.pad, s.noPadBottom]}>Infos pratiques</ThemedText>
          {infos.map((r, i) => (
            <Pressable
              key={r.title}
              onPress={r.onPress}
              disabled={!r.onPress}
              style={({ pressed }) => [s.infoRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
              <View style={[s.infoIco, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name={r.icon} size={18} color={Brand.primary} />
              </View>
              <View style={s.flex}>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.title}
                </ThemedText>
                <ThemedText style={r.onPress ? { color: Brand.primary } : undefined}>{r.value}</ThemedText>
              </View>
              {r.onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[s.card, s.pad, { borderColor: theme.border }]}>
        <ThemedText style={s.cardTitle}>Horaires d’ouverture</ThemedText>
        {hours.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Horaires non renseignés.
          </ThemedText>
        ) : (
          hours.map((h) => {
            const isToday = h.jour === today;
            return (
              <View key={h.jour} style={[s.hourRow, isToday && { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={[s.flex, isToday && s.bold]}>
                  {DAY_LABEL[h.jour] ?? h.jour}
                  {isToday ? ' (aujourd’hui)' : ''}
                </ThemedText>
                {h.actif && h.ouverture && h.fermeture ? (
                  <ThemedText style={isToday ? s.bold : undefined}>
                    {h.ouverture} – {h.fermeture}
                  </ThemedText>
                ) : (
                  <ThemedText style={{ color: Brand.danger }}>Fermé</ThemedText>
                )}
              </View>
            );
          })
        )}
      </View>

      {lv ? (
        <View style={[s.card, s.pad, { borderColor: theme.border }]}>
          <ThemedText style={s.cardTitle}>Livraison</ThemedText>
          {methods.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucun mode de livraison renseigné.
            </ThemedText>
          ) : (
            methods.map((m) => (
              <View key={m.label} style={s.row8}>
                <Ionicons name="checkmark-circle" size={18} color={Brand.success} />
                <ThemedText style={s.flex}>{m.label}</ThemedText>
              </View>
            ))
          )}
          <ThemedText type="smallBold" style={s.zonesTitle}>
            Zones desservies
          </ThemedText>
          {lv.zones.length ? (
            <View style={s.tags}>
              {lv.zones.map((z) => (
                <View key={z} style={[s.tag, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={[s.tagText, { color: Brand.primary }]}>{z}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Toutes les zones (aucune restriction).
            </ThemedText>
          )}
        </View>
      ) : null}

      {drivers.length ? (
        <View style={[s.card, s.pad, { borderColor: theme.border }]}>
          <ThemedText style={s.cardTitle}>Livreurs de la boutique</ThemedText>
          {drivers.slice(0, 4).map((d) => (
            <Pressable key={d.id} onPress={() => openDriver(d.id)} style={s.row8} accessibilityRole="button">
              <ThemedText style={s.actorEmoji}>{d.emoji}</ThemedText>
              <ThemedText numberOfLines={1} style={s.flex}>
                {d.fullName}
              </ThemedText>
              <Stars value={d.note} size={11} />
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Voir
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  gap12: { gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  pad: { padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  desc: { fontSize: 15, lineHeight: 22 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { flexBasis: '47%', flexGrow: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statV: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: Brand.primary },
  center: { textAlign: 'center' },
  noPadBottom: { paddingBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  infoIco: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  hourRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  bold: { fontWeight: '700' },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zonesTitle: { marginTop: 6 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  actorEmoji: { fontSize: 24, lineHeight: 30 },
});
