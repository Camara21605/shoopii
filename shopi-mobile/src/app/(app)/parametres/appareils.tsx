/**
 * Paramètres › Appareils connectés — sessions actives du compte
 * (GET /client/parametres/sessions), révoquer une session ou toutes les
 * autres, comme la rubrique « Appareils connectés » du site.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchSessions, revokeOtherSessions, revokeSession, type Session } from '@/features/settings/api';
import { Card, LoadState, OutlineButton, Pill, Section, TextButton, useToast } from '@/features/settings/ui';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const KEY = ['settings', 'sessions'];

function deviceIcon(s: Session): React.ComponentProps<typeof Ionicons>['name'] {
  const d = `${s.device} ${s.os}`.toLowerCase();
  if (/android|iphone|ios|mobile|phone/.test(d)) return 'phone-portrait-outline';
  if (/ipad|tablet/.test(d)) return 'tablet-portrait-outline';
  return 'desktop-outline';
}

function lastSeen(iso?: string | null) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 300) return 'Active maintenant';
  if (diff < 3600) return `Dernière activité : il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `Dernière activité : il y a ${Math.floor(diff / 3600)} h`;
  return `Dernière activité : ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}

export default function AppareilsScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: KEY, queryFn: fetchSessions });
  const [busy, setBusy] = useState<string | null>(null);

  const sessions = query.data ?? [];
  const others = sessions.filter((s) => !s.isCurrent);
  const suspects = sessions.filter((s) => s.suspect).length;

  async function revoke(s: Session) {
    setBusy(s.id);
    try {
      await revokeSession(s.id);
      qc.setQueryData<Session[]>(KEY, (old) => (old ?? []).filter((x) => x.id !== s.id));
      toast.show('Session révoquée');
    } catch (e) {
      toast.show(toUserMessage(e));
    } finally {
      setBusy(null);
    }
  }

  function confirmRevokeAll() {
    Alert.alert(
      others.length > 1 ? `Déconnecter les ${others.length} autres appareils ?` : 'Déconnecter l’autre appareil connecté ?',
      'Ils devront se reconnecter avec votre mot de passe.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Oui, déconnecter',
          style: 'destructive',
          onPress: async () => {
            setBusy('all');
            try {
              await revokeOtherSessions();
              qc.setQueryData<Session[]>(KEY, (old) => (old ?? []).filter((x) => x.isCurrent));
              toast.show('Toutes les autres sessions révoquées');
            } catch (e) {
              toast.show(toUserMessage(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Appareils connectés" />
      {!query.data ? (
        <LoadState loading={query.isLoading} error={query.error ? toUserMessage(query.error) : null} onRetry={() => void query.refetch()} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} colors={[Brand.primary]} />}>
          {suspects > 0 ? (
            <View style={styles.warn} accessibilityRole="alert">
              <Ionicons name="warning-outline" size={20} color={Brand.danger} />
              <ThemedText type="small" style={styles.flex}>
                {suspects} connexion{suspects > 1 ? 's' : ''} suspecte{suspects > 1 ? 's' : ''} détectée{suspects > 1 ? 's' : ''}. Révoquez-la
                {suspects > 1 ? 's' : ''} et changez votre mot de passe immédiatement.
              </ThemedText>
            </View>
          ) : null}

          <Section
            title={`${sessions.length} session${sessions.length > 1 ? 's' : ''} active${sessions.length > 1 ? 's' : ''}`}
            note="Pour votre sécurité, Shoneya n’autorise qu’une seule session active par compte : vous connecter sur un autre appareil ferme automatiquement la précédente.">
            {sessions.length === 0 ? (
              <ThemedText themeColor="textSecondary">Aucune session active</ThemedText>
            ) : (
              <Card>
                {sessions.map((s) => (
                  <View key={s.id} style={styles.item}>
                    <View style={[styles.icon, { backgroundColor: s.suspect ? '#FDECEA' : theme.backgroundElement }]}>
                      <Ionicons name={deviceIcon(s)} size={20} color={s.suspect ? Brand.danger : Brand.primary} />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.titleRow}>
                        <ThemedText style={styles.title} numberOfLines={1}>
                          {[s.browser, s.os].filter(Boolean).join(' · ') || s.device || 'Appareil'}
                        </ThemedText>
                        {s.isCurrent ? <Pill label="Cet appareil" tone="success" /> : null}
                        {s.suspect ? <Pill label="Suspect" tone="danger" /> : null}
                      </View>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {[s.location || 'Localisation inconnue', s.ip].filter(Boolean).join(' · ')}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {s.isCurrent ? 'Active maintenant' : lastSeen(s.lastSeen)}
                      </ThemedText>
                      {!s.isCurrent ? (
                        <View style={styles.revoke}>
                          <TextButton label={busy === s.id ? 'Révocation…' : 'Révoquer'} onPress={() => void revoke(s)} disabled={!!busy} />
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Card>
            )}
          </Section>

          {others.length > 0 ? (
            <OutlineButton icon="log-out-outline" label="Déconnecter les autres appareils" danger loading={busy === 'all'} onPress={confirmRevokeAll} />
          ) : null}
        </ScrollView>
      )}
      {toast.element}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  warn: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, borderRadius: 14, backgroundColor: '#FDECEA' },
  item: { flexDirection: 'row', gap: 12, padding: 14 },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '700', flexShrink: 1 },
  revoke: { alignItems: 'flex-start', marginTop: 2 },
});
