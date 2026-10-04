/**
 * Centre d'aide › Article (comme /aide/articles/:slug) : catégorie, titre,
 * date et vues, contenu mis en forme, « Cet article vous a-t-il aidé ? »
 * (POST …/feedback, une seule réponse), puis renvoi vers le support.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchArticle, sendFeedback } from '../api';
import { Markdown } from '../components/markdown';

export default function HelpArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const s = String(slug ?? '');
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.help.article(s), queryFn: () => fetchArticle(s), enabled: !!s });
  const [voted, setVoted] = useState<boolean | null>(null);
  const vote = useMutation({ mutationFn: (helpful: boolean) => sendFeedback(s, helpful), onMutate: (h) => setVoted(h) });
  const a = q.data;

  const share = () =>
    a ? void Share.share({ message: `${a.title} — Centre d’aide Shoneya\nhttps://www.shoneya.com/aide/articles/${a.slug}` }).catch(() => undefined) : undefined;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader
        title="Article"
        right={
          a ? (
            <Pressable onPress={share} hitSlop={10} accessibilityRole="button" accessibilityLabel="Partager l’article">
              <Ionicons name="share-outline" size={22} color={theme.text} />
            </Pressable>
          ) : undefined
        }
      />
      {q.isPending ? (
        <ActivityIndicator style={styles.loader} />
      ) : !a ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {a.category ? (
            <Pressable onPress={() => router.push({ pathname: '/aide/categorie/[slug]', params: { slug: a.category!.slug } })} accessibilityRole="button" style={styles.cat}>
              <Ionicons name="folder-outline" size={13} color="#1F1F1F" />
              <ThemedText style={styles.catText}>{a.category.name}</ThemedText>
            </Pressable>
          ) : null}
          <ThemedText style={styles.title}>{a.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {a.publishedAt ? `Publié le ${new Date(a.publishedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · ` : ''}
            {a.viewCount} vue{a.viewCount > 1 ? 's' : ''}
          </ThemedText>
          {a.excerpt ? <ThemedText style={styles.excerpt}>{a.excerpt}</ThemedText> : null}
          <View style={[styles.sep, { backgroundColor: theme.border }]} />
          {a.content ? <Markdown content={a.content} /> : <ThemedText themeColor="textSecondary">Contenu indisponible.</ThemedText>}

          <View style={styles.feedback}>
            {voted === null ? (
              <>
                <ThemedText style={styles.fbTitle}>Cet article vous a-t-il aidé ?</ThemedText>
                <View style={styles.fbRow}>
                  <Pressable onPress={() => vote.mutate(true)} accessibilityRole="button" style={[styles.fbBtn, { borderColor: theme.border }]}>
                    <Ionicons name="thumbs-up-outline" size={18} color="#1F1F1F" />
                    <ThemedText style={styles.fbText}>Oui</ThemedText>
                  </Pressable>
                  <Pressable onPress={() => vote.mutate(false)} accessibilityRole="button" style={[styles.fbBtn, { borderColor: theme.border }]}>
                    <Ionicons name="thumbs-down-outline" size={18} color="#1F1F1F" />
                    <ThemedText style={styles.fbText}>Non</ThemedText>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={26} color="#047857" />
                <ThemedText style={styles.fbTitle}>Merci pour votre retour !</ThemedText>
                {voted === false ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                    Désolé que cet article ne vous ait pas aidé. Notre équipe peut vous répondre directement.
                  </ThemedText>
                ) : null}
              </>
            )}
          </View>

          <Pressable onPress={() => router.push('/support/nouveau')} accessibilityRole="button" style={styles.cta}>
            <Ionicons name="headset-outline" size={20} color="#fff" />
            <View style={styles.flex}>
              <ThemedText style={styles.ctaTitle}>Toujours besoin d’aide ?</ThemedText>
              <ThemedText style={styles.ctaSub}>Ouvrez une demande, réponse en 24 h</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  loader: { marginTop: 40 },
  content: { padding: 18, gap: 10, paddingBottom: 40 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  catText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  title: { fontSize: 24, lineHeight: 31, fontWeight: '900' },
  excerpt: { fontSize: 16, lineHeight: 23, fontWeight: '600' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  feedback: { alignItems: 'center', gap: 10, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 18, padding: 18, marginTop: 18 },
  fbTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  fbRow: { flexDirection: 'row', gap: 10 },
  fbBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 18, minHeight: 42, backgroundColor: '#fff' },
  fbText: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1F1F1F', borderRadius: 18, padding: 16, marginTop: 6 },
  ctaTitle: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  ctaSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 17 },
});
