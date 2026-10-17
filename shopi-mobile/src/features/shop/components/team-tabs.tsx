/**
 * Onglets Livreurs et Points relais de la boutique (disponibilité, note, abonnement).
 * « Appeler » un point relais = appel audio dans Shoneya (messagerie), comme
 * sur sa fiche publique — pas d'appel téléphonique.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { requireAuth } from '@/features/auth/auth-gate';
import { openDriver, openRelay } from '@/features/catalog/open';
import { useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';

import type { ShopDriver, ShopRelay } from '../api';
import { Stars, Empty, FollowPill, place } from './shared';

/* ── Livreurs et points relais ──────────────────────────────────────── */

const AVAIL: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: Brand.success },
  on_delivery: { label: 'En course', color: '#D97706' },
};

export function DriversTab({
  drivers,
  loading,
  follows,
  pending,
  onFollow,
  selfId,
}: {
  drivers: ShopDriver[];
  loading: boolean;
  follows: Record<string, boolean>;
  pending?: string;
  /** Absent = ma propre boutique (pas d'abonnement à mes livreurs / points relais). */
  onFollow?: (id: string) => void;
  /** Mon profil livreur : pas de bouton « S'abonner » sur moi-même. */
  selfId?: string;
}) {
  const theme = useTheme();
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (drivers.length === 0) return <Empty icon="bicycle-outline" title="Aucun livreur associé" text="Cette boutique n’a pas encore de livreur attitré." />;
  return (
    <View style={[s.card, { borderColor: theme.border }]}>
      {drivers.map((d, i) => {
        const av = AVAIL[d.availability] ?? { label: 'Hors ligne', color: '#A3A3A3' };
        const where = place(d);
        return (
          <View key={d.id} style={[s.actor, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <Pressable onPress={() => openDriver(d.id)} style={s.actorTap} accessibilityRole="button" accessibilityLabel={d.fullName}>
              <View style={[s.actorAva, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={s.actorEmoji}>{d.emoji}</ThemedText>
                <View style={[s.dot, { backgroundColor: av.color, borderColor: theme.background }]} />
              </View>
              <View style={s.flex}>
                <ThemedText numberOfLines={1} style={s.actorName}>
                  {d.fullName}
                </ThemedText>
                <ThemedText type="small" style={{ color: av.color }}>
                  ● {av.label}
                </ThemedText>
                {where ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    📍 {where}
                  </ThemedText>
                ) : null}
                <View style={s.row6}>
                  <Stars value={d.note} size={11} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {d.note > 0 ? d.note.toFixed(1) : '—'} · {d.trips} livraison{d.trips > 1 ? 's' : ''}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
            {onFollow && d.id !== selfId ? <FollowPill followed={!!follows[d.id]} loading={pending === d.id} onPress={() => onFollow(d.id)} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function RelaysTab({
  relays,
  loading,
  follows,
  pending,
  onFollow,
  selfId,
}: {
  relays: ShopRelay[];
  loading: boolean;
  follows: Record<string, boolean>;
  pending?: string;
  /** Absent = ma propre boutique (pas d'abonnement à mes livreurs / points relais). */
  onFollow?: (id: string) => void;
  /** Mon profil point relais : pas de bouton « S'abonner » sur moi-même. */
  selfId?: string;
}) {
  const theme = useTheme();
  const contact = useActorContact('correspondent');
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (relays.length === 0) return <Empty icon="location-outline" title="Aucun point relais associé" text="Cette boutique n’a pas encore de point relais partenaire." />;
  return (
    <View style={s.gap12}>
      {relays.map((c) => {
        const where = place(c);
        return (
          <View key={c.id} style={[s.relay, { borderColor: theme.border }]}>
            <Pressable onPress={() => openRelay(c.id)} style={s.actorTap} accessibilityRole="button" accessibilityLabel={c.fullName}>
              <View style={[s.actorAva, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={s.actorInit}>{initials(c.fullName)}</ThemedText>
              </View>
              <View style={s.flex}>
                <View style={s.row6}>
                  <ThemedText numberOfLines={1} style={[s.actorName, s.shrink]}>
                    {c.fullName}
                  </ThemedText>
                  {c.verified ? <Ionicons name="checkmark-circle" size={15} color={Brand.primary} /> : null}
                </View>
                {where ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    📍 {where}
                  </ThemedText>
                ) : null}
                <View style={s.row6}>
                  <Stars value={c.note} size={11} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {c.note > 0 ? c.note.toFixed(1) : '—'} · {c.missions} mission{c.missions > 1 ? 's' : ''}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
            {c.bio ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                {c.bio}
              </ThemedText>
            ) : null}
            <View style={s.tags}>
              <View style={[s.tag, { backgroundColor: c.horaireAujourdhui ? '#E7F6EE' : '#FDECEC' }]}>
                <ThemedText style={[s.tagText, { color: c.horaireAujourdhui ? Brand.success : Brand.danger }]}>
                  {c.horaireAujourdhui ? `Ouvert aujourd’hui · ${c.horaireAujourdhui}` : 'Fermé aujourd’hui'}
                </ThemedText>
              </View>
              {c.langues.map((l) => (
                <View key={l} style={[s.tag, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={s.tagText}>🗣 {l}</ThemedText>
                </View>
              ))}
            </View>
            <View style={s.row8}>
              {onFollow && c.id !== selfId ? <FollowPill followed={!!follows[c.id]} loading={pending === c.id} onPress={() => onFollow(c.id)} /> : null}
              <Pressable
                onPress={() => requireAuth(() => void contact.call(c.id, c.fullName), 'Connectez-vous pour appeler ce point relais depuis Shoneya.')}
                disabled={!!contact.busy}
                style={[s.outlineBtn, { borderColor: theme.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Appeler ${c.fullName} dans Shoneya`}>
                {contact.busy === `call:${c.id}` ? <ActivityIndicator size="small" color={theme.text} /> : <Ionicons name="call-outline" size={15} color={theme.text} />}
                <ThemedText type="smallBold">Appeler</ThemedText>
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
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  actor: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  actorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actorAva: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actorEmoji: { fontSize: 24, lineHeight: 30 },
  dot: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  flex: { flex: 1 },
  actorName: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gap12: { gap: 12 },
  relay: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  actorInit: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: Brand.primary },
  shrink: { flexShrink: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 },
});
