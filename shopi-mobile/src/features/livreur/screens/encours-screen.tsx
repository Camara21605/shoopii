/**
 * Espace livreur › En cours — équivalent mobile de /dashboard/livreur/encours
 * (EnCoursPage.tsx) : mission active (bannière + compte à rebours), étapes de
 * livraison avec heure de validation, informations du client (téléphone,
 * adresse, instructions). Rafraîchi toutes les 30 s, comme le site.
 * « Appeler le client » appelle vraiment (sur le site : simple message), et
 * l'itinéraire s'ouvre dans Google Maps.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { openDirections } from '@/features/location/open-directions';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchEnCours } from '../api';
import { Box, Empty, LivreurScreen } from '../components';
import { ActiveMission } from './overview-screen';

export default function LivreurEnCoursScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.livreur.encours, queryFn: fetchEnCours, refetchInterval: 30_000 });
  const m = q.data;
  const tel = m?.client.telephone?.replace(/[^\d+]/g, '');

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else if (!m) body = <Empty emoji="🛵" title="Aucune mission en cours" text="Acceptez une mission et récupérez le colis : elle apparaîtra ici." />;
  else
    body = (
      <ScrollView {...hideOnScroll} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <ActiveMission m={m} compact />

        <Box icon="git-commit-outline" title="Étapes de livraison">
          {m.steps.map((s, i) => (
            <View key={`${s.role}-${i}`} style={styles.step}>
              <View style={styles.rail}>
                <View style={[styles.node, s.status === 'done' && styles.done, s.status === 'active' && styles.now]}>
                  {s.status === 'done' ? <Ionicons name="checkmark" size={14} color="#fff" /> : s.status === 'active' ? <Ionicons name="location" size={14} color="#fff" /> : null}
                </View>
                {i < m.steps.length - 1 ? <View style={[styles.line, { backgroundColor: s.status === 'done' ? Brand.success : theme.border }]} /> : null}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{s.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {s.sub}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {s.time ?? '—'}
              </ThemedText>
            </View>
          ))}
        </Box>

        <Box icon="person-circle-outline" title="Informations client">
          <View style={styles.client}>
            <View style={[styles.ava, { backgroundColor: theme.background }]}>
              <ThemedText style={styles.avaText}>{m.client.nom.trim().charAt(0).toUpperCase() || '?'}</ThemedText>
            </View>
            <ThemedText style={[styles.bold, styles.flex]}>{m.client.nom}</ThemedText>
          </View>
          <Info icon="call-outline" label="Téléphone" value={m.client.telephone ?? 'Non renseigné'} />
          <Info icon="location-outline" label="Adresse" value={m.client.adresse} />
          {m.client.instructions ? <Info icon="chatbubble-outline" label="Instruction" value={m.client.instructions} /> : null}
          <View style={styles.btns}>
            {tel ? <Btn icon="call" label="Appeler" onPress={() => void Linking.openURL(`tel:${tel}`)} main /> : null}
            {tel ? <Btn icon="logo-whatsapp" label="WhatsApp" onPress={() => void Linking.openURL(`https://wa.me/${tel.replace(/^\+/, '')}`)} /> : null}
            {(m.client.adresse && m.client.adresse !== '—') || m.client.latitude != null ? (
              <Btn icon="navigate-outline" label="Itinéraire"
                onPress={() => openDirections({ lat: m.client.latitude, lng: m.client.longitude, name: `Client · ${m.client.nom}`, address: m.client.adresse !== '—' ? m.client.adresse : null })} />
            ) : null}
          </View>
        </Box>
      </ScrollView>
    );

  return (
    <LivreurScreen title="En cours" subtitle="Votre livraison active" tab="encours">
      {body}
    </LivreurScreen>
  );
}

function Info({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={16} color={Brand.primary} />
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText style={styles.bold}>{value}</ThemedText>
      </View>
    </View>
  );
}

function Btn({ icon, label, onPress, main }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; main?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.btn, main ? styles.btnMain : { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Ionicons name={icon} size={16} color={icon === 'logo-whatsapp' ? '#25D366' : Brand.primary} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 26 },
  node: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' },
  done: { backgroundColor: Brand.success },
  now: { backgroundColor: Brand.primary },
  line: { flex: 1, width: 2, marginVertical: 2, minHeight: 16 },
  client: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ava: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avaText: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  info: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 42 },
  btnMain: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
});
