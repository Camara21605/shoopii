/**
 * Cadre des profils du réseau : barre de titre (retour), chargement / erreur
 * avec « Réessayer », contenu défilant, barre d'actions fixe en bas (comme la
 * barre d'actions mobile du site) et message bref.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { Snack, type SnackMsg } from '@/components/snack';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

export function ProfileFrame({
  title,
  loading,
  error,
  notFound,
  onRetry,
  refreshing,
  onRefresh,
  bar,
  snack,
  children,
}: {
  title: string;
  loading: boolean;
  error: unknown;
  notFound: string;
  onRetry: () => void;
  refreshing: boolean;
  onRefresh: () => void;
  bar?: ReactNode;
  snack: SnackMsg;
  children?: ReactNode;
}) {
  const theme = useTheme();
  let body: ReactNode;
  if (loading)
    body = (
      <View style={styles.center}>
        <ActivityIndicator color={Brand.primary} />
        <ThemedText type="small" themeColor="textSecondary">
          Chargement du profil…
        </ThemedText>
      </View>
    );
  else if (error || !children) {
    const status = (error as { status?: number } | null)?.status;
    body = (
      <View style={styles.center}>
        <Ionicons name={status === 404 ? 'person-remove-outline' : 'cloud-offline-outline'} size={38} color={theme.textSecondary} />
        <ThemedText style={styles.bold}>{status === 404 ? notFound : 'Profil indisponible'}</ThemedText>
        {status !== 404 ? (
          <>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {toUserMessage(error)}
            </ThemedText>
            <PrimaryButton title="Réessayer" onPress={onRetry} pill />
          </>
        ) : null}
      </View>
    );
  } else
    body = (
      <ScrollView
        contentContainerStyle={[styles.content, bar ? styles.withBar : null]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Brand.primary]} tintColor={Brand.primary} />}>
        {children}
      </ScrollView>
    );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title={title} />
      <View style={styles.flex}>
        {body}
        {bar && !loading && !error && children ? <View style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>{bar}</View> : null}
        <Snack msg={snack} bottom={bar ? 90 : 24} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  centerText: { textAlign: 'center' },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  withBar: { paddingBottom: 100 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
