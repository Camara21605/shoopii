/**
 * Centre d'aide › Recherche (comme /aide/recherche?q=) : résultats au fil de
 * la frappe (350 ms), termes cherchés mis en gras dans les titres, catégorie
 * de chaque article ; aucun résultat → accès au support.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { normalize, searchHelp } from '../api';
import { SearchBar } from '../components/ui';

/** Met en gras les mots cherchés (insensible aux accents et à la casse). */
function Highlight({ text, term }: { text: string; term: string }) {
  const words = term.split(/\s+/).filter((w) => w.length >= 2).map(normalize);
  if (!words.length) return <ThemedText style={styles.title}>{text}</ThemedText>;
  const norm = normalize(text);
  const marks = new Array(text.length).fill(false);
  words.forEach((w) => {
    let i = norm.indexOf(w);
    while (i >= 0) {
      for (let j = i; j < i + w.length; j++) marks[j] = true;
      i = norm.indexOf(w, i + w.length);
    }
  });
  const parts: { t: string; on: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.on === marks[i]) last.t += text[i];
    else parts.push({ t: text[i], on: marks[i] });
  }
  return (
    <ThemedText style={styles.title}>
      {parts.map((p, i) => (
        <ThemedText key={i} style={p.on ? styles.mark : undefined}>
          {p.t}
        </ThemedText>
      ))}
    </ThemedText>
  );
}

export default function HelpSearchScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const theme = useTheme();
  const [text, setText] = useState(String(params.q ?? ''));
  const [term, setTerm] = useState(String(params.q ?? '').trim());
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);
  const q = useQuery({ queryKey: qk.help.search(term), queryFn: () => searchHelp(term), enabled: term.length >= 2, placeholderData: keepPreviousData });
  const results = term.length >= 2 ? (q.data?.data ?? []) : [];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Rechercher dans l’aide" />
      <View style={styles.searchWrap}>
        <SearchBar value={text} onChangeText={setText} placeholder="Ex : suivre ma commande, rembourser…" autoFocus={!params.q} />
      </View>
      <FlatList
        data={results}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          term.length >= 2 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
              {q.isFetching && !q.data ? 'Recherche…' : `${q.data?.total ?? 0} résultat${(q.data?.total ?? 0) > 1 ? 's' : ''} pour « ${term} »`}
            </ThemedText>
          ) : null
        }
        ListEmptyComponent={
          term.length < 2 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
              Tapez au moins 2 lettres pour chercher dans les articles d’aide.
            </ThemedText>
          ) : q.isFetching ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={30} color={theme.textSecondary} />
              <ThemedText style={styles.emptyTitle}>Aucun résultat</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Essayez d’autres mots, ou posez directement votre question à notre équipe.
              </ThemedText>
              <Pressable onPress={() => router.push({ pathname: '/support/nouveau', params: { sujet: term } })} accessibilityRole="button" style={styles.btn}>
                <ThemedText style={styles.btnText}>Poser ma question</ThemedText>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/aide/article/[slug]', params: { slug: item.slug } })}
            accessibilityRole="button"
            style={({ pressed }) => [styles.item, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
            {item.categoryName ? (
              <ThemedText type="small" themeColor="textSecondary">
                {item.categoryName}
              </ThemedText>
            ) : null}
            <Highlight text={item.title} term={term} />
            {item.excerpt ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {item.excerpt}
              </ThemedText>
            ) : null}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  loader: { marginTop: 30 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  count: { marginBottom: 4 },
  hint: { textAlign: 'center', marginTop: 30 },
  item: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  title: { fontSize: 15.5, lineHeight: 21, fontWeight: '700' },
  mark: { fontWeight: '900', backgroundColor: 'rgba(0,0,0,0.08)' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  btn: { backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 20, minHeight: 46, justifyContent: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
});
