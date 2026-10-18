/**
 * /messages/ecrire?type=…&id=… — ouvre (ou crée) la discussion avec un profil
 * puis la remplace par l'écran de discussion. Cible de la notification
 * « X est sur Shoneya » (contact.joined, voir notification-target.util.ts) :
 * un toucher sur la notification → on écrit directement à la personne.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { openConversationWith, type ActorType } from '@/features/messagerie/api';
import { useTheme } from '@/hooks/use-theme';

const TYPES: readonly ActorType[] = ['client', 'company', 'delivery', 'correspondent', 'partner'];

export default function WriteToScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { type, id } = useLocalSearchParams<{ type?: string; id?: string }>();
  const valid = !!type && !!id && TYPES.includes(type as ActorType);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const error = valid ? failure : 'Ce lien de discussion n’est pas valide.';

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    openConversationWith(type as ActorType, id!)
      .then((c) => {
        if (!alive) return;
        void qc.invalidateQueries({ queryKey: ['conversations'] });
        router.replace({
          pathname: '/messages/[id]',
          params: { id: c.id, name: c.contactName, logo: c.contactLogo ?? '', online: c.contactOnline ? '1' : '0', presence: c.contactPresence ?? '', userId: c.contactUserId ?? '' },
        });
      })
      .catch((err: unknown) => alive && setFailure(err instanceof Error ? err.message : 'Impossible d’ouvrir la discussion.'));
    return () => { alive = false; };
  }, [valid, type, id, attempt, qc]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Messages" />
      <View style={styles.body}>
        {error ? (
          <>
            <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.center}>{error}</ThemedText>
            <Pressable onPress={() => { setFailure(null); setAttempt((n) => n + 1); }} accessibilityRole="button" style={styles.btn}>
              <ThemedText style={styles.btnText}>Réessayer</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.replace('/messages')} accessibilityRole="button">
              <ThemedText style={{ color: Brand.primary, fontWeight: '700' }}>Voir mes messages</ThemedText>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={Brand.primary} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: Spacing.four },
  center: { textAlign: 'center' },
  btn: { backgroundColor: Brand.primarySoft, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: Brand.primaryInk, fontWeight: '800' },
});
