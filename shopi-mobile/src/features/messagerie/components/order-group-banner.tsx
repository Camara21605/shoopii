/**
 * Bandeau d'un GROUPE DE LIVRAISON (créé automatiquement à chaque commande,
 * avec le client, la boutique, le livreur et le point relais) — en haut de
 * la discussion, comme l'en-tête du site :
 *   📦 Commande CMD-… · Boutique      [En cours | Livrée | Annulée | Archivé]
 *   « Fermeture le … » une fois livrée (le groupe se ferme 72 h après)
 *   [Suivre la commande] → l'écran de MON rôle (suivi client, détail boutique,
 *   mission livreur, colis du point relais) ; le serveur vérifie l'accès.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { closesOn, orderGroupStatus, orderRouteFor, type Group } from '../groups-api';

export function OrderGroupBanner({ group }: { group: Group }) {
  const theme = useTheme();
  const st = orderGroupStatus(group);
  const route = orderRouteFor(group.myRole, group.commandeId);
  const closes = group.status === 'completed' ? closesOn(group.expiresAt) : null;

  return (
    <View style={[styles.wrap, { borderBottomColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={styles.icon}><Ionicons name="cube" size={18} color="#D97706" /></View>
      <View style={styles.flex}>
        <View style={styles.line}>
          <ThemedText numberOfLines={1} style={styles.title}>Commande {group.commandeNumero ?? ''}</ThemedText>
          <View style={[styles.pill, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={11} color={st.color} />
            <ThemedText style={[styles.pillText, { color: st.color }]}>{st.label}</ThemedText>
          </View>
        </View>
        <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
          {closes
            ? `Livrée · le groupe se ferme le ${closes}`
            : group.status === 'cancelled'
              ? 'Commande annulée — lecture seule'
              : [group.companyName, `${group.memberCount} membres`].filter(Boolean).join(' · ')}
        </ThemedText>
      </View>
      {route ? (
        <Pressable onPress={() => router.push(route)} accessibilityRole="button" accessibilityLabel="Suivre la commande"
          style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
          <ThemedText style={styles.btnText}>Suivre</ThemedText>
          <Ionicons name="chevron-forward" size={14} color={Brand.primaryInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.three, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FFF4E5', alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingLeft: 12, paddingRight: 8, paddingVertical: 6 },
  btnText: { color: Brand.primaryInk, fontSize: 13, lineHeight: 17, fontWeight: '800' },
});
