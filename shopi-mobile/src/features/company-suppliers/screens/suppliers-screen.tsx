/**
 * Espace entreprise › Fournisseurs — version mobile de /dashboard/entreprise/fournisseurs
 * (FournisseursPage.tsx) : les boutiques Shoneya qui vendent en gros auxquelles
 * la boutique est connectée.
 *   · en-tête : nombre de fournisseurs, produits de gros disponibles, bouton « Connecter » ;
 *   · recherche dans mes fournisseurs ;
 *   · une carte par fournisseur : logo, nom, produits de gros, connecté depuis,
 *     description ; « Voir le catalogue » ; « Se déconnecter » (confirmé) ;
 *   · feuille « Connecter un fournisseur » : recherche des boutiques vendant en
 *     gros (côté serveur), « Connecter » / « Connecté ».
 * Droits : fournisseurs.view / connect / disconnect (propriétaire : tout).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { Sheet } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { connectSupplier, disconnectSupplier, fetchSuppliers, normalize, searchCandidates, type Candidate, type Supplier } from '../api';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SupplierLogo({ uri, size = 52 }: { uri: string | null; size?: number }) {
  const theme = useTheme();
  const img = uri?.startsWith('http') ? thumb(uri, size * 3) : undefined;
  return (
    <View style={[styles.logo, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: theme.backgroundElement }]}>
      {img ? <Image source={{ uri: img }} style={styles.fill} contentFit="cover" /> : <Ionicons name="business-outline" size={size * 0.45} color={theme.textSecondary} />}
    </View>
  );
}

const openCatalogue = (s: { companyId: string; nom: string; logo: string | null }) =>
  router.push({ pathname: '/entreprise/fournisseurs/[id]', params: { id: s.companyId, name: s.nom, logo: s.logo ?? '' } });

export default function CompanySuppliersScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canView = perms.can('fournisseurs', 'view');
  const canConnect = perms.can('fournisseurs', 'connect');
  const canDisconnect = perms.can('fournisseurs', 'disconnect');
  const snack = useSnack();
  const [search, setSearch] = useState('');
  const [sheet, setSheet] = useState(false);

  const q = useQuery({ queryKey: qk.companySuppliers.list, queryFn: fetchSuppliers, enabled: canView });
  const suppliers = q.data ?? [];
  const term = normalize(search.trim());
  const list = suppliers.filter((s) => !term || normalize(`${s.nom} ${s.description ?? ''}`).includes(term));
  const totalGros = suppliers.reduce((n, s) => n + s.produitsGrosCount, 0);

  const disconnect = useMutation({
    mutationFn: (s: Supplier) => disconnectSupplier(s.linkId).then(() => s),
    onSuccess: (s) => { snack.show(`Déconnecté de ${s.nom}`); void qc.invalidateQueries({ queryKey: qk.companySuppliers.all }); },
    onError: (e) => snack.show(toUserMessage(e), true),
  });
  const confirmDisconnect = (s: Supplier) => Alert.alert(
    'Se déconnecter de ce fournisseur ?', `Vous n’aurez plus accès au catalogue de gros de ${s.nom}. Vous pourrez vous reconnecter à tout moment.`,
    [{ text: 'Annuler', style: 'cancel' }, { text: 'Se déconnecter', style: 'destructive', onPress: () => disconnect.mutate(s) }],
  );

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.centerBox}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de voir les fournisseurs. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        data={q.isPending ? [] : list}
        keyExtractor={(s) => s.linkId}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.heroTitle}>Achetez en gros sur Shoneya</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Connectez-vous à des boutiques qui vendent en gros pour consulter leurs prix par quantité et approvisionner votre stock.
              </ThemedText>
              <View style={styles.heroStats}>
                <HeroStat v={String(suppliers.length)} l={suppliers.length > 1 ? 'fournisseurs' : 'fournisseur'} />
                <HeroStat v={String(totalGros)} l="produits de gros" />
              </View>
              {canConnect ? (
                <Pressable onPress={() => setSheet(true)} accessibilityRole="button" style={styles.mainBtn}>
                  <Ionicons name="add" size={19} color="#fff" />
                  <ThemedText type="smallBold" style={styles.white}>Connecter un fournisseur</ThemedText>
                </Pressable>
              ) : null}
            </View>
            {suppliers.length > 3 ? (
              <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="search" size={17} color={theme.textSecondary} />
                <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher dans mes fournisseurs" placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher un fournisseur" />
              </View>
            ) : null}
            {q.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          </View>
        }
        ListEmptyComponent={q.isPending ? null : (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyEmoji}>🏭</ThemedText>
            <ThemedText style={styles.emptyTitle}>{term ? 'Aucun résultat' : 'Aucun fournisseur connecté'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {term ? `Aucun fournisseur ne correspond à « ${search.trim()} ».` : 'Trouvez des boutiques qui vendent en gros et connectez-vous pour voir leur catalogue.'}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable onPress={() => openCatalogue(item)} accessibilityRole="button" style={({ pressed }) => [styles.card, { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundElement : theme.background }]}>
            <View style={styles.cardHead}>
              <SupplierLogo uri={item.logo} />
              <View style={styles.flex}>
                <ThemedText numberOfLines={1} style={styles.name}>{item.nom}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.produitsGrosCount} produit{item.produitsGrosCount > 1 ? 's' : ''} en gros
                  {item.connecteLe ? ` · connecté le ${new Date(item.connecteLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                </ThemedText>
              </View>
            </View>
            {item.description ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>{item.description}</ThemedText> : null}
            <View style={styles.actions}>
              <View style={[styles.btn, { backgroundColor: Brand.primary }]}>
                <Ionicons name="file-tray-stacked-outline" size={16} color="#fff" />
                <ThemedText type="smallBold" style={styles.white}>Voir le catalogue</ThemedText>
              </View>
              {canDisconnect ? (
                <Pressable onPress={() => confirmDisconnect(item)} disabled={disconnect.isPending} accessibilityRole="button" accessibilityLabel={`Se déconnecter de ${item.nom}`}
                  style={[styles.iconBtn, { borderColor: `${Brand.danger}55` }]}>
                  {disconnect.isPending && disconnect.variables?.linkId === item.linkId
                    ? <ActivityIndicator size="small" color={Brand.danger} />
                    : <Ionicons name="unlink-outline" size={18} color={Brand.danger} />}
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Fournisseurs" subtitle="Achats en gros auprès d’autres boutiques" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="fournisseurs" />
      <Snack msg={snack.msg} bottom={96} />
      {sheet ? <ConnectSheet onClose={() => setSheet(false)} onDone={snack.show} /> : null}
    </SafeAreaView>
  );
}

function HeroStat({ v, l }: { v: string; l: string }) {
  return (
    <View style={styles.heroStat}>
      <ThemedText style={styles.heroStatV}>{v}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{l}</ThemedText>
    </View>
  );
}

function ConnectSheet({ onClose, onDone }: { onClose: () => void; onDone: (m: string, error?: boolean) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);
  const key = qk.companySuppliers.search(term);
  const q = useQuery({ queryKey: key, queryFn: ({ signal }) => searchCandidates(term, signal) });

  const connect = useMutation({
    mutationFn: (c: Candidate) => connectSupplier(c.id),
    onSuccess: (s, c) => {
      qc.setQueryData<Candidate[]>(key, (old) => old?.map((x) => (x.id === c.id ? { ...x, dejaConnecte: true } : x)));
      void qc.invalidateQueries({ queryKey: qk.companySuppliers.list });
      onDone(`Connecté à ${s.nom} : son catalogue de gros est disponible`);
    },
    onError: (e) => onDone(toUserMessage(e), true),
  });

  const list = q.data ?? [];
  return (
    <Sheet title="Connecter un fournisseur" sub="Boutiques Shoneya qui vendent en gros" onClose={onClose} tall>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={17} color={theme.textSecondary} />
        <TextInput value={search} onChangeText={setSearch} autoFocus placeholder="Nom de la boutique" placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher une boutique" />
        {q.isFetching ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
      </View>
      {q.isError ? <ThemedText type="small" style={styles.danger}>{toUserMessage(q.error)}</ThemedText> : null}
      {!q.isPending && !list.length ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {term ? `Aucune boutique vendant en gros ne correspond à « ${term} ».` : 'Aucune boutique ne vend en gros pour le moment.'}
        </ThemedText>
      ) : null}
      {list.map((c) => {
        const busy = connect.isPending && connect.variables?.id === c.id;
        return (
          <View key={c.id} style={[styles.cand, { borderColor: theme.border }]}>
            <SupplierLogo uri={c.logo} size={44} />
            <View style={styles.flex}>
              <ThemedText numberOfLines={1} style={styles.candName}>{c.nom}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {c.produitsGrosCount} produit{c.produitsGrosCount > 1 ? 's' : ''} en gros{c.description ? ` · ${c.description}` : ''}
              </ThemedText>
            </View>
            <Pressable onPress={() => !c.dejaConnecte && connect.mutate(c)} disabled={c.dejaConnecte || connect.isPending} accessibilityRole="button"
              style={[styles.connect, c.dejaConnecte ? { backgroundColor: theme.backgroundElement } : { backgroundColor: Brand.primary }]}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : c.dejaConnecte ? (
                <><Ionicons name="checkmark" size={15} color={Brand.success} /><ThemedText type="smallBold" style={{ color: Brand.success }}>Connecté</ThemedText></>
              ) : <ThemedText type="smallBold" style={styles.white}>Connecter</ThemedText>}
            </Pressable>
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  white: { color: '#fff' },
  danger: { color: Brand.danger },
  loader: { marginTop: 20 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12 },
  hero: { borderRadius: 18, padding: 16, gap: 8 },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  heroStats: { flexDirection: 'row', gap: 22, marginTop: 4 },
  heroStat: { gap: 0 },
  heroStatV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  mainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Brand.primary, borderRadius: 999, minHeight: 46, marginTop: 6 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40, lineHeight: 48 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, minHeight: 42 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  cand: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10 },
  candName: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  connect: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, minWidth: 96, justifyContent: 'center' },
});
