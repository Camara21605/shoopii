/**
 * Espace correspondant › Détail d'un colis — la commande vue par le point
 * relais (GET /commandes/:uuid, autorisé au correspondant de la commande) :
 *   · numéro, date de paiement, destination, statut du colis (liste du point
 *     relais : à réceptionner, en stock, confié au livreur, livré, retour + motif) ;
 *   · « Votre code de validation » quand c'est son tour, et « Confirmer la
 *     réception du colis » : saisie du code (6 caractères) →
 *     POST /commandes/:uuid/valider { role: 'correspondant' } (5 essais faux
 *     bloquent le code : message du serveur affiché tel quel) ;
 *   · chaîne de livraison (boutique → livreur → point relais → client) ;
 *   · articles, montants, gain du point relais ; signaler un problème.
 * C'est la vraie action derrière « Scanner / Enregistrer » du site (qui
 * n'affiche qu'un message).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchOrder, ISSUE_TYPES, reportIssue, type IssueType } from '@/features/company-orders/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { COLIS_STATUS, gnf, validateCorrespondantStep } from '../api';
import { CARD, Pill } from '../components';
import { useColis } from '../hooks';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
/* Les textes d'étape du serveur sont écrits pour le client (« Vous », « Prépare votre commande ») :
 * ici, chaque étape est décrite du point de vue du point relais. */
const ROLE: Record<string, { label: string; icon: IconName; todo: string }> = {
  entreprise: { label: 'Boutique', icon: 'storefront-outline', todo: 'Prépare et remet le colis' },
  livreur: { label: 'Livreur', icon: 'bicycle-outline', todo: 'Transporte le colis' },
  correspondant: { label: 'Point relais', icon: 'business-outline', todo: 'Réceptionne le colis' },
  client: { label: 'Client', icon: 'person-outline', todo: 'Récupère sa commande' },
};

/** Le serveur renvoie parfois une date ISO brute : on l'affiche en clair. */
const payDate = (v: string) => {
  const d = /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : v;
};

export default function CorrespondantColisDetailScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uuid = id ?? '';
  const q = useQuery({ queryKey: qk.correspondant.order(uuid), queryFn: () => fetchOrder(uuid), enabled: !!uuid, refetchInterval: 30_000 });
  const colis = useColis();
  const snack = useSnack();
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [issue, setIssue] = useState(false);

  const o = q.data;
  const item = colis.data?.items.find((c) => c.uuid === uuid);
  const myIdx = o ? o.acteurs.findIndex((a) => a.role === 'correspondant') : -1;
  const myTurn = !!o && myIdx !== -1 && o.currentStep === myIdx;
  const done = !!o && myIdx !== -1 && o.currentStep > myIdx;
  const myCode = o?.codes.correspondant;
  const myGain = o?.commissions.find((c) => c.role === 'correspondant')?.montant;
  const closed = item?.status === 'ret' || item?.status === 'livr';

  const refresh = () => {
    void q.refetch();
    void qc.invalidateQueries({ queryKey: qk.correspondant.all });
  };

  const validate = async () => {
    if (code.trim().length < 6) return setCodeError('Le code comporte 6 caractères.');
    setValidating(true);
    setCodeError(null);
    try {
      await validateCorrespondantStep(uuid, code);
      setCode('');
      snack.show('✅ Réception du colis confirmée');
      refresh();
    } catch (e) {
      setCodeError(toUserMessage(e));
    } finally {
      setValidating(false);
    }
  };

  /* Ce qu'attend la chaîne avant le tour du point relais */
  const waitingFor = o && myIdx !== -1 && o.currentStep < myIdx ? o.acteurs[o.currentStep] : null;

  let body: React.ReactNode;
  if (q.isPending) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (q.isError || !o) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={refresh} colors={[Brand.primary]} tintColor={Brand.primary} />}
        keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={styles.row}>
            <ThemedText style={styles.ref} numberOfLines={2}>
              {item?.nm ?? `Commande #${o.id}`}
            </ThemedText>
            {item ? <Pill tone={COLIS_STATUS[item.status]} /> : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Payée le {payDate(o.datePaiement)} · Livraison à {o.destination}
          </ThemedText>
          {item?.motif ? (
            <ThemedText type="small" style={styles.err}>
              Motif du retour : {item.motif}
            </ThemedText>
          ) : null}
        </View>

        {myTurn && myCode && !closed ? (
          <View style={styles.codeCard}>
            <View style={styles.row}>
              <Ionicons name="key" size={18} color="#fff" />
              <ThemedText style={styles.codeLabel}>Votre code de validation</ThemedText>
            </View>
            <ThemedText selectable style={styles.codeV} numberOfLines={1} adjustsFontSizeToFit>
              {myCode}
            </ThemedText>
            <ThemedText style={styles.codeHint}>À saisir pour confirmer la réception du colis</ThemedText>
          </View>
        ) : null}

        {myTurn && !closed ? (
          <View style={styles.box}>
            <ThemedText style={styles.bold}>Confirmer la réception du colis</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Quand le colis arrive à votre point relais, vérifiez-le puis saisissez votre code.
            </ThemedText>
            <TextInput
              value={code}
              onChangeText={(v) => {
                setCode(
                  v
                    .replace(/[^a-zA-Z0-9]/g, '')
                    .toUpperCase()
                    .slice(0, 6),
                );
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
            <PrimaryButton title="Confirmer la réception" onPress={() => void validate()} loading={validating} disabled={code.length < 6} pill />
          </View>
        ) : waitingFor && !closed ? (
          <View style={[styles.box, styles.row]}>
            <Ionicons name="hourglass-outline" size={18} color="#B45309" />
            <ThemedText type="small" style={styles.flex}>
              Le colis n’est pas encore en route vers vous : en attente de l’étape « {ROLE[waitingFor.role]?.label ?? waitingFor.role} ». Vous pourrez confirmer sa réception ensuite.
            </ThemedText>
          </View>
        ) : done ? (
          <View style={[styles.box, styles.row]}>
            <Ionicons name="checkmark-circle" size={18} color={Brand.success} />
            <ThemedText type="small" style={styles.flex}>
              Vous avez confirmé la réception de ce colis.
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.box}>
          <ThemedText style={styles.caps} themeColor="textSecondary">
            Chaîne de livraison
          </ThemedText>
          {o.acteurs.map((a, i) => {
            const st = i < o.currentStep ? 'done' : i === o.currentStep ? 'now' : 'wait';
            const meta = ROLE[a.role] ?? ROLE.client;
            const me = a.role === 'correspondant';
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
                    {st === 'done' ? `Validé${a.valideA ? ` à ${a.valideA}` : ''}` : st === 'now' ? (me ? 'À vous de valider' : `En cours : ${meta.todo.toLowerCase()}`) : meta.todo}
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
            {o.montant.fraisCorrespondant ? <Line label="Frais du point relais" value={gnf(o.montant.fraisCorrespondant)} /> : null}
            {myGain != null ? <Line label="Votre gain" value={gnf(myGain)} strong /> : null}
          </View>
        </View>

        <Pressable onPress={() => router.push({ pathname: '/commandes/fiche/[id]', params: { id: uuid, vue: 'correspondant' } })} accessibilityRole="button" style={[styles.issue, { borderColor: theme.border }]}>
          <Ionicons name="receipt-outline" size={18} color={theme.text} />
          <ThemedText type="smallBold">Fiche de la commande</ThemedText>
        </Pressable>
        <Pressable onPress={() => setIssue(true)} accessibilityRole="button" accessibilityLabel="Signaler un problème" style={[styles.issue, { borderColor: theme.border }]}>
          <Ionicons name="alert-circle-outline" size={18} color={Brand.danger} />
          <ThemedText type="smallBold" style={{ color: Brand.danger }}>
            Signaler un problème
          </ThemedText>
        </Pressable>
      </ScrollView>
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={o ? `Colis #${o.id}` : 'Colis'} />
      <View style={styles.flex}>{body}</View>
      <Snack msg={snack.msg} bottom={24} />
      {issue ? (
        <IssueSheet
          uuid={uuid}
          onClose={() => setIssue(false)}
          onDone={(m) => {
            setIssue(false);
            snack.show(m);
            refresh();
          }}
        />
      ) : null}
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
        <View style={styles.warn}>
          <ThemedText type="small">La commande passera « en litige » : la boutique et Shoneya seront prévenus.</ThemedText>
        </View>
        <View style={styles.wrap}>
          {ISSUE_TYPES.map((t) => {
            const on = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <ThemedText type="smallBold">{t.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="Décrivez le problème…"
          placeholderTextColor={theme.textSecondary}
          style={[styles.area, { color: theme.text, borderColor: theme.border }]}
          accessibilityLabel="Description du problème"
        />
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title="Envoyer" onPress={() => void send()} loading={saving} disabled={!type || text.trim().length < 5} pill />
      </ScrollView>
    </BottomSheet>
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
  codeCard: { backgroundColor: '#1F1F1F', borderRadius: 18, padding: 16, gap: 4 },
  codeLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  codeV: { color: '#fff', fontSize: 32, lineHeight: 40, fontWeight: '900', letterSpacing: 6 },
  codeHint: { color: 'rgba(255,255,255,0.65)', fontSize: 11.5, lineHeight: 15 },
  codeInput: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 12, fontSize: 24, fontWeight: '900', letterSpacing: 6, textAlign: 'center' },
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
  warn: { backgroundColor: '#FDECEC', borderRadius: 12, padding: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  area: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 100, textAlignVertical: 'top', fontSize: 15 },
});
