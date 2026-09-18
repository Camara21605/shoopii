import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { login, type LoginOutcome } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const UNSUPPORTED: Partial<Record<LoginOutcome['kind'], string>> = {
  twoFa: 'Ce compte utilise la double authentification (2FA). Sa prise en charge arrive bientôt dans l’application.',
  accountChoice: 'Cet identifiant correspond à plusieurs comptes. Le choix du compte arrive bientôt dans l’application.',
  emailVerification: 'Votre email n’est pas encore vérifié. Vérifiez-le depuis le site shoneya.com puis reconnectez-vous.',
};

export default function LoginScreen() {
  const theme = useTheme();
  const signIn = useSession((s) => s.signIn);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !loading;

  async function submit(confirmDisconnectOther = false) {
    setLoading(true);
    setError(null);
    try {
      const outcome = await login({ identifier, password, confirmDisconnectOther });
      if (outcome.kind === 'success') {
        await signIn(
          { accessToken: outcome.accessToken, refreshToken: outcome.refreshToken },
          outcome.user,
        );
        return;
      }
      if (outcome.kind === 'sessionConfirm') {
        Alert.alert(
          'Déjà connecté ailleurs',
          'Ce compte est ouvert sur un autre appareil. Le déconnecter et continuer ici ?',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Continuer ici', onPress: () => void submit(true) },
          ],
        );
        return;
      }
      setError(UNSUPPORTED[outcome.kind] ?? 'Connexion impossible.');
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.form}>
        <ThemedText type="subtitle">Shoneya</ThemedText>
        <ThemedText themeColor="textSecondary">Connectez-vous pour continuer.</ThemedText>

        <TextInput
          style={inputStyle}
          placeholder="Email ou téléphone"
          placeholderTextColor={theme.textSecondary}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          textContentType="username"
          keyboardType="email-address"
          returnKeyType="next"
          accessibilityLabel="Email ou téléphone"
          editable={!loading}
        />
        <TextInput
          style={inputStyle}
          placeholder="Mot de passe"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void submit()}
          accessibilityLabel="Mot de passe"
          editable={!loading}
        />

        {error ? (
          <ThemedText type="small" style={styles.error} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={() => void submit()}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: loading }}
          style={[styles.button, !canSubmit && styles.buttonDisabled]}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="smallBold" style={styles.buttonText}>
              Se connecter
            </ThemedText>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  form: { gap: Spacing.three },
  input: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16 },
  error: { color: '#D93025' },
  button: {
    backgroundColor: '#208AEF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff' },
});
