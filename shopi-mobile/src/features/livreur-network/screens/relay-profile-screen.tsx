/**
 * Espace livreur › Réseau › Profil d'un correspondant — équivalent mobile de
 * ProfilCorrespondantReseauPage (profil public profil-correspondant du site) :
 *   · en-tête : initiales (point vert si en ligne), nom, type, localisation
 *     (+ distance), en ligne, membre depuis, abonnés, badges (identité vérifiée,
 *     assuré, top, premium) ; « Partager » (lien du profil public) ;
 *   · « Appeler » et « Message » RÉSERVÉS aux abonnés (masqués sinon, comme le
 *     site) — vraie discussion / vrai appel dans l'application ;
 *   · 8 chiffres clés ; onglets Infos (à propos, infos pratiques, horaires),
 *     Services, Zones, Tarifs, Avis, Galerie (sans données publiques côté
 *     serveur pour l'instant : mêmes états vides que le site) ;
 *   · contacts détaillés (copier, appeler, écrire), statistiques, abonnés,
 *     vérifications Shoneya.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { qk } from '@/lib/query-keys';

import { fetchRelayProfile } from '../api';
import { ProfileFrame } from '../components/profile-frame';
import { RelayProfileView } from '../components/relay-profile-view';
import { FollowControl } from '../components/ui';
import { useFollowActions } from '../hooks';

export default function RelayProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.livreur.relay(id), queryFn: () => fetchRelayProfile(id), enabled: !!id });
  const actions = useFollowActions('correspondants', snack.show);
  const contact = useActorContact('correspondent');
  const p = q.data;

  const bar = p ? (
    <>
      {p.suivi ? (
        <Pressable onPress={() => void contact.message(p.id)} disabled={!!contact.busy} accessibilityRole="button" accessibilityLabel="Message" style={styles.barMain}>
          {contact.busy === `msg:${p.id}` ? <ActivityIndicator color="#fff" /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />}
          <ThemedText style={styles.barMainText}>Message</ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          Abonnez-vous à ce correspondant pour lui envoyer un message ou l’appeler.
        </ThemedText>
      )}
      <FollowControl name={p.nom} kindLabel="ce correspondant" suivi={p.suivi} busy={actions.busy === p.id} onToggle={() => actions.toggle(p.id, p.nom)} onHide={() => actions.hide(p.id)} large />
    </>
  ) : null;

  return (
    <ProfileFrame
      title={p?.nom || 'Profil du correspondant'}
      loading={q.isPending}
      error={q.error}
      notFound="Correspondant introuvable."
      onRetry={() => void q.refetch()}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      bar={bar}
      snack={snack.msg}>
      {p ? <RelayProfileView p={p} contact={contact} notify={snack.show} /> : null}
    </ProfileFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, paddingHorizontal: 18, backgroundColor: Brand.primary },
  barMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
