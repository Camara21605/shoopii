/**
 * Paramètres › Zone sensible — comme SecDanger du site :
 *   · état réel du compte (actif, en pause, désactivé 30 jours, suspendu, bloqué)
 *     et « Reprendre mon activité » depuis une pause / désactivation ;
 *   · pause (jusqu'à reprise), désactivation 30 jours (reprise automatique),
 *     suppression du compte — chaque action demande le mot de passe (limite :
 *     5 essais / 15 min) ; pause et désactivation seulement depuis un compte actif ;
 *   · suppression refusée par le serveur s'il reste des livraisons en cours ou de
 *     l'argent au portefeuille ; après suppression → déconnexion (sessions fermées).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PasswordField, PrimaryButton, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import { deactivateAccount, deleteAccount, fetchDanger, pauseAccount, resumeAccount, type DangerState } from '../api';
import { FormCard, Hint, SettingsShell, Sheet, toast, TONE, type IconName } from '../components/ui';

type Action = 'pause' | 'desactiver' | 'supprimer';

const ACTIONS: Record<Action, { icon: IconName; title: string; sub: string; btn: string; confirm: string }> = {
  pause: {
    icon: 'pause-circle-outline',
    title: 'Mettre mon activité en pause',
    sub: 'Vous êtes masqué et ne recevez plus de nouvelles livraisons. Les livraisons déjà acceptées continuent. Reprenez quand vous voulez.',
    btn: 'Mettre en pause',
    confirm: 'Votre activité sera mise en pause jusqu’à ce que vous la repreniez depuis ce menu.',
  },
  desactiver: {
    icon: 'moon-outline',
    title: 'Désactiver pendant 30 jours',
    sub: 'Comme la pause, avec une reprise automatique au bout de 30 jours. Vous pouvez reprendre plus tôt.',
    btn: 'Désactiver',
    confirm: 'Votre activité sera suspendue pendant 30 jours, puis reprendra automatiquement.',
  },
  supprimer: {
    icon: 'trash-outline',
    title: 'Supprimer mon compte',
    sub: 'Vous serez déconnecté et ne pourrez plus vous connecter. Vos données personnelles et vos pièces justificatives sont effacées définitivement après 30 jours. Impossible s’il vous reste des livraisons en cours ou de l’argent dans votre portefeuille.',
    btn: 'Supprimer mon compte',
    confirm: '⚠️ Cette action est définitive : vous ne pourrez plus vous connecter à ce compte. L’historique des livraisons est conservé de façon anonyme.',
  },
};

const STATE: Record<DangerState['etat'], { title: string; sub: string }> = {
  actif: {
    title: 'Votre activité est en cours',
    sub: 'Vous apparaissez aux boutiques et aux clients et pouvez recevoir des livraisons.',
  },
  pause: {
    title: 'Activité en pause',
    sub: 'Vous êtes masqué et ne recevez plus de nouvelles livraisons, jusqu’à ce que vous repreniez.',
  },
  desactive: {
    title: 'Compte désactivé',
    sub: 'Vous êtes masqué et ne recevez plus de nouvelles livraisons. Reprise automatique le {date} — ou dès maintenant.',
  },
  suspendu: {
    title: 'Compte suspendu',
    sub: 'Votre compte a été suspendu par votre entreprise ou par Shoneya. Contactez-les pour en savoir plus.',
  },
  banni: {
    title: 'Compte bloqué',
    sub: 'Votre compte a été bloqué par Shoneya. Contactez le support pour en savoir plus.',
  },
};

const dateFr = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

export default function DangerScreen() {
  const q = useQuery({ queryKey: qk.livreur.danger, queryFn: fetchDanger });
  return (
    <SettingsShell
      title="Zone sensible"
      icon="warning-outline"
      danger
      subtitle="Mettre votre activité en pause ou supprimer votre compte. Chaque action demande votre mot de passe."
      query={q}
      loadingText="Chargement de l’état de votre compte…">
      {(etat) => <Content etat={etat} />}
    </SettingsShell>
  );
}

function Content({ etat }: { etat: DangerState }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const [resuming, setResuming] = useState(false);

  const paused = etat.etat === 'pause' || etat.etat === 'desactive';
  const blocked = etat.etat === 'suspendu' || etat.etat === 'banni';
  /* pause / désactivation : seulement depuis un compte en activité */
  const actions: Action[] = paused || blocked ? ['supprimer'] : ['pause', 'desactiver', 'supprimer'];
  const st = STATE[etat.etat];
  const tone = etat.etat === 'actif' ? TONE.success : TONE.danger;

  const applied = (res: DangerState) => {
    qc.setQueryData(qk.livreur.danger, res);
    /* Visibilité / missions changent : les écrans livreur se rafraîchissent */
    void qc.invalidateQueries({ queryKey: qk.livreur.missions });
  };

  const resume = async () => {
    setResuming(true);
    try {
      applied(await resumeAccount());
      toast('Activité reprise — vous êtes de nouveau visible');
    } catch (e) {
      toast(toUserMessage(e) || 'Action impossible — réessayez', 'danger');
    } finally {
      setResuming(false);
    }
  };

  return (
    <>
      <View style={[styles.state, { backgroundColor: tone.bg }]}>
        <Ionicons name={etat.etat === 'actif' ? 'checkmark-circle' : paused ? 'pause-circle' : 'ban'} size={24} color={tone.fg} />
        <View style={styles.flex}>
          <ThemedText style={[styles.stateTitle, { color: tone.fg }]}>{st.title}</ThemedText>
          <ThemedText type="small" style={{ color: tone.fg }}>
            {st.sub.replace('{date}', dateFr(etat.jusquau))}
          </ThemedText>
        </View>
      </View>
      {paused ? <PrimaryButton title="Reprendre mon activité" onPress={() => void resume()} loading={resuming} pill /> : null}

      <FormCard title="Actions sensibles" icon="warning-outline" danger>
        {actions.map((a, i) => (
          <View
            key={a}
            style={[
              styles.action,
              i > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: theme.border,
              },
            ]}>
            <ThemedText style={styles.actionTitle}>{ACTIONS[a].title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {ACTIONS[a].sub}
            </ThemedText>
            <Pressable onPress={() => setAction(a)} accessibilityRole="button" style={styles.actionBtn}>
              <Ionicons name={ACTIONS[a].icon} size={16} color={Brand.danger} />
              <ThemedText style={styles.actionBtnText}>{ACTIONS[a].btn}</ThemedText>
            </Pressable>
          </View>
        ))}
      </FormCard>

      {action ? <ConfirmSheet action={action} onClose={() => setAction(null)} onDone={applied} /> : null}
    </>
  );
}

function ConfirmSheet({ action, onClose, onDone }: { action: Action; onClose: () => void; onDone: (r: DangerState) => void }) {
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
      const res = action === 'pause' ? await pauseAccount(pwd) : await deactivateAccount(pwd);
      onDone(res);
      toast(action === 'pause' ? 'Activité mise en pause' : 'Compte désactivé pour 30 jours', 'warning');
      onClose();
    } catch (e) {
      setError(toUserMessage(e) || 'Action impossible — réessayez');
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
        <Pressable onPress={() => void confirm()} disabled={busy || !pwd} accessibilityRole="button" style={[styles.flex, styles.dangerBtn, (busy || !pwd) && styles.dim]}>
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
  state: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
  },
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
  actionBtnText: {
    color: Brand.danger,
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '800',
  },
  dangerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
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
});
