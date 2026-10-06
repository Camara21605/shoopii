/**
 * Paramètres › Confidentialité & sécurité — même panneau que le site
 * (SecuriteSection + ConfidentialiteSection) :
 *   - mot de passe : règles du serveur (8 caractères, minuscule, majuscule,
 *     chiffre, différent de l'actuel) ; le changement déconnecte tous les
 *     appareils, on renvoie donc à la connexion ;
 *   - double authentification et codes de secours : état affiché, réglage
 *     sur le site (scan de QR code, téléchargement des codes) ;
 *   - alertes de sécurité par e-mail (5 types) ;
 *   - confidentialité du profil (visibilité + 4 réglages).
 * Interrupteurs : enregistrement immédiat, un à la fois.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordField, PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import {
  ALERT_TYPES,
  changePassword,
  fetchAlerts,
  fetchPrivacy,
  fetchSecurite,
  updateAlert,
  updatePrivacy,
  type AlertSettings,
  type AlertType,
  type Privacy,
} from '@/features/settings/api';
import { Card, LoadState, OutlineButton, Pill, Row, Section, SwitchRow, TextButton, useToast, type IconName } from '@/features/settings/ui';
import { useSerialQueue } from '@/features/settings/use-serial-queue';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

const SITE_SECURITE = 'https://www.shoneya.com/parametres?panel=confidentialiteSecurite';

const ALERTS: Record<AlertType, { title: string; desc: string }> = {
  connex: { title: 'Nouvelle connexion détectée', desc: 'Connexion depuis un appareil ou un pays inconnu' },
  mdp: { title: 'Changement de mot de passe', desc: 'Alerte immédiate si votre mot de passe est modifié' },
  tentatives: { title: 'Tentatives de connexion échouées', desc: 'Après 3 tentatives incorrectes consécutives' },
  transaction: { title: 'Transaction suspecte ou refusée', desc: 'Paiement inhabituellement élevé' },
  pays: { title: 'Accès depuis un pays inhabituel', desc: 'Compte utilisé depuis un pays inconnu' },
};

const PRIVACY_ROWS: { key: Exclude<keyof Privacy, 'visibilite'>; icon: IconName; title: string; desc: string }[] = [
  { key: 'historique', icon: 'bag-handle-outline', title: 'Historique des commandes', desc: 'Afficher vos achats récents sur votre profil' },
  { key: 'wishlist', icon: 'heart-outline', title: 'Liste de souhaits', desc: 'Rendre votre liste de souhaits visible aux autres' },
  { key: 'perso', icon: 'sparkles-outline', title: 'Données de personnalisation', desc: 'Utiliser votre activité pour améliorer les recommandations' },
  { key: 'localisation', icon: 'navigate-outline', title: 'Localisation approximative', desc: 'Partager votre ville pour des offres locales' },
];
const VISIBILITES = [
  { value: 'public', label: 'Tout le monde' },
  { value: 'members', label: 'Membres Shoneya' },
  { value: 'nobody', label: 'Personne' },
];

/* Règles du serveur (securite.service.ts › changePassword) */
const RULES: { label: string; test: (n: string, cur: string, conf: string) => boolean }[] = [
  { label: '8 caractères minimum', test: (n) => n.length >= 8 },
  { label: 'Une minuscule', test: (n) => /[a-z]/.test(n) },
  { label: 'Une majuscule', test: (n) => /[A-Z]/.test(n) },
  { label: 'Un chiffre', test: (n) => /\d/.test(n) },
  { label: 'Différent de l’actuel', test: (n, cur) => !!n && n !== cur },
  { label: 'Confirmation identique', test: (n, _c, conf) => !!n && n === conf },
];

const daysSince = (iso?: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)) : null);

export default function SecuriteScreen() {
  const theme = useTheme();
  const toast = useToast();
  const securite = useQuery({ queryKey: ['settings', 'securite'], queryFn: fetchSecurite });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Confidentialité & sécurité" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!securite.data ? (
          <LoadState loading={securite.isLoading} error={securite.error ? toUserMessage(securite.error) : null} onRetry={() => void securite.refetch()} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <PasswordSection lastChange={securite.data.dernierChangementMdp} toast={toast.show} />

            <Section title="Double authentification" note="La configuration (scan d’un QR code avec une application d’authentification) se fait sur shoneya.com.">
              <Card>
                <Row
                  icon="key-outline"
                  label="Authentification à deux facteurs"
                  desc="Protège votre compte même si votre mot de passe est compromis"
                  right={<Pill label={securite.data.twoFaEnabled ? 'Activée' : 'Désactivée'} tone={securite.data.twoFaEnabled ? 'success' : 'warning'} />}
                />
                <Row
                  icon="document-lock-outline"
                  label="Codes de secours"
                  desc={
                    !securite.data.twoFaEnabled
                      ? 'Activez d’abord la double authentification'
                      : securite.data.codesSecours > 0
                        ? `${securite.data.codesSecours} code${securite.data.codesSecours > 1 ? 's' : ''} à usage unique disponible${securite.data.codesSecours > 1 ? 's' : ''}`
                        : 'Aucun code généré'
                  }
                />
                <Row
                  icon="shield-checkmark-outline"
                  label={securite.data.twoFaEnabled ? 'Gérer la double authentification' : 'Activer la double authentification'}
                  onPress={() => void WebBrowser.openBrowserAsync(SITE_SECURITE)}
                  external
                />
              </Card>
            </Section>

            <AlertsSection toast={toast.show} />
            <PrivacySection toast={toast.show} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      {toast.element}
    </SafeAreaView>
  );
}

/* ─────────────────────────── Mot de passe ─────────────────────────── */

function PasswordSection({ lastChange, toast }: { lastChange?: string | null; toast: (m: string) => void }) {
  const theme = useTheme();
  const signOut = useSession((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const ok = RULES.every((r) => r.test(next, current, confirm)) && !!current;
  const days = daysSince(lastChange);

  function reset() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setOpen(false);
  }

  async function submit() {
    if (!ok) return;
    setSaving(true);
    try {
      await changePassword(current, next);
      reset();
      Alert.alert(
        'Mot de passe modifié',
        'Pour votre sécurité, tous vos appareils ont été déconnectés. Reconnectez-vous avec le nouveau mot de passe.',
        [{ text: 'OK', onPress: () => void signOut() }],
        { cancelable: false },
      );
    } catch (e) {
      toast(toUserMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Mot de passe">
      <Card>
        <Row
          icon="lock-closed-outline"
          label="Mot de passe"
          desc={days === null ? 'Jamais modifié' : days === 0 ? 'Modifié aujourd’hui' : `Dernière modification il y a ${days} jour${days > 1 ? 's' : ''}`}
        />
        {open ? (
          <View style={styles.form}>
            <PasswordField label="Mot de passe actuel" value={current} onChangeText={setCurrent} autoComplete="current-password" />
            <PasswordField label="Nouveau mot de passe" value={next} onChangeText={setNext} autoComplete="new-password" />
            <PasswordField label="Confirmer le nouveau mot de passe" value={confirm} onChangeText={setConfirm} autoComplete="new-password" />
            {next || confirm ? (
              <View style={styles.rules}>
                {RULES.map((r) => {
                  const pass = r.test(next, current, confirm);
                  return (
                    <ThemedText key={r.label} type="small" style={{ color: pass ? Brand.success : theme.textSecondary }}>
                      {pass ? '✓' : '•'} {r.label}
                    </ThemedText>
                  );
                })}
              </View>
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              Pour votre sécurité, tous vos appareils seront déconnectés après le changement.
            </ThemedText>
            <PrimaryButton title="Changer le mot de passe" onPress={() => void submit()} loading={saving} disabled={!ok} />
            <TextButton label="Annuler" onPress={reset} disabled={saving} />
          </View>
        ) : null}
      </Card>
      {!open ? <OutlineButton icon="create-outline" label="Changer le mot de passe" onPress={() => setOpen(true)} /> : null}
    </Section>
  );
}

/* ─────────────────────────── Alertes ─────────────────────────── */

function AlertsSection({ toast }: { toast: (m: string) => void }) {
  const qc = useQueryClient();
  const queue = useSerialQueue();
  const KEY = ['settings', 'alertes'];
  const alerts = useQuery({ queryKey: KEY, queryFn: fetchAlerts });

  /* Inverse la dernière valeur connue (voir notifications.tsx) */
  function toggle(type: AlertType) {
    const data = qc.getQueryData<AlertSettings>(KEY) ?? alerts.data;
    if (!data) return;
    const email = !data[type]?.email;
    qc.setQueryData<AlertSettings>(KEY, { ...data, [type]: { ...data[type], email } });
    const { promise, isLatest } = queue(() => updateAlert(type, email));
    promise
      .then((v) => {
        if (isLatest()) qc.setQueryData(KEY, v);
      })
      .catch(() => {
        toast('Impossible de mettre à jour cette alerte');
        if (isLatest()) void qc.invalidateQueries({ queryKey: KEY });
      });
  }

  return (
    <Section title="Alertes de sécurité" note="Envoyées par e-mail. Les alertes SMS et push ne sont pas encore disponibles.">
      {alerts.data ? (
        <Card>
          {ALERT_TYPES.map((type) => (
            <SwitchRow
              key={type}
              label={ALERTS[type].title}
              desc={ALERTS[type].desc}
              value={!!alerts.data?.[type]?.email}
              onChange={() => toggle(type)}
            />
          ))}
        </Card>
      ) : (
        <Card>
          <LoadState loading={alerts.isLoading} error={alerts.error ? toUserMessage(alerts.error) : null} onRetry={() => void alerts.refetch()} />
        </Card>
      )}
    </Section>
  );
}

/* ─────────────────────────── Confidentialité ─────────────────────────── */

function PrivacySection({ toast }: { toast: (m: string) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const queue = useSerialQueue();
  const KEY = ['settings', 'privacy'];
  const privacy = useQuery({ queryKey: KEY, queryFn: fetchPrivacy });

  /* Part toujours de la dernière valeur connue (touches rapprochées) */
  function apply(change: Partial<Privacy>) {
    const base = qc.getQueryData<Privacy>(KEY) ?? privacy.data;
    if (!base) return;
    const next = { ...base, ...change };
    qc.setQueryData(KEY, next);
    const { promise, isLatest } = queue(() => updatePrivacy(next));
    promise
      .then((v) => {
        if (isLatest()) qc.setQueryData(KEY, v);
      })
      .catch((e) => {
        toast(toUserMessage(e));
        if (isLatest()) void qc.invalidateQueries({ queryKey: KEY });
      });
  }

  const p = privacy.data;
  return (
    <Section title="Confidentialité du profil" note="Contrôlez qui peut voir vos informations. Chaque réglage s’applique immédiatement.">
      {p ? (
        <Card>
          <View style={styles.visibility}>
            <ThemedText style={styles.label}>Visibilité du profil</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Qui peut voir votre profil public
            </ThemedText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {VISIBILITES.map((v) => {
                const on = p.visibilite === v.value;
                return (
                  <Pressable
                    key={v.value}
                    onPress={() => !on && apply({ visibilite: v.value })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? theme.backgroundSelected : theme.background }]}>
                    <ThemedText type="small" style={{ color: on ? Brand.primary : theme.text, fontWeight: on ? '700' : '500' }}>
                      {v.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {PRIVACY_ROWS.map((r) => (
            <SwitchRow key={r.key} icon={r.icon} label={r.title} desc={r.desc} value={!!p[r.key]} onChange={() => apply({ [r.key]: !(qc.getQueryData<Privacy>(KEY) ?? p)[r.key] })} />
          ))}
        </Card>
      ) : (
        <Card>
          <LoadState loading={privacy.isLoading} error={privacy.error ? toUserMessage(privacy.error) : null} onRetry={() => void privacy.refetch()} />
        </Card>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.three, gap: Spacing.four, paddingBottom: Spacing.six },
  form: { padding: 14, gap: Spacing.three },
  rules: { gap: 2 },
  visibility: { padding: 14, gap: 4 },
  label: { fontSize: 15, lineHeight: 21 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
