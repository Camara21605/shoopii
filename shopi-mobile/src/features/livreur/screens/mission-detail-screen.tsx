/**
 * Espace livreur › Détail d'une mission — équivalent mobile de la page de
 * suivi /commande/:uuid/suivi vue par le livreur :
 *   · numéro, date de paiement, destination, statut ;
 *   · mission pas encore acceptée → Accepter / Refuser (motif) ;
 *   · « Votre code de validation » quand c'est son tour (comme le site) et
 *     « Confirmer la prise du colis » : saisie du code (6 caractères) →
 *     POST /commandes/:uuid/valider { role: 'livreur' } ;
 *   · où récupérer le colis (adresse, repère, appeler la boutique) ;
 *   · client de la mission en cours (appeler, WhatsApp, instructions) ;
 *   · itinéraire dans Google Maps (le site montre la carte « Ma zone ») ;
 *   · chaîne de validation (boutique → livreur → point relais → client) ;
 *   · articles, montants, gain du livreur ; signaler un problème.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchOrder, ISSUE_TYPES, reportIssue, type IssueType } from '@/features/company-orders/api';
import { openDirections } from '@/features/location/open-directions';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { fetchEnCours, gnf, MISSION_STATUS, validateLivreurStep } from '../api';
import { CARD, DeliveryAddressBox, Pill, RefuseSheet, type DeliveryAddress } from '../components';
import { useMissions } from '../hooks';
import { useMissionActions } from '../use-mission-actions';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const ROLE: Record<string, { label: string; icon: IconName }> = {
  entreprise: { label: 'Boutique', icon: 'storefront-outline' },
  livreur: { label: 'Livreur', icon: 'bicycle-outline' },
  correspondant: { label: 'Point relais', icon: 'business-outline' },
  client: { label: 'Client', icon: 'person-outline' },
};

/** Le serveur renvoie parfois une date ISO brute : on l'affiche en clair. */
const payDate = (v: string) => {
  const d = /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : v;
};

export default function LivreurMissionDetailScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uuid = id ?? '';
  const q = useQuery({ queryKey: qk.livreur.order(uuid), queryFn: () => fetchOrder(uuid), enabled: !!uuid, refetchInterval: 30_000 });
  const missions = useMissions();
  const encours = useQuery({ queryKey: qk.livreur.encours, queryFn: fetchEnCours });
  const actions = useMissionActions();
  const snack = useSnack();
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [issue, setIssue] = useState(false);

  const o = q.data;
  const mission = missions.data?.find((m) => m.uuid === uuid);
  const client = encours.data?.uuid === uuid ? encours.data.client : null;
  const myIdx = o ? o.acteurs.findIndex((a) => a.role === 'livreur') : -1;
  const myTurn = !!o && myIdx !== -1 && o.currentStep === myIdx;
  const done = !!o && myIdx !== -1 && o.currentStep > myIdx;
  const myCode = o?.codes.livreur;
  const myGain = o?.commissions.find((c) => c.role === 'livreur')?.montant;

  const refresh = () => {
    void q.refetch();
    void qc.invalidateQueries({ queryKey: qk.livreur.all });
  };

  const validate = async () => {
    if (code.trim().length < 6) return setCodeError('Le code comporte 6 caractères.');
    setValidating(true);
    setCodeError(null);
    try {
      await validateLivreurStep(uuid, code);
      setCode('');
      snack.show('✅ Prise du colis confirmée — bonne route !');
      refresh();
    } catch (e) {
      setCodeError(toUserMessage(e));
    } finally {
      setValidating(false);
    }
  };

  const pickupQuery = mission ? [mission.companyAdresse, mission.companyQuartier, mission.companyVille, mission.shop].filter(Boolean).join(', ') : '';
  const dropQuery = client?.adresse && client.adresse !== '—' ? client.adresse : (o?.destination ?? '');
  /* Adresse de livraison : mission en cours (détail complet) sinon la liste des missions */
  const dest: DeliveryAddress | null =
    client || mission
      ? {
          nom: client?.nom ?? mission?.client ?? null,
          rue: client?.rue ?? mission?.clientAdresse ?? null,
          quartier: client?.quartier ?? mission?.clientQuartier ?? null,
          commune: client?.commune ?? mission?.clientCommune ?? null,
          ville: client?.ville ?? mission?.clientVille ?? null,
          instructions: client?.instructions ?? mission?.clientInstructions ?? null,
          telephone: client?.telephone ?? mission?.clientTelephone ?? null,
          lat: client?.latitude ?? mission?.clientLat ?? null,
          lng: client?.longitude ?? mission?.clientLng ?? null,
        }
      : null;

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !o) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={styles.row}>
            <ThemedText style={styles.ref}>Commande #{o.id}</ThemedText>
            {mission ? <Pill tone={MISSION_STATUS[mission.status]} /> : done ? <Pill tone={{ label: '✓ Colis pris en charge', color: '#0F7B45', bg: '#E7F6EE' }} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Payée le {payDate(o.datePaiement)} · Livraison à {o.destination}
          </ThemedText>
        </View>

        {mission?.status === 'new' ? (
          <View style={styles.box}>
            <ThemedText style={styles.bold}>Cette mission vous est proposée</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Acceptez-la pour recevoir votre code de validation, ou refusez-la en indiquant pourquoi.
            </ThemedText>
            <View style={styles.row}>
              <Pressable onPress={() => void actions.accept(mission)} disabled={actions.busy === uuid} accessibilityRole="button" style={[styles.btn, styles.btnMain, styles.flex]}>
                {actions.busy === uuid ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="checkmark" size={18} color={Brand.primaryInk} />}
                <ThemedText type="smallBold">Accepter · {gnf(mission.fee)}</ThemedText>
              </Pressable>
              <Pressable onPress={() => actions.setRefusing(mission)} accessibilityRole="button" style={[styles.btn, styles.btnDanger]}>
                <ThemedText type="smallBold" style={{ color: Brand.danger }}>
                  Refuser
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : null}

        {myTurn && myCode ? (
          <View style={styles.codeCard}>
            <View style={styles.row}>
              <Ionicons name="key" size={18} color="#fff" />
              <ThemedText style={styles.codeLabel}>Votre code de validation</ThemedText>
            </View>
            <ThemedText selectable style={styles.codeV} numberOfLines={1} adjustsFontSizeToFit>
              {myCode}
            </ThemedText>
            <ThemedText style={styles.codeHint}>À saisir pour valider votre étape</ThemedText>
          </View>
        ) : null}

        {myTurn && o.livreurAssignmentStatus !== 'pending' ? (
          <View style={styles.box}>
            <ThemedText style={styles.bold}>Confirmer la prise du colis</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Une fois le colis récupéré à la boutique, saisissez votre code pour passer « En route ».
            </ThemedText>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6));
                setCodeError(null);
              }}
              placeholder="CODE"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={[styles.codeInput, { color: theme.text, borderColor: codeError ? Brand.danger : theme.border, backgroundColor: theme.background }]}
              accessibilityLabel="Code de validation"
            />
            {codeError ? (
              <ThemedText type="small" style={styles.err} accessibilityRole="alert">
                {codeError}
              </ThemedText>
            ) : null}
            <PrimaryButton title="Confirmer la prise du colis" onPress={() => void validate()} loading={validating} disabled={code.length < 6} pill />
          </View>
        ) : null}

        {mission && (mission.status === 'new' || mission.status === 'prep') && (mission.companyAdresse || mission.companyRepere || mission.companyTelephone) ? (
          <View style={styles.box}>
            <ThemedText style={styles.caps} themeColor="textSecondary">
              Où récupérer le colis
            </ThemedText>
            <ThemedText style={styles.bold}>🏪 {mission.shop}</ThemedText>
            {mission.companyAdresse ? <ThemedText type="small">{mission.companyAdresse}</ThemedText> : null}
            {mission.companyRepere ? (
              <ThemedText type="small">
                <ThemedText type="smallBold">Repère : </ThemedText>
                {mission.companyRepere}
              </ThemedText>
            ) : null}
            <View style={styles.row}>
              {mission.companyTelephone ? <Action icon="call-outline" label="Appeler" onPress={() => void Linking.openURL(`tel:${mission.companyTelephone!.replace(/\s+/g, '')}`)} /> : null}
              {pickupQuery || mission.companyLat != null ? (
                <Action icon="navigate-outline" label="Itinéraire"
                  onPress={() => openDirections({ lat: mission.companyLat, lng: mission.companyLng, name: mission.shop || 'Boutique', address: pickupQuery })} />
              ) : null}
              {/* Boutique + client sur la carte de « Ma zone de livraison » (bouton « Carte » du site) */}
              <Action icon="map-outline" label="Voir sur la carte" onPress={() => router.push({ pathname: '/livreur/zone', params: { mission: mission.uuid } })} />
            </View>
          </View>
        ) : null}

        {dest ? (
          <DeliveryAddressBox
            a={dest}
            contactAllowed={!!client || (!!mission && mission.status !== 'new')}
            onMap={mission ? () => router.push({ pathname: '/livreur/zone', params: { mission: mission.uuid } }) : undefined}
          />
        ) : dropQuery ? (
          <Pressable onPress={() => openDirections({ lat: mission?.clientLat, lng: mission?.clientLng, name: 'Client', address: dropQuery })} accessibilityRole="button" style={[styles.box, styles.row]}>
            <Ionicons name="navigate-outline" size={18} color={Brand.primary} />
            <ThemedText type="smallBold" style={styles.flex}>
              Itinéraire vers {dropQuery}
            </ThemedText>
          </Pressable>
        ) : null}

        <View style={styles.box}>
          <ThemedText style={styles.caps} themeColor="textSecondary">
            Chaîne de livraison
          </ThemedText>
          {o.acteurs.map((a, i) => {
            const st = i < o.currentStep ? 'done' : i === o.currentStep ? 'now' : 'wait';
            const meta = ROLE[a.role] ?? ROLE.client;
            const me = a.role === 'livreur';
            return (
              <View key={`${a.role}-${i}`} style={styles.step}>
                <View style={styles.rail}>
                  <View style={[styles.node, st === 'done' && styles.nodeDone, st === 'now' && styles.nodeNow]}>
                    <Ionicons name={st === 'done' ? 'checkmark' : meta.icon} size={15} color={st === 'wait' ? theme.textSecondary : '#fff'} />
                  </View>
                  {i < o.acteurs.length - 1 ? <View style={[styles.line, { backgroundColor: i < o.currentStep ? Brand.success : theme.border }]} /> : null}
                </View>
                <View style={styles.stepBody}>
                  <ThemedText style={styles.bold}>
                    {meta.label}
                    {me ? ' (vous)' : ''} · {a.nom}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {st === 'done' ? `Validé${a.valideA ? ` à ${a.valideA}` : ''}` : st === 'now' ? (me ? 'À vous de valider' : `En attente : ${a.action || a.sousTitre}`) : a.sousTitre}
                  </ThemedText>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.box}>
          <ThemedText style={styles.caps} themeColor="textSecondary">
            Articles
          </ThemedText>
          {o.articles.map((it, i) => (
            <View key={`${it.nom}-${i}`} style={styles.item}>
              {it.imageUrl ? <Image source={{ uri: it.imageUrl }} style={styles.itemImg} contentFit="cover" /> : <View style={[styles.itemImg, { backgroundColor: theme.background }]} />}
              <ThemedText type="small" style={styles.flex} numberOfLines={2}>
                {it.nom}
              </ThemedText>
              <ThemedText type="smallBold">× {it.qty}</ThemedText>
            </View>
          ))}
          <View style={[styles.sum, { borderTopColor: theme.border }]}>
            <Line label="Total de la commande" value={gnf(o.montant.total)} />
            <Line label="Frais de livraison" value={gnf(o.montant.livraison)} />
            {myGain != null ? <Line label="Votre gain" value={gnf(myGain)} strong /> : null}
          </View>
        </View>

        <Pressable onPress={() => router.push({ pathname: '/commandes/fiche/[id]', params: { id: uuid, vue: 'livreur' } })} accessibilityRole="button" style={[styles.issue, { borderColor: theme.border }]}>
          <Ionicons name="receipt-outline" size={18} color={theme.text} />
          <ThemedText type="smallBold">Fiche de la commande</ThemedText>
        </Pressable>
        <Pressable onPress={() => setIssue(true)} accessibilityRole="button" style={[styles.issue, { borderColor: theme.border }]}>
          <Ionicons name="alert-circle-outline" size={18} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Signaler un problème
          </ThemedText>
        </Pressable>
      </ScrollView>
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={o ? `Mission #${o.id}` : 'Mission'} />
      <View style={styles.flex}>{body}</View>
      <Snack msg={snack.msg ?? actions.snack.msg} bottom={24} />
      {actions.refusing ? <RefuseSheet m={actions.refusing} onClose={() => actions.setRefusing(null)} onConfirm={actions.refuse} /> : null}
      {issue ? <IssueSheet uuid={uuid} onClose={() => setIssue(false)} onDone={(m) => { setIssue(false); snack.show(m); }} /> : null}
    </SafeAreaView>
  );
}

function IssueSheet({ uuid, onClose, onDone }: { uuid: string; onClose: () => void; onDone: (msg: string) => void }) {
  const theme = useTheme();
  const [type, setType] = useState<IssueType | null>(null);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!type) return;
    setSaving(true);
    setError(null);
    try {
      await reportIssue(uuid, type, text.trim());
      onDone('Problème signalé — la boutique et Shoneya sont prévenus.');
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };
  return (
    <BottomSheet title="Signaler un problème" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <View style={styles.wrap}>
          {ISSUE_TYPES.map((t) => {
            const on = type === t.value;
            return (
              <Pressable key={t.value} onPress={() => setType(t.value)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <ThemedText type="smallBold">{t.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder="Décrivez le problème…" placeholderTextColor={theme.textSecondary} style={[styles.area, { color: theme.text, borderColor: theme.border }]} accessibilityLabel="Description du problème" />
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title="Envoyer" onPress={() => void send()} loading={saving} disabled={!type || text.trim().length < 5} pill />
      </ScrollView>
    </BottomSheet>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[styles.act, { borderColor: theme.border, backgroundColor: theme.background }]}>
      <Ionicons name={icon} size={16} color={icon === 'logo-whatsapp' ? '#25D366' : Brand.primary} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.lineRow}>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText style={strong ? styles.strong : styles.bold}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  err: { color: Brand.danger },
  loader: { marginVertical: 32 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  head: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ref: { fontSize: 18, lineHeight: 24, fontWeight: '900', flex: 1 },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 8 },
  caps: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 999, minHeight: 46, paddingHorizontal: 16, borderWidth: 1 },
  btnMain: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  btnDanger: { borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
  codeCard: { backgroundColor: '#1F1F1F', borderRadius: 18, padding: 16, gap: 4 },
  codeLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  codeV: { color: '#fff', fontSize: 32, lineHeight: 40, fontWeight: '900', letterSpacing: 6 },
  codeHint: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, lineHeight: 15 },
  codeInput: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, fontSize: 24, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 40 },
  step: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 30 },
  node: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.08)', alignItems: 'center', justifyContent: 'center' },
  nodeDone: { backgroundColor: Brand.success },
  nodeNow: { backgroundColor: Brand.primary },
  line: { flex: 1, width: 2, marginVertical: 2, minHeight: 14 },
  stepBody: { flex: 1, paddingBottom: 14, gap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemImg: { width: 40, height: 40, borderRadius: 10 },
  sum: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 4 },
  lineRow: { flexDirection: 'row', alignItems: 'center' },
  strong: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: Brand.success },
  issue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, minHeight: 46 },
  sheet: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  area: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 100, textAlignVertical: 'top', fontSize: 15 },
});
