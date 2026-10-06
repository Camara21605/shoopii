/**
 * Paramètres › Journal d'activité — les 50 derniers événements du compte
 * (connexions, sécurité, profil…), avec filtres, comme la rubrique du site
 * (GET /client/parametres/activite). Tirer vers le bas pour actualiser.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { fetchActivite, type Activite } from '@/features/settings/api';
import { LoadState, type IconName } from '@/features/settings/ui';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

/* Libellés du site (settingsPage.activite.events.*) — repli sur le titre envoyé par le serveur */
const EVENTS: Record<string, string> = {
  login_success: 'Connexion réussie',
  login_failed: 'Tentative de connexion échouée',
  login_locked: 'Compte verrouillé après plusieurs échecs',
  login_session_conflict: 'Connexion depuis un autre appareil — ancienne session fermée',
  logout: 'Déconnexion',
  register_success: 'Création du compte',
  password_reset_success: 'Mot de passe réinitialisé',
  password_changed: 'Mot de passe modifié',
  email_verify_success: 'Adresse e-mail vérifiée',
  email_changed: 'Adresse e-mail modifiée',
  phone_changed: 'Numéro de téléphone modifié',
  tokens_revoked: 'Sessions révoquées',
  account_locked: 'Compte verrouillé',
  login_2fa_failed: 'Code de double authentification incorrect',
  twofa_enabled: 'Double authentification activée',
  twofa_disabled: 'Double authentification désactivée',
  backup_codes_generated: 'Nouveaux codes de secours générés',
  account_unlink: 'Compte lié détaché',
};
const ICONS: Record<string, IconName> = {
  login: 'log-in-outline',
  order: 'bag-handle-outline',
  security: 'shield-checkmark-outline',
  alert: 'warning-outline',
  profile: 'person-outline',
};
const FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'login', label: 'Connexions' },
  { key: 'security', label: 'Sécurité' },
  { key: 'alert', label: 'Alertes' },
  { key: 'profile', label: 'Profil' },
];

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'à l’instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `il y a ${Math.floor(diff / 3600)} h`;
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ActiviteScreen() {
  const theme = useTheme();
  const [filter, setFilter] = useState('all');
  const query = useQuery({ queryKey: ['settings', 'activite'], queryFn: fetchActivite });
  const items = useMemo(
    () => (query.data ?? []).filter((a) => filter === 'all' || a.type === filter),
    [query.data, filter],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Journal d’activité" />
      {!query.data ? (
        <LoadState loading={query.isLoading} error={query.error ? toUserMessage(query.error) : null} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(a, i) => `${a.time}-${i}`}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} colors={[Brand.primary]} />}
          ListHeaderComponent={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
              {FILTERS.map((f) => {
                const on = f.key === filter;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primaryLine : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText type="small" style={{ color: on ? Brand.primaryInk : theme.text, fontWeight: '700' }}>
                      {f.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              Aucune activité enregistrée
            </ThemedText>
          }
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: theme.border }]} />}
          renderItem={({ item }) => <Item a={item} />}
        />
      )}
    </SafeAreaView>
  );
}

function Item({ a }: { a: Activite }) {
  const theme = useTheme();
  const bad = !a.success || a.type === 'alert';
  const title = EVENTS[a.code] ?? a.title ?? 'Activité';
  const meta = [a.device, a.location].filter(Boolean).join(' · ');
  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: bad ? '#FDECEA' : theme.backgroundElement }]}>
        <Ionicons name={ICONS[a.type] ?? 'ellipse-outline'} size={18} color={bad ? Brand.danger : Brand.primary} />
      </View>
      <View style={styles.flex}>
        <ThemedText style={[styles.title, bad && { color: Brand.danger }]}>{title}</ThemedText>
        {meta ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {when(a.time)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
  filters: { gap: 8, paddingVertical: Spacing.three },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  empty: { textAlign: 'center', paddingVertical: Spacing.six },
  sep: { height: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 21 },
});
