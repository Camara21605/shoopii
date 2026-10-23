/**
 * Espace entreprise › Mes livreurs › fiche d'un livreur (fenêtre « Profil »
 * du site, GET /livreurs/:id) :
 *   · identité : véhicule, disponibilité, statut, plaque, zone, téléphone, e-mail ;
 *   · 4 chiffres : courses (réussies), taux de réussite, note sur 5, gains cumulés ;
 *   · détails : livraisons du jour, dernière activité, membre depuis ;
 *   · actions : Message et Appel dans l'application (si l'entreprise le suit,
 *     comme sur le site), WhatsApp, Téléphone, e-mail (deliveries.edit),
 *     Suivre / ne plus suivre, Valider (en attente, deliveries.assign),
 *     Suspendre / Réactiver (deliveries.edit).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  STATUS, VEHICLE, fetchDriver, reactivateDriver, shortGnf, successRate, toggleFollowDriver, validateDriver,
} from '../api';
import { useDriverContact } from '../contact';
import { AvailBadge, DriverAvatar, Pill } from '../components/driver-rows';
import { ContactSheet, SuspendSheet } from '../components/sheets';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function DriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.can('deliveries', 'edit');
  const canAssign = perms.can('deliveries', 'assign');
  const contact = useDriverContact();
  const snack = useSnack();
  const [sheet, setSheet] = useState<null | 'contact' | 'suspend'>(null);

  const q = useQuery({ queryKey: qk.companyDrivers.detail(id), queryFn: () => fetchDriver(id), enabled: !!id });
  const d = q.data;

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.companyDrivers.all });
  const done = (m: string, error = false) => { setSheet(null); snack.show(m, error); refresh(); };

  const act = useMutation({
    mutationFn: async (kind: 'valider' | 'reactiver' | 'suivre') => {
      if (kind === 'valider') { await validateDriver(id); return 'Livreur validé : il peut recevoir vos courses'; }
      if (kind === 'reactiver') { await reactivateDriver(id); return 'Livreur réactivé'; }
      const r = await toggleFollowDriver(id);
      void qc.invalidateQueries({ queryKey: qk.follows.all });
      return r.isSuivi ? 'Vous suivez ce livreur : message et appel débloqués' : 'Vous ne suivez plus ce livreur';
    },
    onSuccess: (m) => done(m),
    onError: (e) => done(toUserMessage(e), true),
  });

  const header = (
    <View style={[styles.top, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/entreprise/livreurs'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </Pressable>
      <ThemedText style={styles.topTitle} numberOfLines={1}>{d?.fullName ?? 'Livreur'}</ThemedText>
    </View>
  );

  if (!d) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <ActivityIndicator color={Brand.primary} style={styles.loader} />}
      </SafeAreaView>
    );
  }

  const confirm = (title: string, text: string, label: string, kind: 'valider' | 'reactiver') =>
    Alert.alert(title, text, [{ text: 'Annuler', style: 'cancel' }, { text: label, onPress: () => act.mutate(kind) }]);

  const rate = successRate(d);
  const joined = d.joinedAt ? new Date(d.joinedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {/* Identité */}
        <View style={styles.hero}>
          <DriverAvatar emoji={d.avatarEmoji} photo={d.photo} availability={d.availability} size={84} />
          <ThemedText style={styles.name}>{d.fullName}</ThemedText>
          <View style={styles.badges}>
            <AvailBadge a={d.availability} />
            <Pill label={STATUS[d.status]} color={d.status === 'active' ? Brand.success : d.status === 'pending' ? Brand.primaryInk : Brand.danger} soft />
            <Pill label={`${d.vehicleEmoji} ${VEHICLE[d.vehicleType] ?? d.vehicleType}${d.vehiclePlate ? ` · ${d.vehiclePlate}` : ''}`} color={theme.textSecondary} soft />
            {d.isSuivi ? <Pill label="Suivi" color={Brand.primaryInk} soft /> : null}
          </View>
        </View>

        {d.status === 'pending' ? (
          <Banner icon="hourglass-outline" text="Ce livreur attend votre validation avant de recevoir des courses." />
        ) : d.status === 'suspended' ? (
          <Banner icon="ban-outline" text="Ce livreur est suspendu : il ne reçoit plus les courses de votre boutique." danger />
        ) : null}

        {/* Joindre */}
        <View style={styles.contact}>
          {canEdit && d.isSuivi ? <Action icon="chatbubble-ellipses" label="Message" busy={contact.busy === `msg:${d.id}`} onPress={() => void contact.message(d.id)} /> : null}
          {d.isSuivi ? <Action icon="call" label="Appel" busy={contact.busy === `call:${d.id}`} onPress={() => void contact.call(d.id, d.fullName)} /> : null}
          <Action icon="logo-whatsapp" label="WhatsApp" onPress={() => contact.whatsapp(d.phone)} disabled={!d.phone} />
          <Action icon="phone-portrait-outline" label="Téléphone" onPress={() => contact.phoneCall(d.phone)} disabled={!d.phone} />
          {canEdit ? <Action icon="mail-outline" label="E-mail" onPress={() => setSheet('contact')} /> : null}
        </View>
        {!d.isSuivi ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Suivez ce livreur pour lui écrire et l’appeler depuis l’application.
          </ThemedText>
        ) : null}

        {/* Chiffres */}
        <View style={styles.kpis}>
          <Kpi icon="cube-outline" label="Courses" value={String(d.totalDeliveries)} sub={`${d.successfulDeliveries} réussies`} />
          <Kpi icon="trending-up-outline" label="Taux de réussite" value={`${rate} %`} sub={d.totalDeliveries ? (rate >= 90 ? 'Très bon' : rate >= 70 ? 'Correct' : 'À surveiller') : '—'} />
          <Kpi icon="star-outline" label="Note moyenne" value={d.averageRating ? d.averageRating.toFixed(1) : 'N/A'} sub="sur 5 étoiles" />
          <Kpi icon="wallet-outline" label="Gains totaux" value={shortGnf(d.totalEarnings)} sub="GNF cumulés" />
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Évaluation des clients</ThemedText>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name={i <= Math.round(d.averageRating) ? 'star' : 'star-outline'} size={22} color="#F5A524" />)}
            <ThemedText style={styles.starVal}>{d.averageRating ? d.averageRating.toFixed(1) : 'N/A'}</ThemedText>
          </View>
        </View>

        {/* Détails */}
        <View style={[styles.card, { borderColor: theme.border }]}>
          <Detail icon="call-outline" label="Téléphone" value={d.phone ?? 'Non renseigné'} />
          <Detail icon="mail-outline" label="E-mail" value={d.email || 'Non renseigné'} />
          <Detail icon="location-outline" label="Zone" value={d.zone ?? 'Non définie'} />
          <Detail icon="car-outline" label="Véhicule" value={`${d.vehicleEmoji} ${VEHICLE[d.vehicleType] ?? d.vehicleType}`} />
          <Detail icon="card-outline" label="Plaque" value={d.vehiclePlate ?? 'Non renseignée'} />
          <Detail icon="today-outline" label="Livraisons aujourd’hui" value={String(d.todayDeliveries)} />
          {d.lastActivityAt ? <Detail icon="time-outline" label="Dernière activité" value={`${d.lastActivity} (${d.lastActivityAt})`} /> : null}
          <Detail icon="calendar-outline" label="Membre depuis" value={joined} last />
        </View>

        {/* Gestion */}
        <View style={styles.manage}>
          <Wide icon={d.isSuivi ? 'heart-dislike-outline' : 'heart-outline'} label={d.isSuivi ? 'Ne plus suivre' : 'Suivre ce livreur'}
            busy={act.isPending && act.variables === 'suivre'} onPress={() => act.mutate('suivre')} />
          {d.status === 'pending' && canAssign ? (
            <Wide icon="checkmark-circle-outline" label="Valider ce livreur" primary busy={act.isPending && act.variables === 'valider'}
              onPress={() => confirm('Valider ce livreur ?', `${d.fullName} pourra recevoir les courses de votre boutique.`, 'Valider', 'valider')} />
          ) : null}
          {d.status === 'suspended' && canEdit ? (
            <Wide icon="refresh-outline" label="Réactiver ce livreur" primary busy={act.isPending && act.variables === 'reactiver'}
              onPress={() => confirm('Réactiver ce livreur ?', `${d.fullName} recevra de nouveau vos courses.`, 'Réactiver', 'reactiver')} />
          ) : null}
          {d.status === 'active' && canEdit ? <Wide icon="ban-outline" label="Suspendre" danger onPress={() => setSheet('suspend')} /> : null}
        </View>
      </ScrollView>

      {sheet === 'contact' ? <ContactSheet d={d} onClose={() => setSheet(null)} onDone={done} /> : null}
      {sheet === 'suspend' ? <SuspendSheet d={d} onClose={() => setSheet(null)} onDone={done} /> : null}
      <Snack msg={snack.msg} bottom={24} />
    </SafeAreaView>
  );
}

function Banner({ icon, text, danger }: { icon: IconName; text: string; danger?: boolean }) {
  const c = danger ? Brand.danger : Brand.primaryInk;
  return (
    <View style={[styles.banner, { backgroundColor: danger ? `${Brand.danger}12` : Brand.primarySoft }]}>
      <Ionicons name={icon} size={20} color={c} />
      <ThemedText type="small" style={[styles.flex, { color: c }]}>{text}</ThemedText>
    </View>
  );
}

function Action({ icon, label, onPress, busy, disabled }: { icon: IconName; label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={label} style={[styles.action, disabled && styles.off]}>
      <View style={[styles.actionIco, { backgroundColor: Brand.primarySoft }]}>
        {busy ? <ActivityIndicator size="small" color={Brand.primaryInk} /> : <Ionicons name={icon} size={21} color={Brand.primaryInk} />}
      </View>
      <ThemedText type="small" style={styles.actionLabel}>{label}</ThemedText>
    </Pressable>
  );
}

function Kpi({ icon, label, value, sub }: { icon: IconName; label: string; value: string; sub: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.kpi, { borderColor: theme.border }]}>
      <Ionicons name={icon} size={18} color={Brand.primaryInk} />
      <ThemedText style={styles.kpiV}>{value}</ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{sub}</ThemedText>
    </View>
  );
}

function Detail({ icon, label, value, last }: { icon: IconName; label: string; value: string; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.detail, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue} selectable>{value}</ThemedText>
    </View>
  );
}

function Wide({ icon, label, onPress, busy, primary, danger }: { icon: IconName; label: string; onPress: () => void; busy?: boolean; primary?: boolean; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : primary ? '#fff' : theme.text;
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityRole="button"
      style={[styles.wide, primary ? { backgroundColor: Brand.primary } : { borderWidth: 1.2, borderColor: danger ? `${Brand.danger}55` : theme.border }, busy && styles.off]}>
      {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={19} color={color} />}
      <ThemedText type="smallBold" style={{ color, fontSize: 15 }}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  off: { opacity: 0.45 },
  loader: { marginTop: 60 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  topTitle: { flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 8 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12 },
  contact: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 14 },
  action: { alignItems: 'center', gap: 5, width: 64 },
  actionIco: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontWeight: '700' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 2 },
  kpiV: { fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  starVal: { marginLeft: 6, fontSize: 16, fontWeight: '900' },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  detailLabel: { width: 120 },
  detailValue: { flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '700', textAlign: 'right' },
  manage: { gap: 10 },
  wide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, minHeight: 50 },
});
