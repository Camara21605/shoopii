/**
 * Espace entreprise › Mes correspondants › fiche d'un correspondant (fenêtre
 * « Profil » du site, GET /correspondants/:id) :
 *   · identité : type (principal, point relais, entrepôt, export), statut, ville · quartier ;
 *   · 4 chiffres : missions totales, commandes du mois, note sur 5, zone couverte ;
 *   · détails : téléphone, e-mail, adresse du dépôt, zone, dernière activité, membre depuis ;
 *   · actions : Message et Appel dans l'application (si l'entreprise le suit,
 *     comme sur le site), WhatsApp, Téléphone, e-mail (deliveries.edit) ;
 *     Suivre / ne plus suivre ; Valider, Suspendre, Réactiver (deliveries.edit).
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
import { ContactSheet, Pill, SuspendSheet, useActorContact } from '@/features/company-drivers/components';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { contactRelay, fetchRelay, place, reactivateRelay, STATUS, suspendRelay, toggleFollowRelay, validateRelay } from '../api';
import { RelayAvatar, statusColor, TypeBadge } from '../components/relay-rows';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function RelayDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const canEdit = perms.can('deliveries', 'edit');
  const contact = useActorContact('correspondent');
  const snack = useSnack();
  const [sheet, setSheet] = useState<null | 'contact' | 'suspend'>(null);

  const q = useQuery({ queryKey: qk.companyRelays.detail(id), queryFn: () => fetchRelay(id), enabled: !!id });
  const r = q.data;

  const refresh = () => void qc.invalidateQueries({ queryKey: qk.companyRelays.all });
  const done = (m: string, error = false) => { setSheet(null); snack.show(m, error); refresh(); };

  const act = useMutation({
    mutationFn: async (kind: 'valider' | 'reactiver' | 'suivre') => {
      if (kind === 'valider') { await validateRelay(id); return 'Correspondant validé : il peut recevoir vos colis'; }
      if (kind === 'reactiver') { await reactivateRelay(id); return 'Correspondant réactivé'; }
      const res = await toggleFollowRelay(id);
      void qc.invalidateQueries({ queryKey: qk.follows.all });
      return res.isSuivi ? 'Vous suivez ce correspondant : message et appel débloqués' : 'Vous ne suivez plus ce correspondant';
    },
    onSuccess: (m) => done(m),
    onError: (e) => done(toUserMessage(e), true),
  });

  const header = (
    <View style={[styles.top, { borderBottomColor: theme.border }]}>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/entreprise/correspondants'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
        <Ionicons name="arrow-back" size={24} color={theme.text} />
      </Pressable>
      <ThemedText style={styles.topTitle} numberOfLines={1}>{r?.fullName ?? 'Correspondant'}</ThemedText>
    </View>
  );

  if (!r) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {header}
        {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : <ActivityIndicator color={Brand.primary} style={styles.loader} />}
      </SafeAreaView>
    );
  }

  const confirm = (title: string, text: string, label: string, kind: 'valider' | 'reactiver') =>
    Alert.alert(title, text, [{ text: 'Annuler', style: 'cancel' }, { text: label, onPress: () => act.mutate(kind) }]);
  const joined = r.joinedAt ? new Date(r.joinedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      {header}
      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={styles.hero}>
          <RelayAvatar emoji={r.avatarEmoji} photo={r.photo} status={r.status} size={84} />
          <ThemedText style={styles.name}>{r.fullName}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">{place(r)}</ThemedText>
          <View style={styles.badges}>
            <TypeBadge t={r.type} />
            <Pill label={STATUS[r.status]} color={statusColor(r.status)} soft />
            {r.isSuivi ? <Pill label="Suivi" color={Brand.primaryInk} soft /> : null}
          </View>
        </View>

        {r.status === 'pending' ? (
          <Banner icon="hourglass-outline" text="Ce correspondant attend votre validation avant de recevoir des colis." />
        ) : r.status === 'suspended' ? (
          <Banner icon="ban-outline" text="Ce correspondant est suspendu : il ne reçoit plus les colis de votre boutique." danger />
        ) : null}

        <View style={styles.contact}>
          {r.isSuivi ? <Action icon="chatbubble-ellipses" label="Message" busy={contact.busy === `msg:${r.id}`} onPress={() => void contact.message(r.id)} /> : null}
          {r.isSuivi ? <Action icon="call" label="Appel" busy={contact.busy === `call:${r.id}`} onPress={() => void contact.call(r.id, r.fullName)} /> : null}
          <Action icon="logo-whatsapp" label="WhatsApp" onPress={() => contact.whatsapp(r.phone)} disabled={!r.phone} />
          <Action icon="phone-portrait-outline" label="Téléphone" onPress={() => contact.phoneCall(r.phone)} disabled={!r.phone} />
          {canEdit ? <Action icon="mail-outline" label="E-mail" onPress={() => setSheet('contact')} /> : null}
        </View>
        {!r.isSuivi ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>Suivez ce correspondant pour lui écrire et l’appeler depuis l’application.</ThemedText>
        ) : null}

        <View style={styles.kpis}>
          <Kpi icon="cube-outline" label="Missions totales" value={String(r.totalMissions)} sub="commandes traitées" />
          <Kpi icon="calendar-outline" label="Ce mois" value={String(r.thisMonth)} sub="commandes" />
          <Kpi icon="star-outline" label="Note moyenne" value={r.averageRating ? r.averageRating.toFixed(1) : 'N/A'} sub="sur 5 étoiles" />
          <Kpi icon="map-outline" label="Zone couverte" value={r.ville || '—'} sub={r.zone ?? ''} />
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}>
          <ThemedText type="smallBold">Évaluation des clients</ThemedText>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((i) => <Ionicons key={i} name={i <= Math.round(r.averageRating) ? 'star' : 'star-outline'} size={22} color="#F5A524" />)}
            <ThemedText style={styles.starVal}>{r.averageRating ? r.averageRating.toFixed(1) : 'N/A'}</ThemedText>
          </View>
        </View>

        <View style={[styles.card, { borderColor: theme.border }]}>
          <Detail icon="call-outline" label="Téléphone" value={r.phone ?? 'Non renseigné'} />
          <Detail icon="mail-outline" label="E-mail" value={r.email || 'Non renseigné'} />
          <Detail icon="location-outline" label="Adresse du dépôt" value={r.adresse ?? 'Non renseignée'} />
          <Detail icon="map-outline" label="Zone" value={r.zone ?? 'Non définie'} />
          {r.lastActivityAt ? <Detail icon="time-outline" label="Dernière activité" value={`${r.lastActivity} (${r.lastActivityAt})`} /> : null}
          <Detail icon="calendar-outline" label="Membre depuis" value={joined} last />
        </View>

        <View style={styles.manage}>
          <Wide icon={r.isSuivi ? 'heart-dislike-outline' : 'heart-outline'} label={r.isSuivi ? 'Ne plus suivre' : 'Suivre ce correspondant'}
            busy={act.isPending && act.variables === 'suivre'} onPress={() => act.mutate('suivre')} />
          {r.status === 'pending' && canEdit ? (
            <Wide icon="checkmark-circle-outline" label="Valider ce correspondant" primary busy={act.isPending && act.variables === 'valider'}
              onPress={() => confirm('Valider ce correspondant ?', `${r.fullName} pourra recevoir les colis de votre boutique.`, 'Valider', 'valider')} />
          ) : null}
          {r.status === 'suspended' && canEdit ? (
            <Wide icon="refresh-outline" label="Réactiver ce correspondant" primary busy={act.isPending && act.variables === 'reactiver'}
              onPress={() => confirm('Réactiver ce correspondant ?', `${r.fullName} recevra de nouveau vos colis.`, 'Réactiver', 'reactiver')} />
          ) : null}
          {r.status === 'active' && canEdit ? <Wide icon="ban-outline" label="Suspendre" danger onPress={() => setSheet('suspend')} /> : null}
        </View>
      </ScrollView>

      {sheet === 'contact' ? <ContactSheet d={r} send={contactRelay} onClose={() => setSheet(null)} onDone={done} /> : null}
      {sheet === 'suspend' ? (
        <SuspendSheet d={r} suspend={suspendRelay} title="Suspendre ce correspondant ?" effect="ne recevra plus les colis de votre boutique" onClose={() => setSheet(null)} onDone={done} />
      ) : null}
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
      <ThemedText style={styles.kpiV} numberOfLines={1}>{value}</ThemedText>
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
  hero: { alignItems: 'center', gap: 6 },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '900', textAlign: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 2 },
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
