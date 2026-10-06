/**
 * Espace entreprise › Clients › profil d'un client — équivalent mobile de la
 * modale ClientProfilModal du site, en plein écran :
 *   · identité : photo, nom, segment, « Abonné », e-mail, téléphone, client depuis ;
 *   · chiffres : commandes dans la boutique, total dépensé, dernière commande ;
 *   · onglet Aperçu : relation avec la boutique (commandes, total, abonné,
 *     segment) et dernière commande ;
 *   · onglet Commandes : les 10 dernières (numéro, statut, date, mode de
 *     livraison, livrée le, total, montant des produits) — toucher une commande
 *     ouvre son détail ;
 *   · contact : message dans l'application (messaging.send), appel et WhatsApp
 *     si le client a un numéro. Sur le site, « Envoyer un message » n'affiche
 *     qu'une confirmation sans rien envoyer.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { usePermissions } from '@/features/company/hooks';
import { openConversationWith } from '@/features/messagerie/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { fetchClient, formatDate, fullGnf, gnf, modeLabel, orderStatus, relative, SEGMENTS, type ClientDetail, type ClientOrder } from '../api';
import { ClientAvatar, SegmentPill } from '../components/ui';

export default function ClientDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('orders', 'view');
  const canWrite = perms.isOwner || perms.can('messaging', 'send');
  const [tab, setTab] = useState<'apercu' | 'commandes'>('apercu');
  const [opening, setOpening] = useState(false);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.client(id ?? ''), queryFn: () => fetchClient(id ?? ''), enabled: !!id && canView });
  const c = q.data;

  const message = async () => {
    if (!c || opening) return;
    setOpening(true);
    try {
      const conv = await openConversationWith('client', c.id);
      router.push({ pathname: '/messages/[id]', params: { id: conv.id, name: conv.contactName ?? c.fullName, logo: conv.contactLogo ?? c.profilePicture ?? '', online: conv.contactOnline ? '1' : '0', userId: conv.contactUserId ?? c.userId } });
    } catch (e) {
      snack.show(toUserMessage(e), true);
    } finally {
      setOpening(false);
    }
  };

  const digits = c?.phone?.replace(/[^\d+]/g, '') ?? '';
  const openOrder = (o: ClientOrder) => router.push({ pathname: '/entreprise/commandes/[id]', params: { id: o.id } });

  let body: React.ReactNode;
  if (perms.loading || (q.isPending && canView)) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.h2}>Accès non autorisé</ThemedText>
      </View>
    );
  else if (q.isError || !c) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <Identity c={c} />

        <View style={styles.kpis}>
          <Kpi icon="🛒" value={String(c.totalOrders)} label="Commandes" sub="dans cette boutique" />
          <Kpi icon="💰" value={gnf(c.totalSpent)} label="Total dépensé" sub="depuis le début" />
          <Kpi icon="📅" value={relative(c.lastOrderAt)} label="Dernière cmd" sub={formatDate(c.lastOrderAt)} />
        </View>

        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          <TabBtn on={tab === 'apercu'} icon="person-outline" label="Aperçu" onPress={() => setTab('apercu')} />
          <TabBtn on={tab === 'commandes'} icon="cube-outline" label={`Commandes (${c.commandes.length})`} onPress={() => setTab('commandes')} />
        </View>

        {tab === 'apercu' ? (
          <View style={styles.gap}>
            <View style={[styles.box, { borderColor: theme.border }]}>
              <ThemedText style={styles.caps} themeColor="textSecondary">
                Relation avec votre boutique
              </ThemedText>
              <View style={styles.grid}>
                <Cell label="Commandes passées" value={String(c.totalOrders)} />
                <Cell label="Total dépensé" value={fullGnf(c.totalSpent)} />
                <Cell label="Abonné à la boutique" value={c.isSuivi ? '✅ Oui' : '❌ Non'} />
                <Cell label="Segment" value={`${SEGMENTS[c.segment].emoji} ${SEGMENTS[c.segment].label}`} color={SEGMENTS[c.segment].color} />
              </View>
            </View>
            {c.commandes[0] ? (
              <>
                <ThemedText style={styles.caps} themeColor="textSecondary">
                  Dernière commande
                </ThemedText>
                <OrderRow o={c.commandes[0]} onPress={() => openOrder(c.commandes[0])} />
              </>
            ) : null}
            {c.totalOrders === 0 ? (
              <View style={[styles.noOrders, { borderColor: theme.border }]}>
                <ThemedText style={styles.emoji}>🛍️</ThemedText>
                <ThemedText style={styles.bold}>Aucune commande pour le moment</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Ce client suit votre boutique mais n’a pas encore acheté.
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : c.commandes.length === 0 ? (
          <View style={styles.center}>
            <ThemedText style={styles.emoji}>📭</ThemedText>
            <ThemedText style={styles.bold}>Aucune commande</ThemedText>
          </View>
        ) : (
          <View style={styles.gap}>
            {c.commandes.map((o) => (
              <OrderRow key={o.id} o={o} onPress={() => openOrder(o)} />
            ))}
            {c.totalOrders > 10 ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                Affichage des 10 dernières commandes sur {c.totalOrders} au total.
              </ThemedText>
            ) : null}
          </View>
        )}
      </ScrollView>
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Profil client" />
      <View style={styles.flex}>{body}</View>
      {c ? (
        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          {canWrite ? (
            <Pressable onPress={() => void message()} disabled={opening} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              {opening ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="chatbubble-ellipses-outline" size={19} color={Brand.primaryInk} />}
              <ThemedText style={styles.primaryText}>Envoyer un message</ThemedText>
            </Pressable>
          ) : null}
          {digits ? (
            <>
              <IconBtn icon="call-outline" label={`Appeler ${c.fullName}`} onPress={() => void Linking.openURL(`tel:${digits}`)} />
              <IconBtn icon="logo-whatsapp" label={`WhatsApp ${c.fullName}`} onPress={() => void Linking.openURL(`https://wa.me/${digits.replace(/^\+/, '')}`)} />
            </>
          ) : null}
        </View>
      ) : null}
      <Snack msg={snack.msg} bottom={90} />
    </SafeAreaView>
  );
}

function Identity({ c }: { c: ClientDetail }) {
  const theme = useTheme();
  return (
    <View style={styles.identity}>
      <ClientAvatar name={c.fullName} photo={c.profilePicture} size={72} />
      <View style={styles.flex}>
        <ThemedText style={styles.name}>{c.fullName}</ThemedText>
        <View style={styles.tags}>
          <SegmentPill seg={c.segment} big />
          {c.isSuivi ? (
            <View style={[styles.subPill, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="checkmark-circle" size={13} color={Brand.success} />
              <ThemedText style={styles.subText}>Abonné</ThemedText>
            </View>
          ) : null}
        </View>
        <Pressable onPress={() => c.email.includes('@') && void Linking.openURL(`mailto:${c.email}`)} accessibilityRole="link" style={styles.line}>
          <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.flex}>
            {c.email}
          </ThemedText>
        </Pressable>
        {c.phone ? (
          <View style={styles.line}>
            <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {c.phone}
            </ThemedText>
          </View>
        ) : null}
        <View style={styles.line}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            Client depuis {formatDate(c.membreDepuis)}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function OrderRow({ o, onPress }: { o: ClientOrder; onPress: () => void }) {
  const theme = useTheme();
  const st = orderStatus(o.status);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Commande ${o.numero}, ${st.label}, ${fullGnf(o.total)}. Ouvrir`} style={({ pressed }) => [styles.order, { borderColor: theme.border }, pressed && styles.pressed]}>
      <View style={styles.flex}>
        <View style={styles.orderTop}>
          <ThemedText style={styles.numero}>{o.numero}</ThemedText>
          <View style={[styles.status, { backgroundColor: st.bg }]}>
            <ThemedText style={[styles.statusText, { color: st.color }]}>{st.label}</ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(o.createdAt)} · {modeLabel(o.modeLivraison)}
        </ThemedText>
        {o.livraisonEffective ? (
          <ThemedText type="small" style={{ color: Brand.success }}>
            ✓ Livré le {formatDate(o.livraisonEffective)}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.amount}>
        <ThemedText style={styles.total}>{gnf(o.total)}</ThemedText>
        {o.total !== o.sousTotal && o.sousTotal > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Produits : {gnf(o.sousTotal)}
          </ThemedText>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

function Kpi({ icon, value, label, sub }: { icon: string; value: string; label: string; sub: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { borderColor: theme.border }]} accessible accessibilityLabel={`${label} : ${value}`}>
      <ThemedText style={styles.kpiIcon}>{icon}</ThemedText>
      <ThemedText style={styles.kpiV} numberOfLines={1}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={styles.kpiSub} themeColor="textSecondary" numberOfLines={1}>
        {sub}
      </ThemedText>
    </View>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.cell, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={[styles.cellV, color ? { color } : null]}>{value}</ThemedText>
    </View>
  );
}

function TabBtn({ on, icon, label, onPress }: { on: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && [styles.tabOn, { backgroundColor: theme.background }]]}>
      <Ionicons name={icon} size={16} color={on ? Brand.primary : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ color: on ? theme.text : theme.textSecondary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function IconBtn({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.iconBtn, { borderColor: theme.border }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={21} color={icon === 'logo-whatsapp' ? '#25D366' : Brand.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  gap: { gap: 10 },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  emoji: { fontSize: 30, lineHeight: 38 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  identity: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  name: { fontSize: 21, lineHeight: 27, fontWeight: '900' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  subPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  subText: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', gap: 1 },
  kpiIcon: { fontSize: 18, lineHeight: 24 },
  kpiV: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  kpiSub: { fontSize: 11, lineHeight: 15 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, minHeight: 42 },
  tabOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  box: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  caps: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { flexBasis: '47%', flexGrow: 1, borderRadius: 12, padding: 10, gap: 2 },
  cellV: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  noOrders: { alignItems: 'center', gap: 4, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 20 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  orderTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 },
  numero: { fontSize: 14, lineHeight: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  status: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  statusText: { fontSize: 11.5, lineHeight: 16, fontWeight: '800' },
  amount: { alignItems: 'flex-end' },
  total: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  footer: { flexDirection: 'row', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
  primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 50, borderRadius: 999, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  primaryText: { color: Brand.primaryInk, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  iconBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
