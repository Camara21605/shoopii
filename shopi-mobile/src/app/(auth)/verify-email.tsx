/**
 * Vérification de l'adresse email : code à 6 chiffres envoyé après
 * l'inscription (ou à la connexion d'un compte jamais vérifié) quand la
 * plateforme l'exige (PlatformSettings.emailVerifRequired).
 *   POST /auth/verify-email { userId, code } → session ouverte
 *   POST /auth/resend-verification { userId } → nouveau code (60 s d'attente)
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth-screen';
import { Field, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { resendEmailCode, verifyEmail } from '@/features/auth/api';
import { flushPendingLogo } from '@/features/auth/pending-logo';
import { useSession } from '@/features/auth/session-store';
import { toUserMessage } from '@/lib/api/errors';

const RESEND_DELAY_S = 60;

export default function VerifyEmailScreen() {
  const { userId, email } = useLocalSearchParams<{ userId: string; email?: string }>();
  const signIn = useSession((s) => s.signIn);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [wait, setWait] = useState(RESEND_DELAY_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const valid = /^\d{6}$/.test(code);

  async function submit() {
    if (!userId || !valid) return;
    setLoading(true);
    setError(null);
    try {
      const outcome = await verifyEmail(userId, code);
      if (outcome.kind === 'success') {
        await signIn({ accessToken: outcome.accessToken, refreshToken: outcome.refreshToken }, outcome.user);
        void flushPendingLogo(); // logo d'entreprise choisi à l'inscription (le cas échéant)
      }
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!userId || wait > 0) return;
    setError(null);
    setInfo(null);
    try {
      await resendEmailCode(userId);
      setInfo('Un nouveau code vient de vous être envoyé.');
      setWait(RESEND_DELAY_S);
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <AuthScreen
      title="Vérifiez votre email"
      subtitle={`Nous avons envoyé un code à 6 chiffres à ${email || 'votre adresse email'}. Pensez à regarder dans les spams.`}>
      <Field
        placeholder="000000"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
        accessibilityLabel="Code reçu par email"
        style={styles.codeInput}
        autoFocus
        editable={!loading}
      />
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
      <PrimaryButton title="Valider" onPress={() => void submit()} disabled={!valid} loading={loading} />
      <Pressable onPress={() => void resend()} disabled={wait > 0} accessibilityRole="button" style={styles.link}>
        <ThemedText type="small" style={{ color: wait > 0 ? undefined : Brand.primary }} themeColor={wait > 0 ? 'textSecondary' : undefined}>
          {wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
        </ThemedText>
      </Pressable>
      <Pressable onPress={() => router.replace('/login')} accessibilityRole="button" style={styles.link}>
        <ThemedText type="small" style={{ color: Brand.primary }}>
          ← Retour à la connexion
        </ThemedText>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  codeInput: { fontSize: 26, letterSpacing: 10, textAlign: 'center', fontWeight: '700' },
  errorBox: { backgroundColor: '#FDECEA', borderRadius: 10, padding: Spacing.three },
  link: { alignSelf: 'center', paddingVertical: Spacing.two },
});
