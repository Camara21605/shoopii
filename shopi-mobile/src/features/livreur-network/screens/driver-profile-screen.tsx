/**
 * Espace livreur › Réseau › Profil d'un livreur — équivalent mobile de
 * ProfilLivreurReseauPage (profil public profil-livreur du site) :
 *   · en-tête : photo ou initiales (point vert si disponible), nom, « Livreur ·
 *     véhicule », zone (+ distance), disponible / hors ligne, abonnés, pastilles
 *     (identité vérifiée, assuré Shoneya, note — absente si masquée) ;
 *   · « Appeler » et « Message » RÉSERVÉS aux abonnés (masqués sinon, comme le
 *     site) — vraie discussion / vrai appel dans l'application ;
 *   · 6 chiffres clés ; onglets Infos, Véhicule, Zones, Localisation (position en
 *     temps réel si partagée), Tarifs, Avis, Historique (ces deux derniers : pas
 *     encore de données publiques côté serveur, état vide comme le site) ;
 *   · contact (copier / appeler / WhatsApp) et statistiques.
 * Mon propre profil : pas d'abonnement ni de message, lien vers mes paramètres.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { qk } from '@/lib/query-keys';

import { fetchDriverProfile } from '../api';
import { DriverProfileView } from '../components/driver-profile-view';
import { ProfileFrame } from '../components/profile-frame';
import { FollowControl } from '../components/ui';
import { useFollowActions, useMyLivreurId } from '../hooks';

export default function DriverProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snack = useSnack();
  const me = useMyLivreurId();
  const q = useQuery({ queryKey: qk.livreur.driver(id), queryFn: () => fetchDriverProfile(id), enabled: !!id });
  const actions = useFollowActions('livreurs', snack.show);
  const contact = useActorContact('delivery');
  const p = q.data;
  const self = !!p && p.id === me;

  const bar = p ? (
    self ? (
      <Pressable onPress={() => router.push('/livreur/parametres/profil')} accessibilityRole="button" accessibilityLabel="Modifier mon profil" style={[styles.barBtn, styles.barMain]}>
        <Ionicons name="create-outline" size={17} color="#fff" />
        <ThemedText style={styles.barMainText}>Modifier mon profil</ThemedText>
      </Pressable>
    ) : (
      <>
        {p.isSuivi ? (
          <Pressable onPress={() => void contact.message(p.id)} disabled={!!contact.busy} accessibilityRole="button" accessibilityLabel="Contacter" style={[styles.barBtn, styles.barMain]}>
            {contact.busy === `msg:${p.id}` ? <ActivityIndicator color="#fff" /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />}
            <ThemedText style={styles.barMainText}>Contacter</ThemedText>
          </Pressable>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Abonnez-vous à ce livreur pour lui envoyer un message ou l’appeler.
          </ThemedText>
        )}
        <FollowControl
          name={p.fullName}
          kindLabel="ce livreur"
          suivi={p.isSuivi}
          busy={actions.busy === p.id}
          onToggle={() => actions.toggle(p.id, p.fullName)}
          onHide={() => actions.hide(p.id)}
          large
        />
      </>
    )
  ) : null;

  return (
    <ProfileFrame
      title={p?.fullName || 'Profil du livreur'}
      loading={q.isPending}
      error={q.error}
      notFound="Livreur introuvable."
      onRetry={() => void q.refetch()}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      bar={bar}
      snack={snack.msg}>
      {p ? <DriverProfileView p={p} self={self} onCall={() => void contact.call(p.id, p.fullName)} calling={contact.busy === `call:${p.id}`} contact={contact} notify={snack.show} /> : null}
    </ProfileFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, paddingHorizontal: 18 },
  barMain: { flex: 1, backgroundColor: Brand.primary },
  barMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
