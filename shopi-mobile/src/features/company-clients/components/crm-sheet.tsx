/**
 * Campagne CRM (Newsletter VIP · Offre fidélité · Relance inactifs) — même
 * principe que CrmCampaignModal du site : on charge d'abord un APERÇU (nombre
 * et premiers destinataires, sujet et message proposés), rien n'est envoyé tant
 * que l'on n'a pas relu, éventuellement modifié, puis touché « Envoyer ».
 * Envoi réservé à messaging.send ; le serveur limite à 5 campagnes par heure.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { CRM, fetchCrmPreview, plural, sendCrm, type CrmPreview, type CrmType } from '../api';
import { Sheet } from './ui';

type Props = { type: CrmType; canSend: boolean; onClose: () => void; onSent: (msg: string) => void };

/** Charge l'aperçu, puis monte le formulaire prérempli avec le sujet et le message proposés. */
export function CrmSheet(props: Props) {
  const preview = useQuery({ queryKey: qk.company.clientsCrm(props.type), queryFn: () => fetchCrmPreview(props.type), staleTime: 0, gcTime: 0 });
  if (preview.data) return <CrmForm {...props} preview={preview.data} />;
  return (
    <Sheet title={CRM[props.type].title} icon={CRM[props.type].icon} onClose={props.onClose}>
      {preview.isError ? (
        <View style={styles.center}>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Impossible de charger l’aperçu. {toUserMessage(preview.error)}
          </ThemedText>
          <Pressable onPress={() => void preview.refetch()} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réessayer
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      )}
    </Sheet>
  );
}

function CrmForm({ type, canSend, onClose, onSent, preview }: Props & { preview: CrmPreview }) {
  const theme = useTheme();
  const meta = CRM[type];
  const [subject, setSubject] = useState(preview.suggestedSubject);
  const [message, setMessage] = useState(preview.suggestedMessage);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const count = preview.count;
  const subjectOk = subject.trim().length >= 3;
  const messageOk = message.trim().length >= 10;

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const r = await sendCrm(type, subject.trim(), message.trim());
      setResult(r);
      onSent(`✅ Envoyé à ${plural(r.sent, 'client')}`);
    } catch (e) {
      /* Le serveur limite à 5 campagnes par heure (anti-abus) : message clair plutôt que « Too Many Requests ». */
      setError(e instanceof ApiError && e.status === 429 ? 'Limite atteinte : 5 campagnes par heure au maximum. Réessayez un peu plus tard.' : toUserMessage(e) || 'Échec de l’envoi.');
    } finally {
      setSending(false);
    }
  };

  let body: React.ReactNode;
  if (result)
    body = (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={48} color={Brand.success} />
        <ThemedText style={styles.resultTitle}>
          {result.sent} / {result.total} envoyés
        </ThemedText>
        {result.failed > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {result.failed} envoi(s) ont échoué.
          </ThemedText>
        ) : null}
      </View>
    );
  else
    body = (
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.recipients, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.row}>
            <Ionicons name="people-outline" size={18} color={Brand.primary} />
            <ThemedText style={styles.bold}>{plural(count, 'destinataire')}</ThemedText>
          </View>
          {preview.sample.length ? (
            <ThemedText type="small" themeColor="textSecondary">
              {preview.sample
                .slice(0, 5)
                .map((s) => s.fullName)
                .join(', ')}
              {count > 5 ? '…' : ''}
            </ThemedText>
          ) : null}
        </View>
        {count === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            Aucun client dans ce segment pour le moment.
          </ThemedText>
        ) : (
          <>
            <ThemedText type="smallBold">Sujet</ThemedText>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={150}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: subjectOk ? theme.border : Brand.danger }]}
              accessibilityLabel="Sujet"
            />
            <View style={styles.labelRow}>
              <ThemedText type="smallBold">Message</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {message.length}/5000
              </ThemedText>
            </View>
            <TextInput
              value={message}
              onChangeText={setMessage}
              maxLength={5000}
              multiline
              style={[styles.input, styles.area, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: messageOk ? theme.border : Brand.danger }]}
              accessibilityLabel="Message"
            />
            {!messageOk ? (
              <ThemedText type="small" style={styles.err}>
                Le message doit faire au moins 10 caractères.
              </ThemedText>
            ) : null}
            {!canSend ? (
              <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="lock-closed-outline" size={16} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  Votre rôle dans l’équipe ne permet pas d’écrire aux clients. Demandez l’autorisation « Messagerie : Envoyer » au propriétaire.
                </ThemedText>
              </View>
            ) : null}
            {error ? (
              <ThemedText type="small" style={styles.err} accessibilityRole="alert">
                {error}
              </ThemedText>
            ) : null}
          </>
        )}
      </ScrollView>
    );

  const footer = result ? (
    <PrimaryButton title="Fermer" onPress={onClose} pill />
  ) : count > 0 && canSend ? (
    <PrimaryButton title={`Envoyer à ${plural(count, 'client')}`} onPress={() => void send()} loading={sending} disabled={!subjectOk || !messageOk} pill />
  ) : undefined;

  return (
    <Sheet title={meta.title} icon={meta.icon} onClose={onClose} footer={footer}>
      {body}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  loader: { marginVertical: 36 },
  center: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 24 },
  centerText: { textAlign: 'center' },
  resultTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  recipients: { borderRadius: 14, padding: 12, gap: 4, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  area: { minHeight: 150, textAlignVertical: 'top' },
  err: { color: Brand.danger },
  note: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12, marginTop: 6 },
});
