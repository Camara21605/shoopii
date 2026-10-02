/**
 * Paramètres › Zone sensible — comme DangerSection du site, réservée au
 * propriétaire, chaque action confirmée par le mot de passe :
 *   · mettre en pause (sans limite) · désactiver 30 jours (réouverture auto) ;
 *   · transférer la gestion (bientôt disponible) ;
 *   · supprimer la boutique et le compte (impossible avec une commande en
 *     cours ou des fonds au portefeuille) → déconnexion.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PasswordField, SecondaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useSession } from '@/features/auth/session-store';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { deleteShop, disableShop, pauseShop, type Settings } from '../api';
import { FormCard, Hint, SettingsShell, toast } from '../components/ui';
import { useSettings, useSettingsAccess } from '../hooks';

type Action = 'pause' | 'disable' | 'delete';

const ACTIONS: { key: Action | 'transfer'; title: string; sub: string; btn: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'pause', title: 'Mettre la boutique en pause', sub: 'Masquez votre boutique sans limite de durée. Vos produits, commandes en cours et données sont conservés.', btn: 'Mettre en pause', icon: 'pause-circle-outline' },
  { key: 'disable', title: 'Désactiver la boutique (30 jours)', sub: 'Votre boutique est masquée pendant 30 jours puis rouvre automatiquement. Vous gardez l’accès à votre compte.', btn: 'Désactiver', icon: 'moon-outline' },
  { key: 'transfer', title: 'Transférer la gestion', sub: 'Transférez la gestion de la boutique à un autre responsable avant de partir.', btn: 'Bientôt disponible', icon: 'swap-horizontal-outline' },
  { key: 'delete', title: 'Supprimer la boutique et le compte', sub: 'Irréversible : la boutique disparaît et vous ne pourrez plus vous connecter. Possible seulement sans commande en cours ni fonds au portefeuille.', btn: 'Supprimer', icon: 'trash-outline' },
];

const MODAL: Record<Action, { title: string; msg: string; btn: string }> = {
  pause: {
    title: 'Mettre la boutique en pause ?',
    msg: 'Votre boutique sera masquée du public et ne recevra plus de commandes. Vous pourrez la rouvrir à tout moment depuis « Boutique & identité ».',
    btn: 'Mettre en pause',
  },
  disable: {
    title: 'Désactiver la boutique pendant 30 jours ?',
    msg: 'Votre boutique sera masquée et ne recevra plus de commandes. Elle rouvrira automatiquement après 30 jours (ou plus tôt, depuis « Boutique & identité »).',
    btn: 'Désactiver',
  },
  delete: {
    title: 'Supprimer la boutique et le compte ?',
    msg: 'Action irréversible. Votre boutique disparaît, vous êtes déconnecté et ne pourrez plus vous connecter. Vos données personnelles sont effacées sous 30 jours ; l’historique des commandes est conservé de façon anonyme pour vos clients.',
    btn: 'Supprimer définitivement',
  },
};

export default function DangerScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Zone sensible" icon="warning-outline" subtitle="Ces actions sont irréversibles ou ont un impact majeur sur votre boutique. Procédez avec précaution." ownerOnly>
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const theme = useTheme();
  const { isOwner } = useSettingsAccess();
  const [confirm, setConfirm] = useState<Action | null>(null);
  const paused = d.status === 'suspended';
  const reopen = paused && d.suspendedUntil ? new Date(d.suspendedUntil) : null;

  return (
    <>
      {!isOwner ? (
        <Hint icon="lock-closed" tone="neutral" text="Réservé au propriétaire de la boutique — les collaborateurs ne peuvent pas mettre en pause, désactiver ou supprimer la boutique." />
      ) : null}
      {paused ? (
        <Hint icon="pause-circle" tone="warning">
          <ThemedText style={styles.stateText}>
            {reopen
              ? `Votre boutique est désactivée : elle rouvrira automatiquement le ${reopen.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.`
              : 'Votre boutique est en pause : elle est masquée et ne reçoit plus de commandes.'}
          </ThemedText>
          {isOwner ? (
            <Pressable onPress={() => router.push('/entreprise/parametres/boutique')} accessibilityRole="button" style={styles.reopen}>
              <ThemedText style={styles.reopenText}>Rouvrir la boutique</ThemedText>
              <Ionicons name="arrow-forward" size={14} color="#B45309" />
            </Pressable>
          ) : null}
        </Hint>
      ) : null}

      <FormCard title="Actions irréversibles" icon="skull-outline" subtitle="Ces opérations ne peuvent pas être annulées" danger>
        {ACTIONS.map((a, i) => {
          const soon = a.key === 'transfer';
          const off = !isOwner || soon;
          return (
            <View key={a.key} style={[styles.action, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={styles.actionTop}>
                <Ionicons name={a.icon} size={20} color={a.key === 'delete' ? Brand.danger : '#B45309'} />
                <ThemedText style={styles.actionTitle}>{a.title}</ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {a.sub}
              </ThemedText>
              <Pressable
                onPress={() => !off && !soon && setConfirm(a.key as Action)}
                disabled={off}
                accessibilityRole="button"
                accessibilityState={{ disabled: off }}
                style={({ pressed }) => [styles.btn, a.key === 'delete' ? styles.btnRed : styles.btnOutline, off && styles.dim, pressed && styles.pressed]}>
                <ThemedText style={[styles.btnText, { color: a.key === 'delete' ? '#fff' : Brand.danger }]}>{a.btn}</ThemedText>
              </Pressable>
            </View>
          );
        })}
      </FormCard>

      {confirm ? <ConfirmSheet action={confirm} onClose={() => setConfirm(null)} /> : null}
    </>
  );
}

function ConfirmSheet({ action, onClose }: { action: Action; onClose: () => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const signOut = useSession((s) => s.signOut);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const m = MODAL[action];

  const submit = async () => {
    if (!password.trim()) return setError('Le mot de passe est obligatoire pour confirmer cette action.');
    setError(null);
    setBusy(true);
    try {
      if (action === 'pause') {
        await pauseShop(password);
        toast('Boutique mise en pause');
      } else if (action === 'disable') {
        await disableShop(password);
        toast('Boutique désactivée pour 30 jours');
      } else {
        await deleteShop(password);
        toast('Boutique et compte supprimés. Déconnexion…');
        onClose();
        setTimeout(() => void signOut(), 1200);
        return;
      }
      await Promise.all([qc.invalidateQueries({ queryKey: qk.company.settings }), qc.invalidateQueries({ queryKey: qk.company.identity })]);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      const orders = /(\d+) commande/.exec(msg);
      if (/incorrect|refusée/i.test(msg)) setError('Mot de passe incorrect. Veuillez réessayer.');
      else if (orders) {
        const n = Number(orders[1]);
        setError(n > 1 ? `Impossible : ${n} commandes sont encore en cours ou en litige. Attendez qu’elles soient terminées.` : 'Impossible : 1 commande est encore en cours ou en litige. Attendez qu’elle soit terminée.');
      } else if (msg.includes('portefeuille')) setError('Impossible : votre portefeuille contient encore des fonds. Retirez-les d’abord.');
      else {
        toast('Opération impossible. Vérifiez votre connexion.', 'warning');
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <Pressable style={styles.backdrop} onPress={() => !busy && onClose()} accessibilityLabel="Fermer" />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetIco}>
            <Ionicons name="warning" size={26} color={Brand.danger} />
          </View>
          <ThemedText style={styles.sheetTitle}>{m.title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {m.msg}
          </ThemedText>
          <PasswordField label="Confirmez avec votre mot de passe" value={password} onChangeText={setPassword} placeholder="••••••••" error={error} />
          <Pressable onPress={() => void submit()} disabled={busy} accessibilityRole="button" style={[styles.btn, styles.btnRed, styles.big, busy && styles.dim]}>
            {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={[styles.btnText, { color: '#fff' }]}>{m.btn}</ThemedText>}
          </Pressable>
          <SecondaryButton title="Annuler" onPress={onClose} disabled={busy} pill />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  center: { textAlign: 'center' },
  stateText: { color: '#B45309', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  reopen: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  reopenText: { color: '#B45309', fontSize: 13.5, lineHeight: 18, fontWeight: '900', textDecorationLine: 'underline' },
  action: { paddingVertical: 10, gap: 6 },
  actionTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionTitle: { flex: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  btn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 16, minHeight: 38, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  big: { alignSelf: 'stretch', minHeight: 50 },
  btnRed: { backgroundColor: Brand.danger },
  btnOutline: { borderWidth: 1.5, borderColor: Brand.danger },
  btnText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetBody: { padding: 20, gap: 14 },
  sheetIco: { alignSelf: 'center', width: 54, height: 54, borderRadius: 27, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
});
