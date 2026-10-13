/**
 * Paramètres › Sécurité & connexion — comme SecSecurite du site :
 *   · mot de passe (POST …/securite/password) : MÊMES règles que le serveur,
 *     vérifiées en direct (8 caractères, minuscule, majuscule, chiffre,
 *     différent de l'actuel, confirmation identique) ; le serveur ferme alors
 *     toutes les sessions → déconnexion propre (limite : 5 essais / 15 min) ;
 *   · double authentification par application (TOTP), seule méthode réelle :
 *     l'interrupteur ouvre l'activation (/auth/2fa/setup puis /confirm : clé à
 *     ouvrir dans l'application ou à copier, puis code à 6 chiffres) ou la
 *     désactivation (mot de passe + code) et reflète l'état réel. Le « code
 *     SMS » et l'« alerte connexion inconnue » du site ne sont pas proposés :
 *     aucun envoi de ce type n'existe ;
 *   · session active (une seule à la fois sur Shoneya) + déconnexion.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { Field, PasswordField, PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { changePassword, confirmTwoFa, disableTwoFa, startTwoFaSetup, type CorrespondantSettings } from '../api';
import { Badge, confirmAction, FormCard, Hint, SaveButton, SettingsShell, Sheet, toast, ToggleRow, useUnsavedGuard, errorMessage } from '@/features/settings-kit';
import { useCorrespondantSettings, useMergeSettings } from '../hooks';

export default function SecuriteScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Sécurité & Connexion" icon="lock-closed-outline" subtitle="Protégez votre compte avec des couches de sécurité avancées.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const signOut = useSession((s) => s.signOut);
  const [setup, setSetup] = useState(false);
  const [disable, setDisable] = useState(false);
  const s = d.currentSession;

  const logout = async () => {
    if (await confirmAction('Se déconnecter ?', 'Vous devrez saisir à nouveau votre mot de passe.', 'Se déconnecter', true)) void signOut();
  };

  return (
    <>
      <PasswordCard />

      <FormCard
        title="Authentification 2FA"
        icon="phone-portrait-outline"
        right={<Badge label={d.twoFaEnabled ? 'Activée' : 'Désactivée'} tone={d.twoFaEnabled ? 'success' : 'danger'} icon={d.twoFaEnabled ? 'shield-checkmark' : 'shield-outline'} />}>
        <ToggleRow
          first
          label="Activer la double authentification"
          sub="Avec une application d’authentification (Google Authenticator, Authy…) : un code à 6 chiffres en plus du mot de passe à chaque connexion."
          value={d.twoFaEnabled}
          onChange={(v) => (v ? setSetup(true) : setDisable(true))}
        />
      </FormCard>

      <FormCard title="Session active" icon="time-outline" subtitle="Une seule session peut être active à la fois sur votre compte">
        {s ? (
          <View style={styles.session}>
            <View style={[styles.sessIco, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="phone-portrait-outline" size={20} color={theme.text} />
            </View>
            <View style={styles.flex}>
              <View style={styles.sessTop}>
                <ThemedText style={styles.bold} numberOfLines={1}>
                  {[s.device, s.browser].filter(Boolean).join(' · ') || 'Appareil'}
                </ThemedText>
                <Badge label="Session actuelle" tone="success" />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {s.ipAddress ?? '—'} · Connecté depuis le{' '}
                {s.connectedSince
                  ? new Date(s.connectedSince).toLocaleString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </ThemedText>
            </View>
          </View>
        ) : (
          <Hint tone="neutral" text="Informations de session indisponibles pour le moment." />
        )}
        <SecondaryButton title="Se déconnecter" onPress={() => void logout()} pill />
      </FormCard>

      {setup ? <SetupSheet onClose={() => setSetup(false)} /> : null}
      {disable ? <DisableSheet onClose={() => setDisable(false)} /> : null}
    </>
  );
}

/* ── Mot de passe ──────────────────────────────────────────────────── */

const RULES: { key: string; label: string }[] = [
  { key: 'longueur', label: '8 caractères au moins' },
  { key: 'minuscule', label: 'une minuscule' },
  { key: 'majuscule', label: 'une majuscule' },
  { key: 'chiffre', label: 'un chiffre' },
  { key: 'different', label: 'différent de l’actuel' },
  { key: 'confirmation', label: 'confirmation identique' },
];

function PasswordCard() {
  const theme = useTheme();
  const signOut = useSession((s) => s.signOut);
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useUnsavedGuard(!!(cur || next || conf) && !saving);

  /* Mêmes règles que le serveur (dashboard/correspondant/services/securite.service.ts) */
  const ok = useMemo<Record<string, boolean>>(
    () => ({
      longueur: next.length >= 8,
      minuscule: /[a-z]/.test(next),
      majuscule: /[A-Z]/.test(next),
      chiffre: /\d/.test(next),
      different: !!next && next !== cur,
      confirmation: !!next && next === conf,
    }),
    [next, conf, cur],
  );
  const valid = !!cur && Object.values(ok).every(Boolean);

  const submit = async () => {
    if (!valid) return;
    setError(null);
    setSaving(true);
    try {
      await changePassword({
        currentPassword: cur,
        newPassword: next,
      });
      setCur('');
      setNext('');
      setConf('');
      /* Le serveur a fermé toutes les sessions : on quitte proprement */
      toast('Mot de passe modifié. Reconnectez-vous avec le nouveau.');
      setTimeout(() => void signOut(), 1500);
    } catch (e) {
      setError(errorMessage(e, '') || 'Mot de passe actuel incorrect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard title="Changer le mot de passe" icon="key-outline">
      <PasswordField label="Mot de passe actuel" value={cur} onChangeText={setCur} placeholder="••••••••" autoComplete="current-password" />
      <PasswordField label="Nouveau mot de passe" value={next} onChangeText={setNext} placeholder="Min. 8 caractères" autoComplete="new-password" />
      <PasswordField label="Confirmer" value={conf} onChangeText={setConf} placeholder="Répétez" autoComplete="new-password" />
      {next ? (
        <View style={styles.rules}>
          {RULES.map((r) => (
            <View key={r.key} style={styles.rule}>
              <Ionicons name={ok[r.key] ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok[r.key] ? Brand.success : theme.textSecondary} />
              <ThemedText
                type="small"
                style={{
                  color: ok[r.key] ? Brand.success : theme.textSecondary,
                }}>
                {r.label}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
      {error ? <Hint icon="alert-circle" tone="danger" text={error} /> : null}
      <SaveButton label={saving ? 'Sauvegarde…' : 'Modifier le mot de passe'} onPress={() => void submit()} loading={saving} disabled={!valid} />
    </FormCard>
  );
}

/* ── Feuilles 2FA ──────────────────────────────────────────────────── */

function SetupSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [secret, setSecret] = useState<{
    secret: string;
    otpauthUri: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      setSecret(await startTwoFaSetup());
    } catch (e) {
      setError(errorMessage(e, ''));
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!/^\d{6}$/.test(code)) return setError('Saisissez le code à 6 chiffres affiché par l’application.');
    setLoading(true);
    setError(null);
    try {
      await confirmTwoFa(code);
      /* L'écran reflète l'état réel (2FA active) */
      await qc.invalidateQueries({ queryKey: qk.correspondant.settings });
      toast('Double authentification activée');
      onClose();
    } catch (e) {
      setError(errorMessage(e, ''));
    } finally {
      setLoading(false);
    }
  };

  const openApp = async () => {
    if (!secret) return;
    try {
      await Linking.openURL(secret.otpauthUri);
    } catch {
      toast('Aucune application d’authentification trouvée : copiez la clé et ajoutez-la à la main.', 'warning');
    }
  };

  return (
    <Sheet title="Activer la double authentification" onClose={onClose}>
      <Step n={1} title="Installez une application d’authentification" text="Google Authenticator, Microsoft Authenticator ou Authy (gratuites)." />
      <Step n={2} title="Ajoutez votre compte Shoneya" text="Générez votre clé secrète, puis ouvrez-la dans l’application ou copiez-la." />
      {!secret ? (
        <PrimaryButton title="Générer ma clé secrète" onPress={() => void start()} loading={loading} pill />
      ) : (
        <>
          <View style={[styles.secret, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Clé secrète
            </ThemedText>
            <ThemedText selectable style={styles.secretText}>
              {secret.secret.replace(/(.{4})/g, '$1 ').trim()}
            </ThemedText>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <SecondaryButton title="Ouvrir l’application" onPress={() => void openApp()} pill />
            </View>
            <View style={styles.flex}>
              <SecondaryButton
                title="Copier la clé"
                onPress={() => {
                  void Clipboard.setStringAsync(secret.secret);
                  toast('Clé copiée');
                }}
                pill
              />
            </View>
          </View>
          <Step n={3} title="Saisissez le code affiché" text="L’application affiche un code à 6 chiffres qui change toutes les 30 secondes." />
          <Field label="Code à 6 chiffres" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" maxLength={6} />
          <PrimaryButton title="Activer" onPress={() => void confirm()} loading={loading} disabled={code.length !== 6} pill />
        </>
      )}
      {error ? <Hint icon="alert-circle" tone="danger" text={error} /> : null}
    </Sheet>
  );
}

function DisableSheet({ onClose }: { onClose: () => void }) {
  const merge = useMergeSettings();
  const [pwd, setPwd] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!pwd || code.length !== 6) return setError('Saisissez votre mot de passe et le code à 6 chiffres.');
    setLoading(true);
    setError(null);
    try {
      await disableTwoFa(pwd, code);
      merge({ twoFaEnabled: false });
      toast('Double authentification désactivée', 'warning');
      onClose();
    } catch (e) {
      setError(errorMessage(e, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet title="Désactiver la double authentification" onClose={onClose}>
      <Hint icon="warning-outline" tone="warning" text="Votre compte ne sera plus protégé que par le mot de passe. Confirmez avec votre mot de passe et un code de l’application." />
      <PasswordField label="Mot de passe" value={pwd} onChangeText={setPwd} autoComplete="current-password" />
      <Field label="Code à 6 chiffres" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" maxLength={6} />
      {error ? <Hint icon="alert-circle" tone="danger" text={error} /> : null}
      <Pressable onPress={() => void submit()} disabled={loading} accessibilityRole="button" style={[styles.dangerBtn, loading && styles.dim]}>
        {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.dangerText}>Désactiver</ThemedText>}
      </Pressable>
    </Sheet>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepN}>
        <ThemedText style={styles.stepNText}>{n}</ThemedText>
      </View>
      <View style={styles.flex}>
        <ThemedText style={styles.bold}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {text}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  row: { flexDirection: 'row', gap: 10 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '46%' },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Brand.danger,
    borderRadius: 999,
    minHeight: 50,
  },
  dangerText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessIco: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  secret: { borderRadius: 14, padding: 14, gap: 4 },
  secretText: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  step: { flexDirection: 'row', gap: 12 },
  stepN: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNText: {
    color: Brand.primaryInk,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
});
