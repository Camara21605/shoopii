/**
 * Support › Détail d'une demande (comme /support/tickets/:id) :
 *   · en-tête : référence, type, statut, date d'ouverture ;
 *   · fil de discussion (vos messages à droite, l'équipe à gauche, messages
 *     système centrés), pièces jointes (image en aperçu, autres en carte) ;
 *   · réponse + pièce jointe (texte d'abord, puis fichier sur ce message) ;
 *   · « Votre réponse est attendue » quand l'équipe vous a répondu ;
 *   · note de satisfaction (1 à 5 ★) une fois la demande résolue ou fermée ;
 *   · demande fermée : plus de réponse possible → nouvelle demande.
 * Actualisation toutes les 30 s.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { fetchTicket, fmtBytes, rateTicket, replyTicket, TYPE_LABEL, uploadAttachment, type Attachment, type LocalFile, type TicketMessage } from '../api';
import { FileChip, pickAttachment, SignInPrompt, StatusPill } from '../components/ui';

const time = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
};

export default function TicketDetailScreen() {
  const { id, pj } = useLocalSearchParams<{ id: string; pj?: string }>();
  const tid = String(id ?? '');
  const theme = useTheme();
  const qc = useQueryClient();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const scroll = useRef<ScrollView>(null);
  const q = useQuery({ queryKey: qk.help.ticket(tid), queryFn: () => fetchTicket(tid), enabled: signedIn && !!tid, refetchInterval: 30_000 });
  const [text, setText] = useState('');
  const [file, setFile] = useState<LocalFile | null>(null);
  const [note, setNote] = useState<string | null>(pj === 'echec' ? 'Votre demande est créée, mais la pièce jointe n’a pas pu être envoyée. Ajoutez-la dans une réponse.' : null);
  const [rated, setRated] = useState<number | null>(null);

  const t = q.data?.ticket;
  const messages = (q.data?.messages ?? []).filter((m) => !m.isInternal);

  useEffect(() => {
    if (messages.length) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 80);
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async () => {
      const content = text.trim() || (file ? `Pièce jointe : ${file.name}` : '');
      const msg = await replyTicket(tid, content);
      if (file) {
        try {
          await uploadAttachment(tid, msg.id, file);
        } catch {
          setNote('Message envoyé, mais la pièce jointe n’a pas pu être envoyée.');
        }
      }
    },
    onSuccess: () => {
      setText('');
      setFile(null);
      void qc.invalidateQueries({ queryKey: qk.help.ticket(tid) });
      void qc.invalidateQueries({ queryKey: qk.help.ticketsAll });
    },
  });
  const rate = useMutation({ mutationFn: (score: number) => rateTicket(tid, score), onMutate: (s) => setRated(s) });

  const attach = async () => {
    const r = await pickAttachment();
    if (r.error) setNote(r.error);
    else if (r.file) setFile(r.file);
  };

  if (!signedIn)
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Demande" />
        <SignInPrompt text="Connectez-vous pour voir cette demande." />
      </SafeAreaView>
    );

  const closed = t?.status === 'closed';
  const canRate = (t?.status === 'resolved' || t?.status === 'closed') && !t?.satisfactionScore && rated === null;
  const score = t?.satisfactionScore ?? rated;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={t ? t.reference : 'Demande'} />
      {q.isPending ? (
        <ActivityIndicator style={styles.loader} />
      ) : !t ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}>
          <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[styles.head, { borderColor: theme.border }]}>
              <View style={styles.headTop}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {TYPE_LABEL[t.type] ?? t.type}
                </ThemedText>
                <StatusPill status={t.status} />
              </View>
              <ThemedText style={styles.subject}>{t.subject}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Ouverte le {time(t.createdAt)}
              </ThemedText>
            </View>

            {t.status === 'waiting_user' ? (
              <View style={styles.waiting}>
                <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                <ThemedText style={styles.waitingText}>L’équipe attend votre réponse pour avancer.</ThemedText>
              </View>
            ) : null}
            {note ? (
              <Pressable onPress={() => setNote(null)} style={styles.note}>
                <Ionicons name="information-circle" size={16} color="#B45309" />
                <ThemedText type="small" style={styles.noteText}>
                  {note}
                </ThemedText>
              </Pressable>
            ) : null}

            {messages.map((m) => (
              <Bubble key={m.id} m={m} />
            ))}

            {canRate ? (
              <View style={[styles.rate, { borderColor: theme.border }]}>
                <ThemedText style={styles.rateTitle}>Êtes-vous satisfait de la réponse ?</ThemedText>
                <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Notez votre satisfaction de 1 à 5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => rate.mutate(n)} hitSlop={4} accessibilityRole="radio" accessibilityLabel={`${n} étoile${n > 1 ? 's' : ''}`}>
                      <Ionicons name="star-outline" size={32} color="#B45309" />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : score ? (
              <View style={[styles.rate, { borderColor: theme.border }]}>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons key={n} name={n <= score ? 'star' : 'star-outline'} size={22} color="#B45309" />
                  ))}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  Merci pour votre note !
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          {closed ? (
            <View style={[styles.closed, { borderTopColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textSecondary} />
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Cette demande est fermée</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Vous ne pouvez plus y répondre.
                </ThemedText>
              </View>
              <Pressable onPress={() => router.push('/support/nouveau')} accessibilityRole="button" style={styles.newBtn}>
                <ThemedText style={styles.newText}>Nouvelle demande</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
              {file ? <FileChip file={file} onRemove={() => setFile(null)} /> : null}
              {send.isError ? <ThemedText style={styles.err}>{toUserMessage(send.error)}</ThemedText> : null}
              <View style={styles.inputRow}>
                <Pressable onPress={() => void attach()} hitSlop={6} accessibilityRole="button" accessibilityLabel="Joindre un fichier" style={[styles.iconBtn, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="attach" size={20} color={theme.text} />
                </Pressable>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Écrire une réponse…"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  maxLength={5000}
                  style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
                  accessibilityLabel="Votre réponse"
                />
                <Pressable
                  onPress={() => send.mutate()}
                  disabled={send.isPending || (!text.trim() && !file)}
                  accessibilityRole="button"
                  accessibilityLabel="Envoyer"
                  style={[styles.send, (send.isPending || (!text.trim() && !file)) && styles.dim]}>
                  {send.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
                </Pressable>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function Bubble({ m }: { m: TicketMessage }) {
  const theme = useTheme();
  if (m.senderType === 'system')
    return (
      <View style={styles.system}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {m.content} · {time(m.createdAt)}
        </ThemedText>
      </View>
    );
  const mine = m.senderType === 'user';
  return (
    <View style={[styles.msgWrap, mine ? styles.right : styles.left]}>
      {!mine ? (
        <View style={styles.agent}>
          <Ionicons name="headset" size={12} color="#fff" />
          <ThemedText style={styles.agentName}>{m.senderName || 'Équipe Shoneya'}</ThemedText>
        </View>
      ) : null}
      <View style={[styles.bubble, mine ? styles.mine : { backgroundColor: theme.backgroundElement }]}>
        {m.content ? <ThemedText style={[styles.msgText, mine && { color: '#fff' }]}>{m.content}</ThemedText> : null}
        {m.attachments.map((a) => (
          <AttachmentView key={a.id} a={a} mine={mine} />
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={mine ? styles.timeRight : undefined}>
        {time(m.createdAt)}
      </ThemedText>
    </View>
  );
}

function AttachmentView({ a, mine }: { a: Attachment; mine: boolean }) {
  const open = () => void Linking.openURL(a.secureUrl);
  if (a.mimeType.startsWith('image/'))
    return (
      <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`Ouvrir ${a.originalFilename}`}>
        <Image source={{ uri: a.secureUrl }} style={styles.attImg} contentFit="cover" />
      </Pressable>
    );
  return (
    <Pressable onPress={open} accessibilityRole="button" style={[styles.att, { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : '#fff' }]}>
      <Ionicons name={a.mimeType.startsWith('video/') ? 'videocam-outline' : 'document-text-outline'} size={20} color={mine ? '#fff' : '#1F1F1F'} />
      <View style={styles.flex}>
        <ThemedText style={[styles.attName, mine && { color: '#fff' }]} numberOfLines={1}>
          {a.originalFilename}
        </ThemedText>
        <ThemedText type="small" style={{ color: mine ? 'rgba(255,255,255,0.7)' : '#6B6B6B' }}>
          {fmtBytes(a.sizeBytes)} · Ouvrir
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  dim: { opacity: 0.4 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 12, paddingBottom: 20 },
  head: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  headTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subject: { fontSize: 17, lineHeight: 23, fontWeight: '900' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 10 },
  waitingText: { flex: 1, color: '#B91C1C', fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  note: { flexDirection: 'row', gap: 8, backgroundColor: '#FFF7E6', borderRadius: 12, padding: 10 },
  noteText: { flex: 1, color: '#B45309', fontWeight: '600' },
  system: { alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, maxWidth: '90%' },
  msgWrap: { maxWidth: '86%', gap: 3 },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  left: { alignSelf: 'flex-start' },
  agent: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  agentName: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '800' },
  bubble: { borderRadius: 18, padding: 12, gap: 8 },
  mine: { backgroundColor: '#1F1F1F', borderBottomRightRadius: 6 },
  msgText: { fontSize: 15, lineHeight: 21 },
  timeRight: { textAlign: 'right' },
  attImg: { width: 220, height: 160, borderRadius: 12 },
  att: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 10, minWidth: 200 },
  attName: { fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  rate: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 16, padding: 14 },
  rateTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  stars: { flexDirection: 'row', gap: 8 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 10, gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, borderRadius: 21, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 15, maxHeight: 130, minHeight: 42 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  err: { color: '#B91C1C', fontSize: 13, lineHeight: 17, fontWeight: '600' },
  closed: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, padding: 14 },
  newBtn: { backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  newText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' },
});
