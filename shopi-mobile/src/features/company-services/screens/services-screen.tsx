/**
 * Espace entreprise (compte « services ») › Mes prestations — équivalent
 * NATIF de /dashboard/entreprise/services (ServicesPage.tsx). Avant, le
 * téléphone ouvrait le site dans le navigateur intégré.
 *   · compteurs Total / Publiées / Brouillons / Retirées (touchés = filtre) ;
 *   · recherche, filtres ;
 *   · carte : photo, nom, catégorie, tarif, durée, lieux (sur place,
 *     à domicile, à distance), statut ;
 *   · toucher = modifier ; ⋯ = Publier / Retirer du catalogue / Voir la
 *     fiche publique / Supprimer (selon les permissions de l'équipe).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { confirmAction } from '@/lib/confirm';
import { qk } from '@/lib/query-keys';
import { hideOnScroll } from '@/lib/scroll-chrome';

import {
  archiveService,
  deleteService,
  durationLabel,
  fetchMyServices,
  normalize,
  priceLabel,
  publishService,
  VISIBILITY,
  type Service,
  type ServiceVisibility,
} from '../api';

type Filter = ServiceVisibility | 'tous';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'tous', label: 'Toutes' },
  { key: 'public', label: 'Publiées' },
  { key: 'draft', label: 'Brouillons' },
  { key: 'private', label: 'Retirées' },
];

export default function CompanyServicesScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const snack = useSnack();
  const perms = usePermissions();
  const canView = perms.can('services', 'view');
  const canCreate = perms.can('services', 'create');
  const canEdit = perms.can('services', 'edit');
  const canDelete = perms.can('services', 'delete');
  const [filter, setFilter] = useState<Filter>('tous');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({ queryKey: qk.company.services, queryFn: fetchMyServices, enabled: canView });
  const services = q.data ?? [];

  const count = (f: Filter) => (f === 'tous' ? services.length : services.filter((s) => s.visibilite === f).length);
  const term = normalize(search.trim());
  const list = services
    .filter((s) => filter === 'tous' || s.visibilite === filter)
    .filter((s) => !term || normalize(`${s.nom} ${s.category?.nom ?? ''} ${s.tags ?? ''}`).includes(term));

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.company.services });
  const run = async (s: Service, fn: () => Promise<unknown>, ok: string) => {
    setBusy(s.id);
    try {
      await fn();
      refresh();
      snack.show(ok);
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setBusy(null);
    }
  };

  const actions = (s: Service) => {
    const items: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [];
    if (canEdit) items.push({ text: 'Modifier', onPress: () => router.push({ pathname: '/entreprise/services/[id]', params: { id: s.id } }) });
    if (canEdit && s.visibilite !== 'public') items.push({ text: 'Publier', onPress: () => void run(s, () => publishService(s.id), 'Prestation publiée') });
    if (canEdit && s.visibilite === 'public') items.push({ text: 'Retirer du catalogue', onPress: () => void run(s, () => archiveService(s.id), 'Prestation retirée du catalogue') });
    if (s.visibilite === 'public') items.push({ text: 'Voir la fiche publique', onPress: () => router.push({ pathname: '/service/[id]', params: { id: s.id } }) });
    if (canDelete)
      items.push({
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          if (await confirmAction('Supprimer cette prestation ?', `« ${s.nom} » sera supprimée définitivement.`, 'Supprimer', true)) {
            void run(s, () => deleteService(s.id), 'Prestation supprimée');
          }
        },
      });
    items.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(s.nom, undefined, items);
  };

  const STATS = [
    { label: 'Total', value: services.length, icon: 'construct-outline' as const, color: Brand.primaryInk, bg: Brand.primarySoft, f: 'tous' as Filter },
    { label: 'Publiées', value: count('public'), icon: 'globe-outline' as const, color: '#047857', bg: '#ECFDF5', f: 'public' as Filter },
    { label: 'Brouillons', value: count('draft'), icon: 'document-text-outline' as const, color: '#B45309', bg: '#FFF7E6', f: 'draft' as Filter },
    { label: 'Retirées', value: count('private'), icon: 'eye-off-outline' as const, color: '#6B7280', bg: '#F3F4F6', f: 'private' as Filter },
  ];

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de consulter les prestations. Demandez l’accès au propriétaire.
        </ThemedText>
      </View>
    );
  else if (q.isError && !q.data) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <FlatList
        data={list}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        {...hideOnScroll}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.title}>Mes prestations</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Ce que vous proposez à vos clients
                </ThemedText>
              </View>
              {canCreate ? (
                <Pressable onPress={() => router.push('/entreprise/services/nouveau')} accessibilityRole="button" style={styles.newBtn}>
                  <Ionicons name="add" size={18} color={Brand.primaryInk} />
                  <ThemedText style={styles.newText}>Nouvelle</ThemedText>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.stats}>
              {STATS.map((s) => (
                <Pressable key={s.label} onPress={() => setFilter(s.f)} accessibilityRole="button" accessibilityLabel={`${s.label} : ${s.value}`} style={[styles.stat, { backgroundColor: s.bg }]}>
                  <Ionicons name={s.icon} size={16} color={s.color} />
                  <ThemedText style={[styles.statV, { color: s.color }]}>{s.value}</ThemedText>
                  <ThemedText style={[styles.statL, { color: s.color }]} numberOfLines={1}>
                    {s.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={17} color={theme.textSecondary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher une prestation…" placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} accessibilityLabel="Rechercher une prestation" returnKeyType="search" />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText style={styles.chipText}>
                      {f.label} ({count(f.key)})
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {q.isPending ? <ActivityIndicator color={Brand.primary} /> : null}
          </View>
        }
        ListEmptyComponent={
          q.isPending ? null : (
            <View style={styles.empty}>
              <View style={[styles.emptyIco, { backgroundColor: Brand.primarySoft }]}>
                <Ionicons name="construct-outline" size={28} color={Brand.primary} />
              </View>
              <ThemedText style={styles.emptyTitle}>{services.length ? 'Aucun résultat' : 'Aucune prestation encore'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {services.length ? 'Essayez de modifier vos filtres.' : 'Ajoutez votre première prestation : nom, tarif, durée, lieu et photos.'}
              </ThemedText>
              {!services.length && canCreate ? (
                <Pressable onPress={() => router.push('/entreprise/services/nouveau')} accessibilityRole="button" style={[styles.newBtn, styles.emptyBtn]}>
                  <Ionicons name="add" size={18} color={Brand.primaryInk} />
                  <ThemedText style={styles.newText}>Ajouter une prestation</ThemedText>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item: s }) => {
          const img = s.media.find((m) => m.type !== 'video')?.url;
          const v = VISIBILITY[s.visibilite];
          const duree = durationLabel(s.dureeMinMinutes, s.dureeMaxMinutes);
          const lieux = [s.surPlaceEntreprise && 'Sur place', s.aDomicile && 'À domicile', s.aDistance && 'À distance'].filter(Boolean).join(' · ');
          return (
            <Pressable
              onPress={() => (canEdit ? router.push({ pathname: '/entreprise/services/[id]', params: { id: s.id } }) : actions(s))}
              accessibilityRole="button"
              accessibilityLabel={`${s.nom}, ${priceLabel(s)}, ${v.label}`}
              style={({ pressed }) => [styles.card, { borderColor: theme.border }, pressed && styles.pressed]}>
              <View style={[styles.img, { backgroundColor: theme.backgroundElement }]}>
                {img ? <Image source={{ uri: thumb(img, 200) ?? img }} style={styles.fill} contentFit="cover" /> : <Ionicons name="image-outline" size={24} color={theme.textSecondary} />}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.name} numberOfLines={2}>
                  {s.nom}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {[s.category?.nom, duree].filter(Boolean).join(' · ')}
                </ThemedText>
                {lieux ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {lieux}
                  </ThemedText>
                ) : null}
                <View style={styles.cardFoot}>
                  <ThemedText style={styles.price}>{priceLabel(s)}</ThemedText>
                  <View style={[styles.pill, { backgroundColor: v.bg }]}>
                    <ThemedText style={[styles.pillText, { color: v.color }]}>{v.label}</ThemedText>
                  </View>
                </View>
                {s.visibilite === 'draft' && !img ? (
                  <ThemedText type="small" style={styles.hint}>
                    Ajoutez une photo pour pouvoir la publier.
                  </ThemedText>
                ) : null}
              </View>
              {busy === s.id ? (
                <ActivityIndicator color={Brand.primary} />
              ) : (
                <Pressable onPress={() => actions(s)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Actions — ${s.nom}`} style={styles.more}>
                  <Ionicons name="ellipsis-vertical" size={18} color={theme.text} />
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Services" subtitle={`${services.length} prestation${services.length > 1 ? 's' : ''}`} />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="services" />
      <Snack msg={snack.msg} bottom={96} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.85 },
  loader: { marginTop: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 10, paddingBottom: 110 },
  header: { gap: 14, marginBottom: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  newText: { color: Brand.primaryInk, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, gap: 2 },
  statV: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  statL: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  emptyBtn: { marginTop: 8 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 18, padding: 10 },
  img: { width: 76, height: 76, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  price: { fontSize: 14, lineHeight: 19, fontWeight: '900' },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  hint: { color: '#B45309', marginTop: 2 },
  more: { padding: 6 },
});
