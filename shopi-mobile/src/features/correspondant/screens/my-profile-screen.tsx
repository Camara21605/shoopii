/**
 * Espace correspondant › Mon profil — ouvert par la photo de l'en-tête :
 * le profil PUBLIC du point relais, exactement tel que les boutiques, les
 * livreurs et les clients le voient (GET /client/correspondants/:id), avec
 * « Modifier mon profil » (Paramètres › Profil & identité) et « Partager » (lien public du site,
 * dans l'en-tête du profil). Pas d'appel ni de distance sur son propre profil.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { fetchRelayProfile } from '@/features/livreur-network/api';
import { RelayProfileView } from '@/features/livreur-network/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { CorrespondantScreen } from '../components';
import { useCorrespondantMe } from '../hooks';

export default function CorrespondantMyProfileScreen() {
  const theme = useTheme();
  const snack = useSnack();
  const me = useCorrespondantMe();
  const id = me.data?.id;
  const profile = useQuery({ queryKey: qk.correspondant.profile(id ?? ''), queryFn: () => fetchRelayProfile(id!), enabled: !!id });
  const contact = useActorContact('correspondent');

  const refresh = () => {
    void me.refetch();
    /* refetch() ignore « enabled » : jamais sans l'identifiant du point relais */
    if (id) void profile.refetch();
  };
  /* Retour depuis les Paramètres : le profil public reflète aussitôt les changements */
  useFocusEffect(
    useCallback(() => {
      if (id) void profile.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]),
  );

  let body: React.ReactNode;
  if (me.isPending || (id && profile.isPending)) {
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary">
          Chargement du profil…
        </ThemedText>
      </View>
    );
  } else if (me.isError || profile.isError || !profile.data) {
    body = (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={36} color={theme.textSecondary} />
        <ThemedText style={styles.bold}>Profil introuvable.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {toUserMessage(me.error ?? profile.error)}
        </ThemedText>
        <PrimaryButton title="Réessayer" onPress={refresh} pill />
      </View>
    );
  } else {
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={profile.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={[styles.preview, { borderColor: theme.border }]}>
          <Ionicons name="eye-outline" size={18} color={Brand.primary} />
          <ThemedText type="small" style={styles.flex}>
            <ThemedText type="smallBold">Votre profil public</ThemedText> — tel que les boutiques, les livreurs et les clients le voient.
          </ThemedText>
        </View>
        <Pressable onPress={() => router.push('/correspondant/parametres/profil')} accessibilityRole="button" accessibilityLabel="Modifier mon profil" style={styles.edit}>
          <Ionicons name="create-outline" size={17} color="#fff" />
          <ThemedText style={styles.editText}>Modifier mon profil</ThemedText>
        </Pressable>
        <RelayProfileView p={profile.data} self contact={contact} notify={snack.show} />
      </ScrollView>
    );
  }

  return (
    <CorrespondantScreen title="Mon profil" subtitle="Votre point relais vu par le public" snack={snack.msg}>
      {body}
    </CorrespondantScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  centerText: { textAlign: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  edit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 46, backgroundColor: Brand.primary },
  editText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
