/**
 * Profil public d'un livreur — s'ouvre depuis l'accueil (rangée « Livreurs »), l'onglet
 * Livreurs, une boutique, mes abonnements ou « Mes livreurs » (entreprise).
 * Équivalent natif de la page /livreurs/:id du site (auparavant ouverte dans le navigateur) :
 *   · photo (point vert si disponible), nom, véhicule, lieu (+ distance pour un compte
 *     connecté), disponible / hors ligne, pastilles (identité vérifiée, assuré, note) ;
 *   · chiffres clés réels (livraisons, note, abonnés, expérience) ;
 *   · onglets Infos, Véhicule, Zones, Tarifs (frais réels de la zone, ceux du panier), Avis,
 *     Historique — pas de Localisation en direct, comme le site ;
 *   · barre d'actions fixe : « Appeler » et « Contacter » RÉSERVÉS aux abonnés (masqués
 *     sinon, et le serveur ne donne alors pas le numéro), « S'abonner » (visiteur → fenêtre
 *     de connexion ; réservé aux clients).
 * Mon propre profil (compte livreur) : ni abonnement, ni message, ni appel — un rappel
 * « c'est votre profil, tel que le voient les clients ».
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
import { DriverProfileView, ProfileFrame } from '@/features/livreur-network/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchDriverProfile, fetchMyDriverSettings } from '../api';

export default function DriverPublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const snack = useSnack();
  const isDriver = useSession((s) => s.user?.role === 'delivery');
  const q = useQuery({ queryKey: qk.driverPublic(id), queryFn: () => fetchDriverProfile(id), enabled: !!id });
  const mine = useQuery({ queryKey: qk.livreur.settings, queryFn: fetchMyDriverSettings, enabled: isDriver, staleTime: 5 * 60_000 });
  const follow = useToggleFollow('livreurs');
  const contact = useActorContact('delivery');
  const p = q.data;
  const self = !!p && isDriver && mine.data?.id === p.id;

  const bar = !p ? null : self ? (
    <View style={[styles.selfNote, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="eye-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        C’est votre profil, tel que le voient les clients.
      </ThemedText>
    </View>
  ) : (
    <>
      {p.isSuivi ? (
        <>
          <Pressable
            onPress={() => requireAuth(() => void contact.call(p.id, p.fullName))}
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
      <View style={p.isSuivi ? styles.followSmall : styles.followWide}>
        <FollowButton followed={p.isSuivi} loading={follow.pending === p.id} onPress={() => follow.toggle(p.id)} compact />
      </View>
    </>
  );

  return (
    <ProfileFrame
      title={p?.fullName || 'Livreur'}
      loading={q.isPending}
      error={q.error}
      notFound="Livreur introuvable."
      onRetry={() => void q.refetch()}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      bar={bar}
      snack={snack.msg}>
      {p ? <DriverProfileView p={p} self={self} showLocation={false} contact={contact} notify={snack.show} /> : null}
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
