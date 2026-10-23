/**
 * Espace correspondant › Clients — équivalent mobile de ClientsPage du site
 * (GET /dashboard/correspondant/clients) : les clients dont au moins une
 * commande est passée par ce point relais.
 *   · par client : téléphone, nombre de colis, dernier colis, valeur totale,
 *     état du dernier colis (en cours, livré, retour) ;
 *   · filtres par état, recherche (nom, téléphone) ;
 *   · écrire au client (vraie discussion), l'appeler, WhatsApp.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ErrorState } from '@/components/catalog';
import { AvatarPhoto } from '@/components/avatar-photo';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { CLIENT_STATUS, fetchClients, gnf, initials, type Client } from '../api';
import { CARD, CorrespondantScreen, Empty, Filters, Pill } from '../components';

type F = 'all' | Client['status'];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function CorrespondantClientsScreen() {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.correspondant.clients, queryFn: fetchClients });
  const contact = useActorContact('client');
  const [filter, setFilter] = useState<F>('all');
  const [search, setSearch] = useState('');
  const all = useMemo(() => q.data ?? [], [q.data]);
  const count = (s: Client['status']) => all.filter((c) => c.status === s).length;

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    const digits = s.replace(/\D/g, '');
    return all.filter((c) => (filter === 'all' || c.status === filter) && (!s || c.nm.toLowerCase().includes(s) || (digits && c.tel.replace(/\D/g, '').includes(digits))));
  }, [all, filter, search]);

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {all.length ? (
          <>
            <View style={[styles.search, { borderColor: theme.border, backgroundColor: theme.background }]}>
              <Ionicons name="search" size={16} color={theme.textSecondary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Nom ou téléphone…"
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
                accessibilityLabel="Rechercher un client"
              />
            </View>
            <View style={styles.filters}>
              <Filters<F>
                value={filter}
                onChange={setFilter}
                items={[
                  { id: 'all', label: 'Tous', n: all.length },
                  { id: 'att', label: 'Colis en cours', n: count('att') },
                  { id: 'ok', label: 'Livrés', n: count('ok') },
                  { id: 'retour', label: 'Retours', n: count('retour') },
                ]}
              />
            </View>
          </>
        ) : null}
        {all.length === 0 ? (
          <Empty emoji="👥" title="Aucun client pour le moment" text="Les clients dont les commandes passent par votre point relais apparaîtront ici." />
        ) : list.length === 0 ? (
          <Empty emoji="🔎" title="Aucun résultat" />
        ) : (
          list.map((c) => (
            <View key={c.id || c.nm} style={styles.card}>
              <View style={styles.top}>
                <View style={[styles.ava, { backgroundColor: theme.background }]}>
                  {c.photo ? <AvatarPhoto uri={c.photo} size={46} /> : <ThemedText style={styles.init}>{initials(c.nm)}</ThemedText>}
                </View>
                <View style={styles.flex}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {c.nm}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {[c.tel || null, `${c.colis} colis`, c.dernier ? `dernier : ${c.dernier}` : null].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                <ThemedText style={styles.val}>{gnf(c.val)}</ThemedText>
              </View>
              <View style={styles.foot}>
                <Pill tone={CLIENT_STATUS[c.status]} />
                <View style={styles.actions}>
                  {c.id ? <Act icon="chatbubble-ellipses-outline" label={`Écrire à ${c.nm}`} busy={contact.busy === `msg:${c.id}`} onPress={() => void contact.message(c.id)} /> : null}
                  {c.tel ? <Act icon="call-outline" label={`Appeler ${c.nm}`} onPress={() => contact.phoneCall(c.tel)} /> : null}
                  {c.tel ? <Act icon="logo-whatsapp" label={`WhatsApp ${c.nm}`} onPress={() => contact.whatsapp(c.tel)} /> : null}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );

  return (
    <CorrespondantScreen title="Clients" subtitle="Les clients servis par votre point relais">
      {body}
    </CorrespondantScreen>
  );
}

function Act({ icon, label, onPress, busy }: { icon: IconName; label: string; onPress: () => void; busy?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.act, { borderColor: theme.border, backgroundColor: theme.background }]}>
      {busy ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={icon} size={16} color={icon === 'logo-whatsapp' ? '#25D366' : Brand.primary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 42 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  filters: { marginHorizontal: -16, marginVertical: -6 },
  card: { backgroundColor: CARD, borderRadius: 18, padding: 12, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ava: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  init: { fontWeight: '900', color: Brand.primary },
  val: { fontWeight: '900', fontSize: 14, lineHeight: 19 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  act: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
