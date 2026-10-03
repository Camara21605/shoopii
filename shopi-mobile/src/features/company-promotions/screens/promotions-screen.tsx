/**
 * Espace entreprise › Promotions — version mobile de /dashboard/entreprise/promotions
 * (PromotionsPage.tsx), mêmes données :
 *   · bandeau « Créer une promotion » ;
 *   · 4 chiffres : promotions (total), actives (+ planifiées), utilisations, CA généré ;
 *   · filtres Toutes / Actives / Planifiées / Brouillons / En pause / Terminées
 *     avec compteurs, recherche (nom ou code, côté serveur) ;
 *   · une carte par promotion (voir promo-card.tsx) : copier le code, modifier,
 *     activer, mettre en pause, terminer, supprimer (une promotion active doit
 *     d'abord être mise en pause — règle du serveur) ;
 *   · performance des promotions, créer rapidement (modèles), meilleures
 *     promotions, conseils.
 * Droits : promotions.view / create / edit / delete (propriétaire : tout).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { CompanyBottomNav, CompanyHeader } from '@/features/company/components';
import { usePermissions } from '@/features/company/hooks';
import { fetchAllProducts } from '@/features/company-products/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  activatePromo, deletePromo, endPromo, fetchPromos, fetchStats, pausePromo, shortGnf, STATUS,
  type Promo, type PromoStatus,
} from '../api';
import { PromoCard } from '../components/promo-card';
import { TEMPLATES } from '../promo-form';

type Filter = 'all' | PromoStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Toutes' }, { key: 'active', label: 'Actives' }, { key: 'scheduled', label: 'Planifiées' },
  { key: 'draft', label: 'Brouillons' }, { key: 'paused', label: 'En pause' }, { key: 'ended', label: 'Terminées' },
];
const TIPS = [
  { icon: '⚡', text: 'Une vente flash courte (24–48 h) crée l’urgence : annoncez-la en story le jour même.' },
  { icon: '🚚', text: 'La livraison offerte au-delà d’un montant augmente le panier moyen.' },
  { icon: '🎯', text: 'Ciblez vos produits à faible rotation plutôt que tout le catalogue pour protéger vos marges.' },
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const openForm = (params?: { id?: string; template?: string }) =>
  router.push({ pathname: '/entreprise/promotions/edition', params: params ?? {} });

export default function CompanyPromotionsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canView = perms.can('promotions', 'view');
  const canCreate = perms.can('promotions', 'create');
  const canEdit = perms.can('promotions', 'edit');
  const canDelete = perms.can('promotions', 'delete');
  const snack = useSnack();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 350);

  const stats = useQuery({ queryKey: qk.companyPromos.stats, queryFn: fetchStats, enabled: canView });
  const list = useQuery({ queryKey: qk.companyPromos.list(term), queryFn: ({ signal }) => fetchPromos(term, signal), enabled: canView });
  const products = useQuery({ queryKey: qk.company.products, queryFn: fetchAllProducts, enabled: canView, staleTime: 5 * 60_000 });
  const names = new Map((products.data ?? []).map((p) => [p.id, p.nom]));

  const promos = list.data ?? [];
  const shown = filter === 'all' ? promos : promos.filter((p) => p.status === filter);
  const count = (k: Filter) => (k === 'all' ? promos.length : promos.filter((p) => p.status === k).length);
  const maxUses = Math.max(1, ...promos.map((p) => p.uses));
  const refresh = () => void qc.invalidateQueries({ queryKey: qk.companyPromos.all });

  const act = useMutation({
    mutationFn: async ({ kind, p }: { kind: 'activate' | 'pause' | 'end' | 'delete'; p: Promo }) => {
      if (kind === 'activate') { await activatePromo(p.id); return `« ${p.nom} » est active : la réduction s’affiche sur vos produits`; }
      if (kind === 'pause') { await pausePromo(p.id); return `« ${p.nom} » est en pause`; }
      if (kind === 'end') { await endPromo(p.id); return `« ${p.nom} » est terminée`; }
      await deletePromo(p.id);
      return `« ${p.nom} » a été supprimée`;
    },
    onSuccess: (m) => { snack.show(m); refresh(); void qc.invalidateQueries({ queryKey: qk.company.products }); },
    onError: (e) => { snack.show(toUserMessage(e), true); refresh(); },
  });

  function more(p: Promo) {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [];
    if (p.status !== 'ended' && canEdit) {
      buttons.push({ text: 'Terminer la promotion', style: 'destructive', onPress: () => Alert.alert(
        'Terminer cette promotion ?', `« ${p.nom} » s’arrêtera définitivement et ne pourra plus être réactivée.`,
        [{ text: 'Annuler', style: 'cancel' }, { text: 'Terminer', style: 'destructive', onPress: () => act.mutate({ kind: 'end', p }) }]) });
    }
    if (canDelete) {
      buttons.push({ text: 'Supprimer', style: 'destructive', onPress: () => {
        if (p.status === 'active') { Alert.alert('Promotion active', 'Mettez-la en pause avant de la supprimer.'); return; }
        Alert.alert('Supprimer cette promotion ?', `« ${p.nom} » (${p.code}) sera supprimée définitivement, avec ses statistiques.`,
          [{ text: 'Annuler', style: 'cancel' }, { text: 'Supprimer', style: 'destructive', onPress: () => act.mutate({ kind: 'delete', p }) }]);
      } });
    }
    buttons.push({ text: 'Fermer', style: 'cancel' });
    Alert.alert(p.nom, `${p.code} · ${STATUS[p.status].label}`, buttons);
  }

  let body: React.ReactNode;
  if (perms.loading) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.centerBox}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.deniedTitle}>Accès non autorisé</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Votre rôle dans l’équipe ne permet pas de voir les promotions. Demandez l’accès au propriétaire de la boutique.
        </ThemedText>
      </View>
    );
  else if (list.isError && !list.data) body = <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  else {
    const s = stats.data;
    const perf = promos.filter((p) => p.uses > 0 || p.status === 'active').sort((a, b) => b.uses - a.uses).slice(0, 5);
    const best = [...promos].filter((p) => p.uses > 0).sort((a, b) => b.uses - a.uses).slice(0, 3);
    body = (
      <FlatList
        data={list.isPending ? [] : shown}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.hero, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={styles.heroTitle}>Boostez vos ventes</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Codes promo, livraison offerte, lots et ventes flash, sur toute la boutique ou des produits choisis.</ThemedText>
              {canCreate ? (
                <Pressable onPress={() => openForm()} accessibilityRole="button" style={styles.heroBtn}>
                  <Ionicons name="add" size={19} color="#fff" />
                  <ThemedText type="smallBold" style={styles.white}>Créer une promotion</ThemedText>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.kpis}>
              <Kpi icon="🏷️" v={s ? String(s.total) : '…'} l="Promotions" />
              <Kpi icon="✅" v={s ? String(s.actives) : '…'} l="Actives" sub={s?.planifiees ? `${s.planifiees} planifiée(s)` : undefined} />
              <Kpi icon="👆" v={s ? s.totalUses.toLocaleString('fr-FR') : '…'} l="Utilisations" />
              <Kpi icon="💰" v={s ? shortGnf(s.totalCa) : '…'} l="CA généré (GNF)" />
            </View>

            <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="search" size={17} color={theme.textSecondary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Nom ou code promo" placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text }]} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Rechercher une promotion" />
              {list.isFetching && search ? <ActivityIndicator size="small" color={Brand.primary} /> : search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer"><Ionicons name="close-circle" size={18} color={theme.textSecondary} /></Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {FILTERS.map((f) => {
                const on = filter === f.key;
                return (
                  <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primary : theme.background }]}>
                    <ThemedText style={[styles.chipText, on && styles.white]}>{f.label}</ThemedText>
                    <View style={[styles.chipCount, { backgroundColor: on ? 'rgba(255,255,255,.22)' : theme.backgroundElement }]}>
                      <ThemedText style={[styles.chipCountText, on && styles.white]}>{count(f.key)}</ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {list.isPending ? <ActivityIndicator color={Brand.primary} style={styles.loader} /> : null}
          </View>
        }
        ListEmptyComponent={list.isPending ? null : (
          <View style={styles.empty}>
            <ThemedText style={styles.emptyEmoji}>🏷️</ThemedText>
            <ThemedText style={styles.emptyTitle}>{term ? 'Aucun résultat' : promos.length ? 'Aucune promotion ici' : 'Aucune promotion'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {term ? `Aucune promotion ne correspond à « ${term} ».` : promos.length ? 'Aucune promotion avec ce statut.' : 'Créez votre première promotion pour attirer de nouveaux clients.'}
            </ThemedText>
            {!promos.length && canCreate && !term ? (
              <Pressable onPress={() => openForm()} accessibilityRole="button" style={styles.heroBtn}>
                <Ionicons name="add" size={19} color="#fff" />
                <ThemedText type="smallBold" style={styles.white}>Créer une promotion</ThemedText>
              </Pressable>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <PromoCard
            p={item}
            productNames={item.productIds.map((id) => names.get(id)).filter((x): x is string => !!x)}
            busy={act.isPending && act.variables?.p.id === item.id}
            canEdit={canEdit || canDelete}
            onEdit={() => (canEdit ? openForm({ id: item.id }) : Alert.alert('Accès refusé', 'Votre rôle ne permet pas de modifier les promotions.'))}
            onActivate={() => act.mutate({ kind: 'activate', p: item })}
            onPause={() => act.mutate({ kind: 'pause', p: item })}
            onMore={() => more(item)}
            onCopied={(c) => snack.show(`Code ${c} copié`)}
          />
        )}
        ListFooterComponent={
          <View style={styles.side}>
            {perf.length ? (
              <Panel icon="bar-chart-outline" title="Performance des promotions">
                {perf.map((p) => (
                  <View key={p.id} style={styles.perf}>
                    <View style={styles.perfHead}>
                      <ThemedText numberOfLines={1} style={styles.flex}>{p.nom}</ThemedText>
                      <ThemedText type="smallBold">{p.uses} util.</ThemedText>
                    </View>
                    <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                      <View style={[styles.fill, { width: `${Math.max(2, (p.uses / maxUses) * 100)}%` }]} />
                    </View>
                  </View>
                ))}
              </Panel>
            ) : null}
            {canCreate ? (
              <Panel icon="sparkles-outline" title="Créer rapidement">
                {TEMPLATES.map((t, i) => (
                  <Pressable key={t.label} onPress={() => openForm({ template: String(i) })} accessibilityRole="button"
                    style={({ pressed }) => [styles.tpl, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.tplIco, { backgroundColor: theme.backgroundElement }]}><ThemedText style={styles.tplEmoji}>{t.icon}</ThemedText></View>
                    <View style={styles.flex}>
                      <ThemedText style={styles.tplLabel}>{t.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{t.sub}</ThemedText>
                    </View>
                    <Ionicons name="add-circle-outline" size={20} color={theme.text} />
                  </Pressable>
                ))}
              </Panel>
            ) : null}
            {best.length ? (
              <Panel icon="flame-outline" title="Meilleures promotions">
                {best.map((p, i) => (
                  <View key={p.id} style={styles.best}>
                    <ThemedText style={styles.rank}>#{i + 1}</ThemedText>
                    <View style={styles.flex}>
                      <ThemedText numberOfLines={1} style={styles.tplLabel}>{p.nom}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{p.code}</ThemedText>
                    </View>
                    <ThemedText type="smallBold">{p.uses} util.</ThemedText>
                  </View>
                ))}
              </Panel>
            ) : null}
            <Panel icon="bulb-outline" title="Conseils">
              {TIPS.map((t) => (
                <View key={t.text} style={styles.tip}>
                  <ThemedText>{t.icon}</ThemedText>
                  <ThemedText type="small" style={styles.flex}>{t.text}</ThemedText>
                </View>
              ))}
            </Panel>
          </View>
        }
      />
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top']}>
      <CompanyHeader title="Promotions" subtitle="Codes promo et offres de la boutique" />
      <View style={styles.flex}>{body}</View>
      <CompanyBottomNav active="promotions" />
      <Snack msg={snack.msg} bottom={96} />
    </SafeAreaView>
  );
}

function Kpi({ icon, v, l, sub }: { icon: string; v: string; l: string; sub?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { borderColor: theme.border }]}>
      <ThemedText style={styles.kpiIco}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV} numberOfLines={1}>{v}</ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>{l}</ThemedText>
      {sub ? <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{sub}</ThemedText> : null}
    </View>
  );
}

function Panel({ icon, title, children }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, { borderColor: theme.border }]}>
      <View style={styles.panelHead}>
        <Ionicons name={icon} size={17} color={theme.text} />
        <ThemedText style={styles.panelTitle}>{title}</ThemedText>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#fff' },
  loader: { marginTop: 20 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  deniedTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { gap: 12 },
  hero: { borderRadius: 18, padding: 16, gap: 6 },
  heroTitle: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  heroBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Brand.primary, borderRadius: 999, minHeight: 46, paddingHorizontal: 18, marginTop: 8, alignSelf: 'stretch' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 1 },
  kpiIco: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 22, lineHeight: 28, fontWeight: '900' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, minHeight: 44 },
  input: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.2, borderRadius: 999, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipCount: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chipCountText: { fontSize: 11.5, lineHeight: 15, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 40, lineHeight: 48 },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900' },
  side: { gap: 12, marginTop: 8 },
  panel: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 },
  panelTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  panelBody: { padding: 14, gap: 10 },
  perf: { gap: 5 },
  perfHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: Brand.primary },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  tplIco: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tplEmoji: { fontSize: 19, lineHeight: 25 },
  tplLabel: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  best: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { fontSize: 15, fontWeight: '900', width: 30 },
  tip: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
