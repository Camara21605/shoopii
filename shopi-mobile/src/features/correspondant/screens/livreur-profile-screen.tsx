/**
 * Espace correspondant › Livreurs › Profil d'un livreur — son profil public
 * (GET /client/livreurs/:id, le même que voient boutiques et clients), avec
 * « Message » (vraie discussion) et l'appel dans l'application.
 * Contenu partagé avec le réseau du livreur (features/livreur-network).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { fetchDriverProfile } from '@/features/livreur-network/api';
import { DriverProfileView, ProfileFrame } from '@/features/livreur-network/components';
import { qk } from '@/lib/query-keys';

export default function CorrespondantLivreurProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.correspondant.profile(`livreur:${id}`), queryFn: () => fetchDriverProfile(id), enabled: !!id });
  const contact = useActorContact('delivery');
  const p = q.data;

  const bar = p ? (
    <Pressable onPress={() => void contact.message(p.id)} disabled={!!contact.busy} accessibilityRole="button" accessibilityLabel="Message" style={styles.barMain}>
      {contact.busy === `msg:${p.id}` ? <ActivityIndicator color="#fff" /> : <Ionicons name="chatbubble-ellipses-outline" size={17} color="#fff" />}
      <ThemedText style={styles.barMainText}>Message</ThemedText>
    </Pressable>
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
      {p ? <DriverProfileView p={p} self={false} onCall={() => void contact.call(p.id, p.fullName)} calling={contact.busy === `call:${p.id}`} contact={contact} notify={snack.show} /> : null}
    </ProfileFrame>
  );
}

const styles = StyleSheet.create({
  barMain: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, paddingHorizontal: 18, backgroundColor: Brand.primary },
  barMainText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
