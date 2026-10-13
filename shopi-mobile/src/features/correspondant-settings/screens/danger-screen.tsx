/**
 * Paramètres › Zone sensible — comme SecDanger du site, d'après les règles
 * du serveur (DangerService) :
 *   · état réel du compte (actif, en pause, suspendu par Shoneya / une
 *     entreprise, en attente de validation) et « Reprendre mon activité »
 *     depuis une pause ;
 *   · pause de l'activité (POST …/danger/suspendre, mot de passe exigé) : vous
 *     n'apparaissez plus aux clients ni aux boutiques, jusqu'à reprise. La
 *     « désactivation 30 jours » du site fait exactement la même chose côté
 *     serveur (aucune reprise automatique n'existe) : pas proposée en double ;
 *   · suppression du compte (DELETE …/danger/supprimer, mot de passe exigé) :
 *     refusée s'il reste des commandes en cours par votre relais ou de l'argent
 *     au portefeuille ; sessions fermées → déconnexion ; données effacées
 *     après 30 jours.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PasswordField, PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { FormCard, Hint, SettingsShell, Sheet, toast, TONE, type IconName, errorMessage } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';

import { deleteAccount, pauseAccount, resumeAccount, type CorrespondantSettings } from '../api';
import { useCorrespondantSettings, useMergeSettings } from '../hooks';

type Action = 'pause' | 'supprimer';

const ACTIONS: Record<Action, { icon: IconName; title: string; sub: string; btn: string; confirm: string }> = {
  pause: {
    icon: 'pause-circle-outline',
    title: 'Mettre mon activité en pause',
    sub: 'Vous n’apparaissez plus aux clients ni aux boutiques. Les colis déjà en cours continuent. Reprenez quand vous voulez depuis ce menu.',
    btn: 'Mettre en pause',
    confirm: 'Votre point relais sera masqué jusqu’à ce que vous repreniez votre activité depuis ce menu.',
  },
  supprimer: {
    icon: 'trash-outline',
    title: 'Supprimer mon compte',
    sub: 'Vous serez déconnecté et ne pourrez plus vous connecter. Vos données personnelles sont effacées définitivement après 30 jours. Impossible s’il reste des commandes en cours par votre relais ou de l’argent dans votre portefeuille.',
    btn: 'Supprimer mon compte',
    confirm: '⚠️ Cette action est définitive : vous ne pourrez plus vous connecter à ce compte.',
  },
};

const STATE: Record<string, { title: string; sub: string; tone: 'success' | 'danger' | 'warning' }> = {
  active: { title: 'Votre activité est en cours', sub: 'Votre point relais est visible des boutiques et des clients.', tone: 'success' },
  disabled: { title: 'Activité en pause', sub: 'Votre point relais est masqué jusqu’à ce que vous repreniez votre activité.', tone: 'warning' },
  suspended: { title: 'Compte suspendu', sub: 'Votre compte a été suspendu par Shoneya ou par une entreprise. Contactez le support pour en savoir plus.', tone: 'danger' },
  pending: { title: 'En attente de validation', sub: 'Votre compte n’a pas encore été validé par Shoneya.', tone: 'warning' },
  deleted: { title: 'Suppression en cours', sub: 'Ce compte est en cours de suppression.', tone: 'danger' },
};

export default function DangerScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings>
      query={q}
      title="Zone sensible"
      icon="warning-outline"
      danger
      subtitle="Mettre votre activité en pause ou supprimer votre compte. Chaque action demande votre mot de passe.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const merge = useMergeSettings();
  const [action, setAction] = useState<Action | null>(null);
  const [resuming, setResuming] = useState(false);

  const st = STATE[d.status] ?? STATE.active;
  const tone = TONE[st.tone];
  const paused = d.status === 'disabled';
  const actions: Action[] = d.status === 'active' ? ['pause', 'supprimer'] : ['supprimer'];

  const resume = async () => {
    setResuming(true);
    try {
      const res = await resumeAccount();
      merge({ status: res.status });
      toast('Activité reprise — vous êtes de nouveau visible');
    } catch (e) {
      toast(errorMessage(e, '') || 'Action impossible — réessayez', 'danger');
    } finally {
      setResuming(false);
    }
  };

  return (
    <>
      <View style={[styles.state, { backgroundColor: tone.bg }]}>
        <Ionicons name={d.status === 'active' ? 'checkmark-circle' : paused ? 'pause-circle' : 'ban'} size={24} color={tone.fg} />
        <View style={styles.flex}>
          <ThemedText style={[styles.stateTitle, { color: tone.fg }]}>{st.title}</ThemedText>
          <ThemedText type="small" style={{ color: tone.fg }}>
            {st.sub}
          </ThemedText>
        </View>
      </View>
      {paused ? <PrimaryButton title="Reprendre mon activité" onPress={() => void resume()} loading={resuming} pill /> : null}

      <FormCard title="Actions sensibles" icon="warning-outline" danger>
        {actions.map((a, i) => (
          <View key={a} style={[styles.action, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <ThemedText style={styles.actionTitle}>{ACTIONS[a].title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ACTIONS[a].sub}
            </ThemedText>
            <Pressable onPress={() => setAction(a)} accessibilityRole="button" accessibilityLabel={ACTIONS[a].btn} style={styles.actionBtn}>
              <Ionicons name={ACTIONS[a].icon} size={16} color={Brand.danger} />
              <ThemedText style={styles.actionBtnText}>{ACTIONS[a].btn}</ThemedText>
            </Pressable>
          </View>
        ))}
      </FormCard>

      {action ? <ConfirmSheet action={action} onClose={() => setAction(null)} onPaused={(status) => merge({ status })} /> : null}
    </>
  );
}

function ConfirmSheet({ action, onClose, onPaused }: { action: Action; onClose: () => void; onPaused: (status: string) => void }) {
  const signOut = useSession((s) => s.signOut);
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = ACTIONS[action];

  const close = () => {
    if (!busy) onClose();
  };

  const confirm = async () => {
    if (!pwd) return setError('Saisissez votre mot de passe pour confirmer');
    setBusy(true);
    setError(null);
    try {
      if (action === 'supprimer') {
        await deleteAccount(pwd);
        toast('Compte supprimé — déconnexion…', 'warning');
        onClose();
        /* sessions déjà fermées côté serveur */
        setTimeout(() => void signOut(), 1500);
        return;
      }
      const res = await pauseAccount(pwd);
      onPaused(res.status);
      toast('Activité mise en pause', 'warning');
      onClose();
    } catch (e) {
      setError(errorMessage(e, '') || 'Action impossible — réessayez');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={a.title} onClose={close}>
      <Hint icon="warning-outline" tone="danger" text={a.confirm} />
      <PasswordField label="Saisissez votre mot de passe pour confirmer" value={pwd} onChangeText={setPwd} placeholder="Votre mot de passe" autoComplete="current-password" autoFocus />
      {error ? <Hint icon="alert-circle" tone="danger" text={error} /> : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <SecondaryButton title="Annuler" onPress={close} disabled={busy} pill />
        </View>
        <Pressable
          onPress={() => void confirm()}
          disabled={busy || !pwd}
          accessibilityRole="button"
          accessibilityLabel="Confirmer"
          style={[styles.flex, styles.dangerBtn, (busy || !pwd) && styles.dim]}>
          {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.dangerText}>Confirmer</ThemedText>}
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  row: { flexDirection: 'row', gap: 10 },
  state: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 16, padding: 14 },
  stateTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  action: { gap: 6, paddingVertical: 10 },
  actionTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 38,
    marginTop: 4,
  },
  actionBtnText: { color: Brand.danger, fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  dangerBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.danger, borderRadius: 999, minHeight: 50 },
  dangerText: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '800' },
});
