/**
 * Mot de passe oublié — 3 étapes sur un seul écran :
 *   1. identifiant (e-mail ou numéro) → code à 6 chiffres envoyé par e-mail
 *   2. code (+ choix du compte si l'identifiant en ouvre plusieurs,
 *      + « Renvoyer le code » après 60 s)
 *   3. nouveau mot de passe (règles en direct + confirmation)
 * Fin : retour à la connexion, identifiant pré-rempli, message de réussite.
 * Voir features/auth/api.ts (requestPasswordReset / verifyResetCode / resetPassword).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Field, PasswordField, PrimaryButton } from '@/components/form';
import { PasswordRulesList } from '@/components/password-rules-list';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  ROLE_LABELS,
  requestPasswordReset,
  resetPassword,
  verifyResetCode,
  type AccountOption,
} from '@/features/auth/api';
import { isStrongPassword } from '@/features/auth/password-rules';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const RESEND_DELAY_S = 60;

type Step =
  | { name: 'identifier' }
  | { name: 'code' }
  | { name: 'account'; accounts: AccountOption[] }
  | { name: 'password'; resetToken: string };

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ identifier?: string }>();
  const confirmRef = useRef<TextInput>(null);
  const [step, setStep] = useState<Step>({ name: 'identifier' });
  const [identifier, setIdentifier] = useState(params.identifier ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  /** Exécute une étape : chargement, message d'erreur lisible. */
  async function run(fn: () => Promise<void>) {
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      if (!identifier.trim()) {
        setError('Entrez votre numéro mobile ou e-mail.');
        return;
      }
      await requestPasswordReset(identifier);
      setCode('');
      setWait(RESEND_DELAY_S);
      setStep({ name: 'code' });
    });

  const resend = () =>
    run(async () => {
      await requestPasswordReset(identifier);
      setWait(RESEND_DELAY_S);
      setInfo('Un nouveau code vient de vous être envoyé.');
    });

  const checkCode = (accountUserId?: string) =>
    run(async () => {
      const outcome = await verifyResetCode(identifier, code, accountUserId);
      if (outcome.kind === 'accountChoice') setStep({ name: 'account', accounts: outcome.accounts });
      else setStep({ name: 'password', resetToken: outcome.resetToken });
    });

  const savePassword = (resetToken: string) =>
    run(async () => {
      if (!isStrongPassword(password)) {
        setError('Le mot de passe ne respecte pas toutes les règles.');
        return;
      }
      if (confirm !== password) {
        setError('Les deux mots de passe ne correspondent pas.');
        return;
      }
      await resetPassword(resetToken, password);
      /* Revient à l'écran de connexion déjà ouvert (sans en empiler un second) */
      router.dismissTo({ pathname: '/login', params: { reset: '1', identifier: identifier.trim() } });
    });

  const messages = (
    <>
      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <ThemedText type="small" style={{ color: Brand.danger }}>
            {error}
          </ThemedText>
        </View>
      ) : null}
      {info ? (
        <ThemedText type="small" style={{ color: Brand.success }}>
          {info}
        </ThemedText>
      ) : null}
    </>
  );

  const backToLogin = (
    <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.link} disabled={loading}>
      <ThemedText type="small" style={{ color: Brand.primary }}>
        ← Retour à la connexion
      </ThemedText>
    </Pressable>
  );

  if (step.name === 'code') {
    return (
      <AuthScreen
        title="Entrez le code"
        subtitle={`Si un compte correspond à « ${identifier.trim()} », un code à 6 chiffres vient d’être envoyé à son adresse e-mail (valable 10 minutes). Pensez aux spams.`}>
        <Field
          variant="outline"
          placeholder="000000"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="go"
          onSubmitEditing={() => /^\d{6}$/.test(code) && void checkCode()}
          accessibilityLabel="Code reçu par e-mail"
          style={styles.codeInput}
          autoFocus
          editable={!loading}
        />
        {messages}
        <PrimaryButton pill title="Continuer" onPress={() => void checkCode()} disabled={!/^\d{6}$/.test(code)} loading={loading} />
        <Pressable onPress={() => void resend()} disabled={wait > 0 || loading} accessibilityRole="button" style={styles.link}>
          <ThemedText type="small" themeColor={wait > 0 ? 'textSecondary' : undefined} style={wait > 0 ? undefined : { color: Brand.primary }}>
            {wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setStep({ name: 'identifier' })} accessibilityRole="button" style={styles.link} disabled={loading}>
          <ThemedText type="small" style={{ color: Brand.primary }}>
            Changer d’identifiant
          </ThemedText>
        </Pressable>
      </AuthScreen>
    );
  }

  if (step.name === 'account') {
    return (
      <AuthScreen title="Quel compte ?" subtitle="Cet identifiant correspond à plusieurs comptes. Lequel voulez-vous réinitialiser ?">
        {step.accounts.map((a) => (
          <Pressable
            key={a.userId}
            onPress={() => void checkCode(a.userId)}
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
        {messages}
        {backToLogin}
      </AuthScreen>
    );
  }

  if (step.name === 'password') {
    return (
      <AuthScreen title="Nouveau mot de passe" subtitle="Choisissez un mot de passe différent de l’ancien. Vous serez déconnecté de vos autres appareils.">
        <PasswordField
          variant="outline"
          placeholder="Nouveau mot de passe"
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          autoFocus
          editable={!loading}
        />
        <PasswordRulesList password={password} />
        <PasswordField
          ref={confirmRef}
          variant="outline"
          placeholder="Confirmer le mot de passe"
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={() => void savePassword(step.resetToken)}
          editable={!loading}
        />
        {messages}
        <PrimaryButton pill title="Enregistrer" onPress={() => void savePassword(step.resetToken)} loading={loading} />
        {backToLogin}
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Mot de passe oublié ?"
      subtitle="Entrez le numéro mobile ou l’e-mail de votre compte. Nous vous enverrons un code pour choisir un nouveau mot de passe.">
      <Field
        variant="outline"
        placeholder="Numéro mobile ou e-mail"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        keyboardType="email-address"
        returnKeyType="go"
        onSubmitEditing={() => void sendCode()}
        autoFocus={!identifier}
        editable={!loading}
      />
      {messages}
      <PrimaryButton pill title="Recevoir le code" onPress={() => void sendCode()} loading={loading} />
      {backToLogin}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  codeInput: { fontSize: 26, letterSpacing: 10, textAlign: 'center', fontWeight: '700' },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: Spacing.three },
  link: { alignSelf: 'center', paddingVertical: Spacing.two },
  accountBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
