/**
 * Centre d'aide › Catégorie (comme /aide/categories/:slug) : en-tête de la
 * catégorie, article vedette (le plus consulté), liste des articles. Catégorie
 * inconnue ou vide : message clair + accès au support.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchCategory, ionOf } from '../api';
import { ArticleRow, type IconName } from '../components/ui';

export default function HelpCategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const s = String(slug ?? '');
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.help.category(s), queryFn: () => fetchCategory(s), enabled: !!s, retry: false });
  const articles = q.data?.articles ?? [];
  const featured = [...articles].sort((a, b) => b.viewCount - a.viewCount)[0];
  const open = (slugA: string) => router.push({ pathname: '/aide/article/[slug]', params: { slug: slugA } });

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={q.data?.name ?? 'Catégorie'} />
      {q.isPending ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {q.data ? (
            <View style={styles.head}>
              <View style={styles.ico}>
                <Ionicons name={ionOf(q.data.icon) as IconName} size={26} color="#1F1F1F" />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.title}>{q.data.name}</ThemedText>
                {q.data.description ? <ThemedText themeColor="textSecondary">{q.data.description}</ThemedText> : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {articles.length} article{articles.length !== 1 ? 's' : ''}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {featured ? (
            <Pressable onPress={() => open(featured.slug)} accessibilityRole="button" style={styles.featured}>
              <ThemedText style={styles.featLabel}>À LA UNE · LE PLUS CONSULTÉ</ThemedText>
              <ThemedText style={styles.featTitle}>{featured.title}</ThemedText>
              {featured.excerpt ? (
                <ThemedText style={styles.featExcerpt} numberOfLines={3}>
                  {featured.excerpt}
                </ThemedText>
              ) : null}
              <View style={styles.featFoot}>
                <ThemedText style={styles.featRead}>Lire l’article</ThemedText>
                <Ionicons name="arrow-forward" size={15} color="#fff" />
              </View>
            </Pressable>
          ) : null}

          {articles.length ? (
            <View style={[styles.card, { borderColor: theme.border }]}>
              {articles.map((a, i) => (
                <ArticleRow key={a.id} first={i === 0} title={a.title} meta={a.excerpt ?? undefined} onPress={() => open(a.slug)} />
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={30} color={theme.textSecondary} />
              <ThemedText style={styles.emptyTitle}>{q.data ? 'Aucun article pour le moment' : 'Rubrique bientôt disponible'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Notre équipe peut vous répondre directement.
              </ThemedText>
              <Pressable onPress={() => router.push('/support/nouveau')} accessibilityRole="button" style={styles.btn}>
                <ThemedText style={styles.btnText}>Ouvrir une demande</ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ico: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  featured: { backgroundColor: '#1F1F1F', borderRadius: 20, padding: 16, gap: 6 },
  featLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1 },
  featTitle: { color: '#fff', fontSize: 18, lineHeight: 24, fontWeight: '900' },
  featExcerpt: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 20 },
  featFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  featRead: { color: '#fff', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  btn: { backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 20, minHeight: 46, justifyContent: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
});
