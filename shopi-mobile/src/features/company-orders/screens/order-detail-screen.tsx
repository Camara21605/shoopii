/**
 * Espace entreprise › Détail d'une commande — équivalent mobile de la page de
 * suivi /commande/:uuid/suivi vue par la boutique :
 *   · statut, date de paiement, adresse de livraison, progression ;
 *   · « Confirmer la commande » : le titulaire du code entreprise (propriétaire)
 *     saisit son code → la commande passe en préparation, le client est prévenu
 *     (POST /commandes/:uuid/valider) ; un collaborateur voit pourquoi il ne peut pas ;
 *   · livreur : assigner / changer, en attente de sa réponse, refus + motif ;
 *   · chaîne de validation (boutique → livreur → point relais → client) ;
 *   · articles, montants, répartition des gains ; signaler un problème ;
 *   · carte de suivi en direct : sur le site.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { PrimaryButton, SecondaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openSite } from '@/features/catalog/open';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { confirmOrder, fetchOrder, gnf, type Order, type OrderDetail, type OrderStatus } from '../api';
import { StatusPill } from '../components/order-card';
import { DriverSheet, IssueSheet } from '../components/sheets';
import { Snack, useSnack } from '@/components/snack';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ROLE: Record<string, { label: string; icon: IconName }> = {
  entreprise: { label: 'Votre boutique', icon: 'storefront' },
  livreur: { label: 'Livreur', icon: 'bicycle' },
  correspondant: { label: 'Point relais', icon: 'location' },
  client: { label: 'Client', icon: 'home' },
};

/** Statut affiché : celui de la liste s'il est en cache, sinon déduit de la chaîne. */
function statusOf(d: OrderDetail, cached?: Order): OrderStatus {
  if (cached) return cached.status;
  if (d.currentStep >= d.acteurs.length && d.acteurs.length) return 'del';
  if (d.currentStep === 0) return 'new';
  return d.acteurs[d.currentStep]?.role === 'client' ? 'ship' : 'prep';
}

const dateFr = (iso: string) => {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function CompanyOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uuid = String(id ?? '');
  const theme = useTheme();
  const qc = useQueryClient();
  const perms = usePermissions();
  const snack = useSnack();
  const [sheet, setSheet] = useState<'driver' | 'issue' | null>(null);
  const q = useQuery({ queryKey: qk.company.order(uuid), queryFn: () => fetchOrder(uuid), enabled: !!uuid });
  const cached = qc.getQueryData<Order[]>(qk.company.orders)?.find((o) => o.uuid === uuid);

  const refresh = () => {
    void q.refetch();
    void qc.invalidateQueries({ queryKey: qk.company.orders });
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={q.data ? `Commande ${q.data.id}` : 'Commande'} />
      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : q.isError || !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
            <Detail
              d={q.data}
              uuid={uuid}
              cached={cached}
              canAssign={perms.can('deliveries', 'assign')}
              onAssign={() => setSheet('driver')}
              onIssue={() => setSheet('issue')}
              onConfirmed={() => {
                snack.show('Commande confirmée — le client est prévenu');
                refresh();
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <Snack msg={snack.msg} />
      {sheet === 'driver' && q.data ? (
        <DriverSheet
          order={{ uuid, id: q.data.id, livreurId: cached?.livreurId ?? null }}
          onClose={() => setSheet(null)}
          onDone={(m) => {
            setSheet(null);
            snack.show(m);
          }}
        />
      ) : null}
      {sheet === 'issue' ? (
        <IssueSheet
          uuid={uuid}
          onClose={() => setSheet(null)}
          onDone={(m) => {
            setSheet(null);
            snack.show(m);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Detail({
  d,
  uuid,
  cached,
  canAssign,
  onAssign,
  onIssue,
  onConfirmed,
}: {
  d: OrderDetail;
  uuid: string;
  cached?: Order;
  canAssign: boolean;
  onAssign: () => void;
  onIssue: () => void;
  onConfirmed: () => void;
}) {
  const theme = useTheme();
  const status = statusOf(d, cached);
  const steps = d.acteurs.length;
  const done = steps > 0 && d.currentStep >= steps;
  const myTurn = !done && d.acteurs[d.currentStep]?.role === 'entreprise';
  const myCode = d.codes.entreprise ?? '';
  const driverActor = d.acteurs.find((a) => a.role === 'livreur');
  const driverName = driverActor?.nom || (cached?.livreur && cached.livreur !== '—' ? cached.livreur : '');
  const finished = status === 'del' || status === 'can' || done;
  const pct = steps ? Math.round((Math.min(d.currentStep, steps) / steps) * 100) : 0;

  return (
    <>
      {/* En-tête de la commande */}
      <View style={[styles.card, { borderColor: theme.border }]}>
        <View style={styles.rowBetween}>
          <StatusPill status={status} long />
          <ThemedText style={styles.total}>{gnf(d.montant.total)}</ThemedText>
        </View>
        <Line icon="card-outline" text={`Payée le ${dateFr(d.datePaiement)}`} />
        {cached?.client ? <Line icon="person-outline" text={cached.client} /> : null}
        <Line icon="location-outline" text={d.destination ? `Livraison : ${d.destination}` : 'Adresse de livraison non précisée'} />
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.bar, { width: `${pct}%`, backgroundColor: done ? Brand.success : Brand.primary }]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {done ? 'Commande livrée et confirmée par le client.' : `Étape ${Math.min(d.currentStep + 1, steps)} sur ${steps} · ${d.acteurs[d.currentStep]?.action ?? ''}`}
        </ThemedText>
      </View>

      {/* Confirmer la commande (étape boutique) */}
      {myTurn ? myCode ? <ConfirmCard uuid={uuid} code={myCode} onConfirmed={onConfirmed} /> : <OwnerOnly /> : null}

      {/* Livreur */}
      {driverName || (canAssign && !finished) ? (
        <View style={[styles.card, { borderColor: d.livreurAssignmentStatus === 'refused' ? '#FECACA' : theme.border }]}>
          <SectionTitle icon="bicycle-outline" title="Livreur" />
          {driverName ? (
            <View style={styles.driverRow}>
              <View style={[styles.ava, { backgroundColor: Brand.primarySoft }]}>
                <Ionicons name="bicycle" size={20} color={Brand.primaryInk} />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>{driverName}</ThemedText>
                <ThemedText type="small" style={{ color: d.livreurAssignmentStatus === 'refused' ? Brand.danger : d.livreurAssignmentStatus === 'pending' ? '#B45309' : Brand.success }}>
                  {d.livreurAssignmentStatus === 'pending'
                    ? 'En attente de sa confirmation'
                    : d.livreurAssignmentStatus === 'refused'
                      ? 'A refusé la mission'
                      : 'Mission acceptée'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Aucun livreur n’est assigné à cette commande.
            </ThemedText>
          )}
          {d.livreurAssignmentStatus === 'refused' && d.livreurRefusalReason ? (
            <View style={styles.reason}>
              <ThemedText type="small" style={styles.reasonText}>
                Motif : {d.livreurRefusalReason}
              </ThemedText>
            </View>
          ) : null}
          {canAssign && !finished ? (
            <SecondaryButton title={driverName && d.livreurAssignmentStatus !== 'refused' ? 'Changer de livreur' : 'Assigner un livreur'} onPress={onAssign} pill />
          ) : null}
        </View>
      ) : null}

      {/* Chaîne de validation */}
      <View style={[styles.card, { borderColor: theme.border }]}>
        <SectionTitle icon="git-commit-outline" title="Suivi de la commande" />
        {d.acteurs.map((a, i) => {
          const state = i < d.currentStep ? 'done' : i === d.currentStep ? 'now' : 'wait';
          const r = ROLE[a.role] ?? ROLE.client;
          const color = state === 'done' ? Brand.success : state === 'now' ? Brand.primary : '#BDBDBD';
          return (
            <View key={`${a.role}${i}`} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={[styles.stepDot, { backgroundColor: state === 'wait' ? theme.backgroundElement : state === 'now' ? Brand.primarySoft : '#ECFDF5', borderColor: color }]}>
                  <Ionicons name={state === 'done' ? 'checkmark' : r.icon} size={14} color={color} />
                </View>
                {i < d.acteurs.length - 1 ? <View style={[styles.stepLine, { backgroundColor: i < d.currentStep ? Brand.success : theme.border }]} /> : null}
              </View>
              <View style={[styles.flex, styles.stepBody]}>
                <View style={styles.rowBetween}>
                  <ThemedText style={styles.bold} numberOfLines={1}>
                    {r.label}
                    {a.nom ? ` · ${a.nom}` : ''}
                  </ThemedText>
                  {d.times[i] ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {d.times[i]}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="small" style={{ color: state === 'now' ? Brand.primaryInk : theme.textSecondary }}>
                  {state === 'done' ? 'Validé' : state === 'now' ? `En cours · ${a.action}` : a.action}
                </ThemedText>
              </View>
            </View>
          );
        })}
      </View>

      {/* Articles */}
      <View style={[styles.card, { borderColor: theme.border }]}>
        <SectionTitle icon="cube-outline" title={`Articles (${d.articles.reduce((s, a) => s + a.qty, 0)})`} />
        {d.articles.map((a, i) => {
          const uri = thumb(a.imageUrl, 160);
          return (
            <View key={`${a.nom}${i}`} style={styles.item}>
              <View style={[styles.itemImg, { backgroundColor: theme.backgroundElement }]}>
                {uri ? <Image source={{ uri }} style={styles.fill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="cube-outline" size={20} color={theme.textSecondary} />}
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.itemName} numberOfLines={2}>
                  {a.nom}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {a.qty} × {gnf(a.prix)}
                </ThemedText>
              </View>
              <ThemedText style={styles.bold}>{gnf(a.qty * a.prix)}</ThemedText>
            </View>
          );
        })}
      </View>

      {/* Montants et répartition */}
      <View style={[styles.card, { borderColor: theme.border }]}>
        <SectionTitle icon="receipt-outline" title="Montants" />
        <Amount label="Sous-total des articles" value={d.montant.sousTotal} />
        <Amount label="Livraison (payée par le client)" value={d.montant.livraison} />
        {d.montant.fraisCorrespondant ? <Amount label="Frais du point relais" value={d.montant.fraisCorrespondant} /> : null}
        <View style={[styles.sep, { backgroundColor: theme.border }]} />
        <Amount label="Total payé" value={d.montant.total} strong />
        {d.commissions.length ? (
          <>
            <ThemedText style={styles.subTitle}>Répartition après livraison</ThemedText>
            {d.commissions.map((c, i) => (
              <Amount key={`${c.role}${i}`} label={`${c.libelle} · ${c.role === 'entreprise' ? 'Vous' : c.nom.replace('Shopi', 'Shoneya')}`} value={c.montant} accent={c.role === 'entreprise'} />
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Vos gains arrivent dans le Portefeuille une fois la réception confirmée par le client.
            </ThemedText>
          </>
        ) : null}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <ActionBtn icon="receipt-outline" label="Fiche de la commande" onPress={() => router.push({ pathname: '/commandes/fiche/[id]', params: { id: uuid, vue: 'entreprise' } })} />
        {!done ? <ActionBtn icon="map-outline" label="Suivre sur la carte" onPress={() => openSite(`/commande/${uuid}/suivi`)} /> : null}
        <ActionBtn icon="flag-outline" label="Signaler un problème" onPress={onIssue} danger />
      </View>
    </>
  );
}

function ConfirmCard({ uuid, code, onConfirmed }: { uuid: string; code: string; onConfirmed: () => void }) {
  const theme = useTheme();
  const [value, setValue] = useState('');
  const confirm = useMutation({ mutationFn: () => confirmOrder(uuid, value), onSuccess: onConfirmed });
  const ready = value.trim().length === code.length;
  return (
    <View style={[styles.card, styles.confirm]}>
      <View style={styles.rowGap}>
        <View style={[styles.ava, { backgroundColor: '#fff' }]}>
          <Ionicons name="shield-checkmark" size={20} color={Brand.primaryInk} />
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.bold}>Confirmer la commande</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Vérifiez le stock, puis saisissez votre code : la commande passe « En préparation » et le client est prévenu.
          </ThemedText>
        </View>
      </View>
      <View style={styles.codeBox}>
        <ThemedText type="small" themeColor="textSecondary">
          Votre code de validation
        </ThemedText>
        <ThemedText style={styles.code} selectable>
          {code}
        </ThemedText>
      </View>
      <TextInput
        value={value}
        onChangeText={(v) => setValue(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, code.length))}
        placeholder="Saisissez votre code"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={code.length}
        style={[styles.codeInput, value ? styles.codeTyped : null, { color: theme.text, borderColor: confirm.isError ? Brand.danger : Brand.primaryLine }]}
        accessibilityLabel="Code de validation"
      />
      {confirm.isError ? <ThemedText style={styles.err}>{toUserMessage(confirm.error)}</ThemedText> : null}
      <PrimaryButton title="Confirmer la commande" onPress={() => confirm.mutate()} loading={confirm.isPending} disabled={!ready} pill />
    </View>
  );
}

function OwnerOnly() {
  return (
    <View style={[styles.card, styles.confirm]}>
      <View style={styles.rowGap}>
        <Ionicons name="lock-closed" size={20} color={Brand.primaryInk} />
        <View style={styles.flex}>
          <ThemedText style={styles.bold}>Commande à confirmer</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Seul le titulaire du code de validation de la boutique (le propriétaire) peut confirmer cette commande.
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ icon, title }: { icon: IconName; title: string }) {
  return (
    <View style={styles.rowGap}>
      <Ionicons name={icon} size={18} color={Brand.primary} />
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
    </View>
  );
}

function Line({ icon, text }: { icon: IconName; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.rowGap}>
      <Ionicons name={icon} size={15} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {text}
      </ThemedText>
    </View>
  );
}

function Amount({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <ThemedText type={strong ? 'default' : 'small'} themeColor={strong ? undefined : 'textSecondary'} style={[styles.flex, strong && styles.bold]}>
        {label}
      </ThemedText>
      <ThemedText style={[strong ? styles.total : styles.amount, accent && { color: Brand.primaryInk }]}>{gnf(value)}</ThemedText>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : theme.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={18} color={color} />
      <ThemedText style={[styles.actionText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  loader: { marginTop: 48 },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, backgroundColor: '#fff' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  total: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  amount: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  bar: { height: '100%', borderRadius: 4 },
  sectionTitle: { fontSize: 15.5, lineHeight: 20, fontWeight: '900' },
  subTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800', marginTop: 6 },
  sep: { height: StyleSheet.hairlineWidth },
  confirm: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  codeBox: { backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 2 },
  code: { fontSize: 26, lineHeight: 34, fontWeight: '900', letterSpacing: 6, color: Brand.primaryInk },
  codeInput: { backgroundColor: '#fff', borderWidth: 1.5, borderRadius: 14, minHeight: 52, textAlign: 'center', fontSize: 16, fontWeight: '700' },
  codeTyped: { fontSize: 20, fontWeight: '800', letterSpacing: 6 },
  err: { color: Brand.danger, fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ava: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  reason: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 10 },
  reasonText: { color: '#B91C1C', fontWeight: '600' },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 30 },
  stepDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, width: 2, minHeight: 18, marginVertical: 2 },
  stepBody: { paddingBottom: 14, gap: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemImg: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, minHeight: 48, paddingHorizontal: 10 },
  actionText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
});
