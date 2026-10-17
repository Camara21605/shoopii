/**
 * Fiche d'une prestation (vue client) : photos, prix, durée, lieux, réservation,
 * prestataire, puis « Demander un devis » / « Contacter » qui ouvre la discussion
 * avec la boutique, message pré-rempli (modifiable avant l'envoi).
 *
 * Même règle que la boutique : un client doit être abonné pour lui écrire.
 * Le propriétaire qui ouvre sa propre prestation voit « Modifier » à la place.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { requireAuth } from '@/features/auth/auth-gate';
import { useSession } from '@/features/auth/session-store';
import { fetchFollowStatus, startConversation } from '@/features/shop/api';
import { toggleFollow } from '@/features/catalog/api';
import { formatPrice, productFrame } from '@/features/catalog/format';
import { openShop } from '@/features/catalog/open';
import { useIsMyShop } from '@/features/shop/own';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { DELAY_LABEL, fetchPublicService, POLICY_LABEL, type PublicService } from '../api';

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
const durationOf = (s: PublicService) => {
  const { dureeMinMinutes: a, dureeMaxMinutes: b } = s;
  if (a && b && a !== b) return `${fmtMin(a)} – ${fmtMin(b)}`;
  return a ? fmtMin(a) : b ? fmtMin(b) : null;
};
const priceOf = (s: PublicService) =>
  s.pricingType === 'sur_devis' ? 'Sur devis' : s.prix != null ? `${formatPrice(s.prix)}${s.pricingType === 'horaire' ? ' / heure' : ''}` : 'Sur devis';

export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const role = useSession((st) => st.user?.role);
  const isClient = role === 'client';
  const [page, setPage] = useState(0);

  const q = useQuery({ queryKey: qk.servicePublic(id), queryFn: () => fetchPublicService(id), enabled: !!id });
  const sv = q.data;
  const isOwn = useIsMyShop(sv?.companyId);
  const followQ = useQuery({
    queryKey: qk.follows.status('entreprises', sv?.companyId ?? ''),
    queryFn: () => fetchFollowStatus('entreprises', sv!.companyId),
    enabled: isClient && !!sv?.companyId,
  });

  const quote = sv?.pricingType === 'sur_devis' || sv?.prix == null;
  const prefill = sv ? (quote ? `Bonjour, je souhaite un devis pour « ${sv.nom} ».` : `Bonjour, je suis intéressé(e) par « ${sv.nom} ».`) : '';

  const message = useMutation({
    mutationFn: () => startConversation('company', sv!.companyId),
    onSuccess: (convId) =>
      router.push({ pathname: '/messages/[id]', params: { id: convId, name: sv?.companyName ?? '', logo: sv?.companyLogo ?? '', prefill } }),
    onError: (e) => Alert.alert('Message', toUserMessage(e)),
  });
  const follow = useMutation({
    mutationFn: () => toggleFollow('entreprises', sv!.companyId),
    onSuccess: (r) => {
      qc.setQueryData(qk.follows.status('entreprises', sv!.companyId), r.isSuivi);
      void qc.invalidateQueries({ queryKey: qk.follows.all });
      if (r.isSuivi) message.mutate();
    },
    onError: (e) => Alert.alert('Abonnement', toUserMessage(e)),
  });

  const onContact = () => {
    if (!role) return requireAuth(() => undefined, 'Connectez-vous pour écrire au prestataire.');
    if (isClient && !followQ.data)
      return Alert.alert('Abonnez-vous d’abord', `Abonnez-vous à ${sv?.companyName || 'cette boutique'} pour pouvoir lui écrire.`, [
        { text: 'Annuler', style: 'cancel' },
        { text: 'S’abonner', onPress: () => follow.mutate() },
      ]);
    message.mutate();
  };

  const header = (
    <View style={[st.header, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </Pressable>
      <ThemedText style={st.headerTitle} numberOfLines={1}>Prestation</ThemedText>
    </View>
  );

  if (q.isLoading || !sv) {
    return (
      <SafeAreaView style={[st.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        {q.isLoading ? <ActivityIndicator color={Brand.primary} style={st.loader} /> : (
          <View style={st.empty}>
            <Ionicons name="construct-outline" size={40} color={theme.textSecondary} />
            <ThemedText style={st.emptyTitle}>Prestation indisponible</ThemedText>
            <ThemedText themeColor="textSecondary" style={st.center}>{q.error ? toUserMessage(q.error) : 'Cette prestation n’est pas (ou plus) publiée.'}</ThemedText>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const images = [...sv.media].sort((a, b) => a.ordre - b.ordre).filter((m) => m.type !== 'video');
  const duration = durationOf(sv);
  const places = [
    sv.surPlaceEntreprise && { icon: 'storefront-outline' as const, label: 'Dans les locaux du prestataire' },
    sv.aDomicile && {
      icon: 'home-outline' as const,
      label: `À domicile${sv.zoneCouverture ? ` · ${sv.zoneCouverture}` : ''}${sv.fraisDeplacement ? ` · déplacement ${formatPrice(sv.fraisDeplacement)}` : ''}`,
    },
    sv.aDistance && { icon: 'videocam-outline' as const, label: 'À distance' },
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string }[];
  const busy = message.isPending || follow.isPending;

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={st.scroll}>
        {images.length ? (
          <View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {images.map((m) => (
                <Image key={m.id} source={{ uri: productFrame(m.url, 1000) ?? m.url }} style={{ width, height: width * 0.75, backgroundColor: theme.backgroundElement }} contentFit="cover" />
              ))}
            </ScrollView>
            {images.length > 1 ? (
              <View style={st.dots}>
                {images.map((m, i) => <View key={m.id} style={[st.dot, { backgroundColor: i === page ? Brand.primary : 'rgba(255,255,255,0.7)' }]} />)}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={[st.noImg, { height: width * 0.5, backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={st.noImgEmoji}>{sv.category?.icone || '🛠️'}</ThemedText>
          </View>
        )}

        <View style={st.body}>
          {sv.category ? (
            <ThemedText type="small" themeColor="textSecondary">{[sv.category.nom, sv.subCategory?.nom].filter(Boolean).join(' · ')}</ThemedText>
          ) : null}
          <ThemedText style={st.name}>{sv.nom}</ThemedText>
          <View style={st.priceRow}>
            <ThemedText style={st.price}>{priceOf(sv)}</ThemedText>
            {sv.prixAncien && sv.prix != null && sv.prixAncien > sv.prix ? (
              <ThemedText themeColor="textSecondary" style={st.old}>{formatPrice(sv.prixAncien)}</ThemedText>
            ) : null}
          </View>

          <View style={st.tags}>
            {duration ? <Tag icon="time-outline" text={duration} /> : null}
            {sv.reservationRequise ? <Tag icon="calendar-outline" text="Sur réservation" /> : null}
            {sv.capaciteMax ? <Tag icon="people-outline" text={`Jusqu’à ${sv.capaciteMax} pers.`} /> : null}
            <Tag icon="chatbubble-ellipses-outline" text={DELAY_LABEL[sv.delaiReponse] ?? 'Réponse rapide'} />
          </View>

          {places.length ? (
            <Section title="Où ?">
              {places.map((p) => (
                <View key={p.label} style={st.line}>
                  <Ionicons name={p.icon} size={18} color={Brand.primary} />
                  <ThemedText style={st.flex}>{p.label}</ThemedText>
                </View>
              ))}
            </Section>
          ) : null}

          {sv.description ? (
            <Section title="Description">
              <ThemedText style={st.desc}>{sv.description}</ThemedText>
            </Section>
          ) : null}

          {sv.specs.length ? (
            <Section title="Détails">
              {sv.specs.map((s) => (
                <View key={`${s.cle}-${s.valeur}`} style={st.spec}>
                  <ThemedText themeColor="textSecondary" style={st.flex}>{s.cle}</ThemedText>
                  <ThemedText style={st.specVal}>{s.valeur}</ThemedText>
                </View>
              ))}
            </Section>
          ) : null}

          <Section title="Conditions">
            <View style={st.line}>
              <Ionicons name="refresh-outline" size={18} color={Brand.primary} />
              <ThemedText style={st.flex}>{POLICY_LABEL[sv.politiqueAnnulation] ?? 'Annulation selon le prestataire'}</ThemedText>
            </View>
            {sv.garantiePaiement ? (
              <View style={st.line}><Ionicons name="shield-checkmark-outline" size={18} color={Brand.success} /><ThemedText style={st.flex}>Paiement sécurisé</ThemedText></View>
            ) : null}
            {sv.garantieSatisfaction ? (
              <View style={st.line}><Ionicons name="happy-outline" size={18} color={Brand.success} /><ThemedText style={st.flex}>Satisfaction garantie</ThemedText></View>
            ) : null}
          </Section>

          <Pressable onPress={() => openShop(sv.companyId)} accessibilityRole="button"
            style={({ pressed }) => [st.seller, { borderColor: theme.border }, pressed && st.pressed]}>
            <View style={[st.logo, { backgroundColor: theme.backgroundElement }]}>
              {sv.companyLogo ? <Image source={{ uri: sv.companyLogo }} style={st.fill} contentFit="cover" /> : <Ionicons name="storefront-outline" size={22} color={theme.textSecondary} />}
            </View>
            <View style={st.flex}>
              <View style={st.sellerName}>
                <ThemedText style={st.bold} numberOfLines={1}>{sv.companyName || 'Prestataire'}</ThemedText>
                {sv.companyVerified ? <Ionicons name="checkmark-circle" size={16} color={Brand.primary} /> : null}
              </View>
              <ThemedText type="small" themeColor="textSecondary">{sv.companyVille ? `${sv.companyVille} · ` : ''}Voir la boutique</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[st.bar, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        {isOwn ? (
          <Pressable onPress={() => router.push({ pathname: '/entreprise/services/[id]', params: { id: sv.id } })} accessibilityRole="button"
            style={({ pressed }) => [st.cta, pressed && st.pressed]}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <ThemedText style={st.ctaText}>Modifier ma prestation</ThemedText>
          </Pressable>
        ) : (
          <Pressable onPress={onContact} disabled={busy} accessibilityRole="button"
            style={({ pressed }) => [st.cta, (pressed || busy) && st.pressed]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name={quote ? 'document-text-outline' : 'chatbubble-outline'} size={18} color="#fff" />}
            <ThemedText style={st.ctaText}>{quote ? 'Demander un devis' : sv.reservationRequise ? 'Réserver / Contacter' : 'Contacter le prestataire'}</ThemedText>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function Tag({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <View style={[st.tag, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={14} color={theme.textSecondary} />
      <ThemedText style={st.tagText}>{text}</ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <ThemedText style={st.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  loader: { marginTop: 48 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  center: { textAlign: 'center' },
  scroll: { paddingBottom: 24 },
  dots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  noImg: { alignItems: 'center', justifyContent: 'center' },
  noImgEmoji: { fontSize: 56, lineHeight: 64 },
  body: { padding: 16, gap: 6 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  price: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: Brand.primary },
  old: { textDecorationLine: 'line-through' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tagText: { fontSize: 13, lineHeight: 17 },
  section: { marginTop: 16, gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  desc: { lineHeight: 22 },
  spec: { flexDirection: 'row', gap: 12 },
  specVal: { fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  seller: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  logo: { width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  sellerName: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bold: { fontWeight: '700', flexShrink: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  bar: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primary, borderRadius: 14, paddingVertical: 14 },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
