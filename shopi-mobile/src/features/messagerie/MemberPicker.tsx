/**
 * Choix de membres (nouveau groupe, ajout de membres) — même source que le
 * site (CreateGroupPage.tsx) : GET /messagerie/users/search. Sans rien taper,
 * la liste montre les contacts liés (commandes, abonnements, répertoire) ;
 * en tapant un nom ou un numéro, tout l'annuaire de la plateforme.
 * Les personnes choisies apparaissent en pastilles au-dessus (toucher = retirer).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { useTheme } from '@/hooks/use-theme';

import { searchUsers, type SearchUser } from './api';

export const memberKey = (u: { type: string; id: string }) => `${u.type}:${u.id}`;

const TYPE_LABEL: Record<string, string> = {
  client: 'Client', company: 'Entreprise', delivery: 'Livreur', correspondent: 'Correspondant', partner: 'Partenaire',
};

export function MemberPicker({ selected, onToggle, exclude, header }: {
  selected: SearchUser[];
  onToggle: (u: SearchUser) => void;
  /** Clés `type:id` déjà membres — affichées grisées, non sélectionnables. */
  exclude?: Set<string>;
  /** Contenu placé tout en haut de la liste (ex. nom du groupe), qui défile avec elle. */
  header?: React.ReactElement;
}) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const results = useQuery({
    queryKey: ['msg-user-search', debounced],
    queryFn: ({ signal }) => searchUsers(debounced, signal),
    staleTime: 60_000,
  });
  const selectedKeys = new Set(selected.map(memberKey));

  return (
    <FlatList
      data={results.data ?? []}
      keyExtractor={memberKey}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <View>
          {header}
          {selected.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
              {selected.map(u => (
                <Pressable key={memberKey(u)} onPress={() => onToggle(u)} accessibilityRole="button" accessibilityLabel={`Retirer ${u.name}`} style={styles.chip}>
                  <Avatar u={u} size={44} />
                  <View style={styles.chipX}><Ionicons name="close" size={11} color="#fff" /></View>
                  <ThemedText numberOfLines={1} style={styles.chipName}>{u.name.split(' ')[0]}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <View style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nom ou numéro de téléphone…"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              autoCorrect={false}
              accessibilityLabel="Rechercher une personne"
            />
            {results.isFetching ? <ActivityIndicator size="small" color={Brand.primary} /> : null}
          </View>
          <ThemedText style={styles.sectionTitle}>{debounced ? 'RÉSULTATS' : 'VOS CONTACTS'}</ThemedText>
        </View>
      }
      renderItem={({ item }) => {
        const k = memberKey(item);
        const already = exclude?.has(k) ?? false;
        const on = selectedKeys.has(k);
        return (
          <Pressable
            onPress={() => !already && onToggle(item)}
            disabled={already}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on || already, disabled: already }}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }, already && styles.dim]}>
            <Avatar u={item} size={46} />
            <View style={styles.flex}>
              <ThemedText numberOfLines={1} style={styles.name}>{item.name}</ThemedText>
              <ThemedText numberOfLines={1} type="small" themeColor="textSecondary">
                {already ? 'Déjà dans le groupe' : [TYPE_LABEL[item.type] ?? item.type, item.subtitle].filter(Boolean).join(' · ')}
              </ThemedText>
            </View>
            <View style={[styles.check, on || already ? styles.checkOn : { borderColor: theme.border }]}>
              {on || already ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={
        results.isPending ? (
          <ActivityIndicator color={Brand.primary} style={styles.loader} />
        ) : (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {debounced ? 'Aucune personne ne correspond à cette recherche.' : 'Aucun contact pour le moment — tapez un nom ou un numéro pour chercher dans tout Shoneya.'}
          </ThemedText>
        )
      }
    />
  );
}

export function Avatar({ u, size }: { u: { name: string; logo?: string | null; online?: boolean }; size: number }) {
  const theme = useTheme();
  const img = u.logo?.startsWith('http') ? thumb(u.logo, size * 3) : undefined;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.backgroundSelected }]}>
        {img
          ? <Image source={{ uri: img }} style={styles.fill} contentFit="cover" />
          : <ThemedText style={[styles.avatarText, { fontSize: size * 0.36, lineHeight: size * 0.46 }]}>{initials(u.name)}</ThemedText>}
      </View>
      {u.online ? <View style={[styles.dot, { borderColor: theme.background, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14 }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  list: { paddingBottom: 120, flexGrow: 1 },
  loader: { marginTop: Spacing.four },
  chips: { gap: 12, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  chip: { width: 58, alignItems: 'center' },
  chipX: { position: 'absolute', top: -2, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#6B7280', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  chipName: { fontSize: 11.5, lineHeight: 15, marginTop: 4, maxWidth: 58 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 44, marginHorizontal: Spacing.three, marginTop: Spacing.three },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  sectionTitle: { fontSize: 11.5, lineHeight: 16, fontWeight: '800', letterSpacing: 1.3, color: Brand.primary, paddingHorizontal: Spacing.three, marginTop: Spacing.three, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.three, paddingVertical: 9 },
  dim: { opacity: 0.55 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Brand.primary, borderColor: Brand.primary },
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800', color: Brand.primary },
  dot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2, backgroundColor: Brand.success },
  empty: { textAlign: 'center', paddingHorizontal: Spacing.four, paddingVertical: Spacing.four },
});
