/**
 * src/features/calls/ongoing-call.tsx
 *
 * Appel EN COURS quand on quitte l'écran d'appel — comme WhatsApp :
 *   - bouton Retour (ou « ⌄ Réduire ») sur l'écran d'appel → l'appel continue,
 *     l'application redevient utilisable et un BANDEAU VERT « Appel en cours ·
 *     02:13 » reste en haut de l'écran : le toucher ramène l'écran d'appel ;
 *   - bouton Accueil / autre application → l'appel continue en arrière-plan,
 *     la notification « Appel en cours » (service natif OngoingCallService,
 *     micro et caméra gardés) le montre dans la barre d'état : la toucher
 *     rouvre l'application sur l'écran d'appel, « Raccrocher » termine l'appel.
 * Vaut pour l'appel 1:1 (call-store) et l'appel de groupe (group-call-store).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { ThemedText } from '@/components/themed-text';

import { startOngoingCall, stopOngoingCall } from '../../../modules/shopi-calls';
import { hangUp, useCallStore } from './call-store';
import { leaveGroupCall, useGroupCallStore } from './group-call-store';

/* ── Écran d'appel réduit (l'appel continue derrière l'application) ── */

export const useCallUi = create<{ minimized: boolean }>(() => ({ minimized: false }));
export const minimizeCall = () => useCallUi.setState({ minimized: true });
export const restoreCall = () => useCallUi.setState({ minimized: false });

/** « Raccrocher » depuis la notification ou le bandeau : quel que soit l'appel en cours. */
export function hangUpAny() {
  if (useGroupCallStore.getState().status !== 'idle') leaveGroupCall();
  else if (useCallStore.getState().status !== 'idle') hangUp();
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, '0')}`;
}

/** Ce qui décrit l'appel en cours, 1:1 ou groupe (null s'il n'y en a pas ou s'il sonne encore). */
function useActiveCall() {
  const status = useCallStore((s) => s.status);
  const info = useCallStore((s) => s.callInfo);
  const video = useCallStore((s) => s.videoEnabled && s.callInfo?.callType === 'video');
  const duration = useCallStore((s) => s.durationSec);
  const gStatus = useGroupCallStore((s) => s.status);
  const gName = useGroupCallStore((s) => s.groupName);
  const gVideo = useGroupCallStore((s) => s.videoEnabled);
  const gDuration = useGroupCallStore((s) => s.durationSec);
  const gOutgoing = useGroupCallStore((s) => s.outgoing);

  if (gStatus === 'joining' || gStatus === 'connected') {
    return {
      name: gName || 'Appel de groupe', video: gVideo, connected: gStatus === 'connected', duration: gDuration,
      status: gOutgoing ? 'Ça sonne chez les membres…' : 'Connexion…',
    };
  }
  if (info && (status === 'calling' || status === 'connecting' || status === 'connected' || status === 'reconnecting')) {
    return {
      name: info.remoteName, video, connected: status === 'connected' || status === 'reconnecting', duration,
      status: status === 'calling' ? 'Ça sonne…' : status === 'reconnecting' ? 'Reconnexion…' : 'Connexion…',
    };
  }
  return null;
}

/**
 * Tient la notification native « Appel en cours » à jour : démarrée dès que
 * l'appel part / est décroché (Android n'autorise le micro en arrière-plan
 * que si le service démarre application ouverte), mise à jour à la connexion
 * et au passage en vidéo, arrêtée à la fin de l'appel.
 */
export function useOngoingCallSync() {
  const call = useActiveCall();
  const connectedAt = useRef(0);
  const key = call ? `${call.name}|${call.video}|${call.connected}|${call.status}` : '';

  useEffect(() => {
    if (!call) {
      connectedAt.current = 0;
      stopOngoingCall();
      restoreCall();
      return;
    }
    if (call.connected && !connectedAt.current) connectedAt.current = Date.now() - call.duration * 1000;
    if (!call.connected) connectedAt.current = 0;
    startOngoingCall(call.name, call.video, connectedAt.current, call.status);
    // Seuls les changements d'état comptent (pas chaque seconde du chronomètre).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Bandeau vert en haut de l'application pendant un appel réduit. */
export function OngoingCallBar() {
  const insets = useSafeAreaInsets();
  const minimized = useCallUi((s) => s.minimized);
  const call = useActiveCall();
  if (!minimized || !call) return null;
  return (
    <View style={[styles.wrap, { paddingTop: insets.top }]} pointerEvents="box-none">
      <Pressable
        onPress={restoreCall}
        accessibilityRole="button"
        accessibilityLabel={`Appel en cours avec ${call.name}. Toucher pour revenir à l’appel`}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
        <Ionicons name={call.video ? 'videocam' : 'call'} size={16} color="#fff" />
        <ThemedText numberOfLines={1} style={styles.text}>
          {call.name} · {call.connected ? fmt(call.duration) : call.status}
        </ThemedText>
        <ThemedText style={styles.back}>Revenir</ThemedText>
        <Pressable onPress={hangUpAny} hitSlop={10} accessibilityRole="button" accessibilityLabel="Raccrocher" style={styles.hang}>
          <Ionicons name="call" size={15} color="#fff" style={styles.rotate} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, elevation: 1000 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 9 },
  pressed: { opacity: 0.9 },
  text: { flex: 1, color: '#fff', fontSize: 14, lineHeight: 19, fontWeight: '700', fontVariant: ['tabular-nums'] },
  back: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800', textDecorationLine: 'underline' },
  hang: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  rotate: { transform: [{ rotate: '135deg' }] },
});

/** À monter une fois (CallProvider) : synchronise la notification sans re-rendre tout l'écran d'appel chaque seconde. */
export function OngoingCallSync() {
  useOngoingCallSync();
  return null;
}
