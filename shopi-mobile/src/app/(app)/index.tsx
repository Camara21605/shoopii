import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchMe } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-store';
import { toUserMessage } from '@/lib/api/errors';

export default function HomeScreen() {
  const signOut = useSession((s) => s.signOut);
  const cachedUser = useSession((s) => s.user);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    initialData: cachedUser ?? undefined,
  });

  return (
    <ThemedView style={styles.container}>
      {isPending ? (
        <ActivityIndicator />
      ) : error ? (
        <>
          <ThemedText accessibilityRole="alert">{toUserMessage(error)}</ThemedText>
          <Pressable onPress={() => void refetch()} accessibilityRole="button">
            <ThemedText type="linkPrimary">Réessayer</ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText type="subtitle">Bonjour {data?.firstName} 👋</ThemedText>
          <ThemedText themeColor="textSecondary">
            Connecté en tant que {data?.role} — {data?.email}
          </ThemedText>
        </>
      )}

      <Pressable onPress={() => void signOut()} accessibilityRole="button" style={styles.signOut}>
        <ThemedText type="link">Se déconnecter</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  signOut: { marginTop: Spacing.four },
});
