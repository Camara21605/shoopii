/**
 * Espace entreprise › Retours › détail d'une demande — équivalent mobile de la
 * modale RetourDetailModal du site, en plein écran :
 *   · en-tête : référence, statut, produit, client, priorité (modifiable) ;
 *   · onglet Détails : produit retourné (quantité, variante, commande →
 *     détail de la commande), montants demandé / accordé, description du
 *     problème, note interne, message envoyé au client ;
 *   · onglet Historique : chaque action avec son auteur, la date et ses
 *     détails en clair (le site affiche le JSON brut) ;
 *   · onglet Preuves : photos (plein écran au toucher), vidéos et documents ;
 *   · actions (returns.process) selon le statut :
 *       en attente → Accepter (montant accordé + message) / Refuser (raison) ;
 *       en transit → Marquer comme reçu (absent du site) ;
 *       accepté ou reçu → Rembourser (confirmation) ;
 *       toujours → Note interne, priorité (absente du site).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  acceptReturn,
  actionLabel,
  addReturnNote,
  describeMetadata,
  fetchReturn,
  formatDateTime,
  gnf,
  markReceived,
  PRIORITIES,
  REASONS,
  refundReturn,
  refuseReturn,
  RETURN_TYPES,
  ROLE_LABELS,
  setReturnPriority,
  STATUS,
  type Priority,
  type ReturnDetail,
} from '../api';
import { CARD, Pill, PriorityPicker } from '../components/ui';

type Tab = 'info' | 'history' | 'evidence';
type Action = 'accept' | 'refuse' | 'note' | 'refund' | null;

const HISTORY_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  created: 'add-circle-outline',
  accepted: 'checkmark-circle-outline',
  refused: 'close-circle-outline',
  refunded: 'cash-outline',
  received: 'cube-outline',
  note_added: 'document-text-outline',
  evidence_uploaded: 'image-outline',
  priority_changed: 'flag-outline',
};

export default function ReturnDetailScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('returns', 'view');
  const canProcess = perms.isOwner || perms.can('returns', 'process');
  const canSeeOrders = perms.isOwner || perms.can('orders', 'view');
  const [tab, setTab] = useState<Tab>('info');
  const [action, setAction] = useState<Action>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const snack = useSnack();
  const q = useQuery({ queryKey: qk.company.returnDetail(id ?? ''), queryFn: () => fetchReturn(id ?? ''), enabled: !!id && canView });
  const r = q.data;

  const done = (msg: string) => {
    setAction(null);
    snack.show(msg);
    void q.refetch();
    void qc.invalidateQueries({ queryKey: qk.company.returnsAll });
    void qc.invalidateQueries({ queryKey: qk.company.badges });
  };

  const run = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try {
      await fn();
      done(msg);
    } catch (e) {
      snack.show(`❌ ${toUserMessage(e)}`, true);
    } finally {
      setBusy(null);
    }
  };

  let body: React.ReactNode;
  if (perms.loading || (q.isPending && canView)) body = <ActivityIndicator color={Brand.primary} style={styles.loader} />;
  else if (!canView)
    body = (
      <View style={styles.center}>
        <Ionicons name="lock-closed" size={34} color={theme.textSecondary} />
        <ThemedText style={styles.h2}>Accès non autorisé</ThemedText>
      </View>
    );
  else if (q.isError || !r) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else
    body = (
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        <View style={styles.head}>
          <View style={styles.headTop}>
            <ThemedText style={styles.ref}>{r.reference}</ThemedText>
            <Pill tone={STATUS[r.status]} />
          </View>
          <ThemedText style={styles.product}>
            {r.productName}
            {r.quantity > 1 ? ` × ${r.quantity}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {r.clientName} · {REASONS[r.reason]} · {RETURN_TYPES[r.returnType] ?? r.returnType}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Demande du {formatDateTime(r.createdAt)}
          </ThemedText>
        </View>

        <View style={styles.box}>
          <ThemedText style={styles.caps} themeColor="textSecondary">
            Priorité
          </ThemedText>
          <PriorityPicker
            value={r.priority}
            disabled={!canProcess}
            busy={busy === 'priority'}
            onChange={(p: Priority) => void run('priority', () => setReturnPriority(r.id, p), `Priorité : ${PRIORITIES[p].label}`)}
          />
        </View>

        <View style={[styles.tabs, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          <TabBtn on={tab === 'info'} icon="information-circle-outline" label="Détails" onPress={() => setTab('info')} />
          <TabBtn on={tab === 'history'} icon="time-outline" label="Historique" onPress={() => setTab('history')} />
          <TabBtn on={tab === 'evidence'} icon="images-outline" label={`Preuves (${r.evidences.length})`} onPress={() => setTab('evidence')} />
        </View>

        {tab === 'info' ? <Info r={r} canSeeOrders={canSeeOrders} /> : tab === 'history' ? <History r={r} /> : <Evidence r={r} onOpen={setViewer} />}
      </ScrollView>
    );

  const footer =
    r && canProcess ? (
      <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <FooterBtn icon="document-text-outline" label="Note" onPress={() => setAction('note')} />
        {r.status === 'pending' ? (
          <>
            <FooterBtn icon="close" label="Refuser" tone="danger" onPress={() => setAction('refuse')} />
            <FooterBtn icon="checkmark" label="Accepter" tone="ok" main onPress={() => setAction('accept')} />
          </>
        ) : null}
        {r.status === 'in_transit' ? <FooterBtn icon="cube-outline" label="Marquer reçu" main busy={busy === 'received'} onPress={() => void run('received', () => markReceived(r.id), '📦 Retour marqué comme reçu')} /> : null}
        {r.status === 'accepted' || r.status === 'received' ? <FooterBtn icon="cash-outline" label="Rembourser" main onPress={() => setAction('refund')} /> : null}
      </View>
    ) : null;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Demande de retour" />
      <View style={styles.flex}>{body}</View>
      {footer}
      <Snack msg={snack.msg} bottom={90} />
      {r && action === 'accept' ? <AcceptSheet r={r} onClose={() => setAction(null)} onDone={() => done('✅ Retour accepté — client notifié')} /> : null}
      {r && action === 'refuse' ? <RefuseSheet r={r} onClose={() => setAction(null)} onDone={() => done('Retour refusé — client notifié')} /> : null}
      {r && action === 'note' ? <NoteSheet r={r} onClose={() => setAction(null)} onDone={() => done('📝 Note ajoutée')} /> : null}
      {r && action === 'refund' ? <RefundSheet r={r} onClose={() => setAction(null)} onDone={() => done('💸 Remboursement enregistré')} /> : null}
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable style={styles.viewer} onPress={() => setViewer(null)} accessibilityRole="button" accessibilityLabel="Fermer la photo">
          {viewer ? <Image source={{ uri: viewer }} style={styles.viewerImg} contentFit="contain" /> : null}
          <View style={styles.viewerClose}>
            <Ionicons name="close" size={26} color="#fff" />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Info({ r, canSeeOrders }: { r: ReturnDetail; canSeeOrders: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      <View style={styles.box}>
        <ThemedText style={styles.caps} themeColor="textSecondary">
          Produit retourné
        </ThemedText>
        <View style={styles.prodRow}>
          {r.productImage ? <Image source={{ uri: r.productImage }} style={styles.prodImg} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
          <View style={styles.flex}>
            <ThemedText style={styles.bold}>{r.productName}</ThemedText>
            {r.productVariant ? (
              <ThemedText type="small" themeColor="textSecondary">
                {r.productVariant}
              </ThemedText>
            ) : null}
            <ThemedText type="small">
              Qté : <ThemedText type="smallBold">{r.quantity}</ThemedText>
            </ThemedText>
          </View>
        </View>
        {r.commande ? (
          <Pressable
            onPress={() => canSeeOrders && router.push({ pathname: '/entreprise/commandes/[id]', params: { id: r.commande!.id } })}
            disabled={!canSeeOrders}
            accessibilityRole="button"
            style={[styles.order, { backgroundColor: theme.background }]}>
            <Ionicons name="cube-outline" size={17} color={Brand.primary} />
            <ThemedText type="small" style={styles.flex}>
              Commande <ThemedText type="smallBold">{r.commande.numero}</ThemedText> · {gnf(r.commande.total)}
            </ThemedText>
            {canSeeOrders ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.box}>
        <ThemedText style={styles.caps} themeColor="textSecondary">
          Montants
        </ThemedText>
        <Line label="Demandé" value={gnf(r.montantDemande)} />
        {r.montantAccorde != null ? <Line label="Accordé" value={gnf(r.montantAccorde)} color={Brand.success} /> : null}
      </View>

      <View style={styles.box}>
        <ThemedText style={styles.caps} themeColor="textSecondary">
          Description du problème
        </ThemedText>
        <ThemedText style={styles.text}>{r.description || '—'}</ThemedText>
      </View>

      {r.noteInterne ? (
        <View style={styles.box}>
          <ThemedText style={styles.caps} themeColor="textSecondary">
            🗒️ Note interne (équipe seulement)
          </ThemedText>
          <ThemedText style={styles.text}>{r.noteInterne}</ThemedText>
        </View>
      ) : null}
      {r.noteClient ? (
        <View style={styles.box}>
          <ThemedText style={styles.caps} themeColor="textSecondary">
            💬 Message au client
          </ThemedText>
          <ThemedText style={styles.text}>{r.noteClient}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function History({ r }: { r: ReturnDetail }) {
  const theme = useTheme();
  if (!r.history.length)
    return (
      <View style={styles.center}>
        <ThemedText style={styles.emoji}>📋</ThemedText>
        <ThemedText style={styles.bold}>Aucun historique</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          L’historique des actions apparaîtra ici.
        </ThemedText>
      </View>
    );
  return (
    <View>
      {r.history.map((h, i) => {
        const meta = describeMetadata(h.metadata);
        return (
          <View key={h.id} style={styles.tl}>
            <View style={styles.tlRail}>
              <View style={styles.tlDot}>
                <Ionicons name={HISTORY_ICONS[h.action] ?? 'ellipse-outline'} size={15} color={Brand.primary} />
              </View>
              {i < r.history.length - 1 ? <View style={[styles.tlLine, { backgroundColor: theme.border }]} /> : null}
            </View>
            <View style={styles.tlBody}>
              <ThemedText style={styles.bold}>{actionLabel(h.action)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {[h.actorName, ROLE_LABELS[h.actorRole] ?? h.actorRole].filter(Boolean).join(' · ')} · {formatDateTime(h.createdAt)}
              </ThemedText>
              {meta ? (
                <View style={[styles.meta, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{meta}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Evidence({ r, onOpen }: { r: ReturnDetail; onOpen: (url: string) => void }) {
  if (!r.evidences.length)
    return (
      <View style={styles.center}>
        <ThemedText style={styles.emoji}>🖼️</ThemedText>
        <ThemedText style={styles.bold}>Aucune preuve</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Le client n’a pas encore joint de photos ou documents.
        </ThemedText>
      </View>
    );
  return (
    <View style={styles.gallery}>
      {r.evidences.map((e) => (
        <Pressable
          key={e.id}
          onPress={() => (e.type === 'image' ? onOpen(e.url) : void Linking.openURL(e.url))}
          accessibilityRole="button"
          accessibilityLabel={e.type === 'image' ? 'Voir la photo' : e.type === 'video' ? 'Ouvrir la vidéo' : 'Ouvrir le document'}
          style={styles.thumb}>
          {e.type === 'image' ? (
            <Image source={{ uri: e.url }} style={styles.thumbImg} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <View style={styles.thumbDoc}>
              <ThemedText style={styles.emoji}>{e.type === 'video' ? '🎥' : '📄'}</ThemedText>
              <ThemedText type="small" numberOfLines={1} style={styles.centerText}>
                {e.filename ?? (e.type === 'video' ? 'Vidéo' : 'Document')}
              </ThemedText>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/* ── Feuilles d'action ── */

function AcceptSheet({ r, onClose, onDone }: { r: ReturnDetail; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const [montant, setMontant] = useState(String(r.montantAccorde ?? r.montantDemande));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = Number(montant.replace(/\D/g, '')) || 0;
  const submit = async () => {
    if (value <= 0) return setError('⚠️ Montant invalide');
    setSaving(true);
    setError(null);
    try {
      await acceptReturn(r.id, value, note.trim() || undefined);
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };
  return (
    <BottomSheet title="Accepter le retour" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <ThemedText type="smallBold">Montant accordé (GNF)</ThemedText>
        <TextInput value={montant} onChangeText={(v) => setMontant(v.replace(/[^\d]/g, ''))} keyboardType="number-pad" style={[styles.input, { color: theme.text, borderColor: theme.border }]} accessibilityLabel="Montant accordé" />
        <ThemedText type="small" themeColor="textSecondary">
          Demandé par le client : {gnf(r.montantDemande)}
          {value > r.montantDemande ? ' — attention, vous accordez plus que demandé.' : ''}
        </ThemedText>
        <ThemedText type="smallBold">Message au client (optionnel)</ThemedText>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={1000}
          placeholder="Ex : Votre retour a été accepté. Le remboursement sera effectué sous 3-5 jours."
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, styles.area, { color: theme.text, borderColor: theme.border }]}
          accessibilityLabel="Message au client"
        />
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title="Confirmer l’acceptation" onPress={() => void submit()} loading={saving} pill />
      </ScrollView>
    </BottomSheet>
  );
}

function RefuseSheet({ r, onClose, onDone }: { r: ReturnDetail; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await refuseReturn(r.id, note.trim() || undefined);
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };
  return (
    <BottomSheet title="Refuser le retour" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        <ThemedText type="smallBold">Raison du refus (envoyée au client)</ThemedText>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={1000}
          placeholder="Ex : Votre demande ne respecte pas la politique de retour (délai dépassé)."
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, styles.area, { color: theme.text, borderColor: theme.border }]}
          accessibilityLabel="Raison du refus"
        />
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <Pressable onPress={() => void submit()} disabled={saving} accessibilityRole="button" style={styles.danger}>
          {saving ? <ActivityIndicator color={Brand.danger} /> : <ThemedText style={styles.dangerText}>Confirmer le refus</ThemedText>}
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

function NoteSheet({ r, onClose, onDone }: { r: ReturnDetail; onClose: () => void; onDone: () => void }) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await addReturnNote(r.id, text.trim());
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };
  return (
    <BottomSheet title="Note interne" onClose={onClose}>
      <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
        {r.noteInterne ? (
          <ThemedText type="small" themeColor="textSecondary">
            Elle remplacera la note actuelle : « {r.noteInterne} »
          </ThemedText>
        ) : null}
        <TextInput value={text} onChangeText={setText} multiline maxLength={2000} autoFocus placeholder="Note visible uniquement par votre équipe…" placeholderTextColor={theme.textSecondary} style={[styles.input, styles.area, { color: theme.text, borderColor: theme.border }]} accessibilityLabel="Note interne" />
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title="Enregistrer" onPress={() => void submit()} loading={saving} disabled={!text.trim()} pill />
      </ScrollView>
    </BottomSheet>
  );
}

function RefundSheet({ r, onClose, onDone }: { r: ReturnDetail; onClose: () => void; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await refundReturn(r.id);
      onDone();
    } catch (e) {
      setError(toUserMessage(e));
      setSaving(false);
    }
  };
  return (
    <BottomSheet title="Confirmer le remboursement ?" onClose={onClose}>
      <View style={styles.sheet}>
        <ThemedText>
          Le client {r.clientName} sera remboursé de <ThemedText style={styles.bold}>{gnf(r.montantAccorde ?? r.montantDemande)}</ThemedText> pour « {r.productName} ». Il en est prévenu.
        </ThemedText>
        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        <PrimaryButton title="Rembourser" onPress={() => void submit()} loading={saving} pill />
      </View>
    </BottomSheet>
  );
}

/* ── Petits éléments ── */

function Line({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.line}>
      <ThemedText type="small" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.lineV, color ? { color } : null]}>{value}</ThemedText>
    </View>
  );
}

function TabBtn({ on, icon, label, onPress }: { on: boolean; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.tab, on && [styles.tabOn, { backgroundColor: theme.background }]]}>
      <Ionicons name={icon} size={15} color={on ? Brand.primary : theme.textSecondary} />
      <ThemedText type="smallBold" style={{ color: on ? theme.text : theme.textSecondary }} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FooterBtn({ icon, label, onPress, tone, main, busy }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; tone?: 'ok' | 'danger'; main?: boolean; busy?: boolean }) {
  const theme = useTheme();
  const color = tone === 'danger' ? Brand.danger : tone === 'ok' ? Brand.success : Brand.primaryInk;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fBtn, main ? styles.fMain : { borderColor: theme.border }, tone === 'danger' && styles.fDanger, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={18} color={color} />}
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  gap: { gap: 10 },
  pressed: { opacity: 0.85 },
  loader: { marginVertical: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 28 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  emoji: { fontSize: 30, lineHeight: 38 },
  err: { color: Brand.danger },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  head: { gap: 3 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ref: { fontSize: 14, lineHeight: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  product: { fontSize: 20, lineHeight: 26, fontWeight: '900' },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 8 },
  caps: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  text: { lineHeight: 22 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 11, minHeight: 40, paddingHorizontal: 4 },
  tabOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  prodRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  prodImg: { width: 56, height: 56, borderRadius: 12 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10 },
  line: { flexDirection: 'row', alignItems: 'center' },
  lineV: { fontSize: 16, lineHeight: 21, fontWeight: '900' },
  tl: { flexDirection: 'row', gap: 12 },
  tlRail: { alignItems: 'center', width: 30 },
  tlDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  tlLine: { flex: 1, width: 2, marginVertical: 2 },
  tlBody: { flex: 1, paddingBottom: 16, gap: 2 },
  meta: { borderRadius: 10, padding: 8, marginTop: 4 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: '31.5%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: CARD },
  thumbImg: { width: '100%', height: '100%' },
  thumbDoc: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 6 },
  footer: { flexDirection: 'row', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10 },
  fBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, minHeight: 48 },
  fMain: { flex: 1.4, backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine },
  fDanger: { borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
  sheet: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  area: { minHeight: 110, textAlignVertical: 'top' },
  danger: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 999, borderWidth: 1, borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
  dangerText: { color: Brand.danger, fontWeight: '800' },
  viewer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '80%' },
  viewerClose: { position: 'absolute', top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
});
