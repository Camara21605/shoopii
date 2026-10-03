/**
 * Paramètres › Sécurité & Connexion — comme SecuriteSection du site :
 *   · changer le mot de passe (force affichée ; mêmes contrôles : champs
 *     remplis, 8 caractères, confirmation identique, différent de l'actuel) ;
 *   · double authentification par application (TOTP) : activation en 2 étapes
 *     (POST /auth/2fa/setup puis /auth/2fa/confirm) ; désactivation avec mot
 *     de passe + code — une session volée ne suffit pas à la couper ;
 *   · session active (une seule à la fois sur Shoneya) + déconnexion.
 *
 * Sur téléphone, l'application d'authentification est sur le même appareil :
 * au lieu d'un QR code, on propose « Ouvrir l'application » (lien otpauth://)
 * et la clé à copier.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PasswordField, PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { changePassword, confirmTwoFa, disableTwoFa, startTwoFaSetup, type Settings } from '../api';
import { Badge, confirmAction, FormCard, Hint, SaveButton, SettingsShell, toast, useEditable } from '../components/ui';
import { useMergeSettings, useSettings } from '../hooks';

const STRENGTH = [
  { label: 'Trop faible', color: Brand.danger },
  { label: 'Faible', color: '#D97706' },
  { label: 'Bon', color: '#1F1F1F' },
  { label: 'Fort', color: Brand.success },
];
const scoreOf = (v: string) => [v.length >= 8, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;

export default function SecuriteScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Sécurité" icon="lock-closed-outline" subtitle="Protégez votre compte boutique avec un mot de passe fort et la double authentification.">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const theme = useTheme();
  const editable = useEditable();
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
        title="Double authentification (2FA)"
        icon="shield-checkmark-outline"
        subtitle="Ajoutez une couche de sécurité supplémentaire"
        right={<Badge label={d.twoFaEnabled ? 'Activée' : 'Non activée'} tone={d.twoFaEnabled ? 'success' : 'warning'} />}>
        {d.twoFaEnabled ? (
          <>
            <Hint icon="checkmark-circle" tone="success" text="La double authentification est active sur ce compte (application d’authentification)." />
            {editable ? (
              <Pressable onPress={() => setDisable(true)} accessibilityRole="button" style={styles.dangerBtn}>
                <Ionicons name="shield-outline" size={17} color="#fff" />
                <ThemedText style={styles.dangerText}>Désactiver la double authentification</ThemedText>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <View style={[styles.method, { borderColor: Brand.primary }]}>
              <Ionicons name="phone-portrait-outline" size={22} color={Brand.primary} />
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>Application d’authentification</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Google Authenticator ou Authy · Recommandé
                </ThemedText>
              </View>
              <Badge label="Le plus sécurisé" tone="success" />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              À chaque connexion, un code à 6 chiffres généré par l’application vous sera demandé en plus du mot de passe.
            </ThemedText>
            <SaveButton label="Activer la double authentification" onPress={() => setSetup(true)} />
          </>
        )}
      </FormCard>

      <FormCard title="Session active" icon="phone-portrait-outline" subtitle="Une seule session peut être active à la fois sur votre compte boutique">
        {s ? (
          <View style={styles.session}>
            <View style={[styles.sessIco, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="desktop-outline" size={20} color={theme.text} />
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
                {s.connectedSince ? new Date(s.connectedSince).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
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

function PasswordCard() {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const score = scoreOf(next);
  const st = STRENGTH[Math.max(0, score - 1)];

  const submit = async () => {
    setError(null);
    if (!cur || !next) return setError('Remplissez tous les champs.');
    if (next !== conf) return setError('Les mots de passe ne correspondent pas.');
    if (next.length < 8) return setError('8 caractères minimum.');
    if (next === cur) return setError('Le nouveau mot de passe doit être différent de l’actuel.');
    setSaving(true);
    try {
      await changePassword({ currentPassword: cur, newPassword: next, confirmPassword: conf });
      setCur('');
      setNext('');
      setConf('');
      toast('Mot de passe mis à jour. Vos autres connexions ont été fermées par sécurité.');
    } catch (e) {
      setError(toUserMessage(e) || 'Mot de passe actuel incorrect.');
    } finally {
      setSaving(false);
    }
  };

  const editable = useEditable();
  return (
    <FormCard title="Changer le mot de passe" icon="key-outline">
      <PasswordField label="Mot de passe actuel" value={cur} onChangeText={setCur} editable={editable} />
      <PasswordField label="Nouveau mot de passe" value={next} onChangeText={setNext} placeholder="Min. 8 caractères" editable={editable} />
      {next ? (
        <View style={styles.strength}>
          <View style={styles.bars}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={[styles.sbar, { backgroundColor: i < score ? st.color : '#E5E5E5' }]} />
            ))}
          </View>
          <ThemedText type="small" style={{ color: st.color, fontWeight: '800' }}>
            Force : {st.label}
          </ThemedText>
        </View>
      ) : null}
      <PasswordField label="Confirmer le nouveau mot de passe" value={conf} onChangeText={setConf} placeholder="Répétez le nouveau mot de passe" editable={editable} error={error} />
      <SaveButton label="Mettre à jour le mot de passe" onPress={() => void submit()} loading={saving} />
    </FormCard>
  );
}

/* ── Feuilles 2FA ──────────────────────────────────────────────────── */

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={styles.sheetHead}>
          <ThemedText style={styles.sheetTitle}>{title}</ThemedText>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SetupSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [secret, setSecret] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      setSecret(await startTwoFaSetup());
    } catch (e) {
      setError(toUserMessage(e));
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
      await qc.invalidateQueries({ queryKey: qk.company.settings });
      toast('Double authentification activée.');
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
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
      toast('Double authentification désactivée.', 'warning');
      onClose();
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet title="Désactiver la double authentification" onClose={onClose}>
      <Hint icon="warning-outline" tone="warning" text="Votre compte ne sera plus protégé que par le mot de passe. Confirmez avec votre mot de passe et un code de l’application." />
      <PasswordField label="Mot de passe" value={pwd} onChangeText={setPwd} />
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
  strength: { gap: 6, marginTop: -4 },
  bars: { flexDirection: 'row', gap: 4 },
  sbar: { flex: 1, height: 5, borderRadius: 3 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 14, padding: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.danger, borderRadius: 999, minHeight: 50 },
  dangerText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sessIco: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sessTop: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16 },
  sheetTitle: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '900' },
  sheetBody: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
  secret: { borderRadius: 14, padding: 14, gap: 4 },
  secretText: { fontSize: 17, lineHeight: 24, fontWeight: '900', letterSpacing: 1 },
  step: { flexDirection: 'row', gap: 12 },
  stepN: { width: 26, height: 26, borderRadius: 13, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNText: { color: Brand.primaryInk, fontSize: 13, lineHeight: 17, fontWeight: '900' },
});
