/**
 * Profil public d'un point relais — s'ouvre depuis l'accueil (rangée « Points
 * relais »), la liste des points relais, une boutique ou mes abonnements.
 * Équivalent mobile de la page /correspondants/:id du site :
 *   · couverture, photo (point vert si en ligne), nom, type, lieu (+ distance
 *     pour un compte connecté), en ligne, membre depuis, abonnés, badges ;
 *     « Partager » ;
 *   · 8 chiffres clés (statistiques masquées par le correspondant → « — ») ;
 *   · onglets Infos (à propos, informations pratiques, horaires de la semaine),
 *     Services, Zones, Tarifs, Avis, Galerie (pas encore de données publiques
 *     côté serveur : mêmes états vides que le site) ;
 *   · contacts détaillés (copier, appeler, écrire), statistiques, abonnés,
 *     vérifications Shoneya ;
 *   · barre d'actions fixe, comme la barre mobile du site : « Appeler » et
 *     « Contacter » RÉSERVÉS aux abonnés (masqués sinon), « S'abonner »
 *     (visiteur → fenêtre de connexion ; réservé aux clients).
 * Mon propre profil (compte correspondant) : ni abonnement, ni message, ni
 * appel — un rappel « c'est votre profil, tel que le voient les clients ».
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { FollowButton } from '@/components/catalog';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { requireAuth } from '@/features/auth/auth-gate';
import { useSession } from '@/features/auth/session-store';
import { useToggleFollow } from '@/features/catalog/follow';
import { useActorContact } from '@/features/company-drivers/components';
import { ProfileFrame, RelayProfileView } from '@/features/livreur-network/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchMyRelayId, fetchRelayProfile } from '../api';

export default function RelayPublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const snack = useSnack();
  const signedIn = useSession((s) => s.status === 'signedIn' && !!s.user);
  const isRelay = useSession((s) => s.user?.role === 'correspondent');
  const q = useQuery({ queryKey: qk.relayPublic(id), queryFn: () => fetchRelayProfile(id), enabled: !!id });
  const mine = useQuery({ queryKey: qk.myRelayId, queryFn: fetchMyRelayId, enabled: isRelay, staleTime: 10 * 60_000 });
  const follow = useToggleFollow('correspondants');
  const contact = useActorContact('correspondent');
  const p = q.data;
  const self = !!p && isRelay && mine.data === p.id;

  const bar = !p ? null : self ? (
    <View style={[styles.selfNote, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="eye-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        C’est votre profil, tel que le voient les clients.
      </ThemedText>
    </View>
  ) : (
    <>
      {p.suivi ? (
        <>
          <Pressable
            onPress={() => requireAuth(() => void contact.call(p.id, p.nom))}
            disabled={!!contact.busy}
            accessibilityRole="button"
            accessibilityLabel="Appeler dans l’application"
            style={[styles.barBtn, { borderColor: theme.border }]}>
            {contact.busy === `call:${p.id}` ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="call-outline" size={17} color={Brand.primary} />}
            <ThemedText style={styles.barText}>Appeler</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => requireAuth(() => void contact.message(p.id))}
            disabled={!!contact.busy}
            accessibilityRole="button"
            accessibilityLabel="Contacter"
            style={[styles.barBtn, { borderColor: theme.border }]}>
            {contact.busy === `msg:${p.id}` ? <ActivityIndicator color={Brand.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color={Brand.primary} />}
            <ThemedText style={styles.barText}>Contacter</ThemedText>
          </Pressable>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          Abonnez-vous pour pouvoir l’appeler ou lui écrire.
        </ThemedText>
      )}
      <View style={p.suivi ? styles.followSmall : styles.followWide}>
        <FollowButton followed={p.suivi} loading={follow.pending === p.id} onPress={() => follow.toggle(p.id)} compact />
      </View>
    </>
  );

  return (
    <ProfileFrame
      title={p?.nom || 'Point relais'}
      loading={q.isPending}
      error={q.error}
      notFound="Point relais introuvable."
      onRetry={() => void q.refetch()}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      bar={bar}
      snack={snack.msg}>
      {p ? <RelayProfileView p={p} self={self} cover showDistance={signedIn && !self} contact={contact} notify={snack.show} /> : null}
    </ProfileFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, minHeight: 44 },
  barText: { fontSize: 14, lineHeight: 19, fontWeight: '800', color: Brand.primary },
  followSmall: { flex: 1, marginTop: -6 },
  followWide: { width: 140, marginTop: -6 },
  selfNote: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
});
