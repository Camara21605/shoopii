/**
 * Espace entreprise › SEO & Marketing — sur le site, cette rubrique n'affiche
 * que « bientôt disponible ». Ici, tout vient des vraies données de la
 * boutique (GET /dashboard/entreprise/marketing) :
 *   · score de visibilité sur 100 + la liste de ce qui manque, chacun avec
 *     un bouton « Corriger » vers le bon écran (profil, horaires, catalogue, avis) ;
 *   · partager la boutique (lien public) ;
 *   · audience : vues des fiches, j'aime, favoris, abonnés ;
 *   · qualité des fiches (photo, titre et description Google, mots-clés…) et
 *     les fiches publiées à compléter, les plus vues d'abord ;
 *   · fiches les plus vues, stories des 30 derniers jours, promotions, avis.
 * Permission statistics.view (le serveur refuse aussi sans elle).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { SITE } from '@/features/company/nav';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import { fetchMarketing, fmt, ISSUE_LABEL, scoreTone, type FicheIssue, type FixTarget, type Marketing } from '../api';
import { Box, Head, Kpi, Locked } from '../components';

export default function SeoScreen() {
  const theme = useTheme();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('statistics', 'view');
  const q = useQuery({ queryKey: qk.company.marketing, queryFn: fetchMarketing, enabled: canView });

  let body: React.ReactNode;
  if (perms.loading || (q.isPending && canView)) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView) body = <Locked text="Votre rôle dans l’équipe ne permet pas de consulter les statistiques. Demandez l’accès au propriétaire de la boutique." />;
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else if (!q.data) body = <Locked text="Boutique introuvable." />;
  else {
    const m = q.data;
    const services = m.businessModel === 'services';
    /* Rubrique à ouvrir pour corriger un point */
    const fixRoute = (f: FixTarget): Href =>
      f === 'horaires' ? '/entreprise/parametres/horaires'
        : f === 'catalogue' ? (services ? '/entreprise/services' : '/entreprise/produits')
          : f === 'avis' ? '/entreprise/avis'
            : '/entreprise/parametres/boutique';
    const openFiche = (id: string) =>
      services
        ? router.push({ pathname: '/entreprise/services/[id]', params: { id } })
        : router.push({ pathname: '/entreprise/produits/[id]', params: { id } });

    body = (
      <ScrollView
        {...hideOnScroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <Score m={m} onFix={(f) => router.push(fixRoute(f))} />
        {m.boutique ? <ShareShop id={m.boutique.id} name={m.boutique.nom} /> : null}
        <Audience m={m} />
        <Fiches m={m} services={services} onOpen={openFiche} onCatalog={() => router.push(fixRoute('catalogue'))} />
        <TopViewed m={m} services={services} onOpen={openFiche} />
        {m.stories ? <Stories s={m.stories} /> : null}
        <Promotions m={m} canCreate={perms.isOwner || perms.can('promotions', 'create')} />
        <Reviews m={m} />
        <Tips services={services} />
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="SEO & Marketing" subtitle="Visibilité et audience de votre boutique" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="seo" />
    </SafeAreaView>
  );
}

/* ── Score de visibilité + points à corriger ─────────────────── */

function Score({ m, onFix }: { m: Marketing; onFix: (f: FixTarget) => void }) {
  const theme = useTheme();
  const { score, checks } = m.visibilite;
  const tone = scoreTone(score);
  const todo = checks.filter((c) => !c.ok);
  const done = checks.length - todo.length;
  return (
    <Box>
      <View style={styles.scoreRow}>
        <View style={[styles.scoreCircle, { borderColor: tone.color, backgroundColor: tone.bg }]}>
          <ThemedText style={[styles.scoreV, { color: tone.color }]}>{score}</ThemedText>
          <ThemedText style={[styles.scoreMax, { color: tone.color }]}>/100</ThemedText>
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.h3}>Score de visibilité</ThemedText>
          <ThemedText style={[styles.bold, { color: tone.color }]}>{tone.label}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{done} point{done > 1 ? 's' : ''} sur {checks.length} réglé{done > 1 ? 's' : ''}</ThemedText>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View style={[styles.trackFill, { width: `${score}%`, backgroundColor: tone.color }]} />
      </View>
      {todo.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">Tout est en place 🎉 Continuez à publier et à répondre à vos clients.</ThemedText>
      ) : null}
      {todo.map((c) => (
        <View key={c.key} style={[styles.check, { borderTopColor: theme.border }]}>
          <Ionicons name="alert-circle" size={20} color="#D97706" />
          <View style={styles.flex}>
            <ThemedText style={styles.bold}>{c.label}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{c.hint}</ThemedText>
          </View>
          <Pressable onPress={() => onFix(c.fix)} accessibilityRole="button" accessibilityLabel={`Corriger : ${c.label}`}
            style={({ pressed }) => [styles.fixBtn, pressed && styles.pressed]}>
            <ThemedText style={styles.fixText}>Corriger</ThemedText>
          </Pressable>
        </View>
      ))}
      {checks.filter((c) => c.ok).map((c) => (
        <View key={c.key} style={[styles.check, { borderTopColor: theme.border }]}>
          <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
          <ThemedText style={styles.flex} themeColor="textSecondary">{c.label}</ThemedText>
        </View>
      ))}
    </Box>
  );
}

/* ── Partager la boutique ────────────────────────────────────── */

function ShareShop({ id, name }: { id: string; name: string }) {
  const url = `${SITE}/boutique/${id}`;
  return (
    <Pressable
      onPress={() => void Share.share({ message: `Découvrez ${name || 'ma boutique'} sur Shoneya : ${url}`, url })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
      <View style={styles.shareIco}><Ionicons name="share-social" size={20} color="#fff" /></View>
      <View style={styles.flex}>
        <ThemedText style={[styles.bold, { color: Brand.primaryInk }]}>Partager ma boutique</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>WhatsApp, Facebook, SMS… : {url.replace('https://', '')}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Brand.primaryInk} />
    </Pressable>
  );
}

/* ── Audience ────────────────────────────────────────────────── */

function Audience({ m }: { m: Marketing }) {
  const a = m.audience;
  return (
    <Box>
      <Head icon="people-outline" title="Audience" />
      <View style={styles.kpis}>
        {a.vues != null ? <Kpi icon="👁️" value={fmt(a.vues)} label="Vues des fiches" /> : null}
        <Kpi icon="❤️" value={fmt(a.likes)} label="J’aime" />
        {a.favoris != null ? <Kpi icon="⭐" value={fmt(a.favoris)} label="Ajouts aux favoris" /> : null}
        <Kpi icon="🔔" value={fmt(a.abonnes)} label="Abonnés" />
      </View>
    </Box>
  );
}

/* ── Qualité des fiches ──────────────────────────────────────── */

function Fiches({ m, services, onOpen, onCatalog }: { m: Marketing; services: boolean; onOpen: (id: string) => void; onCatalog: () => void }) {
  const theme = useTheme();
  const f = m.fiches;
  const item = services ? 'services' : 'produits';
  const rows: [string, number, boolean][] = [
    [`${item.charAt(0).toUpperCase()}${item.slice(1)} publiés`, f.publics, false],
    ['Brouillons (non visibles)', f.brouillons, f.brouillons > 0],
    ['Publiés sans photo', f.publicsSansPhoto, f.publicsSansPhoto > 0],
    ['Sans titre Google', f.publicsSansTitreSeo, f.publicsSansTitreSeo > 0],
    ['Sans description Google', f.sansDescriptionSeo, f.sansDescriptionSeo > 0],
    ['Sans mots-clés', f.sansTags, f.sansTags > 0],
    ['Description de moins de 80 caractères', f.descriptionCourte, f.descriptionCourte > 0],
    ...(f.ruptures != null ? [['En rupture de stock', f.ruptures, f.ruptures > 0] as [string, number, boolean]] : []),
  ];
  return (
    <Box>
      <Head
        icon="document-text-outline"
        title="Qualité des fiches"
        right={
          <Pressable onPress={onCatalog} hitSlop={8} accessibilityRole="button">
            <ThemedText style={styles.linkText}>Catalogue</ThemedText>
          </Pressable>
        }
      />
      {rows.map(([label, v, warn]) => (
        <View key={label} style={styles.statRow}>
          <ThemedText style={styles.flex} themeColor="textSecondary">{label}</ThemedText>
          <ThemedText style={[styles.bold, warn && { color: '#B45309' }]}>{fmt(v)}</ThemedText>
        </View>
      ))}
      {m.aAmeliorer.length ? (
        <>
          <ThemedText style={[styles.sub, { borderTopColor: theme.border }]}>À compléter en priorité</ThemedText>
          {m.aAmeliorer.map((p) => (
            <Pressable key={p.id} onPress={() => onOpen(p.id)} accessibilityRole="button" style={({ pressed }) => [styles.fiche, pressed && styles.pressed]}>
              <Thumb uri={p.image} />
              <View style={styles.flex}>
                <ThemedText numberOfLines={1} style={styles.bold}>{p.nom}</ThemedText>
                <View style={styles.issues}>
                  {p.issues.map((i) => (
                    <View key={i} style={styles.issue}>
                      <ThemedText style={styles.issueText}>{ISSUE_LABEL[i as FicheIssue] ?? i}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
              <Ionicons name="create-outline" size={18} color={Brand.primary} />
            </Pressable>
          ))}
        </>
      ) : f.publics > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">Toutes vos fiches publiées sont complètes 👏</ThemedText>
      ) : null}
    </Box>
  );
}

function TopViewed({ m, services, onOpen }: { m: Marketing; services: boolean; onOpen: (id: string) => void }) {
  if (!m.topVus.length) return null;
  return (
    <Box>
      <Head icon="flame-outline" title={services ? 'Les plus aimés' : 'Les plus consultés'} />
      {m.topVus.map((p, i) => (
        <Pressable key={p.id} onPress={() => onOpen(p.id)} accessibilityRole="button" style={({ pressed }) => [styles.fiche, pressed && styles.pressed]}>
          <ThemedText style={styles.rank} themeColor="textSecondary">#{i + 1}</ThemedText>
          <Thumb uri={p.image} />
          <ThemedText numberOfLines={1} style={[styles.flex, styles.bold]}>{p.nom}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {services ? '' : `👁️ ${fmt(p.vues)}  `}❤️ {fmt(p.likes)}
          </ThemedText>
        </Pressable>
      ))}
    </Box>
  );
}

function Stories({ s }: { s: NonNullable<Marketing['stories']> }) {
  return (
    <Box>
      <Head icon="play-circle-outline" title="Stories — 30 derniers jours" />
      <View style={styles.kpis}>
        <Kpi icon="🎬" value={fmt(s.publiees)} label={`Publiées (${s.actives} en ligne)`} />
        <Kpi icon="👁️" value={fmt(s.vues)} label="Vues" />
        <Kpi icon="👆" value={fmt(s.clics)} label="Clics sur le bouton" />
      </View>
      {s.publiees === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Publiez une story depuis la fiche d’un produit : elle reste 24 h en tête de l’accueil des clients.
        </ThemedText>
      ) : null}
    </Box>
  );
}

function Promotions({ m, canCreate }: { m: Marketing; canCreate: boolean }) {
  const p = m.promotions;
  return (
    <Box>
      <Head
        icon="pricetags-outline"
        title="Promotions"
        right={
          <Pressable onPress={() => router.push('/entreprise/promotions')} hitSlop={8} accessibilityRole="button">
            <ThemedText style={styles.linkText}>Voir tout</ThemedText>
          </Pressable>
        }
      />
      <View style={styles.kpis}>
        <Kpi icon="🔥" value={fmt(p.actives)} label={p.planifiees ? `Actives (+${p.planifiees} planifiées)` : 'Actives'} />
        <Kpi icon="🎟️" value={fmt(p.utilisations)} label="Utilisations" />
        <Kpi icon="💰" value={`${fmt(p.caGenere)} GNF`} label="Ventes générées" />
      </View>
      {canCreate ? (
        <Pressable onPress={() => router.push('/entreprise/promotions/edition')} accessibilityRole="button" style={({ pressed }) => [styles.fixBtn, styles.selfStart, pressed && styles.pressed]}>
          <ThemedText style={styles.fixText}>＋ Créer une promotion</ThemedText>
        </Pressable>
      ) : null}
    </Box>
  );
}

function Reviews({ m }: { m: Marketing }) {
  const a = m.avis;
  return (
    <Box>
      <Head icon="star-outline" title="Réputation" />
      <View style={styles.kpis}>
        <Kpi icon="⭐" value={a.total ? `${a.note.toLocaleString('fr-FR')}/5` : '—'} label={`${a.total} avis`} />
        <Kpi icon="💬" value={fmt(a.sansReponse)} label="Avis sans réponse" />
      </View>
      {a.sansReponse > 0 ? (
        <Pressable onPress={() => router.push('/entreprise/avis')} accessibilityRole="button" style={({ pressed }) => [styles.fixBtn, styles.selfStart, pressed && styles.pressed]}>
          <ThemedText style={styles.fixText}>Répondre aux avis</ThemedText>
        </Pressable>
      ) : null}
    </Box>
  );
}

function Tips({ services }: { services: boolean }) {
  const item = services ? 'service' : 'produit';
  const tips = [
    `Titre Google : 50 à 70 caractères, avec le nom du ${item}, la marque et la ville (ex. « iPhone 13 128 Go — Conakry »).`,
    'Description Google : 120 à 160 caractères qui donnent envie de cliquer (prix, livraison, garantie).',
    'Mots-clés : les mots que vos clients tapent vraiment, séparés par des virgules.',
    'Plusieurs photos nettes, sur fond clair : une fiche avec photos est bien plus consultée.',
    'Partagez le lien de votre boutique sur WhatsApp et Facebook, et publiez des stories régulièrement.',
  ];
  return (
    <Box>
      <Head icon="bulb-outline" title="Conseils pour être mieux trouvé" />
      {tips.map((t) => (
        <View key={t} style={styles.tip}>
          <ThemedText style={styles.tipDot}>•</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>{t}</ThemedText>
        </View>
      ))}
    </Box>
  );
}

function Thumb({ uri }: { uri: string | null }) {
  const theme = useTheme();
  return uri ? (
    <Image source={{ uri: thumb(uri, 120) }} style={styles.thumb} contentFit="cover" />
  ) : (
    <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.backgroundSelected }]}>
      <Ionicons name="image-outline" size={18} color={theme.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  pressed: { opacity: 0.85 },
  selfStart: { alignSelf: 'flex-start' },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  h3: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreCircle: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  scoreV: { fontSize: 28, lineHeight: 32, fontWeight: '900' },
  scoreMax: { fontSize: 11, lineHeight: 13, fontWeight: '800' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 4 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  fixBtn: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  fixText: { color: Brand.primaryInk, fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
  share: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: Brand.primaryLine, backgroundColor: Brand.primarySoft, borderRadius: 18, padding: 14 },
  shareIco: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { fontSize: 13.5, lineHeight: 18, fontWeight: '900', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  fiche: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  issues: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  issue: { backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 },
  issueText: { color: '#92400E', fontSize: 10.5, lineHeight: 14, fontWeight: '800' },
  rank: { width: 22, textAlign: 'right', fontWeight: '800', fontSize: 12 },
  thumb: { width: 42, height: 42, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  linkText: { color: Brand.primary, fontSize: 13, lineHeight: 17, fontWeight: '800' },
  tip: { flexDirection: 'row', gap: 6 },
  tipDot: { color: Brand.primary, fontWeight: '900' },
});
