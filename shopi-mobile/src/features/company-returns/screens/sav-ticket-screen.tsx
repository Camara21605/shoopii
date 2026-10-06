/**
 * Espace entreprise › SAV › conversation d'un ticket — équivalent mobile de la
 * modale SavConversationModal du site, en plein écran :
 *   · en-tête : référence, sujet, client, statut, produit, commande, priorité ;
 *   · bulles de discussion (client à gauche, boutique à droite) avec auteur
 *     et heure ; ouvrir le ticket marque les messages du client comme lus ;
 *   · zone de réponse (returns.process, ticket non fermé) ;
 *   · Résoudre / Fermer (confirmation), priorité (absente du site).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/bottom-sheet';
import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, useSnack } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { usePermissions } from '@/features/company/hooks';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { closeTicket, fetchTicket, formatDate, formatTime, PRIORITIES, replyTicket, resolveTicket, SAV_STATUS, setTicketPriority, type Priority, type SavTicketDetail } from '../api';
import { CARD, Pill, PriorityPicker } from '../components/ui';

export default function SavTicketScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const perms = usePermissions();
  const canView = perms.isOwner || perms.can('returns', 'view');
  const canProcess = perms.isOwner || perms.can('returns', 'process');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const snack = useSnack();
  const key = qk.company.savTicket(id ?? '');
  const q = useQuery({ queryKey: key, queryFn: () => fetchTicket(id ?? ''), enabled: !!id && canView, refetchInterval: 30_000 });
  const t = q.data;

  /* Les non-lus disparaissent de la liste dès l'ouverture (le serveur les marque lus). */
  useEffect(() => {
    if (t) void qc.invalidateQueries({ queryKey: qk.company.savAll });
  }, [t?.id, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshLists = () => {
    void qc.invalidateQueries({ queryKey: qk.company.returnsAll });
    void qc.invalidateQueries({ queryKey: qk.company.badges });
  };

  const send = async () => {
    if (!t || !draft.trim() || sending) return;
    setSending(true);
    try {
      const msg = await replyTicket(t.id, draft.trim());
      qc.setQueryData<SavTicketDetail>(key, (d) => (d ? { ...d, status: 'in_progress', messages: [...d.messages, msg], messageCount: d.messageCount + 1 } : d));
      setDraft('');
      refreshLists();
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    } catch (e) {
      snack.show(`❌ ${toUserMessage(e)}`, true);
    } finally {
      setSending(false);
    }
  };

  const act = async (k: string, fn: () => Promise<unknown>, msg: string, leave?: boolean) => {
    setBusy(k);
    try {
      await fn();
      snack.show(msg);
      refreshLists();
      if (leave) router.back();
      else void q.refetch();
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
  else if (q.isError || !t) body = <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  else {
    const open = t.status !== 'closed' && t.status !== 'resolved';
    body = (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView ref={scroll} contentContainerStyle={styles.content} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
          <View style={styles.box}>
            <View style={styles.row}>
              <ThemedText style={styles.ref}>{t.reference}</ThemedText>
              <Pill tone={SAV_STATUS[t.status]} small />
            </View>
            <ThemedText style={styles.subject}>{t.subject}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.clientName} · ouvert le {formatDate(t.createdAt)}
            </ThemedText>
            {t.productName ? (
              <ThemedText type="small" themeColor="textSecondary">
                Produit : {t.productName}
              </ThemedText>
            ) : null}
            {t.commandeNumero ? (
              <Pressable
                onPress={() => t.commandeId && router.push({ pathname: '/entreprise/commandes/[id]', params: { id: t.commandeId } })}
                disabled={!t.commandeId || !(perms.isOwner || perms.can('orders', 'view'))}
                accessibilityRole="button"
                style={styles.order}>
                <Ionicons name="cube-outline" size={15} color={Brand.primary} />
                <ThemedText type="smallBold">Commande {t.commandeNumero}</ThemedText>
              </Pressable>
            ) : null}
            <PriorityPicker value={t.priority} disabled={!canProcess} busy={busy === 'priority'} onChange={(p: Priority) => void act('priority', () => setTicketPriority(t.id, p), `Priorité : ${PRIORITIES[p].label}`)} />
            {canProcess && open ? (
              <View style={styles.actions}>
                <Pressable onPress={() => void act('resolve', () => resolveTicket(t.id), '✅ Ticket résolu', true)} disabled={!!busy} accessibilityRole="button" style={[styles.act, styles.actOk]}>
                  {busy === 'resolve' ? <ActivityIndicator color={Brand.success} /> : <Ionicons name="checkmark" size={17} color={Brand.success} />}
                  <ThemedText type="smallBold" style={{ color: Brand.success }}>
                    Résoudre
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => setConfirmClose(true)} disabled={!!busy} accessibilityRole="button" style={[styles.act, { borderColor: theme.border }]}>
                  <Ionicons name="close" size={17} color={theme.text} />
                  <ThemedText type="smallBold">Fermer</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>

          {t.messages.map((m) => {
            const mine = m.senderRole === 'enterprise';
            return (
              <View key={m.id} style={[styles.msgRow, mine && styles.msgRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={mine ? styles.mineText : undefined}>{m.content}</ThemedText>
                </View>
                <ThemedText style={[styles.time, mine && styles.timeMine]} themeColor="textSecondary">
                  {m.senderName || (mine ? 'Boutique' : t.clientName)} · {formatDate(m.createdAt)} {formatTime(m.createdAt)}
                </ThemedText>
              </View>
            );
          })}
          {!t.messages.length ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Aucun message pour le moment.
            </ThemedText>
          ) : null}
        </ScrollView>

        {canProcess && t.status !== 'closed' ? (
          <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Répondre au client…"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={5000}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
              accessibilityLabel="Votre réponse"
            />
            <Pressable onPress={() => void send()} disabled={sending || !draft.trim()} accessibilityRole="button" accessibilityLabel="Envoyer" style={[styles.sendBtn, (!draft.trim() || sending) && styles.dim]}>
              {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={19} color="#fff" />}
            </Pressable>
          </View>
        ) : t.status === 'closed' ? (
          <View style={[styles.closedBar, { borderTopColor: theme.border }]}>
            <Ionicons name="lock-closed-outline" size={15} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              Ticket fermé — impossible de répondre.
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Ticket SAV" />
      <View style={styles.flex}>{body}</View>
      <Snack msg={snack.msg} bottom={90} />
      {confirmClose && t ? (
        <BottomSheet title="Fermer ce ticket ?" onClose={() => setConfirmClose(false)}>
          <View style={styles.sheet}>
            <ThemedText themeColor="textSecondary">Le client ne pourra plus répondre et vous non plus. Préférez « Résoudre » si le problème est réglé.</ThemedText>
            <Pressable
              onPress={() => {
                setConfirmClose(false);
                void act('close', () => closeTicket(t.id), 'Ticket fermé', true);
              }}
              accessibilityRole="button"
              style={styles.danger}>
              <ThemedText style={styles.dangerText}>Fermer le ticket</ThemedText>
            </Pressable>
          </View>
        </BottomSheet>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.45 },
  loader: { marginVertical: 32 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 6, padding: 28 },
  centerText: { textAlign: 'center' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  content: { padding: 16, gap: 10, paddingBottom: 20 },
  box: { backgroundColor: CARD, borderRadius: 18, padding: 14, gap: 6, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ref: { fontSize: 13, lineHeight: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subject: { fontSize: 17, lineHeight: 23, fontWeight: '900' },
  order: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  act: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, minHeight: 42 },
  actOk: { borderColor: '#BFE5CF', backgroundColor: '#E7F6EE' },
  msgRow: { alignItems: 'flex-start', gap: 3, maxWidth: '85%' },
  msgRowMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { borderRadius: 18, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: Brand.primary, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
  mineText: { color: '#fff' },
  time: { fontSize: 11, lineHeight: 15 },
  timeMine: { textAlign: 'right' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 8 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, maxHeight: 130, fontSize: 15 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  closedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, padding: 12 },
  sheet: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  danger: { alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 999, borderWidth: 1, borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
  dangerText: { color: Brand.danger, fontWeight: '800' },
});
