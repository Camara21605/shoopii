/**
 * Support › Mes demandes (comme /support) : filtres par statut, une carte par
 * ticket (référence, type, sujet, statut, priorité haute / critique, messages,
 * réponse attendue de votre part, dernière activité), « Nouvelle demande ».
 * Mise à jour toutes les minutes et en tirant vers le bas.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { ago, fetchTickets, TICKET_FILTERS, TYPE_LABEL } from '../api';
import { SignInPrompt, StatusPill } from '../components/ui';

const PRIORITY: Record<string, { label: string; color: string } | undefined> = {
  high: { label: 'Haute priorité', color: '#B45309' },
  critical: { label: 'Critique', color: '#B91C1C' },
};

export default function TicketsScreen() {
  const theme = useTheme();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const [status, setStatus] = useState('');
  const q = useQuery({ queryKey: qk.help.tickets(status), queryFn: () => fetchTickets(status), enabled: signedIn, refetchInterval: 60_000 });
  const tickets = q.data?.data ?? [];

  const newBtn = signedIn ? (
    <Pressable onPress={() => router.push('/support/nouveau')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Nouvelle demande" style={styles.newBtn}>
      <Ionicons name="add" size={18} color="#fff" />
      <ThemedText style={styles.newText}>Nouvelle</ThemedText>
    </Pressable>
  ) : undefined;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Mes demandes" right={newBtn} />
      {!signedIn ? (
        <SignInPrompt text="Vos demandes d’assistance sont liées à votre compte Shoneya." />
      ) : q.isError && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
          ListHeaderComponent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {TICKET_FILTERS.map((f) => {
                const on = f.value === status;
                return (
                  <Pressable key={f.value} onPress={() => setStatus(f.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, { borderColor: on ? theme.text : theme.border, backgroundColor: on ? 'rgba(0,0,0,0.05)' : theme.background }]}>
                    <ThemedText style={[styles.chipText, on && styles.chipOn]}>{f.label}</ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          }
          ListEmptyComponent={
            q.isPending ? (
              <ActivityIndicator style={styles.loader} />
            ) : (
              <View style={styles.empty}>
                <View style={[styles.emptyIco, { backgroundColor: theme.backgroundElement }]}>
                  <Ionicons name="chatbubbles-outline" size={28} color={theme.text} />
                </View>
                <ThemedText style={styles.emptyTitle}>{status ? 'Aucune demande avec ce statut' : 'Aucune demande pour le moment'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                  Une question sur une commande, un paiement ou votre compte ? Notre équipe vous répond en 24 h.
                </ThemedText>
                <Pressable onPress={() => router.push('/support/nouveau')} accessibilityRole="button" style={styles.cta}>
                  <ThemedText style={styles.ctaText}>Ouvrir une demande</ThemedText>
                </Pressable>
              </View>
            )
          }
          renderItem={({ item: t }) => {
            const waiting = t.status === 'waiting_user';
            const prio = PRIORITY[t.priority];
            return (
              <Pressable
                onPress={() => router.push({ pathname: '/support/[id]', params: { id: t.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${t.subject}, ${t.reference}`}
                style={({ pressed }) => [styles.card, { borderColor: waiting ? '#FECACA' : theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
                <View style={styles.top}>
                  <ThemedText style={styles.ref}>{t.reference}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    · {TYPE_LABEL[t.type] ?? t.type}
                  </ThemedText>
                  <View style={styles.flex} />
                  <StatusPill status={t.status} />
                </View>
                <ThemedText style={styles.subject} numberOfLines={2}>
                  {t.subject}
                </ThemedText>
                <View style={styles.meta}>
                  <Ionicons name="chatbubble-outline" size={13} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {t.messageCount} message{t.messageCount > 1 ? 's' : ''} · {ago(t.updatedAt)}
                  </ThemedText>
                  {prio ? <ThemedText style={[styles.prio, { color: prio.color }]}>· {prio.label}</ThemedText> : null}
                  <View style={styles.flex} />
                  {t.unreadByUser > 0 ? (
                    <View style={styles.unread}>
                      <ThemedText style={styles.unreadText}>{t.unreadByUser}</ThemedText>
                    </View>
                  ) : null}
                </View>
                {waiting ? (
                  <View style={styles.waiting}>
                    <Ionicons name="alert-circle" size={14} color="#B91C1C" />
                    <ThemedText style={styles.waitingText}>L’équipe attend votre réponse</ThemedText>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  loader: { marginTop: 30 },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  newText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  chips: { gap: 8, paddingBottom: 6 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 6 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  chipOn: { fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ref: { fontSize: 13.5, lineHeight: 18, fontWeight: '900' },
  subject: { fontSize: 15.5, lineHeight: 21, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  prio: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#D93025', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  unreadText: { color: '#fff', fontSize: 11, lineHeight: 14, fontWeight: '900' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  waitingText: { color: '#B91C1C', fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  cta: { backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 20, minHeight: 46, justifyContent: 'center', marginTop: 6 },
  ctaText: { color: '#fff', fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
});
