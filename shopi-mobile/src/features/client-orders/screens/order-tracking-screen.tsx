/**
 * Suivi d'une commande — écran NATIF du client (avant : la page du site
 * s'ouvrait dans le navigateur intégré). Ouvert depuis « Mes commandes » et
 * depuis chaque notification de commande (confirmée, en préparation, en
 * route, « confirmez la réception », paiement…). Contenu :
 *   · numéro, date de paiement, adresse, statut ;
 *   · livreur refusé → choisir un autre livreur (sur le site) ;
 *   · MON TOUR : « Votre colis est arrivé ? » → Confirmer la réception
 *     (mon code de validation est envoyé pour moi, après confirmation) ;
 *   · étapes : boutique → livreur → point relais → moi, avec l'heure de chaque validation ;
 *   · articles et montants ; signaler un problème ;
 *   · commande terminée : noter, facture, demander un retour (site).
 * Actualisée toute seule toutes les 30 s et en tirant vers le bas.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { thumb } from '@/features/catalog/format';
import { openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { confirmReception, fetchOrder, gnf, ISSUE_TYPES, reportIssue, stepState, type IssueType } from '../api';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const ROLE: Record<string, { label: string; icon: IconName; waiting: string }> = {
  entreprise: { label: 'Boutique', icon: 'storefront-outline', waiting: 'Prépare votre commande' },
  livreur: { label: 'Livreur', icon: 'bicycle-outline', waiting: 'Récupère et livre votre colis' },
  correspondant: { label: 'Point relais', icon: 'business-outline', waiting: 'Réceptionne votre colis' },
  client: { label: 'Vous', icon: 'home-outline', waiting: 'Confirmez la réception' },
};

/** Le serveur renvoie parfois une date ISO brute : on l'affiche en clair. */
const payDate = (v: string) => {
  const d = /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : v;
};

export default function ClientOrderTrackingScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const snack = useSnack();
  const { id } = useLocalSearchParams<{ id: string }>();
  const uuid = id ?? '';
  const q = useQuery({ queryKey: qk.profile.order(uuid), queryFn: () => fetchOrder(uuid), enabled: !!uuid, refetchInterval: 30_000 });
  const [confirming, setConfirming] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const o = q.data;

  const site = () => openSite(`/commande/${uuid}/suivi`);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.profile.order(uuid) });
    void qc.invalidateQueries({ queryKey: qk.profile.orders });
  };

  const steps = o?.acteurs ?? [];
  const done = !!o && steps.length > 0 && o.currentStep >= steps.length;
  const myIndex = steps.findIndex((a) => a.role === 'client');
  const myCode = o?.codes?.client ?? '';
  const myTurn = !!o && myIndex !== -1 && stepState(myIndex, o.currentStep) === 'now' && !!myCode;
  const refused = o?.livreurAssignmentStatus === 'refused';
  const nowStep = o && !done ? steps[o.currentStep] : undefined;

  function askConfirm() {
    Alert.alert('Vous avez reçu votre colis ?', 'Confirmez seulement si vous avez bien le colis entre les mains : la commande sera terminée et le vendeur payé.', [
      { text: 'Pas encore', style: 'cancel' },
      {
        text: 'Oui, je l’ai reçu',
        onPress: async () => {
          setConfirming(true);
          try {
            await confirmReception(uuid, myCode);
            refresh();
            Alert.alert('Commande terminée 🎉', 'Merci ! Donnez votre avis sur la boutique et le livreur.', [
              { text: 'Plus tard', style: 'cancel' },
              { text: 'Noter', onPress: site },
            ]);
          } catch (e) {
            snack.show(toUserMessage(e), true);
          } finally {
            setConfirming(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={o ? `Commande #${o.id}` : 'Suivi de commande'} />
      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : q.isError || !o ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
          {/* Statut */}
          <View style={[styles.card, { borderColor: theme.border }]}>
            <View style={styles.rowBetween}>
              <View style={[styles.pill, done ? styles.pillDone : { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name={done ? 'checkmark-circle' : 'time-outline'} size={14} color={done ? '#047857' : theme.text} />
                <ThemedText style={[styles.pillText, done && { color: '#047857' }]}>{done ? 'Livrée' : 'En cours'}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Étape {Math.min(o.currentStep + (done ? 0 : 1), steps.length)}/{steps.length}
              </ThemedText>
            </View>
            {nowStep ? (
              <ThemedText style={styles.now}>
                {ROLE[nowStep.role]?.label ?? nowStep.nom} · {nowStep.role === 'client' ? 'à vous de confirmer la réception' : (ROLE[nowStep.role]?.waiting ?? nowStep.action).toLowerCase()}
              </ThemedText>
            ) : null}
            <Line icon="calendar-outline" text={`Payée le ${payDate(o.datePaiement)}`} />
            {o.destination ? <Line icon="location-outline" text={`Livraison à ${o.destination}`} /> : null}
          </View>

          {/* Livreur refusé */}
          {refused && !done ? (
            <View style={[styles.card, styles.warn]}>
              <ThemedText style={styles.bold}>Le livreur a refusé la mission</ThemedText>
              {o.livreurRefusalReason ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Motif : {o.livreurRefusalReason}
                </ThemedText>
              ) : null}
              <Pressable onPress={site} accessibilityRole="button" style={styles.linkBtn}>
                <ThemedText type="smallBold">Choisir un autre livreur</ThemedText>
                <Ionicons name="open-outline" size={14} color={theme.text} />
              </Pressable>
            </View>
          ) : null}

          {/* Mon tour : confirmer la réception */}
          {myTurn ? (
            <View style={[styles.card, styles.mine]}>
              <View style={styles.rowGap}>
                <Ionicons name="cube" size={22} color="#fff" />
                <ThemedText style={styles.mineTitle}>Votre colis est arrivé ?</ThemedText>
              </View>
              <ThemedText style={styles.mineText}>
                Quand vous avez le colis entre les mains, confirmez la réception. Votre code de validation : <ThemedText style={styles.code}>{myCode}</ThemedText>
              </ThemedText>
              <Pressable onPress={askConfirm} disabled={confirming} accessibilityRole="button" style={styles.mineBtn}>
                {confirming ? <ActivityIndicator color="#1F1F1F" /> : <Ionicons name="checkmark-circle" size={18} color="#1F1F1F" />}
                <ThemedText style={styles.mineBtnText}>Confirmer la réception</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {/* Terminée */}
          {done ? (
            <View style={[styles.card, { borderColor: theme.border }]}>
              <ThemedText style={styles.bold}>Commande terminée 🎉</ThemedText>
              <View style={styles.actions}>
                <Action icon="star-outline" label="Noter" onPress={site} />
                <Action icon="receipt-outline" label="Facture" onPress={site} />
                <Action icon="return-down-back-outline" label="Retour" onPress={site} />
              </View>
            </View>
          ) : null}

          {/* Étapes */}
          <View style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText style={styles.cardTitle}>Suivi</ThemedText>
            {steps.map((a, i) => {
              const st = stepState(i, o.currentStep);
              const r = ROLE[a.role];
              return (
                <View key={`${a.role}${i}`} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.dot, st === 'done' ? styles.dotDone : st === 'now' ? styles.dotNow : { borderColor: theme.border }]}>
                      {st === 'done' ? <Ionicons name="checkmark" size={13} color="#fff" /> : <Ionicons name={r?.icon ?? 'ellipse-outline'} size={12} color={st === 'now' ? '#fff' : theme.textSecondary} />}
                    </View>
                    {i < steps.length - 1 ? <View style={[styles.rail, { backgroundColor: st === 'done' ? '#059669' : theme.border }]} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <ThemedText style={[styles.stepTitle, st === 'next' && { color: theme.textSecondary }]}>
                      {r?.label ?? a.sousTitre} {a.role !== 'client' && a.nom ? `· ${a.nom}` : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {st === 'done' ? `Validé${o.times?.[i] ? ` à ${o.times[i]}` : ''}` : st === 'now' ? (r?.waiting ?? a.action) : 'À venir'}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Articles et montants */}
          <View style={[styles.card, { borderColor: theme.border }]}>
            <ThemedText style={styles.cardTitle}>Articles</ThemedText>
            {o.articles.map((it, i) => (
              <View key={`${it.nom}${i}`} style={styles.item}>
                <View style={[styles.itemImg, { backgroundColor: theme.backgroundElement }]}>
                  {it.imageUrl ? <Image source={{ uri: thumb(it.imageUrl, 120) ?? it.imageUrl }} style={styles.fill} contentFit="cover" /> : <Ionicons name="cube-outline" size={20} color={theme.textSecondary} />}
                </View>
                <View style={styles.flex}>
                  <ThemedText numberOfLines={2} style={styles.itemName}>
                    {it.nom}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {it.qty} × {gnf(it.prix)}
                  </ThemedText>
                </View>
              </View>
            ))}
            <View style={[styles.sep, { backgroundColor: theme.border }]} />
            <Amount label="Sous-total" value={o.montant.sousTotal} />
            {o.montant.livraison ? <Amount label="Livraison" value={o.montant.livraison} /> : null}
            {o.montant.fraisCorrespondant ? <Amount label="Point relais" value={o.montant.fraisCorrespondant} /> : null}
            <Amount label="Total" value={o.montant.total} strong />
          </View>

          {!done ? (
            <Pressable onPress={() => setIssueOpen(true)} accessibilityRole="button" style={styles.issue}>
              <Ionicons name="alert-circle-outline" size={18} color={Brand.danger} />
              <ThemedText style={styles.issueText}>Signaler un problème</ThemedText>
            </Pressable>
          ) : null}
          <Pressable onPress={site} accessibilityRole="button" style={styles.siteLink}>
            <ThemedText type="small" themeColor="textSecondary">
              Carte du suivi en direct et facture : ouvrir sur le site
            </ThemedText>
            <Ionicons name="open-outline" size={13} color={theme.textSecondary} />
          </Pressable>
        </ScrollView>
      )}
      {issueOpen ? (
        <IssueSheet
          onClose={() => setIssueOpen(false)}
          onSent={() => {
            setIssueOpen(false);
            snack.show('Signalement envoyé. Le support vous contacte sous 24 h.');
          }}
          onError={(m) => snack.show(m, true)}
          uuid={uuid}
        />
      ) : null}
      <Snack msg={snack.msg} />
    </SafeAreaView>
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

function Amount({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <View style={styles.rowBetween}>
      <ThemedText style={strong ? styles.bold : undefined} type={strong ? undefined : 'small'}>
        {label}
      </ThemedText>
      <ThemedText style={strong ? styles.bold : undefined} type={strong ? undefined : 'small'}>
        {gnf(value)}
      </ThemedText>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.action, { borderColor: theme.border }]}>
      <Ionicons name={icon} size={18} color={theme.text} />
      <ThemedText type="smallBold">{label}</ThemedText>
    </Pressable>
  );
}

function IssueSheet({ uuid, onClose, onSent, onError }: { uuid: string; onClose: () => void; onSent: () => void; onError: (m: string) => void }) {
  const theme = useTheme();
  const [type, setType] = useState<IssueType>('retard');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      await reportIssue(uuid, type, text.trim());
      onSent();
    } catch (e) {
      onError(toUserMessage(e));
    } finally {
      setSending(false);
    }
  };
  return (
    <BottomSheet title="Signaler un problème" onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.types}>
          {ISSUE_TYPES.map((t) => {
            const on = t.value === type;
            return (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.type, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                <ThemedText type="smallBold">{t.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Décrivez le problème (facultatif)"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
        />
        <PrimaryButton title="Envoyer" onPress={() => void send()} loading={sending} pill />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  loader: { marginTop: 60 },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 8 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900', marginBottom: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bold: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillDone: { backgroundColor: '#ECFDF5' },
  pillText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  now: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  warn: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 4 },
  mine: { backgroundColor: '#1F1F1F', borderColor: '#1F1F1F' },
  mineTitle: { color: '#fff', fontSize: 17, lineHeight: 22, fontWeight: '900' },
  mineText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20 },
  code: { color: '#fff', fontWeight: '900', letterSpacing: 2 },
  mineBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 999, minHeight: 48, marginTop: 4 },
  mineBtnText: { color: '#1F1F1F', fontSize: 15, lineHeight: 20, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 14, paddingVertical: 10 },
  step: { flexDirection: 'row', gap: 12, minHeight: 54 },
  stepRail: { alignItems: 'center', width: 26 },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: '#059669', borderColor: '#059669' },
  dotNow: { backgroundColor: '#1F1F1F', borderColor: '#1F1F1F' },
  rail: { width: 2, flex: 1, marginVertical: 2 },
  stepTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemImg: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  itemName: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  issue: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
  issueText: { color: Brand.danger, fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  siteLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  sheet: { gap: 12, paddingBottom: 12 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 90, textAlignVertical: 'top', fontSize: 15 },
});
