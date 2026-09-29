/**
 * Écran de connexion — en 3 étapes possibles, toutes gérées ici :
 *   1. identifiant + mot de passe (POST /auth/login)
 *   2. choix du compte quand l'identifiant correspond à plusieurs comptes
 *      (ex. entreprise + client lié) → POST /auth/login/choose-account
 *   3. code 2FA (application d'authentification ou code de secours)
 *      → POST /auth/2fa/verify-login
 * « Déjà connecté ailleurs » : confirmation puis nouvel essai avec
 * confirmDisconnectOther, à l'étape où on se trouve.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  ROLE_LABELS,
  chooseAccount,
  login,
  verifyTwoFa,
  type AccountOption,
  type LoginOutcome,
} from '@/features/auth/api';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

type Step =
  | { name: 'credentials' }
  | { name: 'account'; accounts: AccountOption[] }
  | { name: 'twoFa'; challengeToken: string };

export default function LoginScreen() {
  const theme = useTheme();
  const signIn = useSession((s) => s.signIn);
  const [step, setStep] = useState<Step>({ name: 'credentials' });
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Traite la réponse du serveur, quelle que soit l'étape qui l'a produite. */
  async function handle(outcome: LoginOutcome, retry: () => Promise<LoginOutcome>) {
    switch (outcome.kind) {
      case 'success':
        await signIn({ accessToken: outcome.accessToken, refreshToken: outcome.refreshToken }, outcome.user);
        return;
      case 'twoFa':
        setCode('');
        setStep({ name: 'twoFa', challengeToken: outcome.challengeToken });
        return;
      case 'accountChoice':
        setStep({ name: 'account', accounts: outcome.accounts });
        return;
      case 'sessionConfirm':
        Alert.alert(
          'Déjà connecté ailleurs',
          'Ce compte est ouvert sur un autre appareil. Le déconnecter et continuer ici ?',
          [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Continuer ici', onPress: () => void run(retry) },
          ],
        );
        return;
      case 'emailVerification':
        setError('Votre email n’est pas encore vérifié. Vérifiez-le depuis le site shoneya.com, puis reconnectez-vous.');
        return;
    }
  }

  /** Lance un appel, gère chargement et erreurs. `again` = même appel avec confirmDisconnectOther. */
  async function run(call: () => Promise<LoginOutcome>, again?: () => Promise<LoginOutcome>) {
    setLoading(true);
    setError(null);
    try {
      await handle(await call(), again ?? call);
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const submitCredentials = () =>
    run(
      () => login({ identifier, password }),
      () => login({ identifier, password, confirmDisconnectOther: true }),
    );

  const pickAccount = (userId: string) =>
    run(
      () => chooseAccount({ identifier, password, userId }),
      () => chooseAccount({ identifier, password, userId, confirmDisconnectOther: true }),
    );

  const submitCode = (challengeToken: string) => run(() => verifyTwoFa(challengeToken, code));

  const back = () => {
    setStep({ name: 'credentials' });
    setError(null);
  };

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }];
  const canLogin = identifier.trim().length > 0 && password.length > 0 && !loading;
  const canVerify = /^[A-Za-z0-9]{6}$/.test(code.trim()) && !loading;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText style={styles.logo}>
              Sho<ThemedText style={[styles.logo, { color: Brand.primary }]}>neya</ThemedText>
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              {step.name === 'credentials'
                ? 'Connectez-vous pour retrouver vos messages.'
                : step.name === 'account'
                  ? 'Cet identifiant correspond à plusieurs comptes. Lequel ouvrir ?'
                  : 'Entrez le code à 6 caractères de votre application d’authentification (ou un code de secours).'}
            </ThemedText>
          </View>

          {step.name === 'credentials' && (
            <>
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
                onSubmitEditing={() => canLogin && void submitCredentials()}
                accessibilityLabel="Mot de passe"
                editable={!loading}
              />
            </>
          )}

          {step.name === 'account' &&
            step.accounts.map((a) => (
              <Pressable
                key={a.userId}
                onPress={() => void pickAccount(a.userId)}
                disabled={loading}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.accountBtn,
                  { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
                ]}>
                <ThemedText type="smallBold">{ROLE_LABELS[a.role] ?? a.role}</ThemedText>
              </Pressable>
            ))}

          {step.name === 'twoFa' && (
            <TextInput
              style={[inputStyle, styles.codeInput]}
              placeholder="••••••"
              placeholderTextColor={theme.textSecondary}
              value={code}
              onChangeText={(v) => setCode(v.replace(/[^A-Za-z0-9]/g, '').slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              keyboardType={Platform.OS === 'android' ? 'visible-password' : 'default'}
              returnKeyType="go"
              onSubmitEditing={() => canVerify && void submitCode(step.challengeToken)}
              accessibilityLabel="Code de vérification"
              autoFocus
              editable={!loading}
            />
          )}

          {error ? (
            <ThemedText type="small" style={styles.error} accessibilityRole="alert">
              {error}
            </ThemedText>
          ) : null}

          {step.name !== 'account' && (
            <Pressable
              onPress={() => void (step.name === 'twoFa' ? submitCode(step.challengeToken) : submitCredentials())}
              disabled={step.name === 'twoFa' ? !canVerify : !canLogin}
              accessibilityRole="button"
              accessibilityState={{ disabled: step.name === 'twoFa' ? !canVerify : !canLogin, busy: loading }}
              style={[styles.button, (step.name === 'twoFa' ? !canVerify : !canLogin) && styles.buttonDisabled]}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText type="smallBold" style={styles.buttonText}>
                  {step.name === 'twoFa' ? 'Vérifier' : 'Se connecter'}
                </ThemedText>
              )}
            </Pressable>
          )}

          {step.name === 'account' && loading && <ActivityIndicator />}

          {step.name !== 'credentials' && (
            <Pressable onPress={back} disabled={loading} accessibilityRole="button" style={styles.backBtn}>
              <ThemedText type="link">← Changer d’identifiant</ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  logo: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  input: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16 },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  accountBtn: { borderRadius: 12, paddingVertical: 16, paddingHorizontal: Spacing.three, minHeight: 52, justifyContent: 'center' },
  error: { color: '#D93025' },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff' },
  backBtn: { alignSelf: 'center', paddingVertical: Spacing.two },
});
