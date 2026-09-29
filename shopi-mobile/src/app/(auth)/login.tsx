/**
 * Écran de connexion (thème clair) — étapes possibles, toutes gérées ici :
 *   1. identifiant + mot de passe (POST /auth/login)
 *   2. choix du compte quand l'identifiant correspond à plusieurs comptes
 *      (ex. entreprise + client lié) → POST /auth/login/choose-account
 *   3. code 2FA (application d'authentification ou code de secours)
 *      → POST /auth/2fa/verify-login
 * « Déjà connecté ailleurs » : confirmation puis nouvel essai avec
 * confirmDisconnectOther. Email jamais vérifié → écran du code email.
 */
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthScreen } from '@/components/auth-screen';
import { Field, PasswordField, PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
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

const SITE = 'https://www.shoneya.com';

export default function LoginScreen() {
  const theme = useTheme();
  const signIn = useSession((s) => s.signIn);
  const passwordRef = useRef<TextInput>(null);
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
        router.push({ pathname: '/verify-email', params: { userId: outcome.userId, email: outcome.email } });
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

  const canLogin = identifier.trim().length > 0 && password.length > 0;
  const canVerify = /^[A-Za-z0-9]{6}$/.test(code.trim());

  const errorBox = error ? (
    <View style={styles.errorBox} accessibilityRole="alert">
      <ThemedText type="small" style={{ color: Brand.danger }}>
        {error}
      </ThemedText>
    </View>
  ) : null;

  if (step.name === 'account') {
    return (
      <AuthScreen title="Choisissez un compte" subtitle="Cet identifiant correspond à plusieurs comptes. Lequel ouvrir ?">
        {step.accounts.map((a) => (
          <Pressable
            key={a.userId}
            onPress={() => void pickAccount(a.userId)}
            disabled={loading}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.accountBtn,
              { borderColor: theme.border, backgroundColor: pressed ? theme.backgroundSelected : theme.background },
            ]}>
            <ThemedText type="smallBold">{ROLE_LABELS[a.role] ?? a.role}</ThemedText>
            <ThemedText style={{ color: Brand.primary }}>›</ThemedText>
          </Pressable>
        ))}
        {loading && <ActivityIndicator color={Brand.primary} />}
        {errorBox}
        <BackLink onPress={back} disabled={loading} />
      </AuthScreen>
    );
  }

  if (step.name === 'twoFa') {
    return (
      <AuthScreen
        title="Vérification en deux étapes"
        subtitle="Entrez le code à 6 caractères de votre application d’authentification, ou un code de secours.">
        <Field
          placeholder="••••••"
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^A-Za-z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          keyboardType="visible-password"
          returnKeyType="go"
          onSubmitEditing={() => canVerify && void submitCode(step.challengeToken)}
          accessibilityLabel="Code de vérification"
          style={styles.codeInput}
          autoFocus
          editable={!loading}
        />
        {errorBox}
        <PrimaryButton
          title="Vérifier"
          onPress={() => void submitCode(step.challengeToken)}
          disabled={!canVerify}
          loading={loading}
        />
        <BackLink onPress={back} disabled={loading} />
      </AuthScreen>
    );
  }

  /* Écran principal épuré (sans titre ni libellés) : logo au centre, champs,
   * « Se connecter », « Mot de passe oublié ? », et « Créer un nouveau
   * compte » en bas de l'écran avec la signature Shoneya. */
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <Image
              source={require('@/assets/images/icon.png')}
              style={styles.logo}
              accessibilityLabel="Shoneya"
              accessibilityRole="image"
            />
            <Field
              variant="outline"
              placeholder="Numéro mobile ou e-mail"
              value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        keyboardType="email-address"
        returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />
            <PasswordField
              ref={passwordRef}
              variant="outline"
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => canLogin && !loading && void submitCredentials()}
              editable={!loading}
            />
            {errorBox}
            {/* Toujours bleu vif (comme les grandes applications) : champs vides → message */}
            <PrimaryButton
              pill
              title="Se connecter"
              onPress={() =>
                canLogin
                  ? void submitCredentials()
                  : setError('Entrez votre numéro mobile ou e-mail et votre mot de passe.')
              }
              loading={loading}
            />
            <Pressable
              onPress={() => void WebBrowser.openBrowserAsync(`${SITE}/login`)}
              accessibilityRole="link"
              style={styles.forgot}
              hitSlop={8}>
              <ThemedText type="smallBold" style={styles.forgotText}>
                Mot de passe oublié ?
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.bottom}>
            <SecondaryButton pill title="Créer un nouveau compte" onPress={() => router.push('/register')} disabled={loading} />
            <ThemedText style={styles.brand}>
              Sho<ThemedText style={[styles.brand, { color: Brand.primary }]}>neya</ThemedText>
            </ThemedText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BackLink({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={styles.backBtn}>
      <ThemedText type="small" style={{ color: Brand.primary }}>
        ← Changer d’identifiant
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
  accountBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: Spacing.three },
  safe: { flex: 1 },
  flex: { flex: 1 },
  page: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingVertical: Spacing.four },
  main: { flexGrow: 1, justifyContent: 'center', gap: 12 },
  logo: { width: 76, height: 76, borderRadius: 20, alignSelf: 'center', marginBottom: Spacing.five },
  forgot: { alignSelf: 'center', paddingVertical: Spacing.two },
  forgotText: { fontSize: 15 },
  bottom: { gap: Spacing.three, alignItems: 'stretch', marginTop: Spacing.five },
  brand: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  backBtn: { alignSelf: 'center', paddingVertical: Spacing.two },
});
