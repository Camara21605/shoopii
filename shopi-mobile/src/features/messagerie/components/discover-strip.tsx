/**
 * En-tête « découverte » de la messagerie — 4 boutons :
 *   🏪 Entreprises proches · 🛵 Livreurs proches · 🟢 En ligne · ▶ Stories
 * Sous les boutons, une bande de photos selon le bouton choisi :
 *   • proches : recherche « autour de moi » (GET /location/map/search, même
 *     service que la carte Localisation), triée du plus proche au plus loin
 *     dans un rayon de 25 km, distance sous chaque photo ; un livreur
 *     disponible a un point vert ;
 *   • en ligne : mes conversations et contacts actuellement en ligne ;
 *   • stories : bouton seul pour l'instant (« bientôt disponible »).
 * Toucher une photo ouvre (ou démarre) la discussion. La position n'est
 * demandée qu'au toucher de « Activer ma position ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { searchMapActors, type MapActorRole } from '@/features/location/api';
import { useMyPosition } from '@/features/location/hooks';
import { useTheme } from '@/hooks/use-theme';

import type { ActorType } from '../api';
import { Avatar } from '../MemberPicker';

/** Une personne de la bande (photo + nom). */
export interface StripPerson {
  key: string;
  type: ActorType;
  id: string;
  name: string;
  logo: string | null;
  online: boolean;
  distanceKm: number | null;
  /** Livreur disponible maintenant */
  available?: boolean;
}

type Tab = 'company' | 'delivery' | 'online' | 'stories';
const NEARBY_RADIUS_KM = 25;
const ROLE_OF: Record<'company' | 'delivery', MapActorRole> = { company: 'vendor', delivery: 'delivery' };

const TABS: { key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'company', label: 'Entreprises', icon: 'storefront' },
  { key: 'delivery', label: 'Livreurs', icon: 'bicycle' },
  { key: 'online', label: 'En ligne', icon: 'ellipse' },
  { key: 'stories', label: 'Stories', icon: 'play-circle' },
];

const distLabel = (km: number) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`);

export function DiscoverStrip({ online, opening, onOpen }: {
  /** Personnes en ligne (conversations + contacts), déjà dédoublonnées */
  online: StripPerson[];
  opening: string | null;
  onOpen: (p: StripPerson) => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<Tab>('company');
  const geo = useMyPosition();
  const pos = geo.position;
  /* Arrondi ~1 km : pas de nouvelle requête à chaque pas */
  const posKey = pos ? `${pos.latitude.toFixed(2)},${pos.longitude.toFixed(2)}` : '';
  const nearbyTab = tab === 'company' || tab === 'delivery' ? tab : null;

  const nearby = useQuery({
    queryKey: ['msg-nearest', nearbyTab, posKey],
    queryFn: ({ signal }) => {
      const [lat, lng] = posKey.split(',').map(Number);
      return searchMapActors({ lat, lng, radiusKm: NEARBY_RADIUS_KM, limit: 20, types: [ROLE_OF[nearbyTab as 'company' | 'delivery']] }, signal);
    },
    enabled: !!posKey && !!nearbyTab,
    staleTime: 120_000,
  });

  const nearbyPeople: StripPerson[] = (nearby.data?.results ?? []).map((a) => {
    const type: ActorType = a.role === 'vendor' ? 'company' : a.role === 'delivery' ? 'delivery' : 'correspondent';
    return { key: `${type}:${a.id}`, type, id: a.id, name: a.name, logo: a.image, online: false, distanceKm: a.distanceKm, available: a.available === true };
  });

  const noPosition = geo.status === 'idle' || geo.status === 'denied' || geo.status === 'unavailable';
  const askPosition = () => void geo.request();

  let body: React.ReactNode;
  if (tab === 'stories') {
    body = (
      <View style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="play-circle" size={22} color={Brand.primary} />
        <View style={styles.flex}>
          <ThemedText style={styles.infoTitle}>Stories — bientôt disponible</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">Les stories de vos contacts et des boutiques apparaîtront ici.</ThemedText>
        </View>
      </View>
    );
  } else if (tab === 'online') {
    body = online.length ? (
      <People people={online} opening={opening} onOpen={onOpen} />
    ) : (
      <Empty text="Personne en ligne parmi vos discussions et contacts pour le moment." />
    );
  } else if (noPosition) {
    body = (
      <Pressable onPress={askPosition} accessibilityRole="button" style={({ pressed }) => [styles.info, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
        <Ionicons name="navigate" size={22} color={Brand.primary} />
        <View style={styles.flex}>
          <ThemedText style={styles.infoTitle}>{geo.status === 'denied' ? 'Position refusée' : 'Activer ma position'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {geo.status === 'denied'
              ? 'Autorisez la localisation dans les réglages du téléphone pour voir qui est près de vous.'
              : `Pour voir ${tab === 'company' ? 'les entreprises' : 'les livreurs'} les plus proches de vous.`}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      </Pressable>
    );
  } else if (!pos || (nearby.isPending && nearby.fetchStatus !== 'idle')) {
    body = (
      <View style={[styles.info, styles.center]}>
        <ActivityIndicator color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary">{pos ? 'Recherche autour de vous…' : 'Localisation en cours…'}</ThemedText>
      </View>
    );
  } else if (nearby.isError) {
    body = (
      <Pressable onPress={() => void nearby.refetch()} accessibilityRole="button" style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="refresh" size={20} color={Brand.primary} />
        <ThemedText type="small" style={styles.flex}>Recherche impossible pour le moment. Toucher pour réessayer.</ThemedText>
      </Pressable>
    );
  } else {
    body = nearbyPeople.length ? (
      <People people={nearbyPeople} opening={opening} onOpen={onOpen} />
    ) : (
      <Empty text={`Aucun${tab === 'company' ? 'e entreprise' : ' livreur'} dans un rayon de ${NEARBY_RADIUS_KM} km.`} />
    );
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          const count = t.key === 'online' && online.length ? online.length : null;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.key === 'company' ? 'Entreprises les plus proches' : t.key === 'delivery' ? 'Livreurs les plus proches' : t.key === 'online' ? 'Mes conversations en ligne' : 'Stories'}
              style={[styles.tab, on ? styles.tabOn : { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name={t.icon} size={t.key === 'online' ? 9 : 15} color={on ? '#fff' : t.key === 'online' ? Brand.success : theme.text} />
              <ThemedText style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</ThemedText>
              {count ? (
                <View style={[styles.count, on && styles.countOn]}>
                  <ThemedText style={[styles.countText, on && styles.countTextOn]}>{count}</ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.body}>{body}</View>
    </View>
  );
}

function People({ people, opening, onOpen }: { people: StripPerson[]; opening: string | null; onOpen: (p: StripPerson) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {people.map((p) => (
        <Pressable
          key={p.key}
          onPress={() => onOpen(p)}
          accessibilityRole="button"
          accessibilityLabel={`Écrire à ${p.name}${p.online ? ', en ligne' : ''}${p.distanceKm != null ? `, à ${distLabel(p.distanceKm)}` : ''}`}
          style={styles.person}>
          <View>
            <Avatar u={{ name: p.name, logo: p.logo, online: p.online || p.available }} size={54} />
            {opening === p.key ? <View style={styles.busy}><ActivityIndicator size="small" color="#fff" /></View> : null}
            {p.distanceKm != null ? (
              <View style={[styles.dist, { borderColor: theme.background }]}>
                <ThemedText style={styles.distText}>{distLabel(p.distanceKm)}</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText numberOfLines={1} style={styles.name}>{p.type === 'company' ? p.name : p.name.split(' ')[0]}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.info}>
      <ThemedText type="small" themeColor="textSecondary">{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  center: { justifyContent: 'center' },
  tabs: { gap: 8, paddingHorizontal: Spacing.three, paddingTop: 4, paddingBottom: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  tabOn: { backgroundColor: Brand.primary },
  tabText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  tabTextOn: { color: '#fff' },
  count: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: Brand.success, alignItems: 'center', justifyContent: 'center' },
  countOn: { backgroundColor: '#fff' },
  countText: { color: '#fff', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  countTextOn: { color: Brand.primary },
  body: { minHeight: 96, justifyContent: 'center' },
  strip: { gap: 14, paddingHorizontal: Spacing.three, paddingVertical: 8 },
  person: { width: 64, alignItems: 'center' },
  name: { fontSize: 12, lineHeight: 16, marginTop: 6, maxWidth: 64, textAlign: 'center' },
  busy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 27, backgroundColor: 'rgba(0,0,0,.35)', alignItems: 'center', justifyContent: 'center' },
  dist: { position: 'absolute', bottom: -6, alignSelf: 'center', backgroundColor: Brand.primary, borderRadius: 8, paddingHorizontal: 5, borderWidth: 1.5 },
  distText: { color: '#fff', fontSize: 9.5, lineHeight: 13, fontWeight: '800' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: Spacing.three, marginVertical: 8, borderRadius: 14, padding: 12 },
  infoTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
});
