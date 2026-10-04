/**
 * Support › Nouvelle demande (comme /support/nouveau) — 3 étapes :
 *   1. type de demande (7 types du serveur) ;
 *   2. sujet (5-500) avec articles d'aide proposés pendant la saisie
 *      (GET /support/suggest, 500 ms après la frappe) ;
 *   3. message (20-5000) + pièce jointe facultative (PDF, image, vidéo ≤ 10 Mo,
 *      envoyée sur le premier message juste après la création).
 * Paramètres : ?sujet= pré-remplit le sujet, ?commande=<uuid> lie une commande.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { createTicket, MIN_MESSAGE, suggestArticles, TICKET_TYPES, uploadAttachment, type LocalFile } from '../api';
import { FileChip, pickAttachment, SignInPrompt, TypeCard } from '../components/ui';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NewTicketScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ sujet?: string; commande?: string }>();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [type, setType] = useState<string | null>(null);
  const [subject, setSubject] = useState(String(params.sujet ?? '').slice(0, 150));
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<LocalFile | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [term, setTerm] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const orderId = params.commande && UUID.test(String(params.commande)) ? String(params.commande) : undefined;

  useEffect(() => {
    const t = setTimeout(() => setTerm(subject.trim()), 500);
    return () => clearTimeout(t);
  }, [subject]);
  const suggest = useQuery({ queryKey: qk.help.suggest(term), queryFn: () => suggestArticles(term), enabled: term.length >= 5, staleTime: 60_000 });

  const create = useMutation({
    mutationFn: async () => {
      const res = await createTicket({ type: type!, subject: subject.trim(), firstMessage: message.trim(), relatedOrderId: orderId });
      let attachFailed = false;
      if (file && res.firstMessageId) {
        try {
          await uploadAttachment(res.ticket.id, res.firstMessageId, file);
        } catch {
          attachFailed = true;
        }
      }
      return { id: res.ticket.id, attachFailed };
    },
    onSuccess: ({ id, attachFailed }) => {
      void qc.invalidateQueries({ queryKey: qk.help.ticketsAll });
      router.replace({ pathname: '/support/[id]', params: { id, ...(attachFailed ? { pj: 'echec' } : {}) } });
    },
  });

  const step = !type ? 1 : subject.trim().length < 5 ? 2 : 3;
  const canSend = !!type && subject.trim().length >= 5 && message.trim().length >= MIN_MESSAGE;
  const left = MIN_MESSAGE - message.trim().length;

  const attach = async () => {
    setFileErr(null);
    const r = await pickAttachment();
    if (r.error) setFileErr(r.error);
    else if (r.file) setFile(r.file);
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Nouvelle demande" />
      {!signedIn ? (
        <SignInPrompt text="Connectez-vous pour ouvrir une demande et suivre la réponse de l’équipe." />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Étapes */}
            <View style={styles.steps}>
              {['Type', 'Sujet', 'Message'].map((l, i) => {
                const n = i + 1;
                const done = n < step;
                const on = n === step;
                return (
                  <View key={l} style={styles.step}>
                    <View style={[styles.stepDot, { backgroundColor: done || on ? '#1F1F1F' : theme.backgroundElement }]}>
                      {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <ThemedText style={[styles.stepN, { color: on ? '#fff' : theme.textSecondary }]}>{n}</ThemedText>}
                    </View>
                    <ThemedText style={[styles.stepL, { color: on || done ? theme.text : theme.textSecondary }]}>{l}</ThemedText>
                    {i < 2 ? <View style={[styles.stepLine, { backgroundColor: done ? '#1F1F1F' : theme.border }]} /> : null}
                  </View>
                );
              })}
            </View>

            {orderId ? (
              <View style={styles.order}>
                <Ionicons name="cube-outline" size={16} color="#1F1F1F" />
                <ThemedText type="small" style={styles.flex}>
                  Cette demande sera liée à votre commande.
                </ThemedText>
              </View>
            ) : null}

            <ThemedText style={styles.label}>1. De quoi s’agit-il ?</ThemedText>
            <View style={styles.types}>
              {TICKET_TYPES.map((t) => (
                <TypeCard key={t.value} icon={t.icon} label={t.label} desc={t.desc} selected={type === t.value} onPress={() => setType(t.value)} />
              ))}
            </View>

            <ThemedText style={styles.label}>2. Sujet</ThemedText>
            <Field
              value={subject}
              onChangeText={(v) => {
                setSubject(v);
                setDismissed(false);
              }}
              placeholder="Résumez votre demande en une phrase"
              maxLength={500}
              error={subject.length > 0 && subject.trim().length < 5 ? 'Le sujet doit faire au moins 5 caractères.' : null}
            />
            <ThemedText type="small" themeColor="textSecondary" style={styles.counter}>
              {subject.length}/500
            </ThemedText>

            {(suggest.data ?? []).length && !dismissed ? (
              <View style={[styles.sug, { borderColor: theme.border }]}>
                <View style={styles.sugHead}>
                  <Ionicons name="bulb-outline" size={16} color="#1F1F1F" />
                  <ThemedText style={[styles.flex, styles.sugTitle]}>Ces articles pourraient vous aider</ThemedText>
                  <Pressable onPress={() => setDismissed(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Masquer les suggestions">
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
                {(suggest.data ?? []).map((a) => (
                  <Pressable key={a.slug} onPress={() => router.push({ pathname: '/aide/article/[slug]', params: { slug: a.slug } })} accessibilityRole="button" style={styles.sugItem}>
                    <Ionicons name="document-text-outline" size={16} color={theme.textSecondary} />
                    <View style={styles.flex}>
                      <ThemedText style={styles.sugArt} numberOfLines={1}>
                        {a.title}
                      </ThemedText>
                      {a.excerpt ? (
                        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                          {a.excerpt}
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <ThemedText style={styles.label}>3. Message</ThemedText>
            <Field
              value={message}
              onChangeText={setMessage}
              placeholder={'Décrivez votre problème avec le maximum de détails :\n• Que s’est-il passé ?\n• Quand cela s’est-il produit ?\n• Avez-vous un message d’erreur ?'}
              multiline
              maxLength={5000}
              style={styles.area}
              error={message.length > 0 && left > 0 ? `Encore ${left} caractère${left > 1 ? 's' : ''} minimum` : null}
            />
            <ThemedText type="small" themeColor="textSecondary" style={[styles.counter, message.length > 4500 && styles.warn]}>
              {message.length}/5000
            </ThemedText>

            {file ? (
              <FileChip file={file} onRemove={() => setFile(null)} />
            ) : (
              <Pressable onPress={() => void attach()} accessibilityRole="button" style={[styles.attach, { borderColor: theme.border }]}>
                <Ionicons name="attach" size={18} color="#1F1F1F" />
                <View style={styles.flex}>
                  <ThemedText style={styles.attachTitle}>Joindre un fichier (facultatif)</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Capture d’écran, facture, vidéo — PDF, JPG, PNG, WebP, MP4 · 10 Mo max
                  </ThemedText>
                </View>
              </Pressable>
            )}
            {fileErr ? <ThemedText style={styles.err}>{fileErr}</ThemedText> : null}

            {create.isError ? <ThemedText style={styles.err}>{toUserMessage(create.error)}</ThemedText> : null}
            <PrimaryButton title="Envoyer ma demande" onPress={() => create.mutate()} loading={create.isPending} disabled={!canSend} pill />
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Réponse en 24 à 48 h ouvrées · 4 h pour la fraude et la sécurité. Vous serez prévenu dans l’application.
            </ThemedText>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: 16, gap: 10, paddingBottom: 40 },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepN: { fontSize: 12.5, lineHeight: 16, fontWeight: '900' },
  stepL: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  stepLine: { flex: 1, height: 2, borderRadius: 1, marginHorizontal: 4 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 10 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '900', marginTop: 8 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  counter: { textAlign: 'right', marginTop: -6 },
  warn: { color: '#B45309' },
  area: { minHeight: 150, textAlignVertical: 'top' },
  sug: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  sugHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sugTitle: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  sugItem: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  sugArt: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  attach: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 12 },
  attachTitle: { fontSize: 14, lineHeight: 18, fontWeight: '800' },
  err: { color: '#B91C1C', fontSize: 13.5, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
});
