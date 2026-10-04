/**
 * Centre d'aide — accueil (comme /aide sur le site) :
 *   · bandeau « Comment pouvons-nous vous aider ? » + recherche avec suggestions
 *     en direct (dès 2 lettres, 300 ms après la frappe) et raccourcis ;
 *   · accès rapides : mes demandes, nouvelle demande, contacter le support ;
 *   · catégories, articles populaires, questions fréquentes (accordéon) ;
 *   · guides : politique de retour, remboursements ; bandeau de contact.
 * Quand la base d'articles est vide, les accès au support restent en tête.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchCategories, fetchFaq, fetchPopular, ionOf, searchHelp } from '../api';
import { ArticleRow, Section, SearchBar, type IconName } from '../components/ui';

const FAQ_LABELS: Record<string, string> = {
  commandes: 'Commandes',
  livraisons: 'Livraisons',
  paiements: 'Paiements',
  compte: 'Compte',
  retours: 'Retours & Remboursements',
  securite: 'Sécurité',
};
const QUICK_TOPICS = [
  { label: 'Commandes', slug: 'commandes' },
  { label: 'Livraisons', slug: 'livraisons' },
  { label: 'Paiements', slug: 'paiements' },
  { label: 'Mon compte', slug: 'compte' },
];

const openArticle = (slug: string) => router.push({ pathname: '/aide/article/[slug]', params: { slug } });

export default function HelpHomeScreen() {
  const theme = useTheme();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const categories = useQuery({ queryKey: qk.help.categories, queryFn: fetchCategories, staleTime: 10 * 60_000 });
  const popular = useQuery({ queryKey: qk.help.popular, queryFn: fetchPopular, staleTime: 10 * 60_000 });
  const faq = useQuery({ queryKey: qk.help.faq, queryFn: fetchFaq, staleTime: 10 * 60_000 });

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const suggest = useQuery({ queryKey: qk.help.search(term), queryFn: () => searchHelp(term), enabled: term.length >= 2, staleTime: 60_000 });
  const suggestions = term.length >= 2 ? (suggest.data?.data ?? []).slice(0, 5) : [];

  const submit = () => {
    if (text.trim()) router.push({ pathname: '/aide/recherche', params: { q: text.trim() } });
  };
  const refreshing = categories.isRefetching || popular.isRefetching || faq.isRefetching;
  const refresh = () => {
    void categories.refetch();
    void popular.refetch();
    void faq.refetch();
  };
  const faqGroups = (faq.data ?? []).filter((g) => g.faqs.length);

  const ACTIONS: { icon: IconName; title: string; sub: string; href: Href }[] = [
    { icon: 'chatbubbles-outline', title: 'Mes demandes', sub: signedIn ? 'Suivre mes tickets de support' : 'Connectez-vous pour les suivre', href: '/support' },
    { icon: 'add-circle-outline', title: 'Nouvelle demande', sub: 'Ouvrir un ticket — réponse en 24 h', href: '/support/nouveau' },
    { icon: 'mail-outline', title: 'Contacter le support', sub: 'Formulaire de contact, sans compte', href: '/aide/contact' },
  ];

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Centre d’aide" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        {/* Bandeau + recherche */}
        <View style={styles.hero}>
          <View style={styles.bubble} />
          <View style={styles.badge}>
            <Ionicons name="headset" size={13} color="#fff" />
            <ThemedText style={styles.badgeText}>Centre d’aide Shoneya</ThemedText>
          </View>
          <ThemedText style={styles.heroTitle}>Comment pouvons-nous vous aider ?</ThemedText>
          <ThemedText style={styles.heroSub}>Trouvez des réponses, des guides et des tutoriels pour tout ce dont vous avez besoin.</ThemedText>
          <SearchBar value={text} onChangeText={setText} onSubmit={submit} placeholder="Rechercher : commandes, livraisons, paiements…" dark />
          {suggestions.length ? (
            <View style={styles.sugBox}>
              {suggestions.map((s, i) => (
                <Pressable key={s.id} onPress={() => openArticle(s.slug)} accessibilityRole="button" style={[styles.sug, i > 0 && styles.sugSep]}>
                  <Ionicons name="document-text-outline" size={16} color="#1F1F1F" />
                  <View style={styles.flex}>
                    <ThemedText style={styles.sugTitle} numberOfLines={1}>
                      {s.title}
                    </ThemedText>
                    {s.categoryName ? (
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {s.categoryName}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              ))}
              <Pressable onPress={submit} accessibilityRole="button" style={[styles.sug, styles.sugSep]}>
                <ThemedText style={styles.sugAll}>Voir tous les résultats</ThemedText>
                <Ionicons name="chevron-forward" size={14} color="#1F1F1F" />
              </Pressable>
            </View>
          ) : term.length >= 2 && suggest.isFetching ? (
            <ActivityIndicator color="#fff" />
          ) : null}
          <View style={styles.chips}>
            {QUICK_TOPICS.map((t) => (
              <Pressable key={t.slug} onPress={() => router.push({ pathname: '/aide/categorie/[slug]', params: { slug: t.slug } })} accessibilityRole="button" style={styles.chip}>
                <ThemedText style={styles.chipText}>{t.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Accès rapides au support */}
        <View style={styles.actions}>
          {ACTIONS.map((a) => (
            <Pressable key={a.title} onPress={() => router.push(a.href)} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { backgroundColor: 'rgba(0,0,0,0.07)' }]}>
              <View style={styles.actionIco}>
                <Ionicons name={a.icon} size={20} color="#1F1F1F" />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{a.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {a.sub}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

        {/* Catégories */}
        <Section title="Parcourir par catégorie">
          {categories.isPending ? (
            <ActivityIndicator />
          ) : (categories.data ?? []).length ? (
            <View style={styles.grid}>
              {(categories.data ?? []).map((c) => (
                <Pressable key={c.id} onPress={() => router.push({ pathname: '/aide/categorie/[slug]', params: { slug: c.slug } })} accessibilityRole="button" style={({ pressed }) => [styles.cat, pressed && { opacity: 0.8 }]}>
                  <View style={styles.catIco}>
                    <Ionicons name={ionOf(c.icon) as IconName} size={20} color="#1F1F1F" />
                  </View>
                  <ThemedText style={styles.catName} numberOfLines={2}>
                    {c.name}
                  </ThemedText>
                  {c.description ? (
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                      {c.description}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.catCount}>
                    {c.articleCount} article{c.articleCount !== 1 ? 's' : ''}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={[styles.empty, { borderColor: theme.border }]}>
              <Ionicons name="folder-open-outline" size={26} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Les articles d’aide arrivent bientôt. En attendant, l’équipe Shoneya répond à vos questions : ouvrez une demande ou écrivez-nous.
              </ThemedText>
            </View>
          )}
        </Section>

        {(popular.data ?? []).length ? (
          <Section title="Articles populaires">
            <View style={[styles.card, { borderColor: theme.border }]}>
              {(popular.data ?? []).map((a, i) => (
                <ArticleRow key={a.id} first={i === 0} title={a.title} meta={`${a.viewCount} vue${a.viewCount > 1 ? 's' : ''}`} onPress={() => openArticle(a.slug)} />
              ))}
            </View>
          </Section>
        ) : null}

        {faqGroups.length ? (
          <Section title="Questions fréquentes">
            {faqGroups.map((g) => (
              <View key={g.slug} style={styles.faqGroup}>
                <ThemedText style={styles.faqGroupTitle}>{FAQ_LABELS[g.slug] ?? g.slug}</ThemedText>
                <View style={[styles.card, { borderColor: theme.border }]}>
                  {g.faqs.map((f, i) => {
                    const open = openFaq === f.id;
                    return (
                      <View key={f.id} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
                        <Pressable onPress={() => setOpenFaq(open ? null : f.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.faqQ}>
                          <ThemedText style={[styles.flex, styles.bold]}>{f.question}</ThemedText>
                          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
                        </Pressable>
                        {open ? (
                          <ThemedText style={styles.faqA} themeColor="textSecondary">
                            {f.answer}
                          </ThemedText>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        <Section title="Guides">
          <View style={[styles.card, { borderColor: theme.border }]}>
            <ArticleRow first title="Politique de retour" meta="Délais, état des articles, garantie" onPress={() => router.push('/aide/politique-retour')} />
            <ArticleRow title="Politique de remboursement" meta="Rétractation, délais, frais de retour" onPress={() => router.push('/aide/remboursements')} />
          </View>
        </Section>

        {/* Bandeau de contact */}
        <View style={styles.cta}>
          <Ionicons name="headset-outline" size={26} color="#1F1F1F" />
          <ThemedText style={styles.ctaTitle}>Vous ne trouvez pas votre réponse ?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Notre équipe répond en 24 à 48 h ouvrées — 4 h pour la sécurité et la fraude.
          </ThemedText>
          <View style={styles.ctaRow}>
            <Pressable onPress={() => router.push('/support/nouveau')} accessibilityRole="button" style={[styles.btn, styles.btnDark]}>
              <ThemedText style={styles.btnDarkText}>Ouvrir une demande</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/aide/contact')} accessibilityRole="button" style={[styles.btn, { borderColor: theme.border }]}>
              <ThemedText style={styles.btnText}>Nous écrire</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  content: { padding: 16, gap: 22, paddingBottom: 40 },
  hero: { backgroundColor: '#1F1F1F', borderRadius: 24, padding: 18, gap: 12, overflow: 'hidden' },
  bubble: { position: 'absolute', width: 220, height: 220, borderRadius: 110, top: -100, right: -70, backgroundColor: 'rgba(255,255,255,0.07)' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontSize: 12, lineHeight: 16, fontWeight: '800' },
  heroTitle: { color: '#fff', fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20 },
  sugBox: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  sug: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  sugSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8' },
  sugTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700', color: '#1F1F1F' },
  sugAll: { flex: 1, fontSize: 13.5, lineHeight: 18, fontWeight: '800', color: '#1F1F1F' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '700' },
  actions: { gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 16, padding: 12 },
  actionIco: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cat: { flexBasis: '47%', flexGrow: 1, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 16, padding: 12, gap: 4 },
  catIco: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  catName: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  catCount: { fontSize: 12, lineHeight: 16, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 18 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  faqGroup: { gap: 6 },
  faqGroupTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  faqA: { fontSize: 14, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 14 },
  cta: { alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 20, padding: 18 },
  ctaTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { flex: 1, borderWidth: 1, borderRadius: 999, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  btnDark: { backgroundColor: '#1F1F1F', borderColor: '#1F1F1F' },
  btnDarkText: { color: '#fff', fontSize: 14, lineHeight: 18, fontWeight: '800' },
  btnText: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
});
