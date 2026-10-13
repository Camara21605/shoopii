/**
 * Garde de connexion — même règle que le site (shared/hooks/useAuthGate.tsx +
 * AuthPromptModal) : l'application s'ouvre sur l'Accueil SANS connexion ; une
 * action réservée (panier, favoris, abonnement, message, profil…) ouvre une
 * fenêtre « Connectez-vous pour continuer » au lieu d'échouer.
 *
 *   requireClient(action, motif) — réservé aux CLIENTS :
 *       client connecté → action() · visiteur → fenêtre « connexion » ·
 *       autre rôle → fenêtre « réservé aux clients », qui renvoie vers la
 *       bascule (features/account-switch) : seul passage vers l'espace client
 *   requireAuth(action, motif)   — réservé à TOUT compte connecté
 *       (messagerie, notifications, compte)
 *
 * Après la connexion, l'écran de connexion se referme et l'on revient sur
 * l'écran où l'on était (app/_layout.tsx : (auth) présenté par-dessus).
 * La fenêtre est rendue une seule fois, par <AuthPromptHost /> (app/_layout.tsx).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { ROLE_LABELS } from './api';
import { useSession } from './session-store';

type Prompt = { variant: 'anonymous' | 'wrong-role'; reason?: string };

const usePrompt = create<{ prompt: Prompt | null; show: (p: Prompt) => void; close: () => void }>((set) => ({
  prompt: null,
  show: (prompt) => set({ prompt }),
  close: () => set({ prompt: null }),
}));

/** Ouvre la fenêtre de connexion (ex. bouton « Se connecter » de l'en-tête). */
export const promptLogin = (reason?: string) => usePrompt.getState().show({ variant: 'anonymous', reason });

/** Exécute `action` si un client est connecté ; sinon ouvre la fenêtre adaptée. */
export function requireClient(action: () => void, reason?: string) {
  const user = useSession.getState().user;
  if (user?.role === 'client') return action();
  usePrompt.getState().show({ variant: user ? 'wrong-role' : 'anonymous', reason });
}

/** Exécute `action` si un compte (quel que soit son rôle) est connecté ; sinon fenêtre de connexion. */
export function requireAuth(action: () => void, reason?: string) {
  if (useSession.getState().status === 'signedIn' && useSession.getState().user) return action();
  usePrompt.getState().show({ variant: 'anonymous', reason });
}

/** true = visiteur (aucun compte connecté). */
export const useIsGuest = () => useSession((s) => s.status !== 'signedIn' || !s.user);

export function AuthPromptHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const prompt = usePrompt((s) => s.prompt);
  const close = usePrompt((s) => s.close);
  const role = useSession((s) => s.user?.role);
  const wrongRole = prompt?.variant === 'wrong-role';

  const go = (path: '/login' | '/register') => {
    close();
    router.push(path);
  };

  return (
    <Modal visible={!!prompt} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fermer" accessibilityRole="button" />
      <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four }]} accessibilityViewIsModal>
        <View style={[styles.handle, { backgroundColor: theme.border }]} />
        <View style={styles.icon}>
          <Ionicons name={wrongRole ? 'person-outline' : 'lock-closed'} size={28} color={Brand.primaryInk} />
        </View>
        <ThemedText style={styles.title} accessibilityRole="header">
          {wrongRole ? 'Fonctionnalité réservée aux clients' : 'Connectez-vous pour continuer'}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.text}>
          {prompt?.reason ? `${prompt.reason}\n` : ''}
          {wrongRole
            ? 'Le panier, les commandes et les favoris appartiennent à votre espace client.'
            : 'Connectez-vous ou créez un compte gratuit pour accéder à votre panier, vos commandes, vos favoris et vos messages.'}
        </ThemedText>
        {wrongRole && role ? (
          <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.text} />
            <ThemedText type="small" style={styles.flex}>
              Vous êtes connecté avec un compte {(ROLE_LABELS[role] ?? role).toLowerCase()}. Pour acheter, passez à votre espace client avec la bascule (les flèches ⟲ en haut du menu ☰).
            </ThemedText>
          </View>
        ) : null}

        {!wrongRole ? (
          <Pressable onPress={() => go('/login')} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            <Ionicons name="log-in-outline" size={20} color={Brand.primaryInk} />
            <ThemedText type="smallBold" style={styles.white}>
              Se connecter
            </ThemedText>
          </Pressable>
        ) : null}
        {/* Compte connecté (mauvais rôle) : l'inscription est fermée tant qu'une session est
         * ouverte — le seul passage vers l'espace client est la bascule du menu ☰. */}
        {!wrongRole ? (
          <Pressable
            onPress={() => go('/register')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondary, { borderColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name="person-add-outline" size={20} color={theme.text} />
            <ThemedText type="smallBold">Créer un compte</ThemedText>
          </Pressable>
        ) : null}
        <Pressable onPress={close} accessibilityRole="button" style={wrongRole ? [styles.primary] : styles.later} hitSlop={6}>
          <ThemedText type="smallBold" themeColor={wrongRole ? undefined : 'textSecondary'} style={wrongRole ? styles.white : undefined}>
            {wrongRole ? 'Compris' : 'Plus tard'}
          </ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: Brand.primaryInk },
  pressed: { opacity: 0.8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: 10, gap: 12, alignItems: 'stretch' },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 6 },
  icon: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  text: { textAlign: 'center', lineHeight: 22 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 12, padding: 12 },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, minHeight: 52, marginTop: 4 },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 999, minHeight: 52 },
  later: { alignItems: 'center', paddingVertical: 8 },
});
